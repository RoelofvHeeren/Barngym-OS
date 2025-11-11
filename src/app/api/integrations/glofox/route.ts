import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { apiKey: incomingKey, apiToken: incomingToken, studioId, webhookSalt } =
      await request.json();

    const record = await prisma.connectionSecret.findUnique({
      where: { provider: "glofox" },
    });

    const storedSecret =
      (record?.secret as
        | { apiKey?: string; apiToken?: string; studioId?: string; webhookSalt?: string }
        | null) ?? null;

    const apiKey = incomingKey?.trim() || storedSecret?.apiKey;
    const apiToken = incomingToken?.trim() || storedSecret?.apiToken;
    const resolvedStudio = studioId?.trim() || storedSecret?.studioId;
    const resolvedWebhookSalt = webhookSalt?.trim() || storedSecret?.webhookSalt;

    if (!apiKey || !apiToken) {
      return NextResponse.json(
        { ok: false, message: "Provide the API key and token to connect." },
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

    await prisma.connectionSecret.upsert({
      where: { provider: "glofox" },
      update: {
        secret: {
          apiKey,
          apiToken,
          studioId: resolvedStudio,
          webhookSalt: resolvedWebhookSalt,
        },
        status: "connected",
        accountId: resolvedStudio ?? undefined,
        lastVerifiedAt: new Date(),
      },
      create: {
        provider: "glofox",
        secret: {
          apiKey,
          apiToken,
          studioId: resolvedStudio,
          webhookSalt: resolvedWebhookSalt,
        },
        status: "connected",
        accountId: resolvedStudio ?? undefined,
        lastVerifiedAt: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        source: "Glofox",
        detail: resolvedStudio
          ? `Studio ${resolvedStudio} connected.`
          : "API credentials verified.",
        records: "Credential test",
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Authenticated with Glofox${
        resolvedStudio ? ` (studio ${resolvedStudio})` : ""
      }. ${
        resolvedWebhookSalt
          ? "Webhook signature salt captured."
          : "Add the webhook salt to validate incoming events."
      }`,
      data: {
        sessionExpiry: loginPayload?.expires_at ?? null,
      },
      studioId: resolvedStudio ?? null,
      stored: true,
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
