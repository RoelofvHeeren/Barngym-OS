import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const timeframeToRange = (timeframe: string) => {
  const now = new Date();
  const from = new Date();
  if (timeframe === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (timeframe === "7d") {
    from.setDate(now.getDate() - 7);
  } else if (timeframe === "90d") {
    from.setDate(now.getDate() - 90);
  } else {
    from.setDate(now.getDate() - 30);
  }
  return { from, to: now };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") ?? "30d";
    const groupBy = searchParams.get("groupBy") ?? "campaign";
    const { from, to } = timeframeToRange(timeframe);

    const groupField =
      groupBy === "account"
        ? "accountId"
        : groupBy === "adset"
        ? "adsetId"
        : groupBy === "ad"
        ? "adId"
        : "campaignId";

    const grouped = await prisma.metaDailyInsight.groupBy({
      by: [groupField],
      where: { date: { gte: from, lte: to } },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        results: true,
      },
    });

    const ids = grouped.map((row) => row[groupField] as string | null).filter(Boolean) as string[];

    const nameMap: Record<string, string> = {};
    if (groupField === "campaignId" && ids.length) {
      const campaigns = await prisma.metaCampaign.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      campaigns.forEach((c) => (nameMap[c.id] = c.name ?? c.id));
    } else if (groupField === "adsetId" && ids.length) {
      const adsets = await prisma.metaAdSet.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      adsets.forEach((s) => (nameMap[s.id] = s.name ?? s.id));
    } else if (groupField === "adId" && ids.length) {
      const ads = await prisma.metaAd.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      ads.forEach((a) => (nameMap[a.id] = a.name ?? a.id));
    } else if (groupField === "accountId" && ids.length) {
      const accounts = await prisma.metaAdAccount.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      accounts.forEach((a) => (nameMap[a.id] = a.name ?? a.id));
    }

    const items = grouped
      .filter((row) => row[groupField])
      .map((row) => {
        const spend = row._sum.spend ?? 0;
        const impressions = row._sum.impressions ?? 0;
        const clicks = row._sum.clicks ?? 0;
        const results = row._sum.results ?? 0;
        return {
          id: row[groupField],
          name: nameMap[row[groupField] as string] ?? row[groupField],
          spend,
          impressions,
          clicks,
          results,
          cpm: impressions > 0 ? (spend * 1000) / impressions : null,
          cpc: clicks > 0 ? spend / clicks : null,
        };
      });

    return NextResponse.json({ ok: true, data: { timeframe, groupBy: groupField, items } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load ads spend." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const periodStart = body.periodStart ? new Date(body.periodStart) : null;
    const periodEnd = body.periodEnd ? new Date(body.periodEnd) : null;
    const amountCents = Number(body.amountCents);
    const source = body.source ?? "manual";

    if (!periodStart || !periodEnd || Number.isNaN(periodStart.valueOf()) || Number.isNaN(periodEnd.valueOf())) {
      return NextResponse.json({ ok: false, message: "Invalid period dates." }, { status: 400 });
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ ok: false, message: "amountCents must be greater than zero." }, { status: 400 });
    }

    await prisma.adsSpend.create({
      data: {
        periodStart,
        periodEnd,
        amountCents: Math.round(amountCents),
        source: String(source),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to save spend." },
      { status: 500 }
    );
  }
}
