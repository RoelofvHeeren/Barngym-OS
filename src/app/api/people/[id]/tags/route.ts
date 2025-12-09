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

        // ... existing POST logic ...
        await prisma.contact.update({
            where: { id },
            data: {
                segmentTags: {
                    push: tag,
                },
            },
        });

        // SYNC TO LEAD (Ads Dashboard Visibility)
        if (tag.toLowerCase().includes("ads") && contact.email) {
            const lead = await prisma.lead.findFirst({
                where: { email: contact.email },
            });

            if (lead) {
                let newSource = lead.source || "Manual Ads Tag";
                if (!newSource.toLowerCase().includes("ads")) {
                    newSource = `${newSource} (Manual Ads)`;
                }
                // If it was previously marked Organic, switch it back
                newSource = newSource.replace(/organic/gi, "Ads");

                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { source: newSource },
                });
            }
        }

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
            select: { segmentTags: true, email: true }, // Select email too
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

        // SYNC TO LEAD (Ads Dashboard Visibility)
        if (tag.toLowerCase().includes("ads") && contact.email) {
            const lead = await prisma.lead.findFirst({
                where: { email: contact.email },
            });

            if (lead && lead.source?.toLowerCase().includes("ads")) {
                // Replace "Ads" with "Organic" to remove from dashboard views
                // e.g. "Facebook Ads" -> "Facebook Organic"
                const newSource = lead.source.replace(/ads/gi, "Organic").trim();

                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { source: newSource },
                });
            }
        }

        return NextResponse.json({ ok: true, message: "Tag removed" });
    } catch (error) {
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Failed to remove tag" },
            { status: 500 }
        );
    }
}
