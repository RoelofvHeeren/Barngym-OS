#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const samples = await prisma.transaction.findMany({
        where: {
            provider: {
                equals: 'starling',
                mode: 'insensitive'
            }
        },
        orderBy: { occurredAt: 'desc' },
        take: 5,
        select: {
            id: true,
            occurredAt: true,
            personName: true,
            reference: true,
            amountMinor: true,
        }
    });

    console.log('Sample Starling transactions with timestamps:');
    samples.forEach((tx, i) => {
        console.log(`\n${i + 1}. ${tx.personName || 'Unknown'}`);
        console.log(`   Date: ${tx.occurredAt.toISOString()}`);
        console.log(`   Amount: £${(tx.amountMinor / 100).toFixed(2)}`);
        console.log(`   Ref: ${tx.reference || '—'}`);
    });

    const count = await prisma.transaction.count({
        where: {
            provider: { equals: 'starling', mode: 'insensitive' }
        }
    });
    console.log(`\nTotal Starling transactions: ${count}`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
