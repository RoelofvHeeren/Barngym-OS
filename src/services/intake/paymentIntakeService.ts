import { prisma } from "@/lib/prisma";
import { matchPaymentToLead } from "@/services/intake/leadMatchingService";
import { classifyProduct } from "@/utils/productClassifier";
import { appendFile, mkdir } from "fs/promises";
import path from "path";

type NormalizedPayment = {
  externalPaymentId: string;
  amountCents: number;
  currency: string;
  timestamp: Date;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  productName?: string | null;
  productType?: string | null;
  sourceSystem: "stripe" | "glofox";
  rawPayload: unknown;
  ghlContactId?: string | null;
};

const logPaymentEvent = async (line: string) => {
  const logDir = path.join(process.cwd(), "logs", "payments");
  const file = path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);
  await mkdir(logDir, { recursive: true });
  await appendFile(file, `${line}\n`);
};

async function ingestPayment(normalized: NormalizedPayment) {
  const category = classifyProduct(normalized.productName ?? normalized.productType ?? "");
  const existing = await prisma.payment.findFirst({
    where: {
      externalPaymentId: normalized.externalPaymentId,
      sourceSystem: normalized.sourceSystem,
    },
  });

  const context = {
    customerEmail: normalized.customerEmail,
    customerPhone: normalized.customerPhone,
    ghlContactId: normalized.ghlContactId,
    customerName: normalized.customerName,
    productName: normalized.productName,
    productType: category === "unknown" ? normalized.productType : category,
    sourceSystem: normalized.sourceSystem,
  };

  if (existing) {
    if (!existing.leadId) {
      await matchPaymentToLead(existing, context);
    }
    return existing;
  }

  const payment = await prisma.payment.create({
    data: {
      externalPaymentId: normalized.externalPaymentId,
      amountCents: Math.round(normalized.amountCents),
      currency: normalized.currency,
      timestamp: normalized.timestamp,
      productName: normalized.productName,
      productType: category === "unknown" ? normalized.productType : category,
      sourceSystem: normalized.sourceSystem,
      rawPayload: normalized.rawPayload as any,
    },
  });

  await logPaymentEvent(
    `${new Date().toISOString()} | stored payment=${payment.id} | external=${payment.externalPaymentId} | source=${payment.sourceSystem} | amount=${payment.amountCents}`
  );

  await matchPaymentToLead(payment, context);

  return payment;
}

export async function ingestStripePayment(rawPayload: any) {
  const object = rawPayload?.data?.object ?? rawPayload?.object ?? rawPayload ?? {};
  const charge = Array.isArray(object.charges?.data) ? object.charges.data[0] : undefined;
  const externalPaymentId = object.id ?? object.payment_intent ?? object.paymentIntent ?? "";
  const amountCents = object.amount_received ?? object.amount ?? 0;
  const currency = (object.currency ?? charge?.currency ?? "GBP").toString().toUpperCase();
  const timestamp = object.created ? new Date(object.created * 1000) : new Date();
  const customerEmail =
    object.receipt_email ??
    charge?.billing_details?.email ??
    object.customer_email ??
    charge?.receipt_email ??
    null;
  const customerPhone =
    charge?.billing_details?.phone ??
    object.customer_details?.phone ??
    object.phone ??
    null;
  const customerName =
    object.customer_details?.name ??
    charge?.billing_details?.name ??
    object.customer_name ??
    null;
  const productName =
    object.description ??
    charge?.description ??
    object.metadata?.product_name ??
    object.metadata?.product ??
    null;
  const productType =
    object.metadata?.product_type ??
    object.metadata?.category ??
    charge?.metadata?.product_type ??
    null;

  const normalized: NormalizedPayment = {
    externalPaymentId,
    amountCents,
    currency,
    timestamp,
    customerEmail,
    customerPhone,
    customerName,
    productName,
    productType,
    sourceSystem: "stripe",
    rawPayload,
  };

  return ingestPayment(normalized);
}

export async function ingestGlofoxPayment(rawPayload: any) {
  const payment = rawPayload?.payment ?? rawPayload ?? {};
  const externalPaymentId =
    payment.externalPaymentId ??
    payment.paymentId ??
    payment.id ??
    payment.reference ??
    payment.transactionId ??
    "";

  const amount =
    payment.amountCents ??
    payment.amount_cents ??
    payment.amount ??
    payment.total ??
    payment.value ??
    0;

  const currency = (payment.currency ?? "GBP").toString().toUpperCase();
  const timestampValue = payment.timestamp ?? payment.occurredAt ?? payment.createdAt ?? Date.now();
  const timestamp =
    typeof timestampValue === "string" || typeof timestampValue === "number"
      ? new Date(timestampValue)
      : new Date();

  const normalized: NormalizedPayment = {
    externalPaymentId,
    amountCents: Math.round(amount),
    currency,
    timestamp,
    customerEmail: payment.email ?? payment.customerEmail ?? null,
    customerPhone: payment.phone ?? payment.customerPhone ?? null,
    customerName: payment.customerName ?? payment.name ?? null,
    productName: payment.productName ?? payment.product ?? payment.membershipName ?? null,
    productType: payment.productType ?? payment.category ?? null,
    sourceSystem: "glofox",
    rawPayload,
    ghlContactId: payment.ghlContactId ?? payment.contactId ?? null,
  };

  return ingestPayment(normalized);
}
