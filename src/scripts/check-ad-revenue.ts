import { prisma } from '@/lib/prisma';

async function main() {
    // Logic usually used for "Revenue from Ads" card
    // Typically sums ltvAdsCents of all leads derived from ads

    const adLeads = await prisma.lead.findMany({
        where: {
            OR: [
                { source: { contains: 'ads', mode: 'insensitive' as const } },
                { source: { contains: 'facebook', mode: 'insensitive' as const } },
                { source: { contains: 'instagram', mode: 'insensitive' as const } },
                { source: { contains: 'meta', mode: 'insensitive' as const } },
                { source: { contains: 'tiktok', mode: 'insensitive' as const } }
            ]
        },
        select: {
            ltvAdsCents: true,
            ltvAllCents: true,
            email: true
        }
    });

    const totalRevenue = adLeads.reduce((sum, lead) => sum + (lead.ltvAdsCents || 0), 0);

    console.log(`Total Ad Leads: ${adLeads.length}`);
    console.log(`Total Ad Revenue: £${(totalRevenue / 100).toLocaleString()}`);

    // Also check top contributors to see if any big ones are missing
    const topLeads = adLeads
        .sort((a, b) => (b.ltvAdsCents || 0) - (a.ltvAdsCents || 0))
        .slice(0, 5);

    console.log('\nTop 5 Ad Revenue Contributors:');
    topLeads.forEach(l => {
        console.log(`- ${l.email}: £${((l.ltvAdsCents || 0) / 100).toLocaleString()}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
