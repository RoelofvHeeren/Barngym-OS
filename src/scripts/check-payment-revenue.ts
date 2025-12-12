import { prisma } from '@/lib/prisma';

async function main() {
    // Logic from dashboard:
    // source: { contains: "ads", mode: "insensitive" }

    const revenueAgg = await prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: {
            lead: {
                source: { contains: "ads", mode: "insensitive" as const }
            }
        }
    });

    const revenue = (revenueAgg._sum.amountCents || 0) / 100;
    console.log(`Payment Table Revenue (Ads leads): £${revenue.toLocaleString()}`);

    const payments = await prisma.payment.findMany({
        where: {
            lead: {
                source: { contains: "ads", mode: "insensitive" as const }
            }
        },
        select: {
            id: true,
            amountCents: true,
            timestamp: true,
            lead: {
                select: { email: true }
            }
        },
        orderBy: { amountCents: 'desc' },
        take: 5
    });

    console.log('\nTop 5 Payments:');
    payments.forEach(p => {
        console.log(`- ${p.timestamp.toISOString().split('T')[0]} £${p.amountCents / 100} (${p.lead?.email})`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
