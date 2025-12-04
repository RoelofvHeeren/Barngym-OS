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
    const statusParam = (searchParams.get("status") ?? "all").toLowerCase();
    const { start, end } = parseRange(rangeParam);
    const dateFilter = buildDateFilter(start, end);

    const leads = await prisma.lead.findMany({
      where: {
        ...isAdsLeadFilter,
        createdAt: start ? { gte: start, lte: end } : { lte: end },
        ...(statusParam === "lead"
          ? { isClient: false }
          : statusParam === "client"
          ? { isClient: true }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        isClient: true,
        createdAt: true,
        ltvAllCents: true,
        ltvAdsCents: true,
      },
    });

    const leadIds = leads.map((lead) => lead.id);

    const [payments, tracking] = await Promise.all([
      prisma.payment.findMany({
        where: {
          leadId: { in: leadIds },
        },
        select: { leadId: true, timestamp: true, productType: true },
        orderBy: { timestamp: "asc" },
      }),
      prisma.leadTracking.findMany({
        where: { leadId: { in: leadIds } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const paymentsMap = new Map<string, { first: Date; categories: Set<string> }>();
    payments.forEach((p) => {
      if (!p.leadId) return;
      const existing = paymentsMap.get(p.leadId);
      const first = existing?.first ?? p.timestamp;
      const categories = existing?.categories ?? new Set<string>();
      if (p.productType) categories.add(p.productType);
      paymentsMap.set(p.leadId, { first, categories });
    });

    const trackingMap = new Map<string, typeof tracking>();
    tracking.forEach((t) => {
      if (!trackingMap.has(t.leadId)) {
        trackingMap.set(t.leadId, []);
      }
      trackingMap.get(t.leadId)!.push(t);
    });

    const result = leads.map((lead) => {
      const paymentInfo = paymentsMap.get(lead.id);
      const firstPaymentAt = paymentInfo?.first ?? null;
      const trackingEntry = trackingMap.get(lead.id)?.[0];
      const fullName =
        lead.fullName ||
        [lead.firstName ?? "", lead.lastName ?? ""]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" ") ||
        lead.email ||
        "Unnamed Lead";

      return {
        id: lead.id,
        fullName,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        status: lead.isClient ? "CLIENT" : "LEAD",
        createdAt: lead.createdAt,
        firstPaymentAt,
        ltvCents: lead.ltvAllCents ?? 0,
        ltvAdsCents: lead.ltvAdsCents ?? 0,
        productCategories: Array.from(paymentInfo?.categories ?? []),
        tracking: {
          utm_source: trackingEntry?.utmSource ?? null,
          utm_medium: trackingEntry?.utmMedium ?? null,
          utm_campaign: trackingEntry?.utmCampaign ?? null,
          adId: trackingEntry?.adId ?? null,
          adsetId: trackingEntry?.adsetId ?? null,
          campaignId: trackingEntry?.campaignId ?? null,
        },
      };
    });

    return NextResponse.json({ ok: true, data: { range: rangeParam, leads: result } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load ads leads." },
      { status: 500 }
    );
  }
}
