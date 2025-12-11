import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🧠 Smart Recalculating Lead LTV (Max Strategy)...');

    const leads = await prisma.lead.findMany({
        include: {
            transactions: true
        }
    });

    console.log(`Processing ${leads.length} leads...`);
    let updatedCount = 0;

    for (const lead of leads) {
        // 1. Calculate LTV from the transactions actually linked to this lead
        // (This catches cases like Mark Sheldon where Lead -> Tx <- StripeContact, but Lead -x- StripeContact)
        const validTransactions = lead.transactions.filter(t =>
            ['completed', 'succeeded', 'paid', 'SETTLED', 'Completed'].includes(t.status)
        );

        const leadDirectLTV = validTransactions.reduce((sum, t) => sum + (t.amountMinor || 0), 0);

        // 2. Calculate LTV from the matched contact (by email) -> The "Standard" way
        let contactLTV = 0;
        if (lead.email) {
            const contact = await prisma.contact.findFirst({
                where: { email: { equals: lead.email, mode: 'insensitive' } },
                select: { ltvAllCents: true }
            });
            if (contact) {
                contactLTV = contact.ltvAllCents;
            }
        }

        // 3. Take the WINNER
        const bestLTV = Math.max(leadDirectLTV, contactLTV);

        // Only update if it's different (and specifically if we represent an improvement or fix)
        // We strictly want to correct the "0" issue.

        if (bestLTV !== lead.ltvAllCents) {

            // Special logic for Ads LTV:
            // If the lead is an ads lead, verify if ltvAdsCents matches bestLTV
            const isAdsLead = lead.source?.toLowerCase().includes('ads') ||
                lead.source?.toLowerCase().includes('facebook') ||
                lead.source?.toLowerCase().includes('instagram') ||
                lead.source?.toLowerCase().includes('meta') ||
                lead.source?.toLowerCase().includes('tiktok');

            const newAdsLTV = isAdsLead ? bestLTV : lead.ltvAdsCents; // Don't wipe existing ads ltv if not sure? 
            // Actually, if isAdsLead is true, AdsLTV should = AllLTV usually.

            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    ltvAllCents: bestLTV,
                    ltvAdsCents: isAdsLead ? bestLTV : undefined, // Only update Ads LTV if confirmed ads lead
                    isClient: bestLTV > 0
                }
            });

            // console.log(`Fixed ${lead.email}: Was £${lead.ltvAllCents/100} -> Now £${bestLTV/100} (Direct: £${leadDirectLTV/100}, Contact: £${contactLTV/100})`);
            updatedCount++;
        }
    }

    console.log(`\n✅ Updated LTV for ${updatedCount} leads.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
