
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixLeadPayments() {
    console.log("Starting Lead Payment Fix...");

    // 1. Get all leads
    // We can filter for efficiency, e.g., leads with 0 LTV or source 'ghl', but let's be comprehensive or paginated.
    const leads = await prisma.lead.findMany({
        // where: { ltvAllCents: 0 }, // Optional: only target 0 LTV leads? Safer to run on all to ensure completeness.
        select: { id: true, email: true, ltvAllCents: true }
    });

    console.log(`Processing ${leads.length} leads...`);
    let updatedCount = 0;
    let linkedPaymentCount = 0;

    for (const lead of leads) {
        if (!lead.email) continue;

        const contact = await prisma.contact.findUnique({
            where: { email: lead.email },
            include: { transactions: true }
        });

        if (!contact) continue;
        if (contact.transactions.length === 0) continue;

        // Collect external IDs from transactions
        const externalIds = contact.transactions.map(t => t.externalId).filter(Boolean);
        const chargeIds = contact.transactions.map(t => t.stripeChargeId).filter(Boolean) as string[];
        // Add other IDs if needed

        const allIds = Array.from(new Set([...externalIds, ...chargeIds]));

        if (allIds.length === 0) continue;

        // Find payments that match these IDs and are NOT linked to this lead (or any lead?)
        // If linked to ANOTHER lead, be careful. But usually it's NULL or the correct lead.
        const payments = await prisma.payment.findMany({
            where: {
                externalPaymentId: { in: allIds },
                OR: [
                    { leadId: null },
                    { leadId: { not: lead.id } } // Move them to this lead if email matches?
                    // Actually, if email matches, this IS the lead. 
                ]
            }
        });

        if (payments.length > 0) {
            // Link them
            const result = await prisma.payment.updateMany({
                where: { id: { in: payments.map(p => p.id) } },
                data: { leadId: lead.id }
            });

            linkedPaymentCount += result.count;
            updatedCount++;
            // console.log(`Linked ${result.count} payments to Lead ${lead.email}`);
        }
    }

    console.log(`Finished. Linked ${linkedPaymentCount} payments across ${updatedCount} leads.`);

    // Recalculate LTVs
    console.log("Recalculating LTVs...");
    const allLeads = await prisma.lead.findMany({
        include: { payments: true }
    });

    for (const lead of allLeads) {
        const ltv = lead.payments.reduce((sum, p) => sum + p.amountCents, 0);
        let adsLtv = 0;

        const isAds = lead.source?.toLowerCase().includes("ads") || lead.tags?.toString().toLowerCase().includes("ads");

        if (isAds || lead.source === 'ghl_ads') {
            adsLtv = ltv;
        }

        if (ltv !== lead.ltvAllCents || adsLtv !== lead.ltvAdsCents || (ltv > 0 && !lead.isClient)) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    ltvAllCents: ltv,
                    ltvAdsCents: adsLtv,
                    isClient: ltv > 0 ? true : lead.isClient,
                    status: ltv > 0 ? "CLIENT" : lead.status
                }
            });
        }
    }
    console.log("LTV Recalculation Complete.");

}

fixLeadPayments()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
