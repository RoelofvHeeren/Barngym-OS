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
    // Calculate from Payments table directly (same as /api/ltv/categories)
    // This ensures consistency between dashboards.
    const adsClientsForLtv = await prisma.lead.findMany({
      where: {
        ...isAdsLeadFilter,
        isClient: true
      },
      select: {
        id: true,
        payments: { select: { amountCents: true } }
      }
    });

    let totalAdsLtv = 0;
    let totalAdsClients = 0;
    for (const client of adsClientsForLtv) {
      const clientLtv = client.payments.reduce((sum, p) => sum + (p.amountCents || 0), 0);
      if (clientLtv > 0) {
        totalAdsLtv += clientLtv;
        totalAdsClients++;
      }
    }
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

    // Default Budget Logic if no real data
    if (spendCents === 0) {
      const MONTHLY_BUDGET_CENTS = 750 * 100;
      const DAILY_BUDGET_CENTS = Math.round(MONTHLY_BUDGET_CENTS / 30);

      switch (rangeParam as RangeKey) {
        case "today":
          spendCents = DAILY_BUDGET_CENTS;
          break;
        case "7d":
          spendCents = DAILY_BUDGET_CENTS * 7;
          break;
        case "30d":
          spendCents = MONTHLY_BUDGET_CENTS;
          break;
        case "month": {
          const now = new Date();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const currentDay = now.getDate();
          // Prorate: (CurrentDay / DaysInMonth) * MonthlyBudget? 
          // Or just CurrentDay * DailyBudget?
          // User said: "increase by 25 bucks... if it's the 10th... should show 250".
          // So CurrentDay * DAILY_BUDGET_CENTS.
          // But cap at Monthly Budget if end of month?
          spendCents = Math.min(currentDay * DAILY_BUDGET_CENTS, MONTHLY_BUDGET_CENTS);
          break;
        }
        case "all":
          // Estimate duration based on first ever ad lead
          const firstLead = await prisma.lead.findFirst({
            where: isAdsLeadFilter,
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          });

          if (firstLead) {
            const now = new Date();
            const start = firstLead.createdAt;
            const diffTime = Math.abs(now.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // Prorate based on days to be more precise than just months
            spendCents = Math.round(diffDays * DAILY_BUDGET_CENTS);
          } else {
            spendCents = 0;
          }
          break;
      }
    }

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
