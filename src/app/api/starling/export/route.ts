import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_CHUNK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type ConnectionSecret = {
  accessToken?: string;
  webhookUrl?: string;
};

type StarlingAccountResponse = {
  accounts?: Array<{
    accountUid: string;
    defaultCategory: {
      categoryUid: string;
    } | null;
  }>;
};

type FeedItem = {
  feedItemUid: string;
  amount?: { minorUnits?: number; currency?: string };
  totalAmount?: { minorUnits?: number; currency?: string };
  direction?: string;
  counterPartyName?: string;
  counterPartyType?: string;
  counterPartyUid?: string;
  reference?: string;
  description?: string;
  spendingCategory?: string;
  transactionTime?: string;
  updatedAt?: string;
  sourceAmount?: { minorUnits?: number; currency?: string };
  status?: string;
  source?: string;
  merchantUid?: string;
  categoryUid?: string;
  feedItemType?: string;
};

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function formatCsvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\"")) {
    return `"${stringValue.replace(/\"/g, '""')}"`;
  }
  return stringValue;
}

function toIsoString(date: Date) {
  return date.toISOString();
}

function mapFeedItemToCsvRow(item: FeedItem) {
  const amount =
    item.amount?.minorUnits ??
    item.totalAmount?.minorUnits ??
    item.sourceAmount?.minorUnits ??
    0;
  const currency =
    item.amount?.currency ??
    item.totalAmount?.currency ??
    item.sourceAmount?.currency ??
    "GBP";
  const occurredAt =
    item.transactionTime ?? item.updatedAt ?? new Date().toISOString();

  return [
    item.feedItemUid,
    occurredAt,
    item.updatedAt ?? "",
    item.direction ?? "",
    item.status ?? "",
    amount,
    currency,
    item.source ?? "",
    item.spendingCategory ?? "",
    item.counterPartyName ?? "",
    item.counterPartyType ?? "",
    item.counterPartyUid ?? "",
    item.merchantUid ?? "",
    item.reference ?? "",
    item.description ?? "",
    item.feedItemType ?? "",
    item.categoryUid ?? "",
    JSON.stringify(item),
  ]
    .map(formatCsvValue)
    .join(",");
}

async function fetchFeedChunk(
  token: string,
  accountUid: string,
  categoryUid: string,
  from: Date,
  to: Date
) {
  const params = new URLSearchParams({
    minTransactionTimestamp: toIsoString(from),
    maxTransactionTimestamp: toIsoString(to),
  });
  const url = `https://api.starlingbank.com/api/v2/feed/account/${accountUid}/category/${categoryUid}/transactions-between?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Starling export failed (${response.status}). ${body}`);
  }

  const payload = await response.json();
  const feedItems:
    | FeedItem[]
    | undefined =
    payload?.feedItems || payload?._embedded?.feedItems || payload?.items;
  return Array.isArray(feedItems) ? feedItems : [];
}

async function resolveAccount(token: string) {
  const response = await fetch("https://api.starlingbank.com/api/v2/accounts", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Unable to fetch Starling account metadata (${response.status}). ${body}`
    );
  }
  const payload = (await response.json()) as StarlingAccountResponse;
  const account = payload.accounts?.[0];
  if (!account?.accountUid || !account.defaultCategory?.categoryUid) {
    throw new Error("Starling account payload missing category info.");
  }
  return {
    accountUid: account.accountUid,
    categoryUid: account.defaultCategory.categoryUid,
  };
}

function buildChunks(from: Date, to: Date) {
  const chunks: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const next = new Date(Math.min(cursor.getTime() + MAX_CHUNK_DAYS * DAY_MS, to.getTime()));
    chunks.push({ start: new Date(cursor), end: new Date(next) });
    cursor = new Date(next.getTime() + 1000);
  }
  return chunks;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    const fromDate = parseDateParam(fromParam, defaultFrom);
    const toDate = parseDateParam(toParam, now);

    if (fromDate > toDate) {
      throw new Error("`from` date must be before `to` date.");
    }

    const connection = await prisma.connectionSecret.findUnique({
      where: { provider: "starling" },
    });
    const secret = (connection?.secret as ConnectionSecret | null) ?? null;
    const accessToken = secret?.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "Connect Starling first to export transactions." },
        { status: 400 }
      );
    }

    const { accountUid, categoryUid } = await resolveAccount(accessToken);

    const chunks = buildChunks(fromDate, toDate);
    const allItems: FeedItem[] = [];

    for (const chunk of chunks) {
      const items = await fetchFeedChunk(accessToken, accountUid, categoryUid, chunk.start, chunk.end);
      allItems.push(...items);
    }

    const header = [
      "feedItemUid",
      "transactionTime",
      "updatedAt",
      "direction",
      "status",
      "amountMinor",
      "currency",
      "source",
      "spendingCategory",
      "counterPartyName",
      "counterPartyType",
      "counterPartyUid",
      "merchantUid",
      "reference",
      "description",
      "feedItemType",
      "categoryUid",
      "raw",
    ].join(",");
    const rows = allItems.map(mapFeedItemToCsvRow);
    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=starling-feed-${fromDate.toISOString()}-${toDate.toISOString()}.csv`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to export feed items.",
      },
      { status: 500 }
    );
  }
}
