import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // 1. Find the Contact
        const contact = await prisma.contact.findUnique({
            where: { id },
            select: { id: true, email: true },
        });

        if (!contact) {
            // If no contact, try deleting as a Lead ID directly (in case ID passed is Lead ID)
            // gracefully fail or try lead?
            // For now, assume ID is Contact ID as per standard route structure.
            return NextResponse.json(
                { ok: false, message: "Contact not found" },
                { status: 404 }
            );
        }

        // 2. Find Linked Lead (by email)
        const lead = contact.email
            ? await prisma.lead.findFirst({ where: { email: contact.email } })
            : null;

        // 3. Perform Deletion in Transaction
        await prisma.$transaction(async (tx) => {
            // A. Delete Contact Dependencies
            // Transactions linked to Contact
            await tx.transaction.deleteMany({
                where: { contactId: contact.id },
            });

            // B. Delete Lead Dependencies (if lead exists)
            if (lead) {
                // Transactions linked to Lead (if different from Contact links)
                await tx.transaction.deleteMany({
                    where: { leadId: lead.id },
                });

                await tx.leadEvent.deleteMany({ where: { leadId: lead.id } });
                await tx.leadTracking.deleteMany({ where: { leadId: lead.id } });
                await tx.adsRevenue.deleteMany({ where: { leadId: lead.id } });
                await tx.counterpartyMapping.deleteMany({ where: { leadId: lead.id } });
                await tx.payment.deleteMany({ where: { leadId: lead.id } });

                // Finally delete LEad
                await tx.lead.delete({ where: { id: lead.id } });
            }

            // C. Delete Contact
            await tx.contact.delete({ where: { id: contact.id } });
        });

        return NextResponse.json({ ok: true, message: "Contact deleted successfully" });
    } catch (error) {
        console.error("Delete error:", error);
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Failed to delete contact" },
            { status: 500 }
        );
    }
}
