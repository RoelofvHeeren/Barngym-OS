
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('--- Latest SyncLogs (Glofox) ---');
    const logs = await prisma.syncLog.findMany({
        where: { source: 'Glofox' },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log(logs);

    console.log('\n--- Latest Transactions (Glofox) ---');
    const txs = await prisma.transaction.findMany({
        where: { provider: 'Glofox' },
        orderBy: { occurredAt: 'desc' },
        take: 5,
        select: {
            id: true,
            externalId: true,
            occurredAt: true,
            amountMinor: true,
            personName: true
        }
    });
    console.log(txs);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
