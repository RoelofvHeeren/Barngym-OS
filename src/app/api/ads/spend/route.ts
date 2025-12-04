import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const periodStart = body.periodStart ? new Date(body.periodStart) : null;
    const periodEnd = body.periodEnd ? new Date(body.periodEnd) : null;
    const amountCents = Number(body.amountCents);
    const source = body.source ?? "manual";

    if (!periodStart || !periodEnd || Number.isNaN(periodStart.valueOf()) || Number.isNaN(periodEnd.valueOf())) {
      return NextResponse.json({ ok: false, message: "Invalid period dates." }, { status: 400 });
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ ok: false, message: "amountCents must be greater than zero." }, { status: 400 });
    }

    await prisma.adsSpend.create({
      data: {
        periodStart,
        periodEnd,
        amountCents: Math.round(amountCents),
        source: String(source),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to save spend." },
      { status: 500 }
    );
  }
}
