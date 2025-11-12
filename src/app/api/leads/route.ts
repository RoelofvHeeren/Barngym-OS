import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type LeadPayload = {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  channel?: string;
  stage?: string;
  owner?: string;
  nextStep?: string;
  valueMinor?: number | null;
  membershipName?: string;
  metadata?: Record<string, unknown>;
};

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (!leads.length) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const leadIds = leads.map((lead) => lead.id);
    const transactions = await prisma.transaction.findMany({
      where: { leadId: { in: leadIds } },
      orderBy: { occurredAt: "desc" },
    });

    const statsMap = new Map<
      string,
      {
        lifetimeMinor: number;
        payments: typeof transactions;
      }
    >();

    transactions.forEach((transaction) => {
      if (!transaction.leadId) return;
      const bucket =
        statsMap.get(transaction.leadId) ?? {
          lifetimeMinor: 0,
          payments: [],
        };
      if (transaction.status !== "Failed") {
        bucket.lifetimeMinor += transaction.amountMinor ?? 0;
      }
      bucket.payments.push(transaction);
      statsMap.set(transaction.leadId, bucket);
    });

    const formatCurrency = (minor: number, currency = "EUR") =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
      }).format(minor / 100);

    const formatDate = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        month: "short",
        day: "numeric",
      }).format(date);

    const formatTimestamp = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);

    const enriched = leads.map((lead) => {
      const stats = statsMap.get(lead.id) ?? {
        lifetimeMinor: 0,
        payments: [],
      };
      const recentPayments = stats.payments.slice(0, 5);
      const lastPayment = recentPayments[0];

      const profile = {
        name:
          [lead.firstName ?? "", lead.lastName ?? ""].map((part) => part.trim()).join(" ").trim() ||
          lead.email ||
          lead.phone ||
          "Imported Lead",
        initials: (
          ((lead.firstName ?? "").charAt(0) + (lead.lastName ?? "").charAt(0)) ||
          (lead.email ?? "BG").slice(0, 2)
        ).toUpperCase(),
        title: lead.membershipName ?? lead.channel ?? "Lead",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        tags: [lead.channel, lead.stage, lead.membershipName].filter(
          (tag): tag is string => Boolean(tag && tag.trim())
        ),
        identities: [
          lead.email ? { label: "Email", value: lead.email } : null,
          lead.phone ? { label: "Phone", value: lead.phone } : null,
          lead.membershipName ? { label: "Membership", value: lead.membershipName } : null,
        ].filter(Boolean),
        stats: {
          lifetimeSpend: formatCurrency(stats.lifetimeMinor || 0),
          memberships: lead.membershipName ?? "Unassigned",
          lastPayment: lastPayment
            ? `${formatCurrency(lastPayment.amountMinor, lastPayment.currency)} · ${formatTimestamp(
                lastPayment.occurredAt
              )}`
            : "—",
          lastAttendance: "—",
        },
        payments: recentPayments.map((payment) => ({
          date: formatDate(payment.occurredAt),
          source: payment.provider,
          amount: formatCurrency(payment.amountMinor, payment.currency),
          product: payment.productType ?? "Uncategorized",
          status: payment.status,
        })),
        manualMatches: [],
        notes: [
          {
            author: "System",
            content: `Lifetime value recalculated at ${formatCurrency(stats.lifetimeMinor || 0)}.`,
            timestamp: formatTimestamp(new Date()),
          },
        ],
      };

      const metadataValue = lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {};

      return {
        ...lead,
        valueMinor: lead.valueMinor ?? stats.lifetimeMinor,
        metadata: {
          ...metadataValue,
          profile,
        },
      };
    });

    return NextResponse.json({ ok: true, data: enriched });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load leads from the database.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { leads?: LeadPayload[] };
    const leads = Array.isArray(body.leads) ? body.leads : [];

    if (!leads.length) {
      return NextResponse.json(
        { ok: false, message: "Provide at least one lead to import." },
        { status: 400 }
      );
    }

    const externalIds = leads.map(
      (lead) => lead.externalId ?? `import_${randomUUID()}`
    );
    const existing = await prisma.lead.findMany({
      where: { externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const existingSet = new Set(existing.map((lead) => lead.externalId ?? ""));

    let created = 0;

    await Promise.all(
      leads.map((lead, index) =>
        prisma.lead
          .upsert({
            where: { externalId: externalIds[index] },
            update: {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              phone: lead.phone,
              channel: lead.channel,
              stage: lead.stage,
              owner: lead.owner,
              nextStep: lead.nextStep,
              valueMinor: lead.valueMinor ?? null,
              membershipName: lead.membershipName,
              metadata: (lead.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
            },
            create: {
              externalId: externalIds[index],
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              phone: lead.phone,
              channel: lead.channel,
              stage: lead.stage,
              owner: lead.owner,
              nextStep: lead.nextStep,
              valueMinor: lead.valueMinor ?? null,
              membershipName: lead.membershipName,
              metadata: (lead.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
            },
          })
          .then(() => {
            if (!existingSet.has(externalIds[index])) {
              created += 1;
            }
          })
      )
    );

    return NextResponse.json({
      ok: true,
      message: `Imported ${leads.length} lead${
        leads.length === 1 ? "" : "s"
      } (${created} new).`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to import leads.",
      },
      { status: 500 }
    );
  }
}
