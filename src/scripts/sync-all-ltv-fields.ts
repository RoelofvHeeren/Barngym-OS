import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Fixing LTV inconsistencies across all contacts...\n');

    // Get all contacts
    const contacts = await prisma.contact.findMany({
        include: {
            transactions: {
                where: { status: 'completed' }
            }
        }
    });

    console.log(`Found ${contacts.length} contacts to process\n`);

    let fixed = 0;
    let skipped = 0;

    for (const contact of contacts) {
        // Calculate total LTV from all completed transactions
        const totalLTV = contact.transactions.reduce((sum, t) => sum + t.amountMinor, 0);

        // Calculate ads LTV (transactions from ads sources)
        const adsLTV = contact.transactions
            .filter(t => {
                const tags = contact.sourceTags || [];
                return tags.some(tag =>
                    tag.toLowerCase().includes('ads') ||
                    tag.toLowerCase().includes('facebook') ||
                    tag.toLowerCase().includes('instagram') ||
                    tag.toLowerCase().includes('meta') ||
                    tag.toLowerCase().includes('tiktok')
                );
            })
            .reduce((sum, t) => sum + t.amountMinor, 0);

        // Check if update is needed
        if (contact.ltvAllCents !== totalLTV || contact.ltvAdsCents !== adsLTV) {
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    ltvAllCents: totalLTV,
                    ltvAdsCents: adsLTV,
                    ltvGlofoxCents: contact.transactions
                        .filter(t => t.provider === 'Glofox')
                        .reduce((sum, t) => sum + t.amountMinor, 0),
                    ltvStripeCents: contact.transactions
                        .filter(t => t.provider === 'Stripe')
                        .reduce((sum, t) => sum + t.amountMinor, 0),
                    ltvStarlingCents: contact.transactions
                        .filter(t => t.provider === 'Starling')
                        .reduce((sum, t) => sum + t.amountMinor, 0),
                    status: totalLTV > 0 ? 'client' : contact.status,
                }
            });

            console.log(`✅ Fixed: ${contact.fullName || contact.email}`);
            console.log(`   Total LTV: £${(contact.ltvAllCents / 100).toFixed(2)} → £${(totalLTV / 100).toFixed(2)}`);
            console.log(`   Ads LTV: £${(contact.ltvAdsCents / 100).toFixed(2)} → £${(adsLTV / 100).toFixed(2)}`);
            fixed++;
        } else {
            skipped++;
        }
    }

    console.log(`\n✅ Fixed ${fixed} contacts`);
    console.log(`ℹ️  Skipped ${skipped} contacts (already correct)`);
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
