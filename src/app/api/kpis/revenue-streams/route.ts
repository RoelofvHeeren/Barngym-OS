import { prisma } from "@/lib/prisma";
import { classifyProduct } from "@/utils/productClassifier";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const categories = ["pt", "classes", "six_week", "online_coaching", "community", "corporate"] as const;
type CategoryKey = (typeof categories)[number];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe");
    let since: Date | undefined;

    if (timeframe && timeframe !== "all") {
      const days = Number(timeframe);
      if (!Number.isNaN(days) && days > 0) {
        since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
    }

    const where = since ? { timestamp: { gte: since } } : {};
    const payments = await prisma.payment.findMany({
      where,
      select: { productType: true, productName: true, amountCents: true },
    });

    const totals: Record<CategoryKey, number> = {
      pt: 0,
      classes: 0,
      six_week: 0,
      online_coaching: 0,
      community: 0,
      corporate: 0,
    };

    payments.forEach((payment) => {
      const productType =
        (payment.productType ?? "unknown") as CategoryKey | "unknown";
      const category = categories.includes(productType as CategoryKey)
        ? (productType as CategoryKey)
        : ((classifyProduct(payment.productName ?? "") as CategoryKey) ?? "unknown");
      if (categories.includes(category as CategoryKey)) {
        totals[category as CategoryKey] += payment.amountCents;
      }
    });

    return NextResponse.json({ ok: true, data: totals });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load revenue streams.",
      },
      { status: 500 }
    );
  }
}
