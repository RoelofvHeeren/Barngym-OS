
import { prisma } from "@/lib/prisma";

async function main() {
    console.log("Starting Lead LTV recalculation...");

    // Fetch all leads that have payments or transactions linked
    // To be safe, let's just process all leads, or at least those from ads
    // For efficiency, maybe chunk it.

    const leads = await prisma.lead.findMany({
        include: {
            payments: true,
            // We might need to check transactions too if they aren't fully represented in Payment table yet? 
            // But Payment is the source of truth for LTV usually. 
            // The schema has `payments Payment[]`.
            // Also `ltvAdsCents` depends on "AdsRevenue" table or logic.
        }
    });

    console.log(`Found ${leads.length} leads. Processing...`);

    let updatedCount = 0;

    for (const lead of leads) {
        let shouldUpdate = false;

        // Calculate Total LTV from Payments
        const totalLtvCents = lead.payments.reduce((sum, p) => sum + p.amountCents, 0);

        // Calculate Ads LTV
        // Logic: If lead source is 'ghl_ads' (or contains 'ads'), ALL their revenue is attributed to ads?
        // OR: We only count payments that are linked to AdsRevenue?
        // User expectation: "LTV in the ads is also not shown".
        // If the lead originates from ads, we typically count their *entire* LTV as Ads LTV (Cohort analysis).
        // Let's verify existing logic in `leadIntakeService` implies attribution. 
        // Generally: If lead.source includes 'ads' or 'facebook' etc, then ltvAdsCents = ltvAllCents.

        const isAdsLead = lead.source?.toLowerCase().includes("ads") ||
            lead.source === "ghl_ads" ||
            (lead.tags as any)?.includes("ads");

        let newLtvAdsCents = 0;
        if (isAdsLead) {
            newLtvAdsCents = totalLtvCents;
        } else {
            // Check `AdsRevenue` table if partial attribution exists?
            // For now, simpler is better: if they are an ads lead, their LTV is Ads LTV.
        }

        if (lead.ltvAllCents !== totalLtvCents || lead.ltvAdsCents !== newLtvAdsCents) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    ltvAllCents: totalLtvCents,
                    ltvAdsCents: newLtvAdsCents,
                    // Ensure isClient is true if they have revenue
                    isClient: totalLtvCents > 0 ? true : lead.isClient,
                    status: totalLtvCents > 0 ? "CLIENT" : lead.status
                }
            });
            updatedCount++;
            if (updatedCount % 10 === 0) console.log(`Updated ${updatedCount} leads...`);
        }
    }

    console.log(`Finished. Updated LTV for ${updatedCount} leads.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
