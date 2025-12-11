import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  NormalizedTransaction,
  StarlingFeedItem,
  mapStarlingFeedItem,
  upsertTransactions,
  isIncomingStarling,
  isPaymentProcessorPayout,
} from "@/lib/transactions";

export const runtime = "nodejs";

type StarlingSecret = {
  accessToken?: string;
  webhookUrl?: string;
};

function extractFeedItems(payload: Record<string, unknown>): StarlingFeedItem[] {
  if (Array.isArray(payload.feedItems)) {
    return payload.feedItems as StarlingFeedItem[];
  }
  if (Array.isArray(payload.items)) {
    return payload.items as StarlingFeedItem[];
  }
  if (payload.feedItem) {
    return [payload.feedItem as StarlingFeedItem];
  }
  if (payload.content) {
    return [payload.content as StarlingFeedItem];
  }
  return [payload as StarlingFeedItem];
}

export async function POST(request: Request) {
  try {
    const record = await prisma.connectionSecret.findUnique({ where: { provider: "starling" } });
    const secret = (record?.secret as StarlingSecret | null) ?? null;
    if (!secret?.accessToken) {
      return NextResponse.json(
        { ok: false, message: "Starling is not connected. Add the access token first." },
        { status: 400 }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const feedItems = extractFeedItems(payload).filter(Boolean).filter(isIncomingStarling);

    if (!feedItems.length) {
      return NextResponse.json({ ok: true, message: "No incoming feed items provided." });
    }

    const normalized: NormalizedTransaction[] = feedItems.map((item) => mapStarlingFeedItem(item));
    const result = await upsertTransactions(normalized);

    await prisma.syncLog.create({
      data: {
        source: "Starling",
        detail: `Webhook delivered ${normalized.length} feed item${normalized.length === 1 ? "" : "s"}.`,
        records: result.added.toString(),
      },
    });

    return NextResponse.json({ ok: true, processed: normalized.length, stored: result.added });
  } catch (error) {
    console.error("Starling webhook failed", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Starling webhook failed." },
      { status: 500 }
    );
  }
}
