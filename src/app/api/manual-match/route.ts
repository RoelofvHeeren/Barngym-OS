import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
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
            metadata: item.transaction.metadata,
            raw: item.transaction.raw,
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
    const leadPayload = body?.lead as
      | { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }
      | undefined;
    const mapRelated = body?.mapRelated ?? true;

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

      if (
        queueItem.transaction.provider === "Starling" &&
        (queueItem.transaction.personName || queueItem.transaction.reference)
      ) {
        const refKey = (queueItem.transaction.reference || "").trim().toLowerCase();
        const nameKey = (queueItem.transaction.personName || "").trim().toLowerCase();
        const key = refKey || nameKey;
        if (key.trim().length) {
          await prisma.counterpartyMapping.upsert({
            where: { provider_key: { provider: "Starling", key } },
            update: { leadId },
            create: { provider: "Starling", key, leadId },
          });

          const related = await prisma.transaction.findMany({
            where: {
              provider: "Starling",
              OR: [
                {
                  reference: {
                    equals: queueItem.transaction.reference ?? "",
                    mode: "insensitive",
                  },
                },
                {
                  personName: {
                    equals: queueItem.transaction.personName ?? "",
                    mode: "insensitive",
                  },
                },
              ],
            },
            select: { id: true, leadId: true },
          });

          const unmappedIds = related.filter((t) => !t.leadId).map((t) => t.id);

          if (unmappedIds.length) {
            await prisma.transaction.updateMany({
              where: { id: { in: unmappedIds } },
              data: {
                leadId,
                confidence: "Matched",
                status: queueItem.transaction.status === "Needs Review" ? "Completed" : queueItem.transaction.status,
              },
            });
            await prisma.manualMatchQueue.updateMany({
              where: { transactionId: { in: unmappedIds } },
              data: { resolvedAt: new Date(), resolvedBy: "auto-mapping" },
            });
          }

          return NextResponse.json({
            ok: true,
            message: `Attached and auto-mapped ${unmappedIds.length} Starling transactions with this reference/person name.`,
            relatedIds: unmappedIds,
          });
        }
      }
      }
    }

    if (action === "create") {
      const raw = (queueItem.transaction.metadata as Record<string, unknown>)?.raw as
        | Record<string, unknown>
        | undefined;
      const metadataPayload = {
        source: "manual-create",
        raw: raw ?? null,
      } as Prisma.InputJsonValue;
      const personName =
        leadPayload?.firstName || leadPayload?.lastName
          ? `${leadPayload?.firstName ?? ""} ${leadPayload?.lastName ?? ""}`.trim()
          : queueItem.transaction.personName ?? (raw?.["Full name"] as string | undefined);
      const emailCandidate =
        leadPayload?.email ??
        (raw?.["Email"] as string | undefined) ??
        (queueItem.transaction.metadata as Record<string, unknown>)?.customerEmail ??
        undefined;
      const email = typeof emailCandidate === "string" ? emailCandidate : undefined;
      const phone = leadPayload?.phone ?? (raw?.["Phone"] as string | undefined) ?? undefined;
      const [firstName, ...rest] = (personName ?? "").split(" ").filter(Boolean);
      const lastName = rest.join(" ");

      const newLead = await prisma.lead.create({
        data: {
          firstName: firstName || null,
          lastName: lastName || null,
          email: typeof email === "string" ? email.toLowerCase() : null,
          phone: phone ?? null,
          channel: queueItem.transaction.provider ?? "Imported",
          stage: "Won",
          membershipName: queueItem.transaction.productType ?? null,
          metadata: metadataPayload,
        },
      });

      await prisma.transaction.update({
        where: { id: queueItem.transactionId },
        data: {
          leadId: newLead.id,
          status: queueItem.transaction.status === "Needs Review" ? "Completed" : queueItem.transaction.status,
          confidence: "Matched",
        },
      });

      const emailLower = email?.toLowerCase();
      if (emailLower) {
        const updatedTx = await prisma.transaction.updateMany({
          where: {
            leadId: null,
            OR: [
              { reference: { equals: emailLower, mode: "insensitive" } },
              { personName: { equals: emailLower, mode: "insensitive" } },
              {
                metadata: {
                  path: ["customerEmail"],
                  string_contains: emailLower,
                  mode: "insensitive",
                },
              },
              {
                metadata: {
                  path: ["email"],
                  string_contains: emailLower,
                  mode: "insensitive",
                },
              },
            ],
          },
          data: {
            leadId: newLead.id,
            confidence: "Matched",
            status: queueItem.transaction.status === "Needs Review" ? "Completed" : queueItem.transaction.status,
          },
        });

        if (updatedTx.count) {
          const txIds = await prisma.transaction.findMany({
            where: { leadId: newLead.id },
            select: { id: true },
          });
          const txIdList = txIds.map((t) => t.id);
          if (txIdList.length) {
            await prisma.manualMatchQueue.updateMany({
              where: { transactionId: { in: txIdList } },
              data: { resolvedAt: new Date(), resolvedBy: "auto-mapping" },
            });
          }
        }
      }
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
