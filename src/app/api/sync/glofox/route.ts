import { NextResponse } from "next/server";
import { syncGlofoxTransactions } from "@/lib/glofox";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const { days } = await request.json().catch(() => ({ days: 7 }));
        const result = await syncGlofoxTransactions(Number(days) || 7);
        return NextResponse.json({ ok: true, ...result });
    } catch (error) {
        console.error("[Glofox Sync API] Error:", error);
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Sync failed" },
            { status: 500 }
        );
    }
}
