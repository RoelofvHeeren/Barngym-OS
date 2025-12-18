
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ ok: false, message: "Project ID is required" }, { status: 400 });
        }

        const project = await prisma.videoProject.findUnique({
            where: { id },
            include: {
                assets: true,
            },
        });

        if (!project) {
            return NextResponse.json({ ok: false, message: "Project not found" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, data: project });
    } catch (error) {
        console.error("Error fetching video project:", error);
        return NextResponse.json({ ok: false, message: "Failed to fetch project" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const project = await prisma.videoProject.update({
            where: { id },
            data: body,
        });

        return NextResponse.json({ ok: true, data: project });
    } catch (error) {
        console.error("Error updating video project:", error);
        return NextResponse.json({ ok: false, message: "Failed to update project" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.videoProject.delete({
            where: { id },
        });

        return NextResponse.json({ ok: true, message: "Project deleted" });
    } catch (error) {
        console.error("Error deleting video project:", error);
        return NextResponse.json({ ok: false, message: "Failed to delete project" }, { status: 500 });
    }
}
