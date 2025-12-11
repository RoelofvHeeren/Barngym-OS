import { prisma } from '@/lib/prisma';

async function main() {
    const totalLeads = await prisma.lead.count();
    console.log(`Total Leads in DB: ${totalLeads}`);

    const filter = {
        OR: [
            { source: { contains: "ads", mode: "insensitive" } },
            { source: { contains: "facebook", mode: "insensitive" } },
            { source: { contains: "instagram", mode: "insensitive" } },
            { source: { contains: "meta", mode: "insensitive" } },
            { source: { contains: "tiktok", mode: "insensitive" } },
        ]
    };

    const adMatchedLeads = await prisma.lead.count({ where: filter });
    console.log(`Leads matching New AD Filter: ${adMatchedLeads}`);

    // Breakdown of sources matching the filter
    const matchedLeads = await prisma.lead.findMany({
        where: filter,
        select: { source: true }
    });

    const counts: Record<string, number> = {};
    matchedLeads.forEach(l => {
        const s = l.source || 'NULL';
        counts[s] = (counts[s] || 0) + 1;
    });

    console.log('\n--- Sources Matched by Filter ---');
    Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([s, c]) => console.log(`${s}: ${c}`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
