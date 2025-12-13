import { subDays } from "date-fns";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const WINDOW_DAYS = 1095; // 3 years to cover historic import

export async function GET() {
  try {
    const now = new Date();
    const windowStart = subDays(now, WINDOW_DAYS);

    const transactionsPromise = prisma.transaction.findMany({
      where: { occurredAt: { gte: windowStart } },
      orderBy: { occurredAt: "desc" },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            membershipName: true,
            channel: true,
            stage: true,
          },
        },
      },
    });

    const activeMembersPromise = prisma.lead.count({
      where: { membershipName: { not: null } },
    });

    const trialMembersPromise = prisma.lead.count({
      where: {
        OR: [
          { stage: { equals: "Trial", mode: "insensitive" } },
          { membershipName: { contains: "trial", mode: "insensitive" } },
        ],
      },
    });

    const corporateClientsPromise = prisma.lead.count({
      where: {
        OR: [
          { channel: { contains: "corporate", mode: "insensitive" } },
          { membershipName: { contains: "corporate", mode: "insensitive" } },
        ],
      },
    });

    const nextTwoWeeks = new Date();
    nextTwoWeeks.setDate(nextTwoWeeks.getDate() + 14);

    const expiringMembershipsPromise = prisma.contact.count({
      where: {
        membershipEndDate: {
          gt: now,
          lte: nextTwoWeeks,
        },
      },
    });

    const failedPaymentsPromise = prisma.transaction.count({
      where: {
        status: "Failed",
        occurredAt: { gte: subDays(now, 30) },
      },
    });

    const needsReviewPromise = prisma.transaction.count({
      where: {
        status: "Needs Review",
      },
    });

    const [
      transactions,
      activeMembers,
      trialMembers,
      corporateClients,
      expiringMemberships,
      failedPayments,
      needsReview,
    ] = await Promise.all([
      transactionsPromise,
      activeMembersPromise,
      trialMembersPromise,
      corporateClientsPromise,
      expiringMembershipsPromise,
      failedPaymentsPromise,
      needsReviewPromise,
    ]);

    const serialized = transactions.map((transaction) => ({
      id: transaction.id,
      provider: transaction.provider,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      occurredAt: transaction.occurredAt.toISOString(),
      status: transaction.status,
      confidence: transaction.confidence,
      productType: transaction.productType,
      description: transaction.description,
      reference: transaction.reference,
      personName: transaction.personName,
      leadId: transaction.leadId,
      lead: transaction.lead
        ? {
          id: transaction.lead.id,
          firstName: transaction.lead.firstName,
          lastName: transaction.lead.lastName,
          membershipName: transaction.lead.membershipName,
          channel: transaction.lead.channel,
          stage: transaction.lead.stage,
        }
        : null,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        generatedAt: now.toISOString(),
        windowStart: windowStart.toISOString(),
        transactions: serialized,
        stats: {
          members: {
            active: activeMembers,
            trial: trialMembers,
            corporate: corporateClients,
          },
          alerts: {
            failedPayments,
            needsReview,
            expiringMemberships,
            followUps: 0, // Deprecated
          },
        },
      },
    });
  } catch (error) {
    console.error("Dashboard snapshot failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to load dashboard snapshot.",
      },
      { status: 500 }
    );
  }
}
