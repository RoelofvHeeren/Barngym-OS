import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RangeKey = "today" | "7d" | "30d" | "month" | "all";

// --- Configuration ---
// Per business rules: Between 25 Sept 2024 and 24 Dec 2025, Meta API is the single source of truth.
// We must strictly exclude CSV imports for this period to avoid double counting.
const META_SOURCE_START = new Date("2024-09-25T00:00:00.000Z");
const META_SOURCE_END = new Date("2025-12-24T23:59:59.999Z");

const parseRange = (range?: string): { start: Date | null; end: Date } => {
  const now = new Date();
  const end = now;
  switch ((range as RangeKey) ?? "30d") {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start, end };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
    case "all":
    default:
      return { start: null, end };
  }
};

const isAdsLeadFilter = {
  OR: [
    { tags: { array_contains: "ads" } },
    { tags: { path: ["ghlTags"], array_contains: "ads" } },
    { source: { contains: "ads", mode: "insensitive" as const } },
    { source: { contains: "facebook", mode: "insensitive" as const } },
    { source: { contains: "instagram", mode: "insensitive" as const } },
    { source: { contains: "meta", mode: "insensitive" as const } },
    { source: { contains: "tiktok", mode: "insensitive" as const } },
    { source: { equals: "ghl_ads", mode: "insensitive" as const } },
  ],
};

const buildDateFilter = (start: Date | null, end: Date) => {
  if (!start) {
    return { lte: end };
  }
  return { gte: start, lte: end };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") ?? "30d";

    let start: Date | null = null;
    let end: Date = new Date();

    if (rangeParam === "custom") {
      const startParam = searchParams.get("start");
      const endParam = searchParams.get("end");
      if (startParam) start = new Date(startParam);
      if (endParam) end = new Date(endParam);
      if (endParam && endParam.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      const parsed = parseRange(rangeParam);
      start = parsed.start;
      end = parsed.end;
    }

    const dateFilter = start ? { gte: start, lte: end } : { lte: end };

    // Filter by submissionDate OR createdAt
    const whereCondition = {
      AND: [
        isAdsLeadFilter,
        {
          OR: [
            { submissionDate: dateFilter },
            { submissionDate: null, createdAt: dateFilter },
          ],
        },
      ],
    };

    // 1. Leads Count: Created in period + source is ads
    const leadsCount = await prisma.lead.count({
      where: whereCondition,
    });

    // 2. Conversions (Acquisitions): Count of leads whose FIRST payment was in this period.
    const activeAdsClients = await prisma.lead.findMany({
      where: {
        ...isAdsLeadFilter,
        isClient: true,
        payments: {
          some: { timestamp: dateFilter }
        }
      },
      select: {
        id: true,
        payments: {
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
          take: 1
        }
      }
    });

    let conversionsCount = 0;

    for (const client of activeAdsClients) {
      if (!client.payments.length) continue;

      const firstPaymentDate = client.payments[0].timestamp;

      // Check if first payment falls in the requested range
      const isAcquiredInPeriod = start
        ? (firstPaymentDate >= start && firstPaymentDate <= end)
        : (firstPaymentDate <= end);

      if (isAcquiredInPeriod) {
        conversionsCount++;
      }
    }

    // 3a. Avg LTV for ads clients (All Time)
    // Use Contact.ltvAllCents as source of truth (same as /api/ads/leads)
    const adsClientsLeads = await prisma.lead.findMany({
      where: {
        ...isAdsLeadFilter,
        isClient: true,
        payments: { some: {} } // Ensure they are strictly "acquired" (have purchase history)
      },
      select: {
        email: true
      }
    });

    const leadEmails = adsClientsLeads.map(l => l.email).filter(Boolean) as string[];

    // Fetch corresponding contacts to get the canonical LTV
    const adsContacts = await prisma.contact.findMany({
      where: {
        email: { in: leadEmails }
      },
      select: {
        ltvAllCents: true
      }
    });

    let totalAdsLtv = 0;
    let totalAdsClients = 0;

    for (const contact of adsContacts) {
      if (contact.ltvAllCents > 0) {
        totalAdsLtv += contact.ltvAllCents;
        totalAdsClients++;
      }
    }

    const avgLtvAdsCents = totalAdsClients > 0 ? Math.round(totalAdsLtv / totalAdsClients) : 0;

    // 4. Spend: Hybrid Logic (Meta > Manual > CSV) using Precedence Rules

    // Define shared filter
    const spendWhere = start ? { periodStart: { lte: end }, periodEnd: { gte: start } } : {};

    // A. Real Manual Spend (Strict Rule: Exclude "Historical Manual Import" and "CSV_FALLBACK" completely from Manual)
    const nonManualSources = ["Historical Manual Import"];

    const realManualAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true },
      where: {
        AND: [
          spendWhere,
          { source: { not: { startsWith: "CSV_FALLBACK" } } },
          { source: { notIn: nonManualSources } }
        ]
      }
    });
    const realManualSpendCents = realManualAgg._sum.amountCents ?? 0;

    // B. CSV Fallback Spend (Precedence Rule: Exclude records within [Sept 25 2024, Dec 24 2025])
    const csvAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true },
      where: {
        AND: [
          spendWhere,
          { source: { startsWith: "CSV_FALLBACK" } },
          {
            // The record is REJECTED if it fully falls within the Meta Window, or overlaps significantly?
            // "Avoid using CSV-uploaded ad data for spend within this date range"
            // Let's exclude if periodStart >= META_START && periodEnd <= META_END?
            // Or if ANY overlap? 
            // Most rigorous: If the CSV record provides data for the Meta Window, exclude it.
            // CSV usually comes in "chunks" (e.g. Month).
            // Safer to use NOT(Overlap).
            // Logic: Exclude if (RecordStart <= MetaEnd) AND (RecordEnd >= MetaStart).
            // Wait, we want to exclude CSV *only* for the days covered by Meta.
            // But CSV records are aggregated.
            // If we have a CSV row for "Nov 2024", and Meta covers Nov 2024, we drop the CSV row.
            // YES.
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
    const csvSpendCents = csvAgg._sum.amountCents ?? 0;

    // C. Meta Live Spend (The source of truth for the Window)
    const metaSpendAgg = await prisma.metaDailyInsight.aggregate({
      _sum: { spend: true },
      where: start ? { date: { gte: start, lte: end } } : {},
    });
    const metaSpendCents = Math.round((metaSpendAgg._sum.spend ?? 0) * 100);

    // D. Final Period Spend = Manual + Meta + (Filtered CSV)
    // Note: CSV is already filtered to NOT overlap with Meta Window.
    // So we can safely sum them?
    // What if we are outside the window? 
    // Outside window: CSV is included (if filters match). Meta is included (if exists).
    // Original Logic was "Meta > CSV" (if Meta > 0, use Meta).
    // New Logic: "Meta Only in Window". "CSV Only outside?".
    // Actually, simply summing them is fine because:
    // 1. Inside Window: CSV is 0 (filtered out). Meta is X. Sum = X. Correct.
    // 2. Outside Window: CSV is Y. Meta is 0 (presumably not synced). Sum = Y. Correct.
    // 3. Overlap at boundary? The NOT(Overlap) filter handles coarse collisions.
    const programmaticSpend = metaSpendCents + csvSpendCents;
    const spendCents = realManualSpendCents + programmaticSpend;

    const cplCents = leadsCount ? Math.round(spendCents / leadsCount) : 0;
    const cpaCents = conversionsCount ? Math.round(spendCents / conversionsCount) : 0;

    // 5. Cohort-based ROAS: Total LTV / All-Time Spend

    // All-time Manual (Strict)
    const allTimeManualAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true },
      where: {
        AND: [
          { source: { not: { startsWith: "CSV_FALLBACK" } } },
          { source: { notIn: nonManualSources } }
        ]
      }
    });
    const allTimeManual = allTimeManualAgg._sum.amountCents ?? 0;

    // All-time CSV (Strictly Exclude Window)
    const allTimeCsvAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true },
      where: {
        AND: [
          { source: { startsWith: 'CSV_FALLBACK' } },
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
    const allTimeCsv = allTimeCsvAgg._sum.amountCents ?? 0;

    // All-time Meta
    const allTimeMetaAgg = await prisma.metaDailyInsight.aggregate({
      _sum: { spend: true }
    });
    const allTimeMeta = Math.round((allTimeMetaAgg._sum.spend ?? 0) * 100);

    const allTimeProgrammatic = allTimeMeta + allTimeCsv;
    const allTimeSpendCents = allTimeManual + allTimeProgrammatic;

    const cohortRoas = allTimeSpendCents > 0 ? totalAdsLtv / allTimeSpendCents : 0;

    return NextResponse.json({
      ok: true,
      data: {
        range: rangeParam,
        spendCents,
        leadsCount,
        conversionsCount,
        // Total LTV across all ads clients (not period-based)
        totalAdsLtvCents: totalAdsLtv,
        totalAdsClients,
        avgLtvCents: avgLtvAdsCents,
        cplCents,
        cpaCents,
        // Cohort ROAS: lifetime LTV / lifetime spend (meaningful metric)
        cohortRoas: Number(cohortRoas.toFixed(2)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load ads overview." },
      { status: 500 }
    );
  }
}
