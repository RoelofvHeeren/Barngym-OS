
import { prisma } from '@/lib/prisma';

async function verifySpend() {
    console.log("--- Verifying Spend Calculation ---");

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

    // B. CSV Fallback
    const csvAgg = await prisma.adsSpend.aggregate({
        _sum: { amountCents: true },
        where: {
            source: { startsWith: "CSV_FALLBACK" }
        }
    });
    const csvVal = (csvAgg._sum.amountCents || 0) / 100;
    console.log(`CSV Fallback: £${csvVal}`);

    // C. Meta
    const metaSpendAgg = await prisma.metaDailyInsight.aggregate({
        _sum: { spend: true }
    });
    const metaVal = metaSpendAgg._sum.spend || 0;
    console.log(`Meta Live: £${metaVal}`);

    // D. Programmatic
    const programmatic = metaVal > 0 ? metaVal : csvVal;
    console.log(`Programmatic (Meta > CSV): £${programmatic}`);

    // Final
    const final = realManual + programmatic;
    console.log(`\nFinal Calculated Spend: £${final.toFixed(2)}`);
}

verifySpend()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
