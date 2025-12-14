const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function recalculateLtv() {
    const prisma = new PrismaClient();

    try {
        console.log('Starting LTV recalculation for Contacts...');

        // Step 1: Reset all LTV values to 0
        console.log('Resetting all LTV values to 0...');
        await prisma.contact.updateMany({
            data: {
                ltvAllCents: 0,
                ltvGlofoxCents: 0,
                ltvStripeCents: 0,
                ltvStarlingCents: 0,
            },
        });
        console.log('✓ Reset complete');

        // Step 2: Get all transactions with contactId
        console.log('Fetching all transactions with contactId...');
        const transactions = await prisma.transaction.findMany({
            where: {
                contactId: { not: null },
                status: { in: ['completed', 'paid', 'succeeded', 'settled', 'success', 'COMPLETED', 'PAID', 'SUCCEEDED', 'SETTLED', 'SUCCESS'], mode: 'insensitive' }
            },
            select: {
                id: true,
                contactId: true,
                amountMinor: true,
                provider: true,
            },
        });
        console.log(`✓ Found ${transactions.length} transactions to process`);

        // Step 3: Group transactions by contactId and calculate totals
        console.log('Calculating LTV totals...');
        const ltvByContact = new Map();

        for (const transaction of transactions) {
            if (!transaction.contactId) continue;

            const contactId = transaction.contactId;
            const amount = Math.max(0, Math.round(transaction.amountMinor));

            if (!ltvByContact.has(contactId)) {
                ltvByContact.set(contactId, {
                    ltvAllCents: 0,
                    ltvGlofoxCents: 0,
                    ltvStripeCents: 0,
                    ltvStarlingCents: 0,
                });
            }

            const ltv = ltvByContact.get(contactId);
            ltv.ltvAllCents += amount;

            // Categorize by provider
            const provider = (transaction.provider || '').toLowerCase();
            if (provider.includes('glofox')) {
                ltv.ltvGlofoxCents += amount;
            } else if (provider.includes('stripe')) {
                ltv.ltvStripeCents += amount;
            } else if (provider.includes('starling')) {
                ltv.ltvStarlingCents += amount;
            }
        }

        console.log(`✓ Calculated LTV for ${ltvByContact.size} contacts`);

        // Step 4: Update each contact with their LTV totals
        console.log('Updating contact LTV values...');
        let updated = 0;
        for (const [contactId, ltv] of ltvByContact.entries()) {
            await prisma.contact.update({
                where: { id: contactId },
                data: ltv,
            });
            updated++;
            if (updated % 100 === 0) {
                console.log(`  Updated ${updated}/${ltvByContact.size} contacts...`);
            }
        }

        console.log(`✓ Updated ${updated} contacts with LTV values`);
        console.log('LTV recalculation completed successfully!');

    } catch (error) {
        console.error('LTV recalculation failed:', error);
        // Don't throw - allow build to continue
    } finally {
        await prisma.$disconnect();
    }
}

recalculateLtv();
