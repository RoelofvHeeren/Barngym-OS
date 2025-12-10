import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔄 Restoring Lead LTV values from Contact LTV...\n');

    // Get all leads with their email
    const leads = await prisma.lead.findMany({
        where: { email: { not: null } },
        select: { id: true, email: true, source: true }
    });

    console.log(`Found ${leads.length} leads with email addresses\n`);

    let restored = 0;
    let skipped = 0;

    for (const lead of leads) {
        // Find matching contact by email
        const contact = await prisma.contact.findFirst({
            where: { email: { equals: lead.email!, mode: 'insensitive' } },
            select: {
                ltvAllCents: true,
                ltvGlofoxCents: true,
                ltvStripeCents: true,
                ltvStarlingCents: true,
            }
        });

        if (!contact) {
            skipped++;
            continue;
        }

        // Check if this is an ads lead
        const isAdsLead = lead.source?.toLowerCase().includes('ads') ||
            lead.source?.toLowerCase().includes('facebook') ||
            lead.source?.toLowerCase().includes('instagram') ||
            lead.source?.toLowerCase().includes('meta') ||
            lead.source?.toLowerCase().includes('tiktok');

        // Ads LTV = total LTV if from ads source, otherwise 0
        const adsLTV = isAdsLead ? contact.ltvAllCents : 0;

        // Update lead with contact's LTV values
        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                ltvAllCents: contact.ltvAllCents,
                ltvAdsCents: adsLTV,
                isClient: contact.ltvAllCents > 0,
            }
        });

        console.log(`✅ Restored: ${lead.email} - £${(contact.ltvAllCents / 100).toFixed(2)}`);
        restored++;
    }

    console.log(`\n✅ Restored ${restored} leads`);
    console.log(`ℹ️  Skipped ${skipped} leads (no matching contact)`);
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
