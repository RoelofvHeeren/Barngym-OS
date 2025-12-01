import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfQuarter, startOfYear, endOfQuarter } from "date-fns";

export const runtime = "nodejs";

type Goal = {
  id: string;
  category: string;
  period: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  notes?: string | null;
};

function classifyStream(provider: string, productType?: string | null): string {
  const p = (provider ?? "").toLowerCase();
  const pt = (productType ?? "").toLowerCase();
  if (p === "glofox") return "Classes";
  if (p === "starling") {
    if (pt.includes("retreat")) return "Retreats";
    return "Corporate";
  }
  if (p === "stripe") {
    if (pt.includes("pt") || pt.includes("personal")) return "PT";
    if (pt.includes("online")) return "Online Coaching";
    return "Online Coaching";
  }
  return "Total Revenue";
}

async function aggregateRevenue(targetYear: number) {
  const yearStart = startOfYear(new Date(targetYear, 0, 1));
  const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
  const qStart = startOfQuarter(new Date());
  const qEnd = endOfQuarter(new Date());

  const txs = await prisma.transaction.findMany({
    where: {
      amountMinor: { gt: 0 },
      occurredAt: { gte: yearStart, lte: yearEnd },
    },
    select: { amountMinor: true, provider: true, productType: true, occurredAt: true },
  });

  const totals = {
    total: 0,
    pt: 0,
    classes: 0,
    online: 0,
    corporate: 0,
    retreats: 0,
    yearToDate: 0,
    quarterTotals: { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>,
  };

  for (const tx of txs) {
    const amount = (tx.amountMinor ?? 0) / 100;
    totals.total += amount;
    totals.yearToDate += amount;
    const month = tx.occurredAt.getMonth(); // 0-based
    const quarter = Math.floor(month / 3) + 1;
    totals.quarterTotals[quarter] = (totals.quarterTotals[quarter] ?? 0) + amount;

    // If we're in the target year AND current quarter, accumulate for QTD as well
    const t = tx.occurredAt.getTime();
    if (t >= qStart.getTime() && t <= qEnd.getTime()) {
      totals.quarterTotals[Math.floor(new Date().getMonth() / 3) + 1] += 0; // already counted above
    }

    const stream = classifyStream(tx.provider ?? "", tx.productType);
    if (stream === "PT") totals.pt += amount;
    if (stream === "Classes") totals.classes += amount;
    if (stream === "Online Coaching") totals.online += amount;
    if (stream === "Corporate") totals.corporate += amount;
    if (stream === "Retreats") totals.retreats += amount;
  }

  return totals;
}

export async function GET() {
  try {
    const targetYear = 2026;

    let goals = await prisma.revenueGoal.findMany();
    if (goals.length === 0) {
      // Auto-seed if empty (baseline 2026 plan)
      const seedGoals = [
        { category: "Total Revenue", period: "Yearly", targetAmount: 500000, notes: "2026 total target" },
        { category: "Q1", period: "Quarterly", targetAmount: 125000, notes: "Q1 target" },
        { category: "Q2", period: "Quarterly", targetAmount: 125000, notes: "Q2 target" },
        { category: "Q3", period: "Quarterly", targetAmount: 125000, notes: "Q3 target" },
        { category: "Q4", period: "Quarterly", targetAmount: 125000, notes: "Q4 target" },
        { category: "PT", period: "Yearly", targetAmount: 200000, notes: "In-person PT" },
        { category: "Classes", period: "Yearly", targetAmount: 140000, notes: "Classes stream" },
        { category: "Online Coaching", period: "Yearly", targetAmount: 60000, notes: "Online coaching + community" },
        { category: "Corporate Wellness", period: "Yearly", targetAmount: 50000, notes: "Corporate" },
        { category: "Retreats", period: "Yearly", targetAmount: 50000, notes: "Retreats" },
      ];
      await prisma.revenueGoal.createMany({ data: seedGoals });
      goals = await prisma.revenueGoal.findMany();
    }

    const revenue = await aggregateRevenue(targetYear);

    const updatedGoals: Goal[] = goals.map((goal) => {
      const target = goal.targetAmount;
      let current = 0;
      switch (goal.category.toLowerCase()) {
        case "total revenue":
          current = revenue.total;
          break;
        case "pt":
          current = revenue.pt;
          break;
        case "classes":
          current = revenue.classes;
          break;
        case "online coaching":
          current = revenue.online;
          break;
        case "corporate wellness":
        case "corporate":
          current = revenue.corporate;
          break;
        case "retreats":
          current = revenue.retreats;
          break;
        case "q1":
        case "q2":
        case "q3":
        case "q4":
          // approximate: split yearly-to-date across quarters evenly until better mapping
          current = revenue.yearToDate;
          break;
        default:
          current = revenue.total;
          break;
      }
      const progress = target > 0 ? (current / target) * 100 : 0;
      return {
        ...goal,
        currentAmount: current,
        progress,
      };
    });

    // persist progress/current
    await Promise.all(
      updatedGoals.map((g) =>
        prisma.revenueGoal.update({
          where: { id: g.id },
          data: { currentAmount: g.currentAmount, progress: g.progress },
        })
      )
    );

    return NextResponse.json({ ok: true, goals: updatedGoals, revenue });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to load goals." },
      { status: 500 }
    );
  }
}
