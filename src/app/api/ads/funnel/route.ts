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
  source: { contains: "ghl_ads", mode: "insensitive" as const },
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

    const [leadsCount, conversionEvents] = await Promise.all([
      prisma.lead.count({
        where: {
          ...isAdsLeadFilter,
          createdAt: start ? { gte: start, lte: end } : { lte: end },
        },
      }),
      prisma.leadEvent.count({
        where: {
          eventType: "client_conversion",
          createdAt: dateFilter,
          lead: isAdsLeadFilter as any,
        },
      }),
    ]);

    const stages = {
      leads: leadsCount,
      booked: 0,
      showed: 0,
      joined: 0,
      clients: conversionEvents,
    };

    return NextResponse.json({ ok: true, data: { range: rangeParam, stages } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load funnel." },
      { status: 500 }
    );
  }
}
