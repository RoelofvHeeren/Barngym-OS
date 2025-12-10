import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
  source: { contains: "ads", mode: "insensitive" as const },
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
      ...isAdsLeadFilter,
      OR: [
        { submissionDate: dateFilter },
        { submissionDate: null, createdAt: dateFilter },
      ],
    };

    // 1. Leads Count: Created in period + source is ads
    const leadsCount = await prisma.lead.count({
      where: whereCondition,
    });

    // 2. New Clients (Cohort): Converted in period + source is ads
    // We look for client_conversion events in the period for ads leads.
    const conversionEvents = await prisma.leadEvent.findMany({
      where: {
        eventType: "client_conversion",
        createdAt: dateFilter,
        lead: isAdsLeadFilter as any,
      },
      select: { leadId: true },
    });

    // Get unique converted lead IDs
    const newClientIds = Array.from(new Set(conversionEvents.map((e) => e.leadId)));
    const conversionsCount = newClientIds.length;

    // 3. Cohort Revenue & LTV: Sum LTV of these specific new clients
    let revenueFromAdsCents = 0;
    let avgLtvAdsCents = 0;

    if (conversionsCount > 0) {
      const newClients = await prisma.lead.findMany({
        where: { id: { in: newClientIds } },
        select: { ltvAllCents: true }
      });
      revenueFromAdsCents = newClients.reduce((sum, c) => sum + (c.ltvAllCents ?? 0), 0);
      avgLtvAdsCents = Math.round(revenueFromAdsCents / conversionsCount);
    }

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
        case "month":
          spendCents = MONTHLY_BUDGET_CENTS;
          break;
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
    const roas = spendCents > 0 ? revenueFromAdsCents / spendCents : 0;

    return NextResponse.json({
      ok: true,
      data: {
        range: rangeParam,
        spendCents,
        leadsCount,
        conversionsCount,
        revenueFromAdsCents,
        avgLtvAdsCents,
        cplCents,
        cpaCents,
        roas: Number(roas.toFixed(2)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load ads overview." },
      { status: 500 }
    );
  }
}
