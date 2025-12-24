
import { prisma } from '@/lib/prisma';

async function debugRanges() {
    console.log("--- AdsSpend Ranges by Source ---");
    const sources = await prisma.adsSpend.groupBy({
        by: ['source'],
    });

    for (const s of sources) {
        const minMax = await prisma.adsSpend.aggregate({
            where: { source: s.source },
            _min: { periodStart: true },
            _max: { periodEnd: true },
            _sum: { amountCents: true }
        });
        console.log(`Source: "${s.source}"`);
        console.log(`  Start: ${minMax._min.periodStart?.toISOString().split('T')[0]}`);
        console.log(`  End:   ${minMax._max.periodEnd?.toISOString().split('T')[0]}`);
        console.log(`  Total: £${(minMax._sum.amountCents || 0) / 100}\n`);
    }
}

debugRanges()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
