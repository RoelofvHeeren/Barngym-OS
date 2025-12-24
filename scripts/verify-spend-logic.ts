
import { prisma } from '@/lib/prisma';

async function verifySpendStrict() {
    console.log("--- Verifying Spend Calculation Strict Mode ---");
    const META_SOURCE_START = new Date("2024-09-25T00:00:00.000Z");
    const META_SOURCE_END = new Date("2025-12-24T23:59:59.999Z");

    // A. Real Manual Spend (Exclude CSV & Historical Fallback)
    const nonManualSources = ["Historical Manual Import"];

    const realManualAgg = await prisma.adsSpend.aggregate({
        _sum: { amountCents: true },
        where: {
            AND: [
                { source: { not: { startsWith: "CSV_FALLBACK" } } },
                { source: { notIn: nonManualSources } }
            ]
        }
    });
    const realManual = (realManualAgg._sum.amountCents || 0) / 100;
    console.log(`Real Manual (Strict): £${realManual}`);

    // B. CSV Fallback (Date Filtered)
    const csvAgg = await prisma.adsSpend.aggregate({
        _sum: { amountCents: true },
        where: {
            AND: [
                { source: { startsWith: "CSV_FALLBACK" } },
                {
                    NOT: {
                        AND: [
                            { periodStart: { lte: META_SOURCE_END } },
                            { periodEnd: { gte: META_SOURCE_START } }
                        ]
                    }
                }
            ]
        }
    });
    const csvVal = (csvAgg._sum.amountCents || 0) / 100;
    console.log(`CSV Fallback (Outside Window): £${csvVal}`);

    // C. Meta
    const metaSpendAgg = await prisma.metaDailyInsight.aggregate({
        _sum: { spend: true }
    });
    const metaVal = metaSpendAgg._sum.spend || 0;
    console.log(`Meta Live: £${metaVal}`);

    // D. Programmatic
    const programmatic = metaVal + csvVal;
    console.log(`Final Programmatic (Meta + Filtered CSV): £${programmatic.toFixed(2)}`);

    // Final
    const final = realManual + programmatic;
    console.log(`\nFinal Calculated Spend: £${final.toFixed(2)}`);
}

verifySpendStrict()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
