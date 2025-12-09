import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
    try {
        const leads = await prisma.lead.findMany({
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                companyName: true,
                isCorporate: true,
            },
            orderBy: { createdAt: "desc" },
            take: 2000,
        });

        return NextResponse.json({ ok: true, data: leads });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: "Failed to load lead options." },
            { status: 500 }
        );
    }
}
