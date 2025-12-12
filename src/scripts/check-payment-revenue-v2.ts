import { prisma } from '@/lib/prisma';

async function main() {
    console.log("Checking revenue with NEW filter logic (ads, facebook, instagram, meta, tiktok)...");

    // This matches the new API logic
    const revenueAgg = await prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: {
            lead: {
                OR: [
                    { source: { contains: "ads", mode: "insensitive" as const } },
                    { source: { contains: "facebook", mode: "insensitive" as const } },
                    { source: { contains: "instagram", mode: "insensitive" as const } },
                    { source: { contains: "meta", mode: "insensitive" as const } },
                    { source: { contains: "tiktok", mode: "insensitive" as const } }
                ]
            }
        }
    });

    const revenue = (revenueAgg._sum.amountCents || 0) / 100;
    console.log(`Payment Table Revenue (Expanded Filter): £${revenue.toLocaleString()}`);

    if (revenue < 37000) {
        console.log("\n⚠️ Revenue is still lower than expected (~£37k). Investigating why...");
        // Let's check leads that have ltvAdsCents > 0 but are NOT being caught by the Payment filter

        const allAdLeads = await prisma.lead.findMany({
            where: {
                OR: [
                    { source: { contains: 'ads', mode: 'insensitive' as const } },
                    { source: { contains: 'facebook', mode: 'insensitive' as const } },
                    { source: { contains: 'instagram', mode: 'insensitive' as const } },
                    { source: { contains: 'meta', mode: 'insensitive' as const } },
                    { source: { contains: 'tiktok', mode: 'insensitive' as const } }
                ]
            },
            select: { id: true, email: true, ltvAdsCents: true, payments: { select: { id: true, amountCents: true } } }
        });

        const leadsWithLTVButNoPayments = allAdLeads.filter(l => l.ltvAdsCents > 0 && l.payments.length === 0);
        console.log(`Leads with Ads LTV but NO linked 'Payment' records: ${leadsWithLTVButNoPayments.length}`);

        if (leadsWithLTVButNoPayments.length > 0) {
            console.log("Example leads missing payments:");
            leadsWithLTVButNoPayments.slice(0, 5).forEach(l => {
                console.log(`- ${l.email}: LTV £${l.ltvAdsCents / 100}`);
            });
            console.log("\nPossible Reason: These leads have 'Transactions' but no 'Payment' records created for them yet?");
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
