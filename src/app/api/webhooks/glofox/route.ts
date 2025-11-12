import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NormalizedTransaction, mapGlofoxPayment, upsertTransactions } from "@/lib/transactions";

export const runtime = "nodejs";

type GlofoxSecret = {
  apiKey?: string;
  apiToken?: string;
  studioId?: string;
  webhookSalt?: string;
};

function verifySignature(rawBody: string, provided: string | null, salt?: string | null) {
  if (!salt) return true;
  if (!provided) return false;
  const digest = createHmac("sha256", salt).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(provided));
  } catch {
    return false;
  }
}

function extractPayments(payload: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(payload.payments)) {
    return payload.payments as Record<string, unknown>[];
  }
  if (payload.payment && typeof payload.payment === "object") {
    return [payload.payment as Record<string, unknown>];
  }
  if (payload.sale && typeof payload.sale === "object") {
    return [payload.sale as Record<string, unknown>];
  }
  if (payload.data && Array.isArray((payload.data as { payments?: unknown[] }).payments)) {
    return ((payload.data as { payments?: unknown[] }).payments ?? []) as Record<string, unknown>[];
  }
  return [payload as Record<string, unknown>];
}

export async function POST(request: Request) {
  let rawBody: string | null = null;
  try {
    rawBody = await request.text();
    const record = await prisma.connectionSecret.findUnique({ where: { provider: "glofox" } });
    const secret = (record?.secret as GlofoxSecret | null) ?? null;
    if (!secret?.apiKey || !secret?.apiToken) {
      return NextResponse.json(
        { ok: false, message: "Glofox is not connected. Add the API credentials first." },
        { status: 400 }
      );
    }

    const signature = request.headers.get("x-glofox-signature");
    if (!verifySignature(rawBody, signature, secret.webhookSalt)) {
      return NextResponse.json({ ok: false, message: "Invalid Glofox signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const payments = extractPayments(payload).filter(Boolean);

    if (!payments.length) {
      return NextResponse.json({ ok: true, message: "No payments in payload." });
    }

    const normalized: NormalizedTransaction[] = payments.map((payment) =>
      mapGlofoxPayment(payment)
    );
    const result = await upsertTransactions(normalized);

    await prisma.syncLog.create({
      data: {
        source: "Glofox",
        detail: `Webhook processed ${normalized.length} payment${normalized.length === 1 ? "" : "s"}.`,
        records: result.added.toString(),
      },
    });

    return NextResponse.json({ ok: true, processed: normalized.length, stored: result.added });
  } catch (error) {
    console.error("Glofox webhook failed", error, rawBody ?? "<empty>");
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Glofox webhook failed." },
      { status: 500 }
    );
  }
}
