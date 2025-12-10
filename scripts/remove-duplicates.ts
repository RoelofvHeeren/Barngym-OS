
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching transactions for deduplication...');
    const transactions = await prisma.transaction.findMany({
        orderBy: { occurredAt: 'desc' },
    });

    const totalRevenueBefore = transactions.reduce((sum, tx) => sum + (tx.status !== 'Failed' ? tx.amountMinor : 0), 0);
    console.log(`Total Revenue Before: £${(totalRevenueBefore / 100).toLocaleString()}`);

    const map = new Map<string, typeof transactions>();
    const idsToDelete: string[] = [];

    for (const tx of transactions) {
        const key = `${tx.provider}-${tx.amountMinor}-${tx.occurredAt.toISOString()}`;

        if (!map.has(key)) {
            map.set(key, []);
        } else {
            // If key exists, this is a duplicate. Add to delete list.
            // We keep the first one encountered (which is effectively arbitrary or based on sort order, but fine for identicals)
            idsToDelete.push(tx.id);
        }
        map.get(key)?.push(tx);
    }

    console.log(`Found ${idsToDelete.length} duplicate transactions to delete.`);

    if (idsToDelete.length > 0) {
        console.log('Deleting duplicates...');
        const result = await prisma.transaction.deleteMany({
            where: {
                id: {
                    in: idsToDelete,
                },
            },
        });
        console.log(`Successfully deleted ${result.count} transactions.`);
    } else {
        console.log('No duplicates found to delete.');
    }

    // Recalculate
    const remainingTransactions = await prisma.transaction.findMany();
    const totalRevenueAfter = remainingTransactions.reduce((sum, tx) => sum + (tx.status !== 'Failed' ? tx.amountMinor : 0), 0);

    console.log(`Total Revenue After: £${(totalRevenueAfter / 100).toLocaleString()}`);
    console.log(`Difference: £${((totalRevenueBefore - totalRevenueAfter) / 100).toLocaleString()}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
