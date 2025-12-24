/**
 * LTV Audit Script
 * This script audits all LTV calculations and identifies discrepancies between:
 * 1. Stored values (ltvAdsCents on Lead) vs actual Payments
 * 2. Main dashboard LTV vs Ads dashboard LTV
 * 
 * Run: npx tsx src/scripts/audit-ltv-discrepancies.ts
 */

import { prisma } from "../lib/prisma";
import { isAdsLead } from "../utils/ltv";

interface Discrepancy {
    name: string | null;
    email: string | null;
    id: string;
    storedLtvAll: number;
    storedLtvAds: number;
    actualLtvFromPayments: number;
    correctLtvAds: number;
    isAdsLead: boolean;
    paymentCount: number;
    source: string | null;
}

async function main() {
    console.log("=".repeat(80));
    console.log("LTV AUDIT SCRIPT");
    console.log("=".repeat(80));
    console.log();

    // 1. Find test leads to delete
    console.log("--- TEST LEADS TO DELETE ---");
    const testLeads = await prisma.lead.findMany({
        where: {
            OR: [
                { fullName: { contains: 'Mark Zuckerberg', mode: 'insensitive' } },
                { fullName: { contains: 'Elon Musk', mode: 'insensitive' } },
                { fullName: { contains: 'Teste van Heeren', mode: 'insensitive' } },
            ]
        },
        select: { id: true, fullName: true, email: true, ltvAllCents: true, ltvAdsCents: true, source: true }
    });

    if (testLeads.length === 0) {
        console.log("No test leads found.");
    } else {
        for (const l of testLeads) {
            console.log(`  - ${l.fullName} (${l.email}): id=${l.id}, source=${l.source}`);
        }
    }
    console.log();

    // 2. Get all clients with payments
    console.log("--- FETCHING ALL CLIENTS WITH PAYMENTS ---");
    const allClients = await prisma.lead.findMany({
        where: { isClient: true },
        select: {
            id: true,
            fullName: true,
            email: true,
            ltvAllCents: true,
            ltvAdsCents: true,
            source: true,
            tags: true,
            payments: { select: { id: true, amountCents: true } }
        }
    });
    console.log(`Total clients: ${allClients.length}`);
    console.log();

    // 3. Identify Ads leads using the same logic as the codebase
    const adsLeadFilter = {
        OR: [
            { tags: { array_contains: 'ads' } },
            { source: { contains: 'ads', mode: 'insensitive' as const } },
            { source: { contains: 'facebook', mode: 'insensitive' as const } },
            { source: { contains: 'instagram', mode: 'insensitive' as const } },
            { source: { contains: 'meta', mode: 'insensitive' as const } },
            { source: { contains: 'tiktok', mode: 'insensitive' as const } },
            { source: { equals: 'ghl_ads', mode: 'insensitive' as const } },
        ],
    };

    const adsClientsFromDB = await prisma.lead.findMany({
        where: {
            ...adsLeadFilter,
            isClient: true
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            ltvAllCents: true,
            ltvAdsCents: true,
            source: true,
            tags: true,
            payments: { select: { id: true, amountCents: true } }
        }
    });
    console.log(`Ads clients (DB filter): ${adsClientsFromDB.length}`);

    // 4. Audit discrepancies
    console.log("\n--- LTV DISCREPANCIES ---");
    const discrepancies: Discrepancy[] = [];

    let storedAdsLtvTotal = 0;
    let actualAdsLtvTotal = 0;

    for (const lead of adsClientsFromDB) {
        const storedLtvAll = lead.ltvAllCents || 0;
        const storedLtvAds = lead.ltvAdsCents || 0;
        const actualLtvFromPayments = lead.payments.reduce((sum, p) => sum + (p.amountCents || 0), 0);
        const leadIsAds = isAdsLead(lead as any);
        const correctLtvAds = leadIsAds ? actualLtvFromPayments : 0;

        storedAdsLtvTotal += storedLtvAds;
        actualAdsLtvTotal += correctLtvAds;

        // Check for any discrepancy
        const hasDiscrepancy =
            storedLtvAll !== actualLtvFromPayments ||
            storedLtvAds !== correctLtvAds;

        if (hasDiscrepancy) {
            discrepancies.push({
                name: lead.fullName,
                email: lead.email,
                id: lead.id,
                storedLtvAll,
                storedLtvAds,
                actualLtvFromPayments,
                correctLtvAds,
                isAdsLead: leadIsAds,
                paymentCount: lead.payments.length,
                source: lead.source,
            });
        }
    }

    console.log(`\nTotal Ads Clients: ${adsClientsFromDB.length}`);
    console.log(`Stored Ads LTV Total: £${(storedAdsLtvTotal / 100).toFixed(2)}`);
    console.log(`Actual Ads LTV Total (from Payments): £${(actualAdsLtvTotal / 100).toFixed(2)}`);
    console.log(`Difference: £${((actualAdsLtvTotal - storedAdsLtvTotal) / 100).toFixed(2)}`);
    console.log(`\nDiscrepancies found: ${discrepancies.length}`);

    if (discrepancies.length > 0) {
        console.log("\nDetailed Discrepancies:");
        for (const d of discrepancies) {
            console.log(`\n  ${d.name || 'Unknown'} (${d.email})`);
            console.log(`    ID: ${d.id}`);
            console.log(`    Source: ${d.source}`);
            console.log(`    Is Ads Lead: ${d.isAdsLead}`);
            console.log(`    Payments: ${d.paymentCount}`);
            console.log(`    Stored ltvAllCents: £${(d.storedLtvAll / 100).toFixed(2)}`);
            console.log(`    Actual from Payments: £${(d.actualLtvFromPayments / 100).toFixed(2)}`);
            console.log(`    Stored ltvAdsCents: £${(d.storedLtvAds / 100).toFixed(2)}`);
            console.log(`    Correct ltvAdsCents: £${(d.correctLtvAds / 100).toFixed(2)}`);
        }
    }

    // 5. Compare dashboard calculations
    console.log("\n\n--- DASHBOARD LTV COMPARISON ---");

    // Method 1: Sum ltvAdsCents (used by /api/ads/overview)
    const adsOverviewAgg = await prisma.lead.aggregate({
        _sum: { ltvAdsCents: true },
        _count: { id: true },
        where: {
            ...adsLeadFilter,
            isClient: true
        }
    });
    const method1Total = adsOverviewAgg._sum.ltvAdsCents || 0;
    const method1Count = adsOverviewAgg._count.id || 0;
    const method1Avg = method1Count > 0 ? Math.round(method1Total / method1Count) : 0;

    // Method 2: Sum from Payments table (used by /api/ltv/categories)
    const allPayments = await prisma.payment.findMany({
        where: { leadId: { not: null } },
        select: { leadId: true, amountCents: true }
    });

    const perLeadTotals = new Map<string, number>();
    for (const p of allPayments) {
        if (!p.leadId) continue;
        perLeadTotals.set(p.leadId, (perLeadTotals.get(p.leadId) || 0) + (p.amountCents || 0));
    }

    // Filter to only ads clients
    const adsClientIds = new Set(adsClientsFromDB.map(l => l.id));
    let method2Total = 0;
    let method2Count = 0;
    for (const [leadId, total] of perLeadTotals) {
        if (adsClientIds.has(leadId)) {
            method2Total += total;
            method2Count++;
        }
    }
    const method2Avg = method2Count > 0 ? Math.round(method2Total / method2Count) : 0;

    console.log("Method 1 (Ads Dashboard - uses ltvAdsCents field):");
    console.log(`  Total: £${(method1Total / 100).toFixed(2)}`);
    console.log(`  Count: ${method1Count}`);
    console.log(`  Average: £${(method1Avg / 100).toFixed(2)}`);

    console.log("\nMethod 2 (Main Dashboard - calculates from Payments):");
    console.log(`  Total: £${(method2Total / 100).toFixed(2)}`);
    console.log(`  Count: ${method2Count}`);
    console.log(`  Average: £${(method2Avg / 100).toFixed(2)}`);

    console.log(`\nDIFFERENCE: £${((method2Total - method1Total) / 100).toFixed(2)}`);
    console.log(`DIFFERENCE (Avg): £${((method2Avg - method1Avg) / 100).toFixed(2)}`);

    console.log("\n" + "=".repeat(80));
    console.log("AUDIT COMPLETE");
    console.log("=".repeat(80));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
