import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { startOfYear, startOfQuarter, endOfQuarter } from "date-fns";

export const runtime = "nodejs";

const STREAMS = ["total", "classes", "pt", "online_coaching", "corporate", "retreats"] as const;
type RevenueStream = (typeof STREAMS)[number];

function streamMatches(stream: RevenueStream, productType: string | null | undefined) {
  const normalized = (productType ?? "").toLowerCase();
  switch (stream) {
    case "classes":
      return normalized.includes("class") || normalized.includes("membership");
    case "pt":
      return normalized.includes("pt") || normalized.includes("personal");
    case "online_coaching":
      return normalized.includes("online");
    case "corporate":
      return normalized.includes("corporate");
    case "retreats":
      return normalized.includes("retreat");
    default:
      return true;
  }
}

async function sumForWindow(start: Date, end: Date, stream: RevenueStream) {
  const payments = await prisma.transaction.findMany({
    where: {
      occurredAt: {
        gte: start,
        lte: end,
      },
      amountMinor: { gt: 0 },
    },
    select: {
      amountMinor: true,
      productType: true,
    },
  });
  const totalMinor = payments.reduce((sum, tx) => {
    if (stream === "total" || streamMatches(stream, tx.productType)) {
      return sum + (tx.amountMinor ?? 0);
    }
    return sum;
  }, 0);
  return totalMinor / 100;
}

export async function GET() {
  try {
    const now = new Date();
    const yStart = startOfYear(now);
    const qStart = startOfQuarter(now);
    const qEnd = endOfQuarter(now);

    const goals = await prisma.revenueGoal.findMany();

    const achieved = await Promise.all(
      STREAMS.map(async (stream) => ({
        stream,
        ytd: await sumForWindow(yStart, now, stream),
        qtd: await sumForWindow(qStart, qEnd, stream),
        month: await sumForWindow(new Date(now.getFullYear(), now.getMonth(), 1), now, stream),
      }))
    );

    return NextResponse.json({ ok: true, goals, achieved });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to load goals." },
      { status: 500 }
    );
  }
}
