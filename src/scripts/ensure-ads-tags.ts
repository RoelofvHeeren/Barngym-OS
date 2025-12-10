
import { prisma } from "@/lib/prisma";

async function main() {
    console.log("Starting Source Tag repair...");

    // We want to ensure that all leads imported from the CSV have source='ghl_ads'.
    // We can identify them by checking if they were created recently or by specific email list if needed.
    // Best proxy: Look for leads with source='csv_import' (from first script) or undefined. 
    // OR simply update based on the mapped leads logic. 

    // Let's indiscriminately update any lead that has `submissionDate` set (as that was our new field) 
    // AND doesn't have a strong source like 'glofox' unless we want to override it.
    // But wait, user said "Jim Laidler" has "Source: glofox". 
    // If we override it to 'ghl_ads', it might break other integration logic?
    // User asked: "add them with the ads tag and have them show up as ad clients".
    // The Ads Dashboard filters by: source contains 'ads' OR leadTracking has campaign.

    // Strategy:
    // 1. Find leads with `submissionDate` (our marker for GHL leads).
    // 2. Ensuring `source` contains 'ads' or we append it?
    // Better: Update `leadTracking` to have `utmSource: 'ghl_ads'`. 
    // The dashboard might look at that too.

    const targetLeads = await prisma.lead.findMany({
        where: {
            submissionDate: { not: null }
        }
    });

    console.log(`Found ${targetLeads.length} leads with submissionDate.`);

    for (const lead of targetLeads) {
        // If source is NOT ads-related, let's make it so.
        // But we don't want to lose 'glofox'. 
        // Maybe we can append to tags?

        let tags = (lead.tags as any) || [];
        if (!Array.isArray(tags)) tags = [];

        let updated = false;
        if (!tags.includes("ads")) {
            tags.push("ads");
            updated = true;
        }

        // Also ensure leadTracking exists
        const tracking = await prisma.leadTracking.findFirst({
            where: { leadId: lead.id }
        });

        if (!tracking) {
            await prisma.leadTracking.create({
                data: {
                    leadId: lead.id,
                    utmSource: "ghl_ads", // This definitely puts them in Ads bucket
                    campaignId: "ghl_import"
                }
            });
            console.log(`Created tracking for ${lead.email}`);
        } else if (tracking.utmSource !== "ghl_ads" && !tracking.utmSource?.includes("ads")) {
            // Verify if we should overwrite. 
            // If it's empty, yes.
        }

        if (updated) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: { tags: tags, source: lead.source === "glofox" ? "glofox_ads" : "ghl_ads" } // Hybrid source? 
            });
            // Actually, replacing source "glofox" -> "ghl_ads" might be safer for specific reporting IF getting them into this dashboard is priority.
            // Let's stick to updating the source to 'ghl_ads' if it's currently just 'csv_import' or null.
            if (lead.source === "csv_import" || !lead.source) {
                await prisma.lead.update({ where: { id: lead.id }, data: { source: "ghl_ads" } });
            }
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
