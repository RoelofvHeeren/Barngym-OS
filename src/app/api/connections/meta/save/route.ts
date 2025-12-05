import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { accessToken, adAccountId, apiVersion } = (await request.json()) as {
      accessToken?: string;
      adAccountId?: string;
      apiVersion?: string;
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

    await prisma.connectionSecret.upsert({
      where: { provider: "meta" },
      update: {
        secret: { accessToken: token, adAccountId: account, apiVersion: apiVersion?.trim() || undefined },
        status: "connected",
        accountId: account,
        lastVerifiedAt: new Date(),
      },
      create: {
        provider: "meta",
        secret: { accessToken: token, adAccountId: account, apiVersion: apiVersion?.trim() || undefined },
        status: "connected",
        accountId: account,
        lastVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, message: "Meta Ads credentials saved.", adAccountId: account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save Meta Ads connection.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
