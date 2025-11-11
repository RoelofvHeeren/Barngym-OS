import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { TransactionRecord, addTransactions } from "@/lib/transactionStore";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

type StripeBackfillRequest = {
  secretKey: string;
  days?: number;
};

type StarlingBackfillRequest = {
  accessToken: string;
  days?: number;
};

type BackfillPayload = {
  stripe?: StripeBackfillRequest;
  starling?: StarlingBackfillRequest;
};

type BackfillSummary = {
  source: string;
  status: "success" | "error" | "skipped";
  message: string;
  records?: number;
};

type BackfillRunResult = {
  summary: BackfillSummary;
  transactions: TransactionRecord[];
};

type StripeCharge = {
  id?: string;
  created?: number;
  amount?: number;
  currency?: string;
  status?: string;
  paid?: boolean;
  billing_details?: {
    name?: string;
    email?: string;
  };
  metadata?: Record<string, unknown>;
  customer?: string;
  description?: string;
  statement_descriptor?: string;
  invoice?: string;
};

type StarlingFeedItem = {
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
  description?: string;
  direction?: string;
  spendingCategory?: string;
};

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function mapStripeCharge(charge: StripeCharge): TransactionRecord {
  const created = typeof charge?.created === "number" ? charge.created * 1000 : Date.now();
  const amountMinor = typeof charge?.amount === "number" ? charge.amount : 0;
  const currency = (charge?.currency ?? "eur").toString().toUpperCase();
  const status =
    charge?.status === "succeeded"
      ? "Completed"
      : charge?.status === "failed"
      ? "Failed"
      : "Needs Review";
  const confidence = charge?.paid ? "High" : "Needs Review";

  const metadata = (charge?.metadata ?? {}) as Record<string, unknown>;

  return {
    id: `stripe_${charge?.id ?? randomUUID()}`,
    source: "Stripe",
    personName:
      safeString(charge?.billing_details?.name) ||
      safeString(metadata.member_name) ||
      safeString(charge?.customer) ||
      undefined,
    productType: safeString(metadata.product_type) ?? "Stripe Charge",
    status,
    confidence,
    amountMinor,
    currency,
    occurredAt: new Date(created).toISOString(),
    description: charge?.description ?? charge?.statement_descriptor,
    reference: charge?.id,
    metadata: {
      customer: safeString(charge?.customer),
      email: safeString(charge?.billing_details?.email),
      invoice: safeString(charge?.invoice),
    },
  };
}

function mapStarlingFeedItem(item: StarlingFeedItem): TransactionRecord {
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
  const confidence = item?.counterPartyName ? "Medium" : "Needs Review";

  return {
    id: `starling_${feedItemUid}`,
    source: "Starling",
    personName: item?.counterPartyName ?? item?.reference,
    productType: item?.spendingCategory ?? "Bank Transfer",
    status,
    confidence,
    amountMinor,
    currency,
    occurredAt: new Date(occurredAt).toISOString(),
    description: item?.reference ?? item?.description,
    reference: item?.reference ?? feedItemUid,
    metadata: {
      direction: item?.direction,
      spendingCategory: item?.spendingCategory,
    },
  };
}

async function runStripeBackfill(config: StripeBackfillRequest): Promise<BackfillRunResult> {
  const days = Number.isFinite(config.days) ? Number(config.days) : 30;
  const since = Math.floor((Date.now() - days * DAY_MS) / 1000);

  const response = await fetch(
    `https://api.stripe.com/v1/charges?limit=100&created[gte]=${since}`,
    {
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Stripe backfill failed (${response.status}). ${errorBody || "No details"}`
    );
  }

  const payload = await response.json();
  const charges = Array.isArray(payload.data) ? payload.data : [];
  const transactions = charges.map(mapStripeCharge);
  return {
    summary: {
      source: "Stripe",
      status: "success",
      message: `Fetched ${charges.length} charge${
        charges.length === 1 ? "" : "s"
      } from the last ${days} day${days === 1 ? "" : "s"}.`,
      records: charges.length,
    },
    transactions,
  };
}

async function runStarlingBackfill(config: StarlingBackfillRequest): Promise<BackfillRunResult> {
  const days = Number.isFinite(config.days) ? Number(config.days) : 90;
  const sinceIso = new Date(Date.now() - days * DAY_MS).toISOString();
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    Accept: "application/json",
  };

  const accountsResponse = await fetch(
    "https://api.starlingbank.com/api/v2/accounts",
    { headers }
  );

  if (!accountsResponse.ok) {
    const errorBody = await accountsResponse.text();
    throw new Error(
      `Starling accounts lookup failed (${accountsResponse.status}). ${
        errorBody || "No details"
      }`
    );
  }

  const accountsPayload = await accountsResponse.json();
  const primaryAccount =
    accountsPayload?.accounts?.[0] ??
    (Array.isArray(accountsPayload) ? accountsPayload[0] : null);

  const accountUid = primaryAccount?.accountUid;
  const defaultCategory =
    primaryAccount?.defaultCategory?.categoryUid ??
    primaryAccount?.defaultCategory ??
    primaryAccount?.categories?.[0]?.categoryUid;

  if (!accountUid || !defaultCategory) {
    throw new Error(
      "Starling did not return an account UID or default category. Verify the token scopes."
    );
  }

  const feedUrl = `https://api.starlingbank.com/api/v2/feed/account/${accountUid}/category/${defaultCategory}?changesSince=${encodeURIComponent(
    sinceIso
  )}`;
  const feedResponse = await fetch(feedUrl, { headers });

  if (!feedResponse.ok) {
    const errorBody = await feedResponse.text();
    throw new Error(
      `Starling feed fetch failed (${feedResponse.status}). ${errorBody || "No details"}`
    );
  }

  const feedPayload = await feedResponse.json();
  const feedItems: StarlingFeedItem[] =
    (Array.isArray(feedPayload?.feedItems) && (feedPayload.feedItems as StarlingFeedItem[])) ||
    (Array.isArray(feedPayload?._embedded?.feedItems) &&
      (feedPayload._embedded.feedItems as StarlingFeedItem[])) ||
    (Array.isArray(feedPayload?.items) && (feedPayload.items as StarlingFeedItem[])) ||
    [];

  const transactions = feedItems.map(mapStarlingFeedItem);

  return {
    summary: {
      source: "Starling",
      status: "success",
      message: `Fetched ${transactions.length} feed item${
        transactions.length === 1 ? "" : "s"
      } from the last ${days} day${days === 1 ? "" : "s"}.`,
      records: transactions.length,
    },
    transactions,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BackfillPayload;
    const summaries: BackfillSummary[] = [];

    if (body?.stripe?.secretKey?.trim()) {
      try {
        const result = await runStripeBackfill(body.stripe);
        const stats = await addTransactions(result.transactions);
        summaries.push({
          ...result.summary,
          records: result.transactions.length,
          message: `${result.summary.message} Stored ${stats.added} new entr${
            stats.added === 1 ? "y" : "ies"
          }.`,
        });
      } catch (error) {
        summaries.push({
          source: "Stripe",
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Stripe backfill failed unexpectedly.",
        });
      }
    } else {
      summaries.push({
        source: "Stripe",
        status: "skipped",
        message: "No Stripe secret key provided, skipping.",
      });
    }

    if (body?.starling?.accessToken?.trim()) {
      try {
        const result = await runStarlingBackfill(body.starling);
        const stats = await addTransactions(result.transactions);
        summaries.push({
          ...result.summary,
          records: result.transactions.length,
          message: `${result.summary.message} Stored ${stats.added} new entr${
            stats.added === 1 ? "y" : "ies"
          }.`,
        });
      } catch (error) {
        summaries.push({
          source: "Starling",
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Starling backfill failed unexpectedly.",
        });
      }
    } else {
      summaries.push({
        source: "Starling",
        status: "skipped",
        message: "No Starling token provided, skipping.",
      });
    }

    const ok = summaries.some((summary) => summary.status === "success");

    return NextResponse.json({
      ok,
      message: ok
        ? "Backfill complete. Review sync logs for details."
        : "No sources were successfully backfilled.",
      summaries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to run backfill request.",
      },
      { status: 500 }
    );
  }
}
