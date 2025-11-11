import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await prisma.connectionSecret.findMany();

    const data = records.reduce(
      (acc, record) => {
        acc[record.provider] = {
          status: record.status,
          accountId: record.accountId,
          lastVerifiedAt: record.lastVerifiedAt,
          hasSecret: Boolean(record.secret),
        };
        return acc;
      },
      {} as Record<string, { status: string | null; accountId: string | null; lastVerifiedAt: Date | null; hasSecret: boolean }>
    );

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load connection state.",
      },
      { status: 500 }
    );
  }
}
