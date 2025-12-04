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
    const { start, end } = parseRange(rangeParam);
    const dateFilter = buildDateFilter(start, end);

    const [leadsCount, conversionEvents, adsSpendAgg, adsRevenueAgg, adsClients] =
      await Promise.all([
        prisma.lead.count({
          where: {
            ...isAdsLeadFilter,
            createdAt: start ? { gte: start, lte: end } : { lte: end },
          },
        }),
        prisma.leadEvent.findMany({
          where: {
            eventType: "client_conversion",
            createdAt: dateFilter,
            lead: isAdsLeadFilter as any,
          },
          select: { leadId: true },
        }),
        prisma.adsSpend.aggregate({
          _sum: { amountCents: true },
          where: start
            ? {
                periodStart: { lte: end },
                periodEnd: { gte: start },
              }
            : {},
        }),
        prisma.adsRevenue.aggregate({
          _sum: { amountCents: true },
          where: start ? { timestamp: dateFilter } : {},
        }),
        prisma.lead.findMany({
          where: {
            ...isAdsLeadFilter,
            isClient: true,
            ...(start ? { updatedAt: dateFilter } : {}),
          },
          select: { id: true, ltvAdsCents: true },
        }),
      ]);

    const conversionsCount = new Set(conversionEvents.map((e) => e.leadId)).size;
    const spendCents = adsSpendAgg._sum.amountCents ?? 0;
    const revenueFromAdsCents = adsRevenueAgg._sum.amountCents ?? 0;

    const adsClientLtvTotal = adsClients.reduce((sum, lead) => sum + (lead.ltvAdsCents ?? 0), 0);
    const adsClientCount = adsClients.length || conversionsCount;
    const avgLtvAdsCents = adsClientCount ? Math.round(adsClientLtvTotal / adsClientCount) : 0;

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
