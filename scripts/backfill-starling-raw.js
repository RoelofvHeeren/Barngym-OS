#!/usr/bin/env node
/**
 * Backfill raw data for existing Starling transactions
 * This populates the raw field with counterPartyName from personName
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting Starling transaction backfill...');

    const starlingTxs = await prisma.transaction.findMany({
        where: {
            provider: {
                equals: 'starling',
                mode: 'insensitive'
            }
        },
        select: {
            id: true,
            personName: true,
            reference: true,
            description: true,
            metadata: true,
            raw: true,
        }
    });

    // Filter in JS for those without raw data
    const needsBackfill = starlingTxs.filter(tx => !tx.raw || tx.raw === null);

    console.log(`Found ${needsBackfill.length} Starling transactions without raw data (out of ${starlingTxs.length} total)`);

    let updated = 0;
    for (const tx of needsBackfill) {
        const rawData = {
            counterPartyName: tx.personName || tx.reference || 'Unknown',
            reference: tx.reference,
            description: tx.description,
            // Preserve any existing metadata
            ...(tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {})
        };

        await prisma.transaction.update({
            where: { id: tx.id },
            data: { raw: rawData }
        });

        updated++;
        if (updated % 50 === 0) {
            console.log(`Progress: ${updated}/${needsBackfill.length}`);
        }
    }

    console.log(`✓ Backfilled ${updated} Starling transactions`);
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
