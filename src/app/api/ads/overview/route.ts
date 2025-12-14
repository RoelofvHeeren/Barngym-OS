import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RangeKey = "today" | "7d" | "30d" | "month" | "all";

const parseRange = (range?: string): { start: Date | null; end: Date } => {
  const now = new Date();
  const end = now;
  switch ((range as RangeKey) ?? "30d") {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start, end };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
    case "all":
    default:
      return { start: null, end };
  }
};

const isAdsLeadFilter = {
  tags: {
    array_contains: "ads",
  },
};

const buildDateFilter = (start: Date | null, end: Date) => {
  if (!start) {
    return { lte: end };
  }
  return { gte: start, lte: end };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") ?? "30d";

    let start: Date | null = null;
    let end: Date = new Date();

    if (rangeParam === "custom") {
      const startParam = searchParams.get("start");
      const endParam = searchParams.get("end");
      if (startParam) start = new Date(startParam);
      if (endParam) end = new Date(endParam);
      if (endParam && endParam.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      const parsed = parseRange(rangeParam);
      start = parsed.start;
      end = parsed.end;
    }

    const dateFilter = start ? { gte: start, lte: end } : { lte: end };

    // Filter by submissionDate OR createdAt
    // Filter by submissionDate OR createdAt
    const whereCondition = {
      AND: [
        isAdsLeadFilter,
        {
          OR: [
            { submissionDate: dateFilter },
            { submissionDate: null, createdAt: dateFilter },
          ],
        },
      ],
    };

    // 1. Leads Count: Created in period + source is ads
    const leadsCount = await prisma.lead.count({
      where: whereCondition,
    });

    // 2. Revenue (Cash Flow): Sum of all payments in this period from ads leads
    const revenueAgg = await prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: {
        timestamp: dateFilter,
        lead: isAdsLeadFilter as any,
      }
    });
    const revenueFromAdsCents = revenueAgg._sum.amountCents ?? 0;

    // 3. Conversions (Acquisitions): Count of leads whose FIRST payment was in this period.
    // Optimization: Fetch leads who made a payment *in this period* (candidates), 
    // then verify if that was their *first* payment.
    const activeAdsClients = await prisma.lead.findMany({
      where: {
        ...isAdsLeadFilter,
        isClient: true,
        payments: {
          some: { timestamp: dateFilter }
        }
      },
      select: {
        id: true,
        ltvAdsCents: true,
        payments: {
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
          take: 1
        }
      }
    });

    let conversionsCount = 0;

    for (const client of activeAdsClients) {
      if (!client.payments.length) continue;

      const firstPaymentDate = client.payments[0].timestamp;

      // Check if first payment falls in the requested range
      const isAcquiredInPeriod = start
        ? (firstPaymentDate >= start && firstPaymentDate <= end)
        : (firstPaymentDate <= end);

      if (isAcquiredInPeriod) {
        conversionsCount++;
      }
    }

    // Avg LTV for ads clients (Overall or Cohort?)
    // "Average LTV per ads client" usually implies the average value of acquried customers.
    // Let's stick to: Revenue / Conversions (if cohort) OR Revenue / Active Clients?
    // Dashboard label says "Average LTV per ads client".
    // If we use Cash Flow Revenue, dividing by Conversions gives "Avg Revenue per New Client" which might be skewed if revenue includes recurring from old clients.
    // However, usually LTV is calculated on the *population*.
    // Let's calculate Avg LTV based on the *Conversions* (New Clients) LTV, to keep it consistent with "Quality of these new leads".
    // BUT user wants Cash Flow revenue. 
    // Let's calculate Avg LTV as: (Total Lifetime Value of ALL Ads Clients) / (Total Ads Clients) ? 
    // Or (Revenue in Period) / (Conversions)? -> This is "Average Transaction Size" roughly.
    // Given the previous code tried to do "Cohort LTV", let's try to show the Average LTV of the *Newly Acquired* clients.

    let sumLtvOfNewClients = 0;
    let acquisitionRevenueCents = 0; // Revenue from ONLY the clients acquired in this period
    let avgLtvAdsCents = 0;
    if (conversionsCount > 0) {
      // We need to re-fetch or use a different metric if we want "Avg LTV" of these specific converted people.
      // We have `activeAdsClients`. We identified which ones are new.
      // Let's iterate again or optimize the loop above.
      const newClientIds = new Set<string>();
      for (const client of activeAdsClients) {
        if (!client.payments.length) continue;
        const firstPaymentDate = client.payments[0].timestamp;
        const isAcquiredInPeriod = start ? (firstPaymentDate >= start && firstPaymentDate <= end) : (firstPaymentDate <= end);
        if (isAcquiredInPeriod) {
          newClientIds.add(client.id);
        }
      }

      // Calculate Acquisition Revenue: Verify which payments from these new clients fell in this period.
      // We can fetch this specific sum or derive it if we had all payments. 
      // `activeAdsClients` only fetched `take: 1` payment (the first one).
      // We need sum of payments for these clients IN THIS PERIOD.
      // Since we already have the global `revenueAgg` (all payments in period), we can't easily split it without fetching.

      // Let's do a targeted aggregation for these new clients.
      if (newClientIds.size > 0) {
        const acqRevenueAgg = await prisma.payment.aggregate({
          _sum: { amountCents: true },
          where: {
            leadId: { in: Array.from(newClientIds) },
            timestamp: dateFilter
          }
        });
        acquisitionRevenueCents = acqRevenueAgg._sum.amountCents ?? 0;
      }

      // We need the LTV of these new clients. 
      // `activeAdsClients` has `ltvAdsCents`.
      // Let's verify if `activeAdsClients` contains them all. Yes, they paid in this period (first payment), so they are in `activeAdsClients`.

      for (const client of activeAdsClients) {
        if (newClientIds.has(client.id)) {
          sumLtvOfNewClients += (client.ltvAdsCents ?? 0);
          // Note: using ltvAdsCents because they are ads clients.
        }
      }
      avgLtvAdsCents = Math.round(sumLtvOfNewClients / conversionsCount);
    } else {
      avgLtvAdsCents = 0;
    }

    // 4. Spend: Real data OR Default Budget
    // Exclude "Historical Manual Import" from specific ranges (like 7d, 30d) because it's a lump sum spanning a year.
    // It should only show up in "All Time" (where start is null).
    const isHistoricalIncluded = !start;

    const adsSpendAgg = await prisma.adsSpend.aggregate({
      _sum: { amountCents: true },
      where: {
        AND: [
          start ? { periodStart: { lte: end }, periodEnd: { gte: start } } : {},
          isHistoricalIncluded ? {} : { source: { not: "Historical Manual Import" } }
        ]
      }
    });
    const metaSpendAgg = await prisma.metaDailyInsight.aggregate({
      _sum: { spend: true },
      where: start ? { date: { gte: start, lte: end } } : {}, // Approx filter
    });

    const manualSpendCents = adsSpendAgg._sum.amountCents ?? 0;
    const metaSpendCents = Math.round((metaSpendAgg._sum.spend ?? 0) * 100);
    let spendCents = manualSpendCents + metaSpendCents;

    // Default Budget Logic if no real data
    if (spendCents === 0) {
      const MONTHLY_BUDGET_CENTS = 750 * 100;
      const DAILY_BUDGET_CENTS = Math.round(MONTHLY_BUDGET_CENTS / 30);

      switch (rangeParam as RangeKey) {
        case "today":
          spendCents = DAILY_BUDGET_CENTS;
          break;
        case "7d":
          spendCents = DAILY_BUDGET_CENTS * 7;
          break;
        case "30d":
          spendCents = MONTHLY_BUDGET_CENTS;
          break;
        case "month": {
          const now = new Date();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const currentDay = now.getDate();
          // Prorate: (CurrentDay / DaysInMonth) * MonthlyBudget? 
          // Or just CurrentDay * DailyBudget?
          // User said: "increase by 25 bucks... if it's the 10th... should show 250".
          // So CurrentDay * DAILY_BUDGET_CENTS.
          // But cap at Monthly Budget if end of month?
          spendCents = Math.min(currentDay * DAILY_BUDGET_CENTS, MONTHLY_BUDGET_CENTS);
          break;
        }
        case "all":
          // Estimate duration based on first ever ad lead
          const firstLead = await prisma.lead.findFirst({
            where: isAdsLeadFilter,
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          });

          if (firstLead) {
            const now = new Date();
            const start = firstLead.createdAt;
            const diffTime = Math.abs(now.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // Prorate based on days to be more precise than just months
            spendCents = Math.round(diffDays * DAILY_BUDGET_CENTS);
          } else {
            spendCents = 0;
          }
          break;
      }
    }

    const cplCents = leadsCount ? Math.round(spendCents / leadsCount) : 0;
    const cpaCents = conversionsCount ? Math.round(spendCents / conversionsCount) : 0;
    const roas = spendCents > 0 ? revenueFromAdsCents / spendCents : 0;
    const acquisitionRoas = spendCents > 0 ? acquisitionRevenueCents / spendCents : 0;

    return NextResponse.json({
      ok: true,
      data: {
        range: rangeParam,
        spendCents,
        leadsCount,
        conversionsCount,
        revenueFromAdsCents,
        acquisitionRevenueCents,
        avgLtvAdsCents,
        cplCents,
        cpaCents,
        roas: Number(roas.toFixed(2)),
        acquisitionRoas: Number(acquisitionRoas.toFixed(2)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load ads overview." },
      { status: 500 }
    );
  }
}
