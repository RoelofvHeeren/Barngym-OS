import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Add a tag
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const tag = (body.tag as string)?.trim();

        if (!tag) {
            return NextResponse.json(
                { ok: false, message: "Tag is required" },
                { status: 400 }
            );
        }

        const contact = await prisma.contact.findUnique({
            where: { id },
            select: { segmentTags: true },
        });

        if (!contact) {
            return NextResponse.json(
                { ok: false, message: "Contact not found" },
                { status: 404 }
            );
        }

        // Avoid duplicates
        const currentTags = contact.segmentTags || [];
        if (currentTags.includes(tag)) {
            return NextResponse.json({ ok: true, message: "Tag already exists" });
        }

        await prisma.contact.update({
            where: { id },
            data: {
                segmentTags: {
                    push: tag,
                },
            },
        });

        return NextResponse.json({ ok: true, message: "Tag added" });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Failed to add tag" },
            { status: 500 }
        );
    }
}

// Remove a tag
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const tag = (body.tag as string)?.trim();

        if (!tag) {
            return NextResponse.json(
                { ok: false, message: "Tag is required" },
                { status: 400 }
            );
        }

        const contact = await prisma.contact.findUnique({
            where: { id },
            select: { segmentTags: true },
        });

        if (!contact) {
            return NextResponse.json(
                { ok: false, message: "Contact not found" },
                { status: 404 }
            );
        }

        const currentTags = contact.segmentTags || [];
        const newTags = currentTags.filter((t) => t !== tag);

        await prisma.contact.update({
            where: { id },
            data: {
                segmentTags: newTags,
            },
        });

        return NextResponse.json({ ok: true, message: "Tag removed" });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Failed to remove tag" },
            { status: 500 }
        );
    }
}
