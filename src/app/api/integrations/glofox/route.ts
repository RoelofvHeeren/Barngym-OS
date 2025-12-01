import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type GlofoxSecret = {
  apiKey?: string;
  apiToken?: string;
  branchId?: string;
  webhookSalt?: string;
};

export async function POST(request: Request) {
  try {
    const { apiKey: incomingKey, apiToken: incomingToken, branchId, webhookSalt } =
      await request.json();

    const record = await prisma.connectionSecret.findUnique({
      where: { provider: "glofox" },
    });

    const storedSecret = (record?.secret as GlofoxSecret | null) ?? null;

    const apiKey = incomingKey?.trim() || storedSecret?.apiKey;
    const apiToken = incomingToken?.trim() || storedSecret?.apiToken;
    const resolvedBranch = branchId?.trim() || storedSecret?.branchId;
    const resolvedWebhookSalt = webhookSalt?.trim() || storedSecret?.webhookSalt;

    if (!apiKey || !apiToken || !resolvedBranch) {
      return NextResponse.json(
        { ok: false, message: "Provide API key, API token, and branch ID." },
        { status: 400 }
      );
    }

    const resp = await fetch(`https://gf-api.aws.glofox.com/prod/2.0/branches/${resolvedBranch}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-glofox-api-token": apiToken,
        "x-glofox-branch-id": resolvedBranch,
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(
        `Glofox rejected the credentials (${resp.status}). ${body || "Check branch ID, key, token."}`
      );
    }

    const branchPayload = await resp.json().catch(() => null);
    const branchName = branchPayload?.data?.name || branchPayload?.name || resolvedBranch;

    await prisma.connectionSecret.upsert({
      where: { provider: "glofox" },
      update: {
        secret: {
          apiKey,
          apiToken,
          branchId: resolvedBranch,
          webhookSalt: resolvedWebhookSalt,
        },
        status: "connected",
        accountId: resolvedBranch,
        lastVerifiedAt: new Date(),
      },
      create: {
        provider: "glofox",
        secret: {
          apiKey,
          apiToken,
          branchId: resolvedBranch,
          webhookSalt: resolvedWebhookSalt,
        },
        status: "connected",
        accountId: resolvedBranch,
        lastVerifiedAt: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        source: "Glofox",
        detail: `Branch ${branchName} (${resolvedBranch}) connected.`,
        records: "Credential test",
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Authenticated with Glofox (branch ${branchName}). ${
        resolvedWebhookSalt ? "Webhook signature salt captured." : "Add the webhook salt to validate incoming events."
      }`,
      data: { branch: branchPayload?.data ?? branchPayload ?? null },
      branchId: resolvedBranch,
      stored: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to test connection.",
      },
      { status: 500 }
    );
  }
}
