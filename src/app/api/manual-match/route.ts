import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
      | { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; reference?: string | null }
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

    // Validate lead existence if attaching
    if (action === "attach" && leadId) {
      const exists = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json(
          { ok: false, message: "Invalid lead ID. The lead may have been deleted or does not exist." },
          { status: 400 }
        );
      }
    }

    let responseMessage: string | undefined;

    if (action === "attach") {
      if (!leadId) {
        return NextResponse.json(
          { ok: false, message: "Provide leadId to attach." },
          { status: 400 }
        );
      }

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      let contactId: string | null = null;
      if (lead) {
        // Find corresponding contact
        const contact = await prisma.contact.findFirst({
          where: {
            OR: [
              lead.email ? { email: { equals: lead.email, mode: "insensitive" } } : undefined,
              lead.phone ? { phone: { equals: lead.phone, mode: "insensitive" } } : undefined,
            ].filter(Boolean) as Prisma.ContactWhereInput[],
          },
          select: { id: true },
        });
        contactId = contact?.id ?? null;
      }

      const updatedTx = await prisma.transaction.update({
        where: { id: queueItem.transactionId },
        data: {
          leadId,
          contactId, // Link to contact as well
          status: queueItem.transaction.status === "Needs Review" ? "Completed" : queueItem.transaction.status,
          confidence: "Matched",
        },
      });

      if (contactId) {
        await recalculateContactLtv(contactId);
      }

      // Update lead status to Client
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          isClient: true,
          status: "CLIENT",
          stage: "Won",
        },
      });

      if (
        queueItem.transaction.provider?.toLowerCase() === "starling"
      ) {
        const raw = (queueItem.transaction.raw as Record<string, unknown>) ?? {};
        const rawName = (raw.counterPartyName || raw.counterpartyName) as string | undefined;
        const counterPartyName = typeof rawName === "string" ? rawName : undefined;

        const refKey = (queueItem.transaction.reference || "").trim().toLowerCase();
        const nameKey = (queueItem.transaction.personName || "").trim().toLowerCase();
        const rawNameKey = (counterPartyName || "").trim().toLowerCase();

        const key = refKey || nameKey || rawNameKey;
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
                contactId, // Link to contact
                confidence: "Matched",
                status: queueItem.transaction.status === "Needs Review" ? "Completed" : queueItem.transaction.status,
              },
            });
            await prisma.manualMatchQueue.updateMany({
              where: { transactionId: { in: unmappedIds } },
              data: { resolvedAt: new Date(), resolvedBy: "auto-mapping" },
            });
          }

          responseMessage = `Attached and auto-mapped ${unmappedIds.length} Starling transactions with this reference/person name.`;
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
      const reference = leadPayload?.reference ?? queueItem.transaction.reference ?? undefined;
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
          metadata: {
            ...((metadataPayload as Record<string, unknown>) ?? {}),
            reference: reference ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      // Sync/Create Contact
      let contactId: string | null = null;
      const contactEmail = typeof email === "string" ? email.toLowerCase() : null;

      if (contactEmail) {
        const contact = await prisma.contact.upsert({
          where: { email: contactEmail },
          update: {
            fullName: personName || undefined,
            phone: phone || undefined,
          },
          create: {
            email: contactEmail,
            fullName: personName,
            phone: phone,
            sourceTags: ["Manual Match"],
            status: "client",
          },
        });
        contactId = contact.id;
      } else if (phone) {
        // Try to find by phone if no email
        const contact = await prisma.contact.findFirst({
          where: { phone: { equals: phone, mode: 'insensitive' } }
        });
        if (contact) {
          contactId = contact.id;
        }
      }

      await prisma.transaction.update({
        where: { id: queueItem.transactionId },
        data: {
          leadId: newLead.id,
          contactId, // Link to contact
          status: queueItem.transaction.status === "Needs Review" ? "Completed" : queueItem.transaction.status,
          confidence: "Matched",
        },
      });

      if (contactId) {
        await recalculateContactLtv(contactId);
      }

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
            contactId, // Link to contact
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

    return NextResponse.json({ ok: true, message: responseMessage });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to update manual queue." },
      { status: 500 }
    );
  }
}

async function recalculateContactLtv(contactId: string) {
  try {
    const aggregates = await prisma.transaction.aggregate({
      where: {
        contactId: contactId,
        status: 'Completed',
      },
      _sum: {
        amountMinor: true, // Sum amounts in stored currency minor units
      }
    });

    const total = aggregates._sum.amountMinor || 0;

    await prisma.contact.update({
      where: { id: contactId },
      data: { ltvAllCents: total }
    });
  } catch (e) {
    console.error("Failed to recalculate LTV for contact", contactId, e);
  }
}
