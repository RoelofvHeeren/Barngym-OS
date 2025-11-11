import { NextResponse } from "next/server";
import { readTransactions } from "@/lib/transactionStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await readTransactions();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load transaction ledger.",
      },
      { status: 500 }
    );
  }
}
