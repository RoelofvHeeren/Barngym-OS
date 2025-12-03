import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { accessToken, adAccountId } = (await request.json()) as {
      accessToken?: string;
      adAccountId?: string;
    };

    if (!accessToken || !accessToken.trim()) {
      return NextResponse.json(
        { ok: false, message: "Meta access token is required." },
        { status: 400 }
      );
    }
    if (!adAccountId || !adAccountId.trim()) {
      return NextResponse.json(
        { ok: false, message: "Meta ad account ID is required." },
        { status: 400 }
      );
    }

    const token = accessToken.trim();
    const account = adAccountId.trim();
    const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(account)}/insights?date_preset=today&limit=1&access_token=${encodeURIComponent(
      token
    )}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Meta test failed (${response.status}). ${body || "No details"}`);
    }

    return NextResponse.json({
      ok: true,
      message: "Meta Ads connected.",
      adAccountId: account,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify Meta Ads.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
