import { prisma } from '@/lib/prisma';

async function main() {
    // 1. Force Fix Mark Sheldon
    const markEmail = 'marksheldonghl@gmail.com';
    console.log(`\n🚑 Force Fixing Mark Sheldon...`);

    const markLead = await prisma.lead.findFirst({
        where: { email: { equals: markEmail, mode: 'insensitive' } },
        include: { transactions: true }
    });

    if (markLead) {
        // Calculate LTV directly from HIS transactions, ignoring Contact linkage failure
        const validTx = markLead.transactions.filter(t =>
            ['completed', 'succeeded', 'paid', 'SETTLED', 'Completed'].includes(t.status)
        );
        const directLTV = validTx.reduce((sum, t) => sum + (t.amountMinor || 0), 0);

        console.log(`Mark's Transaction Sum: £${directLTV / 100}`);

        if (directLTV > 0) {
            await prisma.lead.update({
                where: { id: markLead.id },
                data: {
                    ltvAllCents: directLTV,
                    ltvAdsCents: directLTV, // Since we know he is ads source
                    isClient: true
                }
            });
            console.log('Mark Updated.');
        }
    }

    // 2. Analyze Top Contributors to Ads Revenue
    console.log(`\n💰 Analyzing Top Ads Revenue Contributors (Total ~46k?)...`);

    const adLeads = await prisma.lead.findMany({
        where: {
            OR: [
                { source: { contains: "ads", mode: "insensitive" as const } },
                { source: { contains: "facebook", mode: "insensitive" as const } },
                { source: { contains: "instagram", mode: "insensitive" as const } },
                { source: { contains: "meta", mode: "insensitive" as const } },
                { source: { contains: "tiktok", mode: "insensitive" as const } },
            ]
        },
        select: { fullName: true, email: true, ltvAdsCents: true, ltvAllCents: true, source: true },
        orderBy: { ltvAdsCents: 'desc' },
        take: 20
    });

    let runningTotal = 0;
    adLeads.forEach(l => {
        const val = l.ltvAdsCents || 0;
        runningTotal += val;
        console.log(` - ${l.fullName} (${l.source}) | Pledged Ads LTV: £${val / 100}`);
    });

    const totalAdsRevenue = await prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: {
            lead: {
                OR: [
                    { source: { contains: "ads", mode: "insensitive" as const } },
                    { source: { contains: "facebook", mode: "insensitive" as const } },
                    { source: { contains: "instagram", mode: "insensitive" as const } },
                    { source: { contains: "meta", mode: "insensitive" as const } },
                    { source: { contains: "tiktok", mode: "insensitive" as const } },
                ]
            }
        }
    });

    console.log(`\nTotal Calculated Ads Revenue (Cash Flow): £${(totalAdsRevenue._sum.amountCents || 0) / 100}`);

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
