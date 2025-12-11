import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🧹 Cleaning up Orphan Payments...');

    // Strategy: 
    // 1. Fetch all Payments.
    // 2. Check if their externalPaymentId matches a Transaction's externalId OR id.
    // 3. If no match, it's an orphan -> Delete.

    // Optimization: Fetch all Transaction IDs/ExternalIDs first?
    // There might be too many. Let's do it in batches or use a raw query if possible.
    // But for safety, checking individually (or filtered) is better.

    // Let's target the AD Leads first since that's where the issue is reported.
    const isAdsLeadFilter = {
        OR: [
            { source: { contains: "ads", mode: "insensitive" } },
            { source: { contains: "facebook", mode: "insensitive" } },
            { source: { contains: "instagram", mode: "insensitive" } },
            { source: { contains: "meta", mode: "insensitive" } },
            { source: { contains: "tiktok", mode: "insensitive" } },
        ]
    };

    const payments = await prisma.payment.findMany({
        where: { lead: isAdsLeadFilter },
        include: { lead: { select: { email: true } } }
    });

    console.log(`Checking ${payments.length} payments linked to Ads Leads...`);

    const orphans = [];

    for (const p of payments) {
        // Find matching tx
        const tx = await prisma.transaction.findFirst({
            where: {
                OR: [
                    { id: p.externalPaymentId },
                    { externalId: p.externalPaymentId }
                ]
            }
        });

        if (!tx) {
            orphans.push(p);
            // console.log(`Orphan found for ${p.lead?.email}: £${p.amountCents/100} (Ext: ${p.externalPaymentId})`);
        }
    }

    console.log(`\nFound ${orphans.length} ORPHAN payments.`);

    if (orphans.length > 0) {
        console.log('Deleting orphans...');
        const ids = orphans.map(p => p.id);
        await prisma.payment.deleteMany({
            where: { id: { in: ids } }
        });
        console.log('✅ Deletion complete.');

        const deletedTotal = orphans.reduce((sum, p) => sum + p.amountCents, 0);
        console.log(`Removed a total of £${deletedTotal / 100} from Revenue.`);
    } else {
        console.log('No orphans found.');
    }

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
