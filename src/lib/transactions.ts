import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { attachLeadBatch } from "./transactionMatcher";
import { recalculateContactLtv, recalculateLeadLtv } from "@/utils/ltv";

export type NormalizedTransaction = {
  externalId: string;
  provider: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  personName?: string;
  productType?: string;
  status: string;
  confidence: string;
  description?: string | null;
  reference?: string;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  leadId?: string | null;
  contactId?: string | null;
};

function safeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export const REVENUE_STATUSES = ["Completed", "Paid", "PAID", "succeeded", "SETTLED", "success", "COMPLETED"];

export function isRevenueTransaction(status: string | null | undefined): boolean {
  if (!status) return false;
  return REVENUE_STATUSES.some(s => s.toLowerCase() === status.toLowerCase());
}

export async function upsertTransactions(records: NormalizedTransaction[]) {
  if (!records.length) {
    return { added: 0, total: await prisma.transaction.count() };
  }

  const enrichedRecords = await attachLeadBatch(records.map((record) => ({ ...record })));

  const externalIds = enrichedRecords.map((record) => record.externalId);
  const existing = await prisma.transaction.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((record) => record.externalId));

  let added = 0;

  for (const record of enrichedRecords) {
    const rawPayload = record.raw ?? undefined;
    const metadataPayload = record.metadata ?? undefined;

    await prisma.transaction
      .upsert({
        where: { externalId: record.externalId },
        update: {
          source: record.provider,
          provider: record.provider,
          amountMinor: record.amountMinor,
          currency: record.currency,
          occurredAt: new Date(record.occurredAt),
          personName: record.personName,
          productType: record.productType,
          status: record.status,
          confidence: record.confidence,
          description: record.description,
          reference: record.reference,
          raw: rawPayload as Prisma.TransactionUncheckedUpdateInput["raw"],
          metadata: metadataPayload as Prisma.TransactionUncheckedUpdateInput["metadata"],
          leadId: record.leadId ?? null,
          contactId: record.contactId ?? null,
        },
        create: {
          externalId: record.externalId,
          source: record.provider,
          provider: record.provider,
          amountMinor: record.amountMinor,
          currency: record.currency,
          occurredAt: new Date(record.occurredAt),
          personName: record.personName,
          productType: record.productType,
          status: record.status,
          confidence: record.confidence,
          description: record.description,
          reference: record.reference,
          raw: rawPayload as Prisma.TransactionUncheckedCreateInput["raw"],
          metadata: metadataPayload as Prisma.TransactionUncheckedCreateInput["metadata"],
          leadId: record.leadId ?? null,
          contactId: record.contactId ?? null,
        },
      })
      .then(async (tx) => {
        if (!existingSet.has(record.externalId)) {
          added += 1;
        }

        // Add to Manual Match Queue if unmatched
        if (!record.leadId && !record.contactId && tx.status !== "Failed") {
          const existingQueue = await prisma.manualMatchQueue.findFirst({
            where: { transactionId: tx.id }
          });
          if (!existingQueue) {
            await prisma.manualMatchQueue.create({
              data: {
                transactionId: tx.id,
                reason: "Unmatched Transaction",
              }
            });
          }
        }

        // Trigger LTV Recalculation (Fire & Forget mostly, or wait?)
        // Waiting ensures consistency but slows down webhook. 
        // Given loop, maybe concurrent? But parallel update to same lead might race.
        // Sequential is safer.
        if (record.leadId) {
          await recalculateLeadLtv(record.leadId);
        }
        if (record.contactId) {
          await recalculateContactLtv(record.contactId);
        }
      })
      .catch((error) => {
        console.error("Failed to upsert transaction", record.externalId, error);
      });
  }

  const total = await prisma.transaction.count();
  return { added, total };
}

export async function listTransactions() {
  return prisma.transaction.findMany({
    orderBy: { occurredAt: "desc" },
  });
}

type StripeChargePayload =
  | Stripe.Charge
  | {
    id?: string;
    payment_intent?: string | Stripe.PaymentIntent | null;
    created?: number;
    amount?: number;
    currency?: string;
    status?: string | null;
    paid?: boolean;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
    description?: string | null;
    statement_descriptor?: string | null;
    metadata?: Record<string, unknown>;
    billing_details?: Stripe.Charge.BillingDetails;
    receipt_email?: string | null;
    invoice?: string | Stripe.Invoice | null;
  };

type StripePaymentIntentPayload =
  | Stripe.PaymentIntent
  | (StripeChargePayload & {
    amount_received?: number;
    amount_capturable?: number;
    amount_details?: Stripe.PaymentIntent.AmountDetails;
    charges?: { data?: Array<StripeChargePayload | Stripe.Charge> };
    invoice?: string | StripeInvoicePayload | null;
  });

type StripeInvoicePayload =
  | Stripe.Invoice
  | {
    id?: string;
    payment_intent?: string | Stripe.PaymentIntent | null;
    created?: number;
    amount_paid?: number;
    currency?: string;
    status?: string | null;
    number?: string | null;
    customer_email?: string | null;
    customer_name?: string | null;
    metadata?: Record<string, unknown>;
    customer?: string;
    hosted_invoice_url?: string | null;
  };

type StripeCheckoutSessionPayload =
  | Stripe.Checkout.Session
  | {
    id?: string;
    created?: number;
    amount_total?: number;
    currency?: string;
    status?: string;
    customer_details?: {
      name?: string;
      email?: string;
    };
    metadata?: Record<string, unknown>;
    payment_intent?: string | StripePaymentIntentPayload;
    customer?: string;
    payment_status?: string;
    mode?: string;
  };

export type StarlingFeedItem = {
  feedItemUid?: string;
  amount?: {
    minorUnits?: number;
    currency?: string;
  };
  totalAmount?: {
    minorUnits?: number;
    currency?: string;
  };
  sourceAmount?: {
    minorUnits?: number;
    currency?: string;
  };
  transactionTime?: string;
  updatedAt?: string;
  spendUntil?: string;
  status?: string;
  counterPartyName?: string;
  reference?: string;
  description?: string | null;
  direction?: string;
  spendingCategory?: string;
};

/**
 * Check if a Starling transaction represents a payout from a payment processor
 * (Stripe or Glofox). These should be excluded to avoid double-counting revenue.
 */
export function isPaymentProcessorPayout(item: StarlingFeedItem): boolean {
  const counterParty = (item?.counterPartyName ?? "").toLowerCase();

  // Stripe payouts (e.g., "Stripe Payments UK Ltd")
  if (counterParty.includes("stripe payments")) return true;

  // Glofox/Zappy payouts (e.g., "ZAPPY LTD")
  if (counterParty.includes("zappy")) return true;

  return false;
}

export function isIncomingStarling(item: StarlingFeedItem): boolean {
  // First check if it's a payment processor payout - exclude these
  if (isPaymentProcessorPayout(item)) return false;

  const dir = (item?.direction ?? "").toString().toUpperCase();
  if (dir) {
    return dir === "IN" || dir === "CREDIT";
  }
  const amountMinor =
    item?.amount?.minorUnits ??
    item?.totalAmount?.minorUnits ??
    item?.sourceAmount?.minorUnits ??
    0;
  return (amountMinor ?? 0) > 0;
}

type GlofoxPaymentPayload = {
  id?: string | number;
  payment_id?: string | number;
  sale_id?: string | number;
  amount?: number | string;
  total?: number | string;
  currency?: string;
  status?: string;
  payment_status?: string;
  description?: string | null;
  category?: string;
  payment_type?: string;
  plan_name?: string;
  product_name?: string;
  membership_name?: string;
  created_at?: string | number;
  processed_at?: string | number;
  transaction_time?: string;
  member_name?: string;
  member_email?: string;
  member_phone?: string;
  member_id?: string | number;
  reference?: string;
};

function resolveStripeStatus(payload?: { status?: string; paid?: boolean }) {
  if (!payload) return "Needs Review";
  const status = payload.status?.toLowerCase();
  if (status === "succeeded" || status === "paid") return "Completed";
  if (status === "failed" || status === "canceled") return "Failed";
  return payload.paid ? "Completed" : "Needs Review";
}

function resolvedConfidence(payload?: { paid?: boolean; counterPartyName?: string | null }) {
  if (payload?.paid || payload?.counterPartyName) return "High";
  return "Needs Review";
}

const DEFAULT_CURRENCY = "EUR";

function stripeExternalId({
  paymentIntentId,
  invoiceId,
  chargeId,
  sessionId,
}: {
  paymentIntentId?: string;
  invoiceId?: string;
  chargeId?: string;
  sessionId?: string;
}) {
  if (paymentIntentId) return `stripe_pi_${paymentIntentId}`;
  if (invoiceId) return `stripe_inv_${invoiceId}`;
  if (chargeId) return `stripe_${chargeId}`;
  if (sessionId) return `stripe_cs_${sessionId}`;
  return `stripe_${randomUUID()}`;
}

export function mapStripeCharge(charge: StripeChargePayload): NormalizedTransaction {
  const created = typeof charge?.created === "number" ? charge.created * 1000 : Date.now();
  const amountMinor = typeof charge?.amount === "number" ? charge.amount : 0;
  const metadata = charge?.metadata ?? {};
  const invoiceReference =
    charge && typeof charge === "object" && "invoice" in charge
      ? (charge as { invoice?: string | Stripe.Invoice | null }).invoice
      : undefined;
  const paymentIntentId =
    typeof charge?.payment_intent === "string"
      ? charge.payment_intent
      : (charge as { payment_intent?: { id?: string } })?.payment_intent?.id;
  const invoiceId = typeof invoiceReference === "string" ? invoiceReference : undefined;
  const chargeId = typeof charge?.id === "string" ? charge.id : undefined;
  const status = resolveStripeStatus({
    status: charge?.status ?? undefined,
    paid: charge?.paid,
  });

  return {
    externalId: stripeExternalId({ paymentIntentId, invoiceId, chargeId }),
    provider: "Stripe",
    amountMinor,
    currency: (charge?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName:
      safeString(charge?.billing_details?.name) ||
      safeString(metadata.customer_name as string | undefined) ||
      safeString(metadata.member_name) ||
      safeString(charge?.customer) ||
      undefined,
    productType: safeString((metadata.product_type as string | undefined) ?? charge?.description) ?? "Stripe Charge",
    status,
    confidence: charge?.paid ? "High" : "Needs Review",
    description: charge?.description ?? charge?.statement_descriptor,
    reference: paymentIntentId ?? chargeId ?? invoiceId ?? charge?.id,
    metadata: {
      paymentIntentId,
      chargeId,
      invoiceId,
      customer: charge?.customer,
      email:
        charge?.billing_details?.email ??
        charge?.receipt_email ??
        (metadata.customer_email as string | undefined) ??
        (metadata.email as string | undefined),
      phone: charge?.billing_details?.phone,
      invoice: invoiceReference,
      rawMetadata: metadata,
    },
    raw: charge as Record<string, unknown>,
  };
}

export function mapStripePaymentIntent(intent: StripePaymentIntentPayload): NormalizedTransaction {
  const intentCharges =
    intent && typeof intent === "object" && "charges" in intent
      ? (intent as { charges?: { data?: Array<StripeChargePayload | Stripe.Charge> } }).charges
      : undefined;
  const charge = intentCharges?.data?.[0];
  if (charge) {
    return mapStripeCharge({
      ...charge,
      payment_intent:
        typeof intent === "object" && intent && "id" in intent && typeof intent.id === "string"
          ? intent.id
          : (charge as { payment_intent?: string | null })?.payment_intent,
      amount: charge.amount ?? intent.amount,
      currency: charge.currency ?? intent.currency,
      status: charge.status ?? intent.status,
      metadata: { ...intent.metadata, ...charge.metadata },
    });
  }

  const created = typeof intent?.created === "number" ? intent.created * 1000 : Date.now();
  const amountMinor =
    typeof intent?.amount_received === "number"
      ? intent.amount_received
      : typeof intent?.amount === "number"
        ? intent.amount
        : 0;

  const metadata = intent?.metadata ?? {};
  const paymentIntentId =
    typeof (intent as { id?: string })?.id === "string" ? (intent as { id?: string }).id : undefined;
  const invoiceId =
    typeof (intent as { invoice?: string })?.invoice === "string"
      ? (intent as { invoice?: string }).invoice
      : undefined;
  return {
    externalId: stripeExternalId({ paymentIntentId, invoiceId }),
    provider: "Stripe",
    amountMinor,
    currency: (intent?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName:
      safeString((intent as { billing_details?: { name?: string } })?.billing_details?.name) ??
      safeString(metadata.customer_name as string | undefined) ??
      safeString(metadata.member_name as string | undefined) ??
      safeString(intent?.customer),
    productType: safeString(intent?.metadata?.product_type as string | undefined) ?? "Stripe Payment Intent",
    status: resolveStripeStatus({
      status: intent?.status ?? undefined,
      paid: amountMinor > 0,
    }),
    confidence: amountMinor > 0 ? "High" : "Needs Review",
    description: intent?.description,
    reference: paymentIntentId ?? invoiceId ?? intent?.id,
    metadata: {
      paymentIntentId,
      invoiceId,
      email:
        safeString((intent as { billing_details?: { email?: string } })?.billing_details?.email) ??
        safeString((metadata.customer_email as string) ?? (metadata.email as string) ?? undefined),
      phone: (intent as { billing_details?: { phone?: string } })?.billing_details?.phone,
      customer: intent?.customer,
      rawMetadata: intent?.metadata,
    },
    raw: intent as Record<string, unknown>,
  };
}

export function mapStripeInvoice(invoice: StripeInvoicePayload): NormalizedTransaction {
  const created = typeof invoice?.created === "number" ? invoice.created * 1000 : Date.now();
  const amountMinor = typeof invoice?.amount_paid === "number" ? invoice.amount_paid : 0;
  const invoiceId = typeof invoice?.id === "string" ? invoice.id : undefined;
  const paymentIntentId = (() => {
    const payload = (invoice as { payment_intent?: string | { id?: string } } | null)?.payment_intent;
    if (typeof payload === "string") return payload;
    return payload?.id;
  })();
  return {
    externalId: stripeExternalId({ paymentIntentId, invoiceId }),
    provider: "Stripe",
    amountMinor,
    currency: (invoice?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName: safeString(invoice?.customer_name) ?? safeString(invoice?.customer),
    productType: safeString(invoice?.metadata?.product_type as string | undefined) ?? "Stripe Invoice",
    status: resolveStripeStatus({
      status: invoice?.status ?? undefined,
      paid: amountMinor > 0,
    }),
    confidence: amountMinor > 0 ? "High" : "Needs Review",
    description: invoice?.number ?? invoice?.hosted_invoice_url,
    reference: paymentIntentId ?? invoiceId ?? invoice?.id,
    metadata: {
      paymentIntentId,
      invoiceId,
      email: invoice?.customer_email,
      rawMetadata: invoice?.metadata,
    },
    raw: invoice as Record<string, unknown>,
  };
}

export function mapStripeCheckoutSession(session: StripeCheckoutSessionPayload): NormalizedTransaction {
  const created = typeof session?.created === "number" ? session.created * 1000 : Date.now();
  const amountMinor = typeof session?.amount_total === "number" ? session.amount_total : 0;
  const status = resolveStripeStatus({
    status: (session?.payment_status ?? session?.status) ?? undefined,
    paid: amountMinor > 0,
  });

  const paymentIntentId =
    typeof session?.payment_intent === "string"
      ? session.payment_intent
      : (session?.payment_intent as { id?: string } | undefined)?.id;
  const sessionId = typeof session?.id === "string" ? session.id : undefined;
  return {
    externalId: stripeExternalId({ paymentIntentId, sessionId }),
    provider: "Stripe",
    amountMinor,
    currency: (session?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName: safeString(session?.customer_details?.name) ?? safeString(session?.customer),
    productType: safeString(session?.mode) ?? "Checkout Session",
    status,
    confidence: amountMinor > 0 ? "High" : "Needs Review",
    description: session?.id ?? "Checkout Session",
    reference: paymentIntentId ?? sessionId ?? session?.id,
    metadata: {
      paymentIntentId,
      sessionId,
      email: session?.customer_details?.email,
      rawMetadata: session?.metadata,
    },
    raw: session as Record<string, unknown>,
  };
}

export function mapStarlingFeedItem(item: StarlingFeedItem): NormalizedTransaction {
  const feedItemUid = item?.feedItemUid ?? randomUUID();
  const amountMinor =
    item?.amount?.minorUnits ??
    item?.totalAmount?.minorUnits ??
    item?.sourceAmount?.minorUnits ??
    0;
  const currency =
    (item?.amount?.currency ??
      item?.totalAmount?.currency ??
      item?.sourceAmount?.currency ??
      "GBP")?.toString().toUpperCase();
  const occurredAt =
    item?.transactionTime ??
    item?.updatedAt ??
    item?.spendUntil ??
    new Date().toISOString();
  const status =
    item?.status === "SETTLED"
      ? "Completed"
      : item?.status === "DECLINED"
        ? "Failed"
        : "Needs Review";

  return {
    externalId: `starling_${feedItemUid}`,
    provider: "Starling",
    personName: item?.counterPartyName ?? item?.reference,
    productType: item?.spendingCategory ?? "Bank Transfer",
    status,
    confidence: resolvedConfidence({ counterPartyName: item?.counterPartyName }),
    amountMinor,
    currency,
    occurredAt: new Date(occurredAt).toISOString(),
    description: item?.reference ?? item?.description,
    reference: item?.reference ?? feedItemUid,
    metadata: {
      direction: item?.direction,
      spendingCategory: item?.spendingCategory,
    },
    raw: item as Record<string, unknown>,
  };
}

function toMinorUnits(value?: number | string | null) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Math.round(value * 100);
  }
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  if (value.toString().includes(".")) {
    return Math.round(numeric * 100);
  }
  return Math.round(numeric);
}

export function mapGlofoxPayment(payload: GlofoxPaymentPayload): NormalizedTransaction {
  const externalId =
    payload.payment_id ?? payload.id ?? payload.sale_id ?? randomUUID();
  const occurredAtValue =
    payload.transaction_time ??
    payload.processed_at ??
    payload.created_at ??
    new Date().toISOString();
  const statusValue = (payload.payment_status ?? payload.status ?? "").toLowerCase();
  const status =
    statusValue === "paid" || statusValue === "completed"
      ? "Completed"
      : statusValue === "failed"
        ? "Failed"
        : "Needs Review";

  const amountMinor = toMinorUnits(payload.amount ?? payload.total);

  return {
    externalId: `glofox_${externalId}`,
    provider: "Glofox",
    amountMinor,
    currency: (payload.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(occurredAtValue).toISOString(),
    personName: payload.member_name,
    productType:
      payload.membership_name ??
      payload.plan_name ??
      payload.product_name ??
      payload.payment_type ??
      "Glofox Sale",
    status,
    confidence: amountMinor > 0 ? "High" : "Needs Review",
    description: payload.description ?? payload.reference,
    reference: payload.reference ?? externalId?.toString(),
    metadata: {
      email: payload.member_email,
      phone: payload.member_phone,
      memberId: payload.member_id,
      raw: payload,
    },
    raw: payload as Record<string, unknown>,
  };
}
