import { prisma } from '@/lib/prisma';

async function main() {
    // 1. Check Ad Revenue Total
    console.log('💰 Re-Checking Total Ads Revenue (Expect ~37k)...');

    const isAdsLeadFilter = {
        OR: [
            { source: { contains: "ads", mode: "insensitive" } },
            { source: { contains: "facebook", mode: "insensitive" } },
            { source: { contains: "instagram", mode: "insensitive" } },
            { source: { contains: "meta", mode: "insensitive" } },
            { source: { contains: "tiktok", mode: "insensitive" } },
        ]
    };

    const totalAdsRevenue = await prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: { lead: isAdsLeadFilter }
    });

    console.log(`GRAND TOTAL: £${(totalAdsRevenue._sum.amountCents || 0) / 100}`);

    // 2. Fix Gia (Again)
    // Ensure her lead/contact has the right value.
    const giaEmail = 'badgix@gmail.com';
    console.log(`\n🚑 Force Fixing Gia (${giaEmail})...`);

    // Calculate sum of transactions for her lead ID only
    const giaLead = await prisma.lead.findFirst({
        where: { email: { equals: giaEmail, mode: 'insensitive' } },
        include: { transactions: true }
    });

    if (giaLead) {
        const sum = giaLead.transactions.reduce((acc, t) => acc + (t.amountMinor || 0), 0);
        console.log(`Gia Lead Transaction Sum: £${sum / 100}`);

        // If sum is correct (1200), update LTV
        if (sum > 0) {
            await prisma.lead.update({
                where: { id: giaLead.id },
                data: {
                    ltvAllCents: sum,
                    ltvAdsCents: sum, // She is ads
                    isClient: true
                }
            });
            console.log(`✅ Updated Gia Lead LTV to £${sum / 100}`);
        } else {
            console.log('❌ Gia sum is still 0? Checking transactions...');
            giaLead.transactions.forEach(t => console.log(` - ${t.amountMinor}`));
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
