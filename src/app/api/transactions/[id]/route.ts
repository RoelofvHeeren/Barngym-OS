
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.transaction.delete({
            where: { id },
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Delete transaction error:", error);
        return NextResponse.json(
            { ok: false, message: "Failed to delete transaction" },
            { status: 500 }
        );
    }
}
