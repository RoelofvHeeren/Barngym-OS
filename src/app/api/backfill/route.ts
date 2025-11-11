import { NextResponse } from "next/server";

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

async function runStripeBackfill(config: StripeBackfillRequest): Promise<BackfillSummary> {
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
  const count = Array.isArray(payload.data) ? payload.data.length : 0;
  return {
    source: "Stripe",
    status: "success",
    message: `Fetched ${count} charge${
      count === 1 ? "" : "s"
    } from the last ${days} day${days === 1 ? "" : "s"}.`,
    records: count,
  };
}

async function runStarlingBackfill(config: StarlingBackfillRequest): Promise<BackfillSummary> {
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
  const feedItems =
    feedPayload?.feedItems ??
    feedPayload?._embedded?.feedItems ??
    feedPayload?.items ??
    [];

  return {
    source: "Starling",
    status: "success",
    message: `Fetched ${feedItems.length} feed item${
      feedItems.length === 1 ? "" : "s"
    } from the last ${days} day${days === 1 ? "" : "s"}.`,
    records: Array.isArray(feedItems) ? feedItems.length : 0,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BackfillPayload;
    const summaries: BackfillSummary[] = [];

    if (body?.stripe?.secretKey?.trim()) {
      try {
        summaries.push(await runStripeBackfill(body.stripe));
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
        summaries.push(await runStarlingBackfill(body.starling));
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
