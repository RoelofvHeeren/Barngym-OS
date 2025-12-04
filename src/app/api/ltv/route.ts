import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const segmentFieldMap: Record<string, string> = {
  all: "ltvAllCents",
  ads: "ltvAdsCents",
  pt: "ltvPTCents",
  classes: "ltvClassesCents",
  six_week: "ltvSixWeekCents",
  online_coaching: "ltvOnlineCoachingCents",
  community: "ltvCommunityCents",
  corporate: "ltvCorporateCents",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const segment = (searchParams.get("segment") ?? "all").toLowerCase();
    const field = segmentFieldMap[segment];

    if (!field) {
      return NextResponse.json(
        { ok: false, message: "Invalid segment." },
        { status: 400 }
      );
    }

    const aggregate = await prisma.lead.aggregate({
      _sum: { [field]: true } as any,
    });

    const value = (aggregate._sum as Record<string, number | null>)[field] ?? 0;

    return NextResponse.json({ ok: true, data: { segment, cents: value } });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load LTV.",
      },
      { status: 500 }
    );
  }
}
