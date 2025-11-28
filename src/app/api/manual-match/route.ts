import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const queue = await prisma.manualMatchQueue.findMany({
      where: { resolvedAt: null },
      include: {
        transaction: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const data = queue.map((item) => ({
      id: item.id,
      reason: item.reason,
      suggestedMemberIds: item.suggestedMemberIds as string[] | null,
      createdAt: item.createdAt.toISOString(),
      transaction: item.transaction
        ? {
            id: item.transaction.id,
            occurredAt: item.transaction.occurredAt.toISOString(),
            amountMinor: item.transaction.amountMinor,
            currency: item.transaction.currency,
            provider: item.transaction.provider,
            productType: item.transaction.productType,
            personName: item.transaction.personName,
            reference: item.transaction.reference,
            status: item.transaction.status,
            confidence: item.transaction.confidence,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to load manual queue." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action as string | undefined;
    const queueId = body?.queueId as string | undefined;
    const leadId = body?.leadId as string | undefined;

    if (!action || !queueId) {
      return NextResponse.json(
        { ok: false, message: "Provide action and queueId." },
        { status: 400 }
      );
    }

    const queueItem = await prisma.manualMatchQueue.findUnique({
      where: { id: queueId },
      include: { transaction: true },
    });

    if (!queueItem || !queueItem.transaction) {
      return NextResponse.json({ ok: false, message: "Queue item not found." }, { status: 404 });
    }

    if (action === "attach") {
      if (!leadId) {
        return NextResponse.json(
          { ok: false, message: "Provide leadId to attach." },
          { status: 400 }
        );
      }

      await prisma.transaction.update({
        where: { id: queueItem.transactionId },
        data: {
          leadId,
          status: queueItem.transaction.status === "Needs Review" ? "Completed" : queueItem.transaction.status,
          confidence: "Matched",
        },
      });
    }

    await prisma.manualMatchQueue.update({
      where: { id: queueId },
      data: {
        resolvedAt: new Date(),
        resolvedBy: "system",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to update manual queue." },
      { status: 500 }
    );
  }
}
