#!/usr/bin/env node
/**
 * Delete all Starling transactions from the database
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting Starling transaction deletion...');

    // First, delete all manual match queue entries for Starling transactions
    const starlingTxIds = await prisma.transaction.findMany({
        where: {
            provider: {
                equals: 'starling',
                mode: 'insensitive'
            }
        },
        select: { id: true }
    });

    const txIds = starlingTxIds.map(tx => tx.id);
    console.log(`Found ${txIds.length} Starling transactions`);

    if (txIds.length > 0) {
        // Delete manual match queue entries
        const deletedQueue = await prisma.manualMatchQueue.deleteMany({
            where: {
                transactionId: { in: txIds }
            }
        });
        console.log(`Deleted ${deletedQueue.count} manual match queue entries`);

        // Delete the transactions
        const deletedTx = await prisma.transaction.deleteMany({
            where: {
                provider: {
                    equals: 'starling',
                    mode: 'insensitive'
                }
            }
        });
        console.log(`✓ Deleted ${deletedTx.count} Starling transactions`);
    } else {
        console.log('No Starling transactions found');
    }
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
