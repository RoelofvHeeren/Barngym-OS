/**
 * Post-fix Verification Script
 * 
 * Verifies that:
 * 1. All LTV values are in sync with Payments
 * 2. Main dashboard and Ads dashboard show consistent values
 * 3. No discrepancies exist
 * 
 * Run: npx tsx src/scripts/verify-ltv-integrity.ts
 */

import { prisma } from "../lib/prisma";
import { isAdsLead } from "../utils/ltv";

async function main() {
    console.log("=".repeat(80));
    console.log("LTV INTEGRITY VERIFICATION");
    console.log("=".repeat(80));
    console.log();

    // Define ads lead filter (same as API endpoints)
    const adsLeadFilter = {
        OR: [
            { tags: { array_contains: "ads" } },
            { source: { contains: "ads", mode: "insensitive" as const } },
            { source: { contains: "facebook", mode: "insensitive" as const } },
            { source: { contains: "instagram", mode: "insensitive" as const } },
            { source: { contains: "meta", mode: "insensitive" as const } },
            { source: { contains: "tiktok", mode: "insensitive" as const } },
            { source: { equals: "ghl_ads", mode: "insensitive" as const } },
        ],
    };

    // 1. Get all ads clients
    const adsClients = await prisma.lead.findMany({
        where: {
            ...adsLeadFilter,
            isClient: true,
        },
        select: {
            id: true,
            fullName: true,
            ltvAdsCents: true,
            ltvAllCents: true,
            source: true,
            tags: true,
            payments: { select: { amountCents: true } },
        }
    });

    console.log(`Found ${adsClients.length} ads clients\n`);

    // 2. Check for discrepancies
    let discrepancyCount = 0;
    let totalStoredLtv = 0;
    let totalActualLtv = 0;

    for (const client of adsClients) {
        const stored = client.ltvAdsCents || 0;
        const actual = client.payments.reduce((sum, p) => sum + (p.amountCents || 0), 0);
        const leadIsAds = isAdsLead(client as any);
        const expectedAdsLtv = leadIsAds ? actual : 0;

        totalStoredLtv += stored;
        totalActualLtv += expectedAdsLtv;

        if (stored !== expectedAdsLtv) {
            discrepancyCount++;
            console.log(`❌ ${client.fullName || 'Unknown'}: Stored £${stored / 100} vs Expected £${expectedAdsLtv / 100}`);
        }
    }

    console.log();
    console.log("--- SUMMARY ---");
    console.log(`Total Ads Clients: ${adsClients.length}`);
    console.log(`Stored LTV Total: £${(totalStoredLtv / 100).toFixed(2)}`);
    console.log(`Expected LTV Total: £${(totalActualLtv / 100).toFixed(2)}`);
    console.log(`Difference: £${((totalActualLtv - totalStoredLtv) / 100).toFixed(2)}`);
    console.log(`Discrepancies: ${discrepancyCount}`);

    // 3. Calculate averages (same as dashboards would)
    const avgStored = adsClients.length > 0 ? Math.round(totalStoredLtv / adsClients.length) : 0;
    const avgActual = adsClients.length > 0 ? Math.round(totalActualLtv / adsClients.length) : 0;

    console.log();
    console.log("--- DASHBOARD VALUES ---");
    console.log(`Ads Dashboard (stored ltvAdsCents): Avg £${(avgStored / 100).toFixed(2)}`);
    console.log(`Main Dashboard (from Payments): Avg £${(avgActual / 100).toFixed(2)}`);

    console.log();
    if (discrepancyCount === 0 && avgStored === avgActual) {
        console.log("✅ PASS: All LTV values are consistent!");
    } else {
        console.log("⚠️  FAIL: Discrepancies found. Run recalculation endpoint:");
        console.log("   POST /api/admin/recalc-ltv");
    }

    console.log();
    console.log("=".repeat(80));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
