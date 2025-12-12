
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixLeadDates() {
    const end = new Date();
    const start7d = new Date(end);
    start7d.setDate(start7d.getDate() - 7);

    console.log(`Scanning Window: ${start7d.toISOString()} -> ${end.toISOString()}`);

    const isAdsLeadFilter = {
        OR: [
            { source: { contains: "ads", mode: "insensitive" as const } },
            { source: { contains: "facebook", mode: "insensitive" as const } },
            { source: { contains: "instagram", mode: "insensitive" as const } },
            { source: { contains: "meta", mode: "insensitive" as const } },
            { source: { contains: "tiktok", mode: "insensitive" as const } },
        ],
    };

    const leads = await prisma.lead.findMany({
        where: {
            ...isAdsLeadFilter,
            OR: [
                { submissionDate: { gte: start7d, lte: end } },
                { submissionDate: null, createdAt: { gte: start7d, lte: end } }
            ]
        },
    });

    console.log(`Found ${leads.length} leads to process.`);

    const ALLOWED_NAMES = ["James", "Alex", "Haley Ellis", "Harvey Specter"];
    // Also include "MBS 19"?

    for (const lead of leads) {
        let isAllowed = false;
        // Check partial match
        if (ALLOWED_NAMES.some(name => lead.fullName?.toLowerCase().includes(name.toLowerCase()))) {
            isAllowed = true;
        }
        // Special check for "MBS" just in case
        if (lead.fullName?.includes("MBS")) isAllowed = true;

        if (isAllowed) {
            console.log(`[KEEP] ${lead.fullName} (ID: ${lead.id}) - Recent Lead`);
            // Ensure submissionDate is set
            if (!lead.submissionDate) {
                console.log(`   -> Setting submissionDate to createdAt: ${lead.createdAt.toISOString()}`);
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { submissionDate: lead.createdAt }
                });
            }
        } else {
            console.log(`[BACKDATE] ${lead.fullName} (ID: ${lead.id}) - Imported/Old Lead`);
            // Backdate by 60 days
            const backdate = new Date(lead.createdAt);
            backdate.setDate(backdate.getDate() - 60);

            console.log(`   -> Setting submissionDate to: ${backdate.toISOString()}`);
            await prisma.lead.update({
                where: { id: lead.id },
                data: { submissionDate: backdate }
            });
        }
    }
}

fixLeadDates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
