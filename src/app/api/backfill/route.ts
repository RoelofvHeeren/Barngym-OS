import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  NormalizedTransaction,
  StarlingFeedItem,
  mapStarlingFeedItem,
  mapStripeCharge,
  mapGlofoxPayment,
  upsertTransactions,
} from "@/lib/transactions";

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

type GlofoxBackfillRequest = {
  apiKey: string;
  apiToken: string;
  branchId: string;
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string; // ISO yyyy-mm-dd
};

type BackfillPayload = {
  stripe?: StripeBackfillRequest;
  starling?: StarlingBackfillRequest;
  glofox?: GlofoxBackfillRequest;
};

type BackfillSummary = {
  source: string;
  status: "success" | "error" | "skipped";
  message: string;
  records?: number;
};

type BackfillRunResult = {
  summary: BackfillSummary;
  transactions: NormalizedTransaction[];
};

type StripeSecretPayload = {
  secretKey?: string;
  webhookSecret?: string;
};

type StarlingSecretPayload = {
  accessToken?: string;
  webhookUrl?: string;
};

type GlofoxSecretPayload = {
  apiKey?: string;
  apiToken?: string;
  branchId?: string;
  webhookSalt?: string;
};

async function getConnectionSecret(provider: string) {
  return prisma.connectionSecret.findUnique({ where: { provider } });
}

async function recordSummary(summary: BackfillSummary) {
  try {
    await prisma.syncLog.create({
      data: {
        source: summary.source,
        detail: summary.message,
        records: typeof summary.records === "number" ? summary.records.toString() : undefined,
        errors: summary.status === "error" ? summary.message : undefined,
      },
    });
  } catch (error) {
    console.error("Failed to persist sync log", summary, error);
  }
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

async function runGlofoxBackfill(config: GlofoxBackfillRequest): Promise<BackfillRunResult> {
  const today = new Date();
  const yesterday = new Date(Date.now() - DAY_MS);
  const start_date = config.startDate ?? yesterday.toISOString().slice(0, 10);
  const end_date = config.endDate ?? today.toISOString().slice(0, 10);

  const resp = await fetch("https://gf-api.aws.glofox.com/prod/Analytics/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "x-glofox-api-token": config.apiToken,
      "x-glofox-branch-id": config.branchId,
    },
    body: JSON.stringify({
      branch_id: config.branchId,
      start_date,
      end_date,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Glofox report failed (${resp.status}). ${body || "No details"}`);
  }

  const payload = await resp.json().catch(() => null);
  const payments: Record<string, unknown>[] =
    (payload?.payments as Record<string, unknown>[]) ??
    (payload?.data?.payments as Record<string, unknown>[]) ??
    (Array.isArray(payload) ? payload : []);

  const transactions = payments.map(mapGlofoxPayment);

  return {
    summary: {
      source: "Glofox",
      status: "success",
      message: `Fetched ${transactions.length} payment${transactions.length === 1 ? "" : "s"} from ${start_date} to ${end_date}.`,
      records: transactions.length,
    },
    transactions,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BackfillPayload;
    const summaries: BackfillSummary[] = [];
    const logWrites: Promise<void>[] = [];

    const pushSummary = (summary: BackfillSummary) => {
      summaries.push(summary);
      if (summary.status !== "skipped") {
        logWrites.push(recordSummary(summary));
      }
    };

    const stripeSecretRecord = await getConnectionSecret("stripe");
    const storedStripeSecret =
      (stripeSecretRecord?.secret as StripeSecretPayload | null) ?? null;
    const stripeSecretKey =
      body?.stripe?.secretKey?.trim() || storedStripeSecret?.secretKey;

    if (stripeSecretKey) {
      try {
        const result = await runStripeBackfill({
          secretKey: stripeSecretKey,
          days: body?.stripe?.days,
        });
        const stats = await upsertTransactions(result.transactions);
        pushSummary({
          ...result.summary,
          message: `${result.summary.message} Stored ${stats.added} new entr${
            stats.added === 1 ? "y" : "ies"
          }.`,
        });
      } catch (error) {
        pushSummary({
          source: "Stripe",
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Stripe backfill failed unexpectedly.",
        });
      }
    } else {
      pushSummary({
        source: "Stripe",
        status: "skipped",
        message: "No stored Stripe credentials. Connect Stripe first.",
      });
    }

    const starlingSecretRecord = await getConnectionSecret("starling");
    const storedStarlingSecret =
      (starlingSecretRecord?.secret as StarlingSecretPayload | null) ?? null;
    const starlingAccessToken =
      body?.starling?.accessToken?.trim() || storedStarlingSecret?.accessToken;

    if (starlingAccessToken) {
      try {
        const result = await runStarlingBackfill({
          accessToken: starlingAccessToken,
          days: body?.starling?.days,
        });
        const stats = await upsertTransactions(result.transactions);
        pushSummary({
          ...result.summary,
          message: `${result.summary.message} Stored ${stats.added} new entr${
            stats.added === 1 ? "y" : "ies"
          }.`,
        });
      } catch (error) {
        pushSummary({
          source: "Starling",
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Starling backfill failed unexpectedly.",
        });
      }
    } else {
      pushSummary({
        source: "Starling",
        status: "skipped",
        message: "No stored Starling credentials. Connect Starling first.",
      });
    }

    const glofoxSecretRecord = await getConnectionSecret("glofox");
    const storedGlofoxSecret = (glofoxSecretRecord?.secret as GlofoxSecretPayload | null) ?? null;
    const glofoxApiKey = body?.glofox?.apiKey?.trim() || storedGlofoxSecret?.apiKey;
    const glofoxApiToken = body?.glofox?.apiToken?.trim() || storedGlofoxSecret?.apiToken;
    const glofoxBranchId = body?.glofox?.branchId?.trim() || storedGlofoxSecret?.branchId;

    if (glofoxApiKey && glofoxApiToken && glofoxBranchId) {
      try {
        const result = await runGlofoxBackfill({
          apiKey: glofoxApiKey,
          apiToken: glofoxApiToken,
          branchId: glofoxBranchId,
          startDate: body?.glofox?.startDate,
          endDate: body?.glofox?.endDate,
        });
        const stats = await upsertTransactions(result.transactions);
        pushSummary({
          ...result.summary,
          message: `${result.summary.message} Stored ${stats.added} new entr${
            stats.added === 1 ? "y" : "ies"
          }.`,
        });
      } catch (error) {
        pushSummary({
          source: "Glofox",
          status: "error",
          message: error instanceof Error ? error.message : "Glofox backfill failed unexpectedly.",
        });
      }
    } else {
      pushSummary({
        source: "Glofox",
        status: "skipped",
        message: "No stored Glofox credentials. Connect Glofox first.",
      });
    }

    await Promise.all(logWrites);

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
