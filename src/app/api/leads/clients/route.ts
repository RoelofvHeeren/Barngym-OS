import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      where: { isClient: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: leads });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load client leads.",
      },
      { status: 500 }
    );
  }
}
