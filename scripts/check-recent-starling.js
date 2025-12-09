#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const recent = await prisma.transaction.findMany({
        where: {
            provider: {
                contains: 'starling',
                mode: 'insensitive'
            }
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
            id: true,
            provider: true,
            personName: true,
            reference: true,
            raw: true,
            updatedAt: true,
        }
    });

    console.log('Recently updated Starling transactions:');
    recent.forEach((tx, i) => {
        console.log(`\n--- Transaction ${i + 1} ---`);
        console.log('ID:', tx.id);
        console.log('Updated:', tx.updatedAt);
        console.log('PersonName:', tx.personName);
        console.log('Reference:', tx.reference);
        if (tx.raw && typeof tx.raw === 'object') {
            console.log('Raw counterPartyName:', tx.raw.counterPartyName);
        }
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
