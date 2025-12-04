import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyProduct } from "@/utils/productClassifier";

export const runtime = "nodejs";

const isAdsLead = (lead: { source: string | null; tags: unknown }) => {
  const src = (lead.source ?? "").toLowerCase();
  if (src.includes("ads")) return true;
  const tags = lead.tags;
  if (!tags) return false;
  if (Array.isArray(tags)) {
    return tags.some((tag) => typeof tag === "string" && tag.toLowerCase().includes("ads"));
  }
  if (typeof tags === "object") {
    return Object.values(tags as Record<string, unknown>).some(
      (value) => typeof value === "string" && value.toLowerCase().includes("ads")
    );
  }
  return false;
};

type CategoryKey = "pt" | "classes" | "online_coaching";

const normalizeCategory = (productType?: string | null) => {
  const normalized = productType ?? "";
  if (normalized === "pt" || normalized === "classes" || normalized === "online_coaching") {
    return normalized as CategoryKey;
  }
  const classified = classifyProduct(normalized);
  if (classified === "pt" || classified === "classes" || classified === "online_coaching") {
    return classified as CategoryKey;
  }
  return null;
};

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({
      where: { leadId: { not: null } },
      select: { leadId: true, amountCents: true, productType: true },
    });

    const leadIds = Array.from(new Set(payments.map((p) => p.leadId).filter(Boolean))) as string[];
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, source: true, tags: true, isClient: true },
    });
    const leadMap = new Map(leads.map((lead) => [lead.id, lead]));

    const perLead = new Map<
      string,
      {
        all: number;
        pt: number;
        classes: number;
        online_coaching: number;
      }
    >();

    payments.forEach((payment) => {
      if (!payment.leadId) return;
      const bucket =
        perLead.get(payment.leadId) ?? { all: 0, pt: 0, classes: 0, online_coaching: 0 };
      const amount = payment.amountCents ?? 0;
      bucket.all += amount;
      const category = normalizeCategory(payment.productType);
      if (category) {
        bucket[category] += amount;
      }
      perLead.set(payment.leadId, bucket);
    });

    const computeAverage = (
      filter: (leadId: string, totals: (typeof perLead extends Map<string, infer V> ? V : never)) => boolean,
      selector: (totals: (typeof perLead extends Map<string, infer V> ? V : never)) => number
    ) => {
      let total = 0;
      let count = 0;
      for (const [leadId, totals] of perLead) {
        if (!filter(leadId, totals)) continue;
        const value = selector(totals);
        if (value > 0) {
          total += value;
          count += 1;
        }
      }
      return count > 0 ? Math.round(total / count) : 0;
    };

    const avgAllCents = computeAverage(
      (leadId) => leadMap.get(leadId)?.isClient === true,
      (totals) => totals.all
    );

    const avgAdsCents = computeAverage(
      (leadId) => {
        const lead = leadMap.get(leadId);
        return !!lead?.isClient && isAdsLead(lead);
      },
      (totals) => totals.all
    );

    const avgPtCents = computeAverage(
      (leadId, totals) => leadMap.get(leadId)?.isClient === true && totals.pt > 0,
      (totals) => totals.pt
    );

    const avgOnlineCoachingCents = computeAverage(
      (leadId, totals) => leadMap.get(leadId)?.isClient === true && totals.online_coaching > 0,
      (totals) => totals.online_coaching
    );

    const avgClassesCents = computeAverage(
      (leadId, totals) => leadMap.get(leadId)?.isClient === true && totals.classes > 0,
      (totals) => totals.classes
    );

    return NextResponse.json({
      ok: true,
      data: {
        avgAllCents,
        avgAdsCents,
        avgPtCents,
        avgOnlineCoachingCents,
        avgClassesCents,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load LTV categories." },
      { status: 500 }
    );
  }
}
