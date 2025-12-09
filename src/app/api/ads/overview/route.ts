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
  OR: [
    { source: { contains: "ads", mode: "insensitive" as const } },
    { source: { contains: "facebook", mode: "insensitive" as const } },
    { source: { contains: "instagram", mode: "insensitive" as const } },
    { source: { contains: "meta", mode: "insensitive" as const } },
    { source: { contains: "tiktok", mode: "insensitive" as const } },
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
    const { start, end } = parseRange(rangeParam);
    const dateFilter = buildDateFilter(start, end);

    // 1. Leads Count: Created in period + source is ads
    const leadsCount = await prisma.lead.count({
      where: {
        ...isAdsLeadFilter,
        createdAt: dateFilter,
      },
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
    const adsSpendAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true },
      where: start ? { periodStart: { lte: end }, periodEnd: { gte: start } } : {},
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
          // For 'all time', maybe default to 3 months estimate or KEEP 0 to avoid confusion?
          // User said "219 leads", likely over longer period.
          // Let's assume 0 for all time if empty, or maybe iterate if reasonable.
          // Given user request "Expect 750 a month", let's apply it if the range is defined.
          // Since 'all' doesn't have a specific duration, let's leave it as 0 or 
          // calculate duration between first lead and now? 
          // Let's safe-bet on 0 for ALL TIME if no data, to prompt data entry, 
          // BUT for specific ranges we use the budget.
          spendCents = 0;
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
