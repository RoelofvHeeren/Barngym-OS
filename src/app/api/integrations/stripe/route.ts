import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { secretKey: incomingSecret, webhookSecret: incomingWebhook } =
      await request.json();

    const record = await prisma.connectionSecret.findUnique({
      where: { provider: "stripe" },
    });

    const storedSecret =
      (record?.secret as { secretKey?: string; webhookSecret?: string } | null) ??
      null;

    const secretKey = incomingSecret?.trim() || storedSecret?.secretKey;
    const webhookSecret = incomingWebhook?.trim() || storedSecret?.webhookSecret;

    if (!secretKey) {
      return NextResponse.json(
        { ok: false, message: "Provide a Stripe secret key to connect." },
        { status: 400 }
      );
    }

    const accountResponse = await fetch("https://api.stripe.com/v1/accounts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!accountResponse.ok) {
      const errorBody = await accountResponse.text();
      throw new Error(
        `Stripe rejected the credentials (${accountResponse.status}). ${errorBody}`
      );
    }

    const accountData = await accountResponse.json();

    await prisma.connectionSecret.upsert({
      where: { provider: "stripe" },
      update: {
        secret: { secretKey, webhookSecret },
        status: "connected",
        accountId: accountData.id,
        lastVerifiedAt: new Date(),
      },
      create: {
        provider: "stripe",
        secret: { secretKey, webhookSecret },
        status: "connected",
        accountId: accountData.id,
        lastVerifiedAt: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        source: "Stripe",
        detail: `Credentials verified for ${accountData.id}.`,
        records: "Credential test",
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Connected to Stripe account ${accountData.id}.${
        webhookSecret ? " Webhook secret captured." : ""
      }`,
      accountId: accountData.id,
      stored: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify Stripe credentials.",
      },
      { status: 500 }
    );
  }
}
