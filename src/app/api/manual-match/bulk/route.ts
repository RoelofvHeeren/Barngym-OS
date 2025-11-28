import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transactionIds?: string[]; leadId?: string };
    const transactionIds = Array.isArray(body.transactionIds) ? body.transactionIds : [];
    const leadId = body.leadId;

    if (!transactionIds.length || !leadId) {
      return NextResponse.json(
        { ok: false, message: "Provide transactionIds and leadId." },
        { status: 400 }
      );
    }

    const updated = await prisma.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: {
        leadId,
        confidence: "Matched",
        status: "Completed",
      },
    });

    await prisma.manualMatchQueue.updateMany({
      where: { transactionId: { in: transactionIds } },
      data: { resolvedAt: new Date(), resolvedBy: "bulk-attach" },
    });

    return NextResponse.json({
      ok: true,
      message: `Updated ${updated.count} transactions.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to bulk attach.",
      },
      { status: 500 }
    );
  }
}
