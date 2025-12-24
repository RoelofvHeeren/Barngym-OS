import { prisma } from '../src/lib/prisma';

async function scanSuspicious() {
    console.log('Scanning for suspicious low-value transactions...');

    // 1. Find all transactions <= 200 cents (£2.00)
    const lowValueTxs = await prisma.transaction.findMany({
        where: {
            amountMinor: { lte: 200, gt: 0 }
        },
        include: {
            contact: { select: { email: true, fullName: true } }
        },
        orderBy: { amountMinor: 'asc' }
    });

    console.log(`Found ${lowValueTxs.length} transactions <= £2.00`);

    // Group by amount
    const byAmount: Record<number, number> = {};
    lowValueTxs.forEach(t => {
        byAmount[t.amountMinor] = (byAmount[t.amountMinor] || 0) + 1;
    });

    console.log('\nDistribution by Amount (Cents):');
    Object.entries(byAmount)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .forEach(([amt, count]) => {
            console.log(`  ${amt} cents (£${(Number(amt) / 100).toFixed(2)}): ${count} txs`);
        });

    // Specifically check for 113 cents
    const tx113 = lowValueTxs.filter(t => t.amountMinor === 113);
    if (tx113.length > 0) {
        console.log(`\nSpecific check for 113 cents (${tx113.length} txs):`);
        tx113.forEach(t => {
            console.log(`  - ${t.occurredAt.toISOString().split('T')[0]} | ${t.provider} | ${t.productType} | ${t.contact?.email}`);
        });
    }

    // Check 0-value transactions just in case
    const zeroValue = await prisma.transaction.count({ where: { amountMinor: 0 } });
    console.log(`\nTotal 0-value transactions: ${zeroValue}`);
}

scanSuspicious()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
