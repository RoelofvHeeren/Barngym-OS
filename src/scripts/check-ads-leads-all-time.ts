import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Checking ALL TIME Ad Leads...');

    const whereCondition = {
        OR: [
            { source: { contains: "ads", mode: "insensitive" } },
            { source: { contains: "facebook", mode: "insensitive" } },
            { source: { contains: "instagram", mode: "insensitive" } },
            { source: { contains: "meta", mode: "insensitive" } },
            { source: { contains: "tiktok", mode: "insensitive" } },
        ]
    };

    const totalCount = await prisma.lead.count({
        where: whereCondition
    });

    console.log(`\nTotal 'Ads' Leads (All Time): ${totalCount}`);

    // Check createdAt distribution
    const leads = await prisma.lead.findMany({
        where: whereCondition,
        select: { createdAt: true, submissionDate: true },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    console.log('\nTop 20 Most Recently Created Ads Leads:');
    leads.forEach(l => {
        console.log(`- Created: ${l.createdAt.toISOString()} | Submission: ${l.submissionDate?.toISOString() || 'null'}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
