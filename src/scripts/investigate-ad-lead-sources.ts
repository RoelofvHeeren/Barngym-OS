import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Analyzing Ad Leads for Last 30 Days...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const whereCondition = {
        AND: [
            {
                OR: [
                    { source: { contains: "ads", mode: "insensitive" } },
                    { source: { contains: "facebook", mode: "insensitive" } },
                    { source: { contains: "instagram", mode: "insensitive" } },
                    { source: { contains: "meta", mode: "insensitive" } },
                    { source: { contains: "tiktok", mode: "insensitive" } },
                ]
            },
            {
                OR: [
                    { submissionDate: { gte: startDate, lte: endDate } },
                    { submissionDate: null, createdAt: { gte: startDate, lte: endDate } },
                ]
            }
        ]
    };

    const leads = await prisma.lead.findMany({
        where: whereCondition,
        select: { source: true, createdAt: true, submissionDate: true }
    });

    console.log(`\nTotal Leads matching filter in last 30 days: ${leads.length}`);

    // Group by source
    const sourceCounts: Record<string, number> = {};
    leads.forEach(l => {
        const s = l.source || 'Unknown';
        sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    });

    console.log('\n--- Breakdown by Source ---');
    Object.entries(sourceCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([source, count]) => {
            console.log(`${source}: ${count}`);
        });

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
