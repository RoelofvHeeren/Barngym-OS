import { prisma } from "@/lib/prisma"; // Adjust path if necessary
import { recalculateLeadLtv } from "@/utils/ltv"; // Adjust path if necessary

// Utility to add a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log("Starting full LTV recalculation...");

    // 1. Fetch all leads that have at least one payment.
    // We can optimize by only selecting IDs.
    // Prisma `findMany` with `where` clause.
    // Ideally, process in chunks to avoid memory issues if there are thousands.

    const CHUNK_SIZE = 50;
    let skip = 0;
    let processedCount = 0;

    while (true) {
        const leads = await prisma.lead.findMany({
            where: {
                payments: {
                    some: {} // Leads with at least one payment
                }
            },
            select: { id: true },
            take: CHUNK_SIZE,
            skip: skip,
            orderBy: { id: 'asc' } // Consistent ordering
        });

        if (leads.length === 0) {
            break;
        }

        console.log(`Processing chunk of ${leads.length} leads (Skip: ${skip})...`);

        // Process chunk in parallel (or sequential if DB load is a concern)
        // recalcluateLeadLtv is async.
        await Promise.all(leads.map(async (lead) => {
            try {
                await recalculateLeadLtv(lead.id);
            } catch (e) {
                console.error(`Failed to recalc lead ${lead.id}`, e);
            }
        }));

        processedCount += leads.length;
        skip += CHUNK_SIZE;

        // Optional: add a small delay between chunks to be nice to the DB
        await delay(100);
    }

    console.log(`Finished. Recalculated LTV for ${processedCount} leads.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
