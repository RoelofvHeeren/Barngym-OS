import { prisma } from '../src/lib/prisma';
import { calculateLtvFromTransactions } from '../src/utils/calculateLTV';
import { writeFile } from 'fs/promises';
import path from 'path';

/**
 * Recalculate Contact LTV Script
 * 
 * Iterates through all Contacts, sums their successful transactions,
 * and updates the `ltvAllCents` field.
 * 
 * Usage: npx tsx scripts/recalc-contact-ltv.ts [--execute]
 */

async function recalcContactLtv() {
    const execute = process.argv.includes('--execute');
    console.log('\n' + '='.repeat(70));
    console.log(`Recalculating Contact LTV ${execute ? '(LIVE EXECUTION)' : '(DRY RUN)'}`);
    console.log('='.repeat(70) + '\n');

    // 1. Fetch all contacts with transactions
    console.log('Fetching contacts and transactions...');
    const contacts = await prisma.contact.findMany({
        include: {
            transactions: {
                select: {
                    amountMinor: true,
                    status: true,
                    productType: true,
                    provider: true
                }
            }
        }
    });

    console.log(`Found ${contacts.length} contacts.`);

    let updatedCount = 0;
    let skippedCount = 0;
    let totalLtvDelta = 0;
    const updates: any[] = [];

    // 2. Process each contact
    for (const contact of contacts) {
        const oldLtv = contact.ltvAllCents;
        const newLtv = calculateLtvFromTransactions(contact.transactions);

        if (oldLtv !== newLtv) {
            updatedCount++;
            totalLtvDelta += (newLtv - oldLtv);

            updates.push({
                email: contact.email,
                old: oldLtv,
                new: newLtv,
                diff: newLtv - oldLtv,
                txCount: contact.transactions.length
            });

            if (execute) {
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { ltvAllCents: newLtv }
                });
            }
        } else {
            skippedCount++;
        }

        if (updates.length > 0 && updates.length % 50 === 0) {
            process.stdout.write(`\rProcessed discrepancies: ${updates.length}...`);
        }
    }

    console.log(`\n\nProcessed all contacts.`);

    // 3. Summary
    console.log('\n' + '='.repeat(70));
    console.log('Summary');
    console.log('='.repeat(70));
    console.log(`Total Contacts:      ${contacts.length}`);
    console.log(`Need Update:         ${updatedCount}`);
    console.log(`Up to Date:          ${skippedCount}`);
    console.log(`Total LTV Impact:    ${totalLtvDelta > 0 ? '+' : ''}${(totalLtvDelta / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}`);
    console.log('='.repeat(70));

    if (updates.length > 0) {
        console.log('\nTop 10 Changes:');
        updates
            .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
            .slice(0, 10)
            .forEach(u => {
                console.log(`  ${u.email?.padEnd(30)}: ${(u.old / 100).toFixed(2)} -> ${(u.new / 100).toFixed(2)} (${(u.diff / 100).toFixed(2)}) [${u.txCount} txs]`);
            });

        // Save full report
        if (!execute) {
            const reportPath = path.join(process.cwd(), 'reports', `ltv-recalc-dryrun-${new Date().toISOString().split('T')[0]}.json`);
            await writeFile(reportPath, JSON.stringify(updates, null, 2));
            console.log(`\nDetailed report saved to: ${reportPath}`);
            console.log(`\nRun with --execute to apply these changes.`);
        } else {
            console.log(`\n✅ Database updated successfully.`);
        }
    } else {
        console.log('\n✅ All LTVs are already satisfyingly correct!');
    }
}

recalcContactLtv()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
