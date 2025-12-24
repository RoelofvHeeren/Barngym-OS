
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const segmentFieldMap: Record<string, string> = {
  all: "ltvAllCents",
  ads: "ltvAdsCents", // Note: Ads LTV is still derived/stored on lead or contact? 
  // If we moved everything to Contact, we should query Contact. 
  // However, currently Ads LTV is special filtering. 
  // ltvAllCents is definitely on Contact.
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const segment = (searchParams.get("segment") ?? "all").toLowerCase();

    // For "all", use the reliable Contact.ltvAllCents
    if (segment === "all") {
      const aggregate = await prisma.contact.aggregate({
        _sum: { ltvAllCents: true },
      });
      const value = aggregate._sum.ltvAllCents ?? 0;
      return NextResponse.json({ ok: true, data: { segment, cents: value } });
    }

    // For segments (ads, pt, etc), we might still need to rely on Lead fields OR 
    // implement filtering based on Contact transactions.
    // For now, let's keep legacy behavior for segments but use Contact for 'all'.

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
