import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const formatCurrency = (minor: number) =>
            new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
                .format(minor / 100);

        // First, try to find as a Lead
        const lead = await prisma.lead.findUnique({
            where: { id },
            include: {
                transactions: {
                    where: { status: 'completed' },
                    orderBy: { occurredAt: 'desc' },
                    take: 50,
                },
                payments: {
                    orderBy: { timestamp: 'desc' },
                },
            },
        });

        if (lead) {
            // Return Lead-specific data
            const leadMetadata = (lead?.metadata as any) || {};
            const profile = leadMetadata.profile || {};

            const transactions = lead.transactions || [];
            const successfulTransactions = transactions.filter((t: any) =>
                t.status === 'completed'
            );

            const lifetimeSpend = lead.ltvAllCents || successfulTransactions.reduce((sum: number, t: any) =>
                sum + (t.amountMinor || 0), 0
            );

            const adsLifetimeSpend = lead.ltvAdsCents || 0;

            const profileData = {
                name: lead.fullName || lead.email || 'Unknown',
                initials: profile.initials || lead.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'BG',
                title: profile.title || lead.membershipName || 'Lead',
                email: lead.email || '',
                phone: lead.phone || '',
                status: profile.status || (lead.isClient ? 'Client' : 'Lead'),
                statusTone: profile.statusTone || (lead.isClient ? 'client' : 'lead'),
                source: profile.source || lead.source || 'Unknown',
                tags: profile.tags || [],
                identities: profile.identities || [
                    lead.email ? { label: 'Email', value: lead.email } : null,
                    lead.phone ? { label: 'Phone', value: lead.phone } : null,
                ].filter(Boolean),
                stats: {
                    lifetimeSpend: formatCurrency(lifetimeSpend),
                    adsLifetimeSpend: adsLifetimeSpend > 0 ? formatCurrency(adsLifetimeSpend) : undefined,
                    memberships: lead.membershipName || 'Unassigned',
                    lastPayment: successfulTransactions[0]?.occurredAt
                        ? new Date(successfulTransactions[0].occurredAt).toLocaleDateString('en-GB')
                        : '—',
                    lastAttendance: '—',
                },
                payments: profile.payments || [],
                history: transactions.map((t: any) => ({
                    timestamp: new Date(t.occurredAt).toLocaleString('en-GB'),
                    source: t.provider || t.source || 'Unknown',
                    amount: formatCurrency(t.amountMinor || 0),
                    product: t.productType || t.description || 'Unknown',
                    status: t.status,
                    reference: t.reference,
                })),
                notes: profile.notes || [],
                dataSource: 'lead' as const,
            };

            return NextResponse.json({ ok: true, data: profileData });
        }

        // If not found as Lead, try as Contact
        const contact = await prisma.contact.findUnique({
            where: { id },
            include: {
                transactions: {
                    orderBy: { occurredAt: 'desc' },
                    take: 50,
                },
            },
        });

        if (!contact) {
            return NextResponse.json(
                { ok: false, message: "Contact not found" },
                { status: 404 }
            );
        }

        // Find linked Lead (by email) for additional context
        const linkedLead = contact.email
            ? await prisma.lead.findFirst({
                where: { email: contact.email },
                include: {
                    payments: {
                        orderBy: { timestamp: 'desc' },
                    },
                },
            })
            : null;

        // Build profile data from Contact
        const leadMetadata = (linkedLead?.metadata as any) || {};
        const profile = leadMetadata.profile || {};

        // Calculate stats
        const transactions = contact.transactions || [];
        const successfulTransactions = transactions.filter((t: any) =>
            t.status === 'succeeded' || t.status === 'paid' || t.status === 'completed'
        );

        const contactLtv = contact.ltvAllCents || successfulTransactions.reduce((sum: number, t: any) =>
            sum + (t.amountMinor || 0), 0
        );

        // Use the maximum of Contact LTV or Linked Lead LTV
        const lifetimeSpend = Math.max(contactLtv, linkedLead?.ltvAllCents || 0);

        const profileData = {
            name: contact.fullName || 'Unknown',
            initials: profile.initials || contact.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'BG',
            title: profile.title || linkedLead?.membershipName || 'Contact',
            email: contact.email || '',
            phone: contact.phone || '',
            status: profile.status || (linkedLead?.isClient ? 'Client' : contact.status === 'client' ? 'Client' : undefined),
            statusTone: profile.statusTone || (linkedLead?.isClient ? 'client' : contact.status === 'client' ? 'client' : 'lead'),
            source: profile.source || linkedLead?.source,
            tags: profile.tags || [...contact.sourceTags, ...contact.segmentTags] || [],
            identities: profile.identities || [
                contact.email ? { label: 'Email', value: contact.email } : null,
                contact.phone ? { label: 'Phone', value: contact.phone } : null,
            ].filter(Boolean),
            stats: {
                lifetimeSpend: formatCurrency(lifetimeSpend),
                memberships: linkedLead?.membershipName || contact.membershipType || 'Unassigned',
                lastPayment: successfulTransactions[0]?.occurredAt
                    ? new Date(successfulTransactions[0].occurredAt).toLocaleDateString('en-GB')
                    : '—',
                lastAttendance: '—',
            },
            payments: profile.payments || [],
            history: transactions.map((t: any) => ({
                timestamp: new Date(t.occurredAt).toLocaleString('en-GB'),
                source: t.source || 'Unknown',
                amount: formatCurrency(t.amountMinor || 0),
                product: t.productType || 'Unknown',
                status: t.status,
                reference: t.reference,
            })),
            notes: profile.notes || [],
            dataSource: 'contact' as const,
        };

        return NextResponse.json({ ok: true, data: profileData });
    } catch (error) {
        console.error("GET error:", error);
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Failed to fetch contact" },
            { status: 500 }
        );
    }
}


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
