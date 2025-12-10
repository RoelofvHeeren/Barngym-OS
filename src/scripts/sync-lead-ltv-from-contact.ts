
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function syncLeadLtvFromContact() {
    console.log("Syncing Lead LTV from Contact LTV...");

    // Get all leads with email
    const leads = await prisma.lead.findMany({
        where: {
            email: { not: null }
        },
        select: {
            id: true,
            email: true,
            ltvAllCents: true,
            ltvAdsCents: true,
            source: true
        }
    });

    console.log(`Found ${leads.length} leads with email addresses.`);

    let updated = 0;
    let skipped = 0;

    for (const lead of leads) {
        if (!lead.email) continue;

        // Find matching contact
        const contact = await prisma.contact.findUnique({
            where: { email: lead.email }
        });

        if (!contact) {
            skipped++;
            continue;
        }

        // Use Contact's LTV as the source of truth
        const correctLtvAllCents = contact.ltvAllCents;

        // Determine if this is an ads lead
        const isAdsLead = lead.source?.toLowerCase().includes("ads") ||
            lead.source === "ghl_ads" ||
            lead.source === "Manual Ads Tag";

        const correctLtvAdsCents = isAdsLead ? correctLtvAllCents : 0;

        // Update if different
        if (lead.ltvAllCents !== correctLtvAllCents || lead.ltvAdsCents !== correctLtvAdsCents) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    ltvAllCents: correctLtvAllCents,
                    ltvAdsCents: correctLtvAdsCents,
                    isClient: correctLtvAllCents > 0 ? true : lead.isClient,
                    status: correctLtvAllCents > 0 ? "CLIENT" : "LEAD"
                }
            });

            updated++;
            if (updated % 50 === 0) {
                console.log(`Updated ${updated} leads...`);
            }
        } else {
            skipped++;
        }
    }

    console.log(`\nFinished!`);
    console.log(`Updated: ${updated} leads`);
    console.log(`Skipped (already correct or no contact): ${skipped}`);
}

syncLeadLtvFromContact()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
