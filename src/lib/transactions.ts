import { randomUUID } from "crypto";
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { attachLeadBatch } from "./transactionMatcher";

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
};

function safeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
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
    await prisma.transaction
      .upsert({
        where: { externalId: record.externalId },
        update: {
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
          raw: record.raw ?? undefined,
          metadata: record.metadata ?? undefined,
          leadId: record.leadId ?? undefined,
        },
        create: {
          externalId: record.externalId,
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
          raw: record.raw ?? undefined,
          metadata: record.metadata ?? undefined,
          leadId: record.leadId ?? undefined,
        },
      })
      .then(() => {
        if (!existingSet.has(record.externalId)) {
          added += 1;
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
      invoice?: string | null;
    };

type StripePaymentIntentPayload =
  | Stripe.PaymentIntent
  | (StripeChargePayload & {
      amount_received?: number;
      amount_capturable?: number;
      amount_details?: Stripe.PaymentIntent.AmountDetails;
      charges?: { data?: Array<StripeChargePayload | Stripe.Charge> };
    });

type StripeInvoicePayload =
  | Stripe.Invoice
  | {
      id?: string;
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

export function mapStripeCharge(charge: StripeChargePayload): NormalizedTransaction {
  const created = typeof charge?.created === "number" ? charge.created * 1000 : Date.now();
  const amountMinor = typeof charge?.amount === "number" ? charge.amount : 0;
  const metadata = charge?.metadata ?? {};
  const status = resolveStripeStatus({ status: charge?.status, paid: charge?.paid });

  return {
    externalId: `stripe_${charge?.id ?? randomUUID()}`,
    provider: "Stripe",
    amountMinor,
    currency: (charge?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName:
      safeString(charge?.billing_details?.name) ||
      safeString(metadata.member_name) ||
      safeString(charge?.customer) ||
      undefined,
    productType: safeString((metadata.product_type as string | undefined) ?? charge?.description) ?? "Stripe Charge",
    status,
    confidence: charge?.paid ? "High" : "Needs Review",
    description: charge?.description ?? charge?.statement_descriptor,
    reference: charge?.id,
    metadata: {
      customer: charge?.customer,
      email: charge?.billing_details?.email ?? charge?.receipt_email,
      phone: charge?.billing_details?.phone,
      invoice: charge?.invoice,
      rawMetadata: metadata,
    },
    raw: charge as Record<string, unknown>,
  };
}

export function mapStripePaymentIntent(intent: StripePaymentIntentPayload): NormalizedTransaction {
  const charge = intent?.charges?.data?.[0];
  if (charge) {
    return mapStripeCharge({
      ...charge,
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
  return {
    externalId: `stripe_pi_${intent?.id ?? randomUUID()}`,
    provider: "Stripe",
    amountMinor,
    currency: (intent?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName:
      safeString((intent as { billing_details?: { name?: string } })?.billing_details?.name) ??
      safeString(metadata.member_name as string | undefined) ??
      safeString(intent?.customer),
    productType: safeString(intent?.metadata?.product_type as string | undefined) ?? "Stripe Payment Intent",
    status: resolveStripeStatus({ status: intent?.status, paid: amountMinor > 0 }),
    confidence: amountMinor > 0 ? "High" : "Needs Review",
    description: intent?.description,
    reference: intent?.id,
    metadata: {
      email:
        safeString((intent as { billing_details?: { email?: string } })?.billing_details?.email) ??
        safeString((metadata.email as string) ?? undefined),
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
  return {
    externalId: `stripe_inv_${invoice?.id ?? randomUUID()}`,
    provider: "Stripe",
    amountMinor,
    currency: (invoice?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName: safeString(invoice?.customer_name) ?? safeString(invoice?.customer),
    productType: safeString(invoice?.metadata?.product_type as string | undefined) ?? "Stripe Invoice",
    status: resolveStripeStatus({ status: invoice?.status, paid: amountMinor > 0 }),
    confidence: amountMinor > 0 ? "High" : "Needs Review",
    description: invoice?.number ?? invoice?.hosted_invoice_url,
    reference: invoice?.id,
    metadata: {
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
    status: session?.payment_status ?? session?.status,
    paid: amountMinor > 0,
  });

  return {
    externalId: `stripe_cs_${session?.id ?? randomUUID()}`,
    provider: "Stripe",
    amountMinor,
    currency: (session?.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    occurredAt: new Date(created).toISOString(),
    personName: safeString(session?.customer_details?.name) ?? safeString(session?.customer),
    productType: safeString(session?.mode) ?? "Checkout Session",
    status,
    confidence: amountMinor > 0 ? "High" : "Needs Review",
    description: session?.id ?? "Checkout Session",
    reference: session?.payment_intent
      ? typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent.id
      : session?.id,
    metadata: {
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
