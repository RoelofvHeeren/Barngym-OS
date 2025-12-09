const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillAdsLtv() {
    console.log('Starting backfill for Ads LTV and Revenue...');

    try {
        // 1. Find all leads that look like ads leads
        const leads = await prisma.lead.findMany({
            where: {
                OR: [
                    { source: { contains: 'ads', mode: 'insensitive' } },
                    { source: { contains: 'facebook', mode: 'insensitive' } },
                    { source: { contains: 'instagram', mode: 'insensitive' } },
                    { source: { contains: 'meta', mode: 'insensitive' } },
                    { source: { contains: 'tiktok', mode: 'insensitive' } },
                    // Check tags properly based on structure. 
                    // Since tags is Json, we can't easily filter in Prisma perfectly for all DBs, 
                    // but we will filter in memory to be safe if Prisma filter misses.
                ]
            },
            include: {
                payments: true
            }
        });

        console.log(`Found ${leads.length} potential ads leads.`);

        let updatedLeads = 0;
        let newRevenueRecords = 0;

        for (const lead of leads) {
            // Double check tags just in case (though source match is what we mostly care about now)
            // We assume if it's in this list, it IS an ads lead.

            const payments = lead.payments;
            if (payments.length === 0) continue;

            let ltvAdsCents = 0;

            for (const payment of payments) {
                const amount = payment.amountCents || 0;
                ltvAdsCents += amount;

                // Check if AdsRevenue exists
                const existingRev = await prisma.adsRevenue.findFirst({
                    where: { paymentId: payment.id }
                });

                if (!existingRev) {
                    await prisma.adsRevenue.create({
                        data: {
                            leadId: lead.id,
                            paymentId: payment.id,
                            amountCents: amount,
                            timestamp: payment.timestamp
                        }
                    });
                    newRevenueRecords++;
                }
            }

            // Update Lead
            if (ltvAdsCents > 0) {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        ltvAdsCents: ltvAdsCents, // Set to calculated total
                        isClient: true // Ensure isClient is true
                    }
                });
                updatedLeads++;
            }
        }

        console.log(`Backfill complete.`);
        console.log(`Updated Leads: ${updatedLeads}`);
        console.log(`New AdsRevenue Records: ${newRevenueRecords}`);

    } catch (error) {
        console.error('Error during backfill:', error);
    } finally {
        await prisma.$disconnect();
    }
}

backfillAdsLtv();
