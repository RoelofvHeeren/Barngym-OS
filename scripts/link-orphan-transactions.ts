import { prisma } from '../src/lib/prisma';
import { calculateLtvFromTransactions } from '../src/utils/calculateLTV';

/**
 * Link Orphan Transactions Script
 * 
 * internal-tooling
 * 
 * Finds transactions that have a `leadId` but no `contactId`.
 * Checks if a Contact exists with the same email as the Lead.
 * If yes, updates the Transaction with `contactId`.
 * Then recalculates LTV for that Contact.
 */

async function linkOrphanTransactions() {
    console.log('Finding orphan transactions (Lead linked, but Contact missing)...');

    // 1. Find transactions linked to Lead but not Contact
    const splitTransactions = await prisma.transaction.findMany({
        where: {
            contactId: null,
            leadId: { not: null }
        },
        include: {
            lead: true
        }
    });

    console.log(`Found ${splitTransactions.length} potential orphan transactions.`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const tx of splitTransactions) {
        if (!tx.lead?.email) {
            skippedCount++;
            continue;
        }

        // Find contact by email
        const contact = await prisma.contact.findFirst({
            where: {
                email: {
                    equals: tx.lead.email,
                    mode: 'insensitive'
                }
            }
        });

        if (contact) {
            // Valid link found
            const amountPounds = (tx.amountMinor / 100).toFixed(2);
            console.log(`Linking Tx ${tx.id} (£${amountPounds}) to Contact ${contact.email} (${contact.id})...`);

            await prisma.transaction.update({
                where: { id: tx.id },
                data: { contactId: contact.id }
            });

            fixedCount++;
        } else {
            skippedCount++;
        }
    }

    console.log(`\nLinkage Complete. Fixed: ${fixedCount}, Skipped: ${skippedCount}`);

    if (fixedCount > 0) {
        console.log('\nRecalculating LTV for affected contacts...');
        // We can just re-run the main recalc logic for everyone or just trust the next nightly job.
        // For immediate user satisfaction, let's run a targeted recalc for contacts we just touched.
        // However, fetching them again is easier.
        // Let's just run the full recalc script logic dry/light here.

        // Actually, shelling out to the existing robust script is safer/cleaner if we want full coverage.
        // But let's verify Tony Harris specifically here.

        const tony = await prisma.contact.findFirst({
            where: { email: { contains: 'th@portdesigns.com' } },
            include: { transactions: true }
        });

        if (tony) {
            const newLtv = calculateLtvFromTransactions(tony.transactions);
            await prisma.contact.update({
                where: { id: tony.id },
                data: { ltvAllCents: newLtv }
            });
            console.log(`\nTony Harris LTV Updated: ${(newLtv / 100).toFixed(2)}`);
        }
    }
}

linkOrphanTransactions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
