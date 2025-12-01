import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfYear } from "date-fns";

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

async function aggregateRevenue() {
  const txs = await prisma.transaction.findMany({
    where: { amountMinor: { gt: 0 } },
    select: { amountMinor: true, provider: true, productType: true, occurredAt: true },
  });

  const yearStart = startOfYear(new Date()).getTime();

  const totals = {
    total: 0,
    pt: 0,
    classes: 0,
    online: 0,
    corporate: 0,
    retreats: 0,
    yearToDate: 0,
  };

  for (const tx of txs) {
    const amount = (tx.amountMinor ?? 0) / 100;
    totals.total += amount;
    if (tx.occurredAt.getTime() >= yearStart) totals.yearToDate += amount;
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
    const goals = await prisma.revenueGoal.findMany();
    const revenue = await aggregateRevenue();

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
