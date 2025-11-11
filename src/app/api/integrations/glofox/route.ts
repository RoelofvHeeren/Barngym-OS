import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { apiKey, apiToken, studioId, webhookSalt } = await request.json();

    if (!apiKey?.trim() || !apiToken?.trim()) {
      return NextResponse.json(
        { ok: false, message: "API key and token are required." },
        { status: 400 }
      );
    }

    const loginResponse = await fetch("https://api.glofox.com/v1/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        api_secret: apiToken,
      }),
    });

    if (!loginResponse.ok) {
      const errorBody = await loginResponse.text();
      throw new Error(
        `Glofox rejected the credentials (${loginResponse.status}). ${errorBody}`
      );
    }

    const loginPayload = await loginResponse.json();

    return NextResponse.json({
      ok: true,
      message: `Authenticated with Glofox${
        studioId ? ` (studio ${studioId})` : ""
      }. ${
        webhookSalt
          ? "Webhook signature salt captured."
          : "Add the webhook salt to validate incoming events."
      }`,
      data: {
        sessionExpiry: loginPayload?.expires_at ?? null,
      },
      studioId: studioId ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to test connection.",
      },
      { status: 500 }
    );
  }
}
