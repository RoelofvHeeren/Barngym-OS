import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { accessToken: incomingToken, webhookUrl: incomingWebhook } =
      await request.json();

    const record = await prisma.connectionSecret.findUnique({
      where: { provider: "starling" },
    });

    const storedSecret =
      (record?.secret as { accessToken?: string; webhookUrl?: string } | null) ??
      null;

    const accessToken = incomingToken?.trim() || storedSecret?.accessToken;
    const webhookUrl = incomingWebhook?.trim() || storedSecret?.webhookUrl;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "Provide a Starling token to connect." },
        { status: 400 }
      );
    }

    const accountResponse = await fetch(
      "https://api.starlingbank.com/api/v2/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!accountResponse.ok) {
      const errorBody = await accountResponse.text();
      throw new Error(
        `Starling rejected the credentials (${accountResponse.status}). ${
          accountResponse.status === 404
            ? "Endpoint returned 404; confirm the token has account:read scope and that the v2 Accounts API is enabled."
            : errorBody
        }`
      );
    }

    const accountData = await accountResponse.json();
    const primaryAccount =
      Array.isArray(accountData.accounts) && accountData.accounts.length > 0
        ? accountData.accounts[0]
        : null;

    await prisma.connectionSecret.upsert({
      where: { provider: "starling" },
      update: {
        secret: { accessToken, webhookUrl },
        status: "connected",
        accountId: primaryAccount?.accountUid,
        lastVerifiedAt: new Date(),
      },
      create: {
        provider: "starling",
        secret: { accessToken, webhookUrl },
        status: "connected",
        accountId: primaryAccount?.accountUid,
        lastVerifiedAt: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        source: "Starling",
        detail: `Bank feed ready${
          primaryAccount?.accountUid ? ` (${primaryAccount.accountUid})` : ""
        }`,
        records: "Credential test",
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Connected to Starling account ${
        primaryAccount?.accountUid ?? "list endpoint"
      }.${webhookUrl ? " Webhook endpoint stored." : ""}`,
      accountUid: primaryAccount?.accountUid ?? null,
      stored: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify Starling access token.",
      },
      { status: 500 }
    );
  }
}
