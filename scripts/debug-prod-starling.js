#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sample = await prisma.transaction.findFirst({
        where: {
            provider: {
                contains: 'starling',
                mode: 'insensitive'
            }
        },
        select: {
            id: true,
            provider: true,
            personName: true,
            reference: true,
            raw: true,
        }
    });

    console.log('Sample Starling transaction:');
    console.log('ID:', sample?.id);
    console.log('Provider:', sample?.provider);
    console.log('PersonName:', sample?.personName);
    console.log('Reference:', sample?.reference);
    console.log('Raw:', JSON.stringify(sample?.raw, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
