
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkCount() {
    const end = new Date();
    const start7d = new Date(end);
    start7d.setDate(start7d.getDate() - 7);

    const count = await prisma.lead.count({
        where: {
            AND: [
                {
                    OR: [
                        { source: { contains: "ads", mode: "insensitive" as const } },
                        { source: { contains: "facebook", mode: "insensitive" as const } },
                        { source: { contains: "instagram", mode: "insensitive" as const } },
                        { source: { contains: "meta", mode: "insensitive" as const } },
                        { source: { contains: "tiktok", mode: "insensitive" as const } },
                    ]
                },
                {
                    OR: [
                        { submissionDate: { gte: start7d, lte: end } },
                        { submissionDate: null, createdAt: { gte: start7d, lte: end } }
                    ]
                }
            ]
        }
    });
    console.log(`7-Day Ads Lead Count: ${count}`);
}

checkCount()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
