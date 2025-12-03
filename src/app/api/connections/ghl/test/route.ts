import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { apiKey, locationId } = (await request.json()) as {
      apiKey?: string;
      locationId?: string;
    };

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { ok: false, message: "GoHighLevel API key is required." },
        { status: 400 }
      );
    }

    const response = await fetch("https://rest.gohighlevel.com/v1/contacts/?limit=1", {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GHL test failed (${response.status}). ${body || "No details"}`);
    }

    return NextResponse.json({
      ok: true,
      message: "GoHighLevel connected.",
      locationId: locationId?.trim() || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify GoHighLevel.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
