import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { queueIds?: string[]; leadId?: string };
    const queueIds = Array.isArray(body.queueIds) ? body.queueIds : [];
    const leadId = body.leadId;

    if (!queueIds.length || !leadId) {
      return NextResponse.json(
        { ok: false, message: "Provide queueIds and leadId." },
        { status: 400 }
      );
    }

    const queueItems = await prisma.manualMatchQueue.findMany({
      where: { id: { in: queueIds } },
      select: { transactionId: true },
    });
    const transactionIds = queueItems.map((item) => item.transactionId);

    const updated = await prisma.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: {
        leadId,
        confidence: "Matched",
        status: "Completed",
      },
    });

    await prisma.manualMatchQueue.updateMany({
      where: { id: { in: queueIds } },
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
