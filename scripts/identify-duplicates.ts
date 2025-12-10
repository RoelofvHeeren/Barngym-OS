
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching transactions...');
    const transactions = await prisma.transaction.findMany({
        orderBy: { occurredAt: 'desc' },
    });

    console.log(`Scanned ${transactions.length} transactions.`);

    const map = new Map<string, typeof transactions>();

    for (const tx of transactions) {
        // Create a unique key for potential duplicates
        // precise timestamp + amount + provider should be very unique.
        // We can also include personName if we want to be extra safe, or productType.
        const key = `${tx.provider}-${tx.amountMinor}-${tx.occurredAt.toISOString()}`;

        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)?.push(tx);
    }

    let duplicateGroups = 0;
    let duplicateCount = 0;

    console.log('\n--- POTENTIAL DUPLICATES ---\n');

    for (const [key, group] of map.entries()) {
        if (group.length > 1) {
            duplicateGroups++;
            duplicateCount += group.length - 1; // The extras are duplicates

            console.log(`Group: ${key} (Count: ${group.length})`);
            group.forEach(tx => {
                console.log(`  - ID: ${tx.id} | Status: ${tx.status} | Person: ${tx.personName || 'N/A'} | Ref: ${tx.reference || 'N/A'}`);
            });
            console.log('---------------------------------------------------');
        }
    }

    console.log(`\nFound ${duplicateGroups} groups of duplicates.`);
    console.log(`Total redundant transactions found: ${duplicateCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
