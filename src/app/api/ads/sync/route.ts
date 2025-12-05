import { NextResponse } from "next/server";
import { fetchInsightsRange } from "@/services/meta/metaClient";
import { ingestInsights } from "@/services/meta/metaIngestService";

export const runtime = "nodejs";

export async function POST() {
  try {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 3);

    const rows = await fetchInsightsRange(from, now);
    await ingestInsights(rows);

    return NextResponse.json({
      ok: true,
      rows: rows.length,
      from: from.toISOString(),
      to: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Meta Ads sync failed." },
      { status: 500 }
    );
  }
}
