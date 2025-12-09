import { prisma } from "@/lib/prisma";
import { recordAdsAttribution } from "@/services/ads/adsAttributionService";
import { updateLtvTotals } from "@/services/ltv/ltvService";
import { classifyProduct } from "@/utils/productClassifier";
import { appendFile, mkdir } from "fs/promises";
import path from "path";

type MatchContext = {
  customerEmail?: string | null;
  customerPhone?: string | null;
  ghlContactId?: string | null;
  customerName?: string | null;
  productName?: string | null;
  productType?: string | null;
  sourceSystem?: string;
};

const normalizePhone = (value?: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length ? digits : null;
};

const tagsIncludeAds = (tags: unknown): boolean => {
  if (!tags) return false;
  if (Array.isArray(tags)) {
    return tags.some((tag) => typeof tag === "string" && tag.toLowerCase().includes("ads"));
  }
  if (typeof tags === "object") {
    const obj = tags as Record<string, unknown>;
    const nested = obj.ghlTags;
    if (Array.isArray(nested)) {
      return nested.some((tag) => typeof tag === "string" && tag.toLowerCase().includes("ads"));
    }
    return Object.values(obj).some(
      (value) => typeof value === "string" && value.toLowerCase().includes("ads")
    );
  }
  return false;
};

const appendConversionLog = async (line: string) => {
  const date = new Date();
  const logDir = path.join(process.cwd(), "logs", "conversions");
  const file = path.join(logDir, `${date.toISOString().slice(0, 10)}.log`);
  await mkdir(logDir, { recursive: true });
  await appendFile(file, `${line}\n`);
};

export async function matchPaymentToLead(
  payment: { id: string; externalPaymentId: string; amountCents: number; sourceSystem: string; timestamp: Date; productName?: string | null; productType?: string | null; rawPayload?: unknown },
  context?: MatchContext
) {
  const email = context?.customerEmail?.trim() || null;
  const phone = normalizePhone(context?.customerPhone ?? null);
  const ghlContactId = context?.ghlContactId?.trim() || null;

  const findLeadByEmail = async () =>
    email
      ? await prisma.lead.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      })
      : null;

  const findLeadByPhone = async () =>
    phone
      ? await prisma.lead.findFirst({
        where: { phone },
      })
      : null;

  const findLeadByGhl = async () =>
    ghlContactId
      ? await prisma.lead.findFirst({
        where: { ghlContactId },
      })
      : null;

  let lead = await findLeadByEmail();
  if (!lead) lead = await findLeadByPhone();
  if (!lead) lead = await findLeadByGhl();

  if (!lead) {
    await prisma.unmatchedPayment.create({
      data: {
        externalPaymentId: payment.externalPaymentId,
        sourceSystem: payment.sourceSystem,
        customerEmail: email ?? undefined,
        customerPhone: phone ?? undefined,
        reason: "No lead match found",
        rawPayload: (payment.rawPayload as any) ?? (context as any),
      },
    });
    return null;
  }

  const providedType = context?.productType ?? payment.productType ?? "";
  const category = ltvCategories.has(providedType)
    ? providedType
    : classifyProduct(
      context?.productName ?? payment.productName ?? providedType ?? ""
    );

  const sourceIsAds = ["ads", "facebook", "instagram", "meta", "tiktok"].some((k) =>
    (lead.source ?? "").toLowerCase().includes(k)
  );
  const tagsHasAds = tagsIncludeAds(lead.tags);
  const fromAds = sourceIsAds || tagsHasAds;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { leadId: lead.id },
    }),
    prisma.lead.update({
      where: { id: lead.id },
      data: { isClient: true },
    }),
    prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        eventType: "client_conversion",
        payload: {
          paymentId: payment.id,
          amountCents: payment.amountCents,
          sourceSystem: payment.sourceSystem,
          productName: payment.productName ?? context?.productName,
          productType: category,
        },
      },
    }),
  ]);

  await updateLtvTotals({
    leadId: lead.id,
    amountCents: payment.amountCents,
    category: category as any,
    fromAds,
  });

  if (fromAds) {
    await recordAdsAttribution({
      leadId: lead.id,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      timestamp: payment.timestamp,
      updateLeadLtv: false,
    });
  }

  await appendConversionLog(
    `${new Date().toISOString()} | lead=${lead.id} | payment=${payment.id} | amount=${payment.amountCents} | source=${payment.sourceSystem}`
  );

  return lead;
}
const ltvCategories = new Set([
  "pt",
  "classes",
  "six_week",
  "online_coaching",
  "community",
  "corporate",
]);
