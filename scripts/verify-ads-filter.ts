
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.local") });

const prisma = new PrismaClient();

async function main() {
    const isAdsLeadFilter = {
        OR: [
            { tags: { array_contains: "ads" } },
            { tags: { path: ["ghlTags"], array_contains: "ads" } },
            { source: { contains: "ads", mode: "insensitive" as const } },
        ],
    };

    console.log("Testing Ads Filter Query...");

    const leads = await prisma.lead.findMany({
        where: {
            AND: [
                isAdsLeadFilter,
                {
                    OR: [
                        { email: { contains: "rmiles", mode: "insensitive" } },
                        { fullName: { contains: "Raymond", mode: "insensitive" } }
                    ]
                }
            ]
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            source: true,
            tags: true
        }
    });

    if (leads.length > 0) {
        console.log("SUCCESS: Found leads matching the new filter:");
        leads.forEach(l => {
            console.log(`- ${l.fullName} (${l.email}) | Source: ${l.source} | Tags: ${JSON.stringify(l.tags)}`);
        });
    } else {
        console.log("FAILURE: No leads found with the new filter.");
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
