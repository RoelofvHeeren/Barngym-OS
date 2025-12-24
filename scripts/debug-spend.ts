
import { prisma } from '@/lib/prisma';

async function debugSpend() {
    console.log("--- AdsSpend Breakdown by Source ---");
    const adsSpend = await prisma.adsSpend.groupBy({
        by: ['source'],
        _sum: {
            amountCents: true,
        },
    });

    let totalAdsSpend = 0;
    for (const group of adsSpend) {
        console.log(`Source: "${group.source}" - Sum: £${(group._sum.amountCents || 0) / 100}`);
        totalAdsSpend += (group._sum.amountCents || 0);
    }
    console.log(`Total AdsSpend Table: £${totalAdsSpend / 100}`);

    console.log("\n--- MetaDailyInsight Total ---");
    const metaSpendAgg = await prisma.metaDailyInsight.aggregate({
        _sum: { spend: true }
    });
    console.log(`Total Meta Insight Spend: £${metaSpendAgg._sum.spend?.toFixed(2)}`);

    // Simulation of current logic
    // A. Real Manual Spend (Exclude CSV)
    const realManualAgg = await prisma.adsSpend.aggregate({
        _sum: { amountCents: true },
        where: {
            source: { not: { startsWith: "CSV_FALLBACK" } }
        }
    });
    const realManual = (realManualAgg._sum.amountCents || 0) / 100;
    console.log(`\nLogic "Real Manual" (Existing - CSV): £${realManual}`);

    // B. CSV Fallback
    const csvAgg = await prisma.adsSpend.aggregate({
        _sum: { amountCents: true },
        where: {
            source: { startsWith: "CSV_FALLBACK" }
        }
    });
    const csvVal = (csvAgg._sum.amountCents || 0) / 100;
    console.log(`Logic "CSV Fallback": £${csvVal}`);

    // C. Meta
    const metaVal = metaSpendAgg._sum.spend || 0;
    console.log(`Logic "Meta Live": £${metaVal}`);

    // D. Programmatic
    const programmatic = metaVal > 0 ? metaVal : csvVal;
    console.log(`Logic "Programmatic (Meta > CSV)": £${programmatic}`);

    // Final
    const final = realManual + programmatic;
    console.log(`\nFinal Calculated Spend: £${final.toFixed(2)}`);
}

debugSpend()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
