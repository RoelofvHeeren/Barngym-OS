const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRevenue() {
    try {
        const transactions = await prisma.transaction.findMany({
            where: {
                status: { not: 'Failed' },
                occurredAt: { gte: new Date('2023-01-01') } // Approx 3 years
            },
            select: { amountMinor: true, occurredAt: true }
        });

        const total = transactions.reduce((sum, t) => sum + (t.amountMinor || 0), 0);
        const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(total / 100);

        console.log(`Transactions: ${transactions.length}`);
        console.log(`Total Revenue: ${gbp}`);
        console.log(`Earliest: ${transactions[transactions.length - 1]?.occurredAt}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkRevenue();
