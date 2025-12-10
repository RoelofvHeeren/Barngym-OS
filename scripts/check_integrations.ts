import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('--- Configured Integrations ---\n');

    const connections = await prisma.connectionSecret.findMany({
        select: {
            provider: true,
            secret: true,
            createdAt: true,
            updatedAt: true
        }
    });

    for (const conn of connections) {
        console.log(`Provider: ${conn.provider}`);
        console.log(`Created: ${conn.createdAt}`);
        console.log(`Updated: ${conn.updatedAt}`);

        // Show which keys are configured (without revealing values)
        const secret = conn.secret as Record<string, unknown>;
        const keys = Object.keys(secret || {});
        console.log(`Configured keys: ${keys.join(', ') || 'none'}`);
        console.log('---');
    }

    console.log('\n--- Recent Sync Logs ---\n');
    const logs = await prisma.syncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
            source: true,
            detail: true,
            createdAt: true
        }
    });

    for (const log of logs) {
        console.log(`[${log.createdAt.toISOString()}] ${log.source}: ${log.detail}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
