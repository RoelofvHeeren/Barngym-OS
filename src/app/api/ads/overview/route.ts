import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RangeKey = "today" | "7d" | "30d" | "month" | "all";

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
    // This ensures consistency between dashboard overview and the leads list.
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

    // fallback for clients count if we missed some via email match (unlikely but safe)
    // actually, we should probably stick to the count of leads for "Total Clients" 
    // but for LTV average, we only count those with LTV.
    // Let's use the contact count for consistency with the LTV sum.

    const avgLtvAdsCents = totalAdsClients > 0 ? Math.round(totalAdsLtv / totalAdsClients) : 0;
    // 4. Spend: Real data OR Default Budget
    // Exclude "Historical Manual Import" from specific ranges (like 7d, 30d) because it's a lump sum spanning a year.
    // It should only show up in "All Time" (where start is null).
    const isHistoricalIncluded = !start;

    const adsSpendAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true },
      where: {
        AND: [
          start ? { periodStart: { lte: end }, periodEnd: { gte: start } } : {},
          isHistoricalIncluded ? {} : { source: { not: "Historical Manual Import" } }
        ]
      }
    });
    const metaSpendAgg = await prisma.metaDailyInsight.aggregate({
      _sum: { spend: true },
      where: start ? { date: { gte: start, lte: end } } : {}, // Approx filter
    });

    const manualSpendCents = adsSpendAgg._sum.amountCents ?? 0;
    const metaSpendCents = Math.round((metaSpendAgg._sum.spend ?? 0) * 100);
    let spendCents = manualSpendCents + metaSpendCents;

    // If no real data, spendCents remains 0. We no longer use a fallback budget.

    const cplCents = leadsCount ? Math.round(spendCents / leadsCount) : 0;
    const cpaCents = conversionsCount ? Math.round(spendCents / conversionsCount) : 0;

    // Cohort-based ROAS: Total LTV of all ads clients / Total all-time spend
    // This is more meaningful than period-based revenue calculations
    const allTimeSpendAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true }
    });
    const allTimeMetaSpendAgg = await prisma.metaDailyInsight.aggregate({
      _sum: { spend: true }
    });
    const allTimeSpendCents = (allTimeSpendAgg._sum.amountCents ?? 0) + Math.round((allTimeMetaSpendAgg._sum.spend ?? 0) * 100);
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
