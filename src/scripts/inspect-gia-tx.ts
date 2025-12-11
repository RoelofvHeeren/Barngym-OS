import { prisma } from '@/lib/prisma';

async function main() {
    const txId = 'cmiwraeda006fuqrwplsumz93'; // From previous log

    const tx = await prisma.transaction.findUnique({
        where: { id: txId }
    });

    if (tx) {
        console.log('--- DB Transaction ---');
        console.log(`Internal ID: ${tx.id}`);
        console.log(`External ID: ${tx.externalId}`);
        console.log(`Amount Minor: ${tx.amountMinor} (pennies)`);
        console.log(`Currency: ${tx.currency}`);
        console.log(`Description: ${tx.description}`);
        console.log(`Reference: ${tx.reference}`);
        console.log(`Source: ${tx.source}`);
        console.log(`Date: ${tx.occurredAt.toISOString()}`);
    } else {
        console.log('Transaction not found');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
