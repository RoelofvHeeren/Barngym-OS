import { prisma } from '@/lib/prisma';
import fs from 'fs';

async function main() {
    console.log('📊 Generating Ad Revenue Breakdown...');

    const isAdsLeadFilter = {
        OR: [
            { source: { contains: "ads", mode: "insensitive" as const } },
            { source: { contains: "facebook", mode: "insensitive" as const } },
            { source: { contains: "instagram", mode: "insensitive" as const } },
            { source: { contains: "meta", mode: "insensitive" as const } },
            { source: { contains: "tiktok", mode: "insensitive" as const } },
        ]
    };

    // 1. Get all payments linked to these leads
    const payments = await prisma.payment.findMany({
        where: {
            lead: isAdsLeadFilter
        },
        include: {
            lead: {
                select: { fullName: true, email: true, source: true }
            }
        },
        orderBy: { amountCents: 'desc' }
    });

    console.log(`Found ${payments.length} individual payments.`);

    // 2. Aggregate by Client
    const clientTotals: Record<string, { name: string, email: string, source: string, total: number }> = {};
    let grandTotal = 0;

    payments.forEach(p => {
        const email = p.lead?.email || 'Unknown';
        if (!clientTotals[email]) {
            clientTotals[email] = {
                name: p.lead?.fullName || 'Unknown',
                email: email,
                source: p.lead?.source || 'Unknown',
                total: 0
            };
        }
        clientTotals[email].total += (p.amountCents || 0);
        grandTotal += (p.amountCents || 0);
    });

    // 3. Output Top 50 Breakdown to Console
    console.log('\n--- 🧾 Top 50 Revenue Contributors ---');
    console.log('Rank | Name | Email | Source | Total Contributed');
    console.log('---|---|---|---|---');

    const sortedClients = Object.values(clientTotals).sort((a, b) => b.total - a.total);

    sortedClients.slice(0, 50).forEach((c, index) => {
        console.log(`${index + 1} | ${c.name} | ${c.email} | ${c.source} | £${(c.total / 100).toFixed(2)}`);
    });

    console.log('\n...');
    console.log(`\n💰 GRAND TOTAL: £${(grandTotal / 100).toFixed(2)}`);
    console.log(`(Sum of ${sortedClients.length} clients)`);

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
