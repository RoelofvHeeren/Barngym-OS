import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadPayload = {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  reference?: string;
  channel?: string;
  stage?: string;
  owner?: string;
  nextStep?: string;
  valueMinor?: number | null;
  membershipName?: string;
  membershipEndDate?: string | null; // Added
  source?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
};



export async function GET(request: Request) {
  try {
    // Get view filter from query params
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view'); // 'leads', 'members', or null for all
    const source = searchParams.get('source');

    // Build where clause based on view
    const whereClause: any = {};
    if (view === 'leads') {
      whereClause.status = 'lead';
    } else if (view === 'members') {
      whereClause.status = 'client';
    } else if (view === 'expiring') {
      const nextTwoWeeks = new Date();
      nextTwoWeeks.setDate(nextTwoWeeks.getDate() + 14);
      const now = new Date();

      const expiringMemberships = await prisma.membership.findMany({
        where: {
          endDate: { gt: now, lte: nextTwoWeeks },
        },
        select: { memberId: true },
      });
      // Glofox Member ID <-> Lead/Contact Logic?
      // Wait, Member table links to Membership by memberId.
      // We need to link Member to Contact/Lead.
      // Schema: Member (memberId) -> Membership.
      // Lead has externalId or glofoxMemberId?
      // Re-checking schema: Lead has glofoxMemberId @unique.
      // Wait, the Phase 3 schema uses Contact table? The code is using `prisma.contact.findMany`.
      // Contact table doesn't have glofoxMemberId explicitly on it in the current Prisma snippet view?
      // Let's check if we can filter contacts by `membershipEndDate` if available or we might need to rely on the Member linkage.
      // Looking at `people/page.tsx`, it uses `contact.membershipType` and `contact.membershipEndDate`?
      // Re-reading `schema.prisma` for Contact model:
      // model Contact { ... membershipEndDate DateTime? ... }
      // So we can just query Contact directly!

      whereClause.membershipEndDate = {
        gt: now,
        lte: nextTwoWeeks,
      };
    }

    if (source && source !== 'All' && source !== 'All Sources') {
      whereClause.sourceTags = { has: source.toLowerCase() };
    }

    // Fetch contacts from the new Contact table (Phase 3)
    const contacts = await prisma.contact.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        transactions: {
          orderBy: { occurredAt: "desc" },
        }, // Include transactions for history
      },
      take: 5000, // Increased limit to show all members
    });

    if (!contacts.length) {
      return NextResponse.json({ ok: true, data: [] });
    }

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

    const enriched = contacts.map((contact) => {
      // Calculate stats from transactions
      const transactions = contact.transactions ?? [];
      const successfulTransactions = transactions.filter((t) => t.status !== "Failed");

      // Deduplicate transactions for display purposes
      // We group by (date, amount, product) and strictly keep distinct ones.
      // This handles cases where double-imports or sync issues create "unique" transactions (diff IDs) for the same event.
      const uniqueTransactionKeys = new Set<string>();
      const distinctTransactions = successfulTransactions.filter((t) => {
        const dateKey = new Date(t.occurredAt).toISOString().split('T')[0]; // YYYY-MM-DD
        const key = `${dateKey}|${t.amountMinor}|${t.productType ?? 'unknown'}`;

        if (uniqueTransactionKeys.has(key)) {
          return false;
        }
        uniqueTransactionKeys.add(key);
        return true;
      });

      const lifetimeMinor = contact.ltvAllCents ?? distinctTransactions.reduce(
        (sum, t) => sum + (t.amountMinor ?? 0),
        0
      );

      const hasPurchases = distinctTransactions.length > 0;
      // Transactions are already sorted by occurredAt desc from the query
      const recentPayments = distinctTransactions.slice(0, 5);

      const lastPayment = recentPayments[0];

      // Determine display fields
      const displayName = contact.fullName || contact.email || "Unnamed Contact";

      // Map tags and source
      const source = contact.sourceTags?.[0] || "Imported";
      const channel = contact.sourceTags?.[0] || "Unknown";

      // Determine status tone/label
      let statusLabel = "Lead";
      let statusTone: "lead" | "client" = "lead";

      if (contact.status?.toLowerCase() === "client") {
        statusLabel = "Client";
        statusTone = "client";
      }

      const expiryDate = contact.membershipEndDate
        ? new Date(contact.membershipEndDate).toLocaleDateString('en-GB')
        : null;

      // Construct the Profile object required by the frontend
      const profile = {
        name: displayName,
        initials: (displayName.slice(0, 2)).toUpperCase(),
        title: contact.membershipType ?? "Lead",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        status: statusLabel,
        statusTone: statusTone,
        source: source,
        tags: [...(contact.sourceTags ?? []), ...(contact.segmentTags ?? [])],
        identities: [
          contact.email ? { label: "Email", value: contact.email } : null,
          contact.phone ? { label: "Phone", value: contact.phone } : null,
          contact.trainerizeId ? { label: "Trainerize ID", value: contact.trainerizeId } : null,
          contact.membershipType ? { label: "Membership", value: contact.membershipType } : null,
          expiryDate ? { label: "Expires", value: expiryDate } : null,
        ].filter(Boolean),
        stats: {
          lifetimeSpend: formatCurrency(lifetimeMinor),
          memberships: contact.membershipType ?? "Unassigned",
          lastPayment: lastPayment
            ? `${formatCurrency(lastPayment.amountMinor, lastPayment.currency)} · ${formatTimestamp(
              lastPayment.occurredAt
            )}`
            : "—",
          lastAttendance: "—",
        },
        payments: recentPayments.map((payment) => ({
          date: formatDate(payment.occurredAt),
          source: payment.provider ?? payment.source,
          amount: formatCurrency(payment.amountMinor, payment.currency),
          product: payment.productType ?? "Uncategorized",
          status: payment.status ?? "Completed",
        })),
        history: distinctTransactions.slice(0, 50).map((payment) => ({
          date: formatDate(payment.occurredAt),
          timestamp: formatTimestamp(payment.occurredAt),
          source: payment.provider ?? payment.source,
          amount: formatCurrency(payment.amountMinor, payment.currency),
          product: payment.productType ?? "Uncategorized",
          status: payment.status ?? "Completed",
          reference: payment.reference,
        })),
        manualMatches: [],
        notes: [],
      };

      // Map to the flat ApiLead structure
      return {
        id: contact.id,
        externalId: contact.id, // Use internal ID as external ID for UI consistency
        firstName: displayName.split(" ")[0] ?? "",
        lastName: displayName.split(" ").slice(1).join(" ") ?? "",
        fullName: displayName,
        email: contact.email,
        phone: contact.phone,
        channel: channel,
        stage: "New", // Default for now
        owner: "Unassigned",
        nextStep: "",
        valueMinor: contact.ltvAllCents, // Use LTV from Contact model
        membershipName: contact.membershipType,
        membershipEndDate: contact.membershipEndDate ? contact.membershipEndDate.toISOString() : null,
        source: source,
        status: contact.status,
        hasPurchases,
        isClient: contact.status === "client",
        metadata: {
          profile,
        },
      };
    });

    return NextResponse.json({ ok: true, data: enriched });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load contacts from the database.",
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
              source: lead.source,
              status: lead.status as any,
              metadata: lead.metadata as any,
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
              source: lead.source,
              status: lead.status as any,
              metadata: lead.metadata as any,
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
      message: `Imported ${leads.length} lead${leads.length === 1 ? "" : "s"
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
