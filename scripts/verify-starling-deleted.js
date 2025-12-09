#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.transaction.count({
        where: {
            provider: {
                equals: 'starling',
                mode: 'insensitive'
            }
        }
    });

    console.log(`Starling transactions in database: ${count}`);

    const queueCount = await prisma.manualMatchQueue.count({
        where: {
            transaction: {
                provider: {
                    equals: 'starling',
                    mode: 'insensitive'
                }
            }
        }
    });

    console.log(`Starling manual match queue entries: ${queueCount}`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
