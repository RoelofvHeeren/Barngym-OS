import { prisma } from '../src/lib/prisma';
import { calculateLtvFromTransactions } from '../src/utils/calculateLTV';

async function deleteSuspicious() {
    console.log('Identifying suspicious £1.13 transactions...');

    // The 113 cents transactions we found
    const suspicious = await prisma.transaction.findMany({
        where: {
            amountMinor: 113
        },
        include: {
            contact: true
        }
    });

    if (suspicious.length === 0) {
        console.log('No £1.13 transactions found.');
        return;
    }

    console.log(`Found ${suspicious.length} transactions to delete:`);

    const contactIdsToRecalc = new Set<string>();

    for (const tx of suspicious) {
        console.log(`- Deleting Tx ${tx.id} | ${tx.occurredAt.toISOString().split('T')[0]} | £${tx.amountMinor / 100} | ${tx.contact?.email}`);
        if (tx.contactId) {
            contactIdsToRecalc.add(tx.contactId);
        }

        // Perform deletion
        await prisma.transaction.delete({
            where: { id: tx.id }
        });
    }

    console.log('\nRecalculating LTV for affected contacts...');
    for (const contactId of contactIdsToRecalc) {
        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { transactions: true }
        });

        if (contact) {
            const newLtv = calculateLtvFromTransactions(contact.transactions);
            await prisma.contact.update({
                where: { id: contactId },
                data: { ltvAllCents: newLtv }
            });
            console.log(`Updated LTV for ${contact.email} -> £${(newLtv / 100).toFixed(2)}`);
        }
    }
}

deleteSuspicious()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
