import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Fixing LTV inconsistencies for all Leads...\n');

    // Get all leads with their transactions
    const leads = await prisma.lead.findMany({
        include: {
            transactions: {
                where: {
                    status: {
                        in: ['Completed', 'completed', 'succeeded', 'paid', 'SETTLED'],
                        mode: 'insensitive' as const
                    }
                }
            }
        }
    });

    console.log(`Found ${leads.length} leads to process\n`);

    let fixed = 0;
    let skipped = 0;

    for (const lead of leads) {
        // Calculate total LTV from all completed transactions
        const totalLTV = lead.transactions.reduce((sum, t) => sum + t.amountMinor, 0);

        // Find associated contact LTV
        let contactLTV = 0;
        if (lead.email) {
            const contact = await prisma.contact.findFirst({
                where: { email: { equals: lead.email, mode: 'insensitive' as const } },
                select: { ltvAllCents: true }
            });
            if (contact) {
                contactLTV = contact.ltvAllCents;
            }
        }

        // Use the MAX of Lead Direct LTV or Contact LTV
        // This prevents overwriting valid Lead data with 0 if contact link is missing,
        // and prevents overwriting valid Contact data with 0 if lead link is missing.
        const bestLTV = Math.max(totalLTV, contactLTV);

        // Check if this is an ads lead
        const isAdsLead = lead.source?.toLowerCase().includes('ads') ||
            lead.source?.toLowerCase().includes('facebook') ||
            lead.source?.toLowerCase().includes('instagram') ||
            lead.source?.toLowerCase().includes('meta') ||
            lead.source?.toLowerCase().includes('tiktok');

        // Ads LTV = bestLTV if from ads source, otherwise 0
        const adsLTV = isAdsLead ? bestLTV : 0;

        // Calculate product-specific LTVs
        const ltvByProduct = {
            PT: 0,
            Classes: 0,
            SixWeek: 0,
            OnlineCoaching: 0,
            Community: 0,
            Corporate: 0,
        };

        lead.transactions.forEach(t => {
            const type = t.productType?.toLowerCase() || '';
            if (type.includes('pt') || type.includes('personal training')) {
                ltvByProduct.PT += t.amountMinor;
            } else if (type.includes('class') || type.includes('membership')) {
                ltvByProduct.Classes += t.amountMinor;
            } else if (type.includes('6 week') || type.includes('transformation')) {
                ltvByProduct.SixWeek += t.amountMinor;
            } else if (type.includes('online') || type.includes('coaching')) {
                ltvByProduct.OnlineCoaching += t.amountMinor;
            } else if (type.includes('community')) {
                ltvByProduct.Community += t.amountMinor;
            } else if (type.includes('corporate')) {
                ltvByProduct.Corporate += t.amountMinor;
            }
        });

        // Check if update is needed
        const needsUpdate =
            lead.ltvAllCents !== bestLTV ||
            lead.ltvAdsCents !== adsLTV ||
            lead.ltvPTCents !== ltvByProduct.PT ||
            lead.ltvClassesCents !== ltvByProduct.Classes ||
            lead.ltvSixWeekCents !== ltvByProduct.SixWeek ||
            lead.ltvOnlineCoachingCents !== ltvByProduct.OnlineCoaching ||
            lead.ltvCommunityCents !== ltvByProduct.Community ||
            lead.ltvCorporateCents !== ltvByProduct.Corporate;

        if (needsUpdate) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    ltvAllCents: bestLTV,
                    ltvAdsCents: adsLTV,
                    ltvPTCents: ltvByProduct.PT,
                    ltvClassesCents: ltvByProduct.Classes,
                    ltvSixWeekCents: ltvByProduct.SixWeek,
                    ltvOnlineCoachingCents: ltvByProduct.OnlineCoaching,
                    ltvCommunityCents: ltvByProduct.Community,
                    ltvCorporateCents: ltvByProduct.Corporate,
                    isClient: totalLTV > 0,
                }
            });

            if (lead.ltvAllCents !== totalLTV || lead.ltvAdsCents !== adsLTV) {
                console.log(`✅ Fixed: ${lead.fullName || lead.email || lead.id}`);
                console.log(`   Total LTV: £${(lead.ltvAllCents / 100).toFixed(2)} → £${(totalLTV / 100).toFixed(2)}`);
                console.log(`   Ads LTV: £${(lead.ltvAdsCents / 100).toFixed(2)} → £${(adsLTV / 100).toFixed(2)}`);
            }
            fixed++;
        } else {
            skipped++;
        }
    }

    console.log(`\n✅ Fixed ${fixed} leads`);
    console.log(`ℹ️  Skipped ${skipped} leads (already correct)`);
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
