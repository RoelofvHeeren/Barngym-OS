const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateContactsToLeads() {
    console.log('Starting migration from Contacts to Leads...');

    try {
        const contacts = await prisma.contact.findMany({
            include: {
                transactions: true
            }
        });

        console.log(`Found ${contacts.length} contacts.`);

        let createdCount = 0;
        let linkedCount = 0;

        for (const contact of contacts) {
            // Check if lead already exists based on email or phone
            let lead = null;
            if (contact.email) {
                lead = await prisma.lead.findFirst({
                    where: { email: { equals: contact.email, mode: 'insensitive' } }
                });
            }
            if (!lead && contact.phone) {
                lead = await prisma.lead.findFirst({
                    where: { phone: contact.phone }
                });
            }

            if (!lead) {
                // Create new lead
                // Determine source
                let source = "imported_contact";

                // Check sourceTags
                const tagsData = contact.sourceTags || [];
                const tagsStr = tagsData.join(' ').toLowerCase();
                if (tagsStr.includes('ads') || tagsStr.includes('facebook') || tagsStr.includes('instagram') || tagsStr.includes('meta')) {
                    source = 'Facebook Ads'; // Or just "ads" to match the filter, but "Facebook Ads" matches contains("ads") too.
                } else {
                    // Simple heuristic: if most transactions are from Glofox, source = glofox, etc.
                    const txProviders = contact.transactions.map(t => t.provider.toLowerCase());
                    if (txProviders.some(p => p.includes('glofox'))) source = 'glofox';
                    else if (txProviders.some(p => p.includes('stripe'))) source = 'stripe';
                }

                try {
                    lead = await prisma.lead.create({
                        data: {
                            email: contact.email,
                            phone: contact.phone,
                            firstName: contact.fullName ? contact.fullName.split(' ')[0] : undefined,
                            lastName: contact.fullName ? contact.fullName.split(' ').slice(1).join(' ') : undefined,
                            fullName: contact.fullName,
                            source: source,
                            isClient: contact.transactions.length > 0, // They have transactions
                            createdAt: contact.createdAt,
                            status: 'CLIENT'
                        }
                    });
                    createdCount++;
                } catch (e) {
                    console.error(`Failed to create lead for contact ${contact.id}: ${e.message}`);
                    continue;
                }
            }

            // Link transactions and create Payments
            if (lead) {
                // Update transactions to point to this lead
                const { count } = await prisma.transaction.updateMany({
                    where: { contactId: contact.id },
                    data: { leadId: lead.id }
                });
                linkedCount += count;

                // Create Payments from successful transactions
                const successfulTxs = contact.transactions.filter(t =>
                    t.status !== 'Failed' && t.amountMinor > 0
                );

                for (const tx of successfulTxs) {
                    const existingPayment = await prisma.payment.findFirst({
                        where: { externalPaymentId: tx.externalId }
                    });

                    if (!existingPayment) {
                        await prisma.payment.create({
                            data: {
                                externalPaymentId: tx.externalId,
                                amountCents: tx.amountMinor,
                                currency: tx.currency,
                                timestamp: tx.occurredAt,
                                sourceSystem: tx.provider,
                                productName: tx.productType, // Map productType to productName? Or just use productType? Schema has both.
                                productType: tx.productType,
                                rawPayload: tx.raw || {},
                                leadId: lead.id
                            }
                        });
                    }
                }

                // Also update Payments if they exist and are linked to these transactions?
                // The schema disconnect: Payment vs Transaction.
                // Dashboard uses Transactions for "Total Revenue".
                // LTV calc uses Payments (api/ltv/categories/route.ts).

                // We need to create Payments from Transactions IF they don't exist?
                // Or does system duplicate them?
                // App usually imports to Transaction, then syncs to Payment?
                // check-revenue.js sums Transactions.
                // ltv/categories/route.ts sums Payments.

                // If Payments are empty, LTV is 0. 
                // I need to check Payment count too!
            }
        }

        console.log(`Migration complete.`);
        console.log(`Created Leads: ${createdCount}`);
        console.log(`Linked Transactions: ${linkedCount}`);

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateContactsToLeads();
