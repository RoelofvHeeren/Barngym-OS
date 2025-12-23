import { prisma } from '../src/lib/prisma';
import { calculateLtvFromTransactions } from '../src/utils/calculateLTV';

/**
 * Migration Script: Consolidate Lead.payments into Contact.transactions
 * 
 * This script:
 * 1. Migrates all Lead.payments to Contact.transactions
 * 2. Creates Contact records for any Lead with payments who doesn't have one
 * 3. Links Leads to their corresponding Contacts
 * 4. Recalculates all Contact LTVs from transactions
 * 5. Validates data integrity
 */

interface MigrationStats {
    totalPayments: number;
    contactsCreated: number;
    transactionsCreated: number;
    transactionsSkipped: number;
    leadsLinked: number;
    ltvRecalculated: number;
    errors: Array<{ type: string; message: string; data?: any }>;
}

async function migratePaymentsToTransactions(dryRun = true): Promise<MigrationStats> {
    const stats: MigrationStats = {
        totalPayments: 0,
        contactsCreated: 0,
        transactionsCreated: 0,
        transactionsSkipped: 0,
        leadsLinked: 0,
        ltvRecalculated: 0,
        errors: []
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Payment to Transaction Migration ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        // Step 1: Fetch all payments with their associated leads
        console.log('Step 1: Fetching all payments...');
        const payments = await prisma.payment.findMany({
            include: {
                lead: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        phone: true,
                        source: true,
                        tags: true,
                        createdAt: true
                    }
                }
            },
            orderBy: { timestamp: 'asc' }
        });

        stats.totalPayments = payments.length;
        console.log(`  Found ${payments.length} payments\n`);

        // Step 2: Process each payment
        console.log('Step 2: Processing payments...');

        for (const payment of payments) {
            try {
                // Skip if no lead or no email
                if (!payment.leadId || !payment.lead?.email) {
                    console.log(`  ⚠️  Skipping payment ${payment.id} - no lead or email`);
                    stats.transactionsSkipped++;
                    stats.errors.push({
                        type: 'NO_EMAIL',
                        message: `Payment ${payment.id} has no associated lead email`,
                        data: { paymentId: payment.id, leadId: payment.leadId }
                    });
                    continue;
                }

                const lead = payment.lead;

                // Step 2a: Find or create Contact
                let contact = await prisma.contact.findUnique({
                    where: { email: lead.email }
                });

                if (!contact) {
                    if (!dryRun) {
                        contact = await prisma.contact.create({
                            data: {
                                email: lead.email,
                                fullName: lead.fullName || undefined,
                                phone: lead.phone || undefined,
                                status: 'client',
                                sourceTags: lead.source ? [lead.source] : [],
                                firstSeenAt: lead.createdAt,
                                isActive: true
                            }
                        });
                        stats.contactsCreated++;
                        console.log(`  ✅ Created contact for ${lead.email}`);
                    } else {
                        console.log(`  [DRY RUN] Would create contact for ${lead.email}`);
                        stats.contactsCreated++;
                        // For dry run, create a mock contact object
                        contact = {
                            id: `dry-run-contact-${lead.email}`,
                            email: lead.email
                        } as any;
                    }
                }

                // Step 2b: Check if transaction already exists
                const existingTransaction = await prisma.transaction.findFirst({
                    where: {
                        OR: [
                            { externalId: payment.externalPaymentId },
                            {
                                AND: [
                                    { contactId: contact!.id },
                                    { occurredAt: payment.timestamp },
                                    { amountMinor: payment.amountCents }
                                ]
                            }
                        ]
                    }
                });

                if (existingTransaction) {
                    console.log(`  ⏭️  Transaction already exists for payment ${payment.externalPaymentId}`);
                    stats.transactionsSkipped++;
                    continue;
                }

                // Step 2c: Create transaction
                if (!dryRun) {
                    await prisma.transaction.create({
                        data: {
                            contactId: contact!.id,
                            externalId: payment.externalPaymentId,
                            transactionUid: `migrated-${payment.id}`,
                            amountMinor: payment.amountCents,
                            currency: payment.currency,
                            occurredAt: payment.timestamp,
                            status: 'succeeded',
                            provider: payment.sourceSystem,
                            source: payment.sourceSystem,
                            productType: payment.productType || undefined,
                            personName: lead.fullName || undefined,
                            confidence: 'high',
                            description: `Migrated from Payment table`,
                            raw: payment.rawPayload,
                            tags: ['migrated-from-payment'],
                            createdAt: payment.createdAt
                        }
                    });
                    stats.transactionsCreated++;
                } else {
                    console.log(`  [DRY RUN] Would create transaction for ${payment.externalPaymentId}`);
                    stats.transactionsCreated++;
                }

                // Step 2d: Link lead to contact (if not already linked)
                const leadToUpdate = await prisma.lead.findUnique({
                    where: { id: lead.id },
                    select: { id: true, isClient: true }
                });

                if (leadToUpdate && !dryRun) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            isClient: true,
                            // Note: contactId field doesn't exist yet - will add in schema update
                        }
                    });
                    stats.leadsLinked++;
                } else if (dryRun) {
                    console.log(`  [DRY RUN] Would link lead ${lead.id} to contact ${contact!.id}`);
                    stats.leadsLinked++;
                }

            } catch (error) {
                console.error(`  ❌ Error processing payment ${payment.id}:`, error);
                stats.errors.push({
                    type: 'PROCESSING_ERROR',
                    message: error instanceof Error ? error.message : String(error),
                    data: { paymentId: payment.id }
                });
            }
        }

        // Step 3: Recalculate all Contact LTVs
        console.log('\nStep 3: Recalculating Contact LTVs...');
        const contacts = await prisma.contact.findMany({
            include: {
                transactions: {
                    select: { amountMinor: true, status: true }
                }
            }
        });

        for (const contact of contacts) {
            const ltv = calculateLtvFromTransactions(contact.transactions);

            if (!dryRun) {
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { ltvAllCents: ltv }
                });
            }

            stats.ltvRecalculated++;

            if (ltv > 0) {
                console.log(`  💰 ${contact.email}: £${(ltv / 100).toFixed(2)}`);
            }
        }

        // Step 4: Validation
        console.log('\nStep 4: Validation...');

        // Check for any payments without corresponding transactions
        const paymentsWithoutTransactions = await prisma.payment.findMany({
            where: {
                lead: {
                    email: { not: null }
                }
            },
            include: {
                lead: {
                    select: { email: true }
                }
            }
        });

        let orphanCount = 0;
        for (const payment of paymentsWithoutTransactions) {
            if (!payment.lead?.email) continue;

            const hasTransaction = await prisma.transaction.findFirst({
                where: {
                    externalId: payment.externalPaymentId
                }
            });

            if (!hasTransaction) {
                orphanCount++;
                console.log(`  ⚠️  Payment ${payment.externalPaymentId} has no corresponding transaction`);
            }
        }

        console.log(`\n  Validation: ${orphanCount} orphaned payments found`);

    } catch (error) {
        console.error('\n❌ Fatal error during migration:', error);
        stats.errors.push({
            type: 'FATAL',
            message: error instanceof Error ? error.message : String(error)
        });
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('Migration Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Payments:          ${stats.totalPayments}`);
    console.log(`Contacts Created:        ${stats.contactsCreated}`);
    console.log(`Transactions Created:    ${stats.transactionsCreated}`);
    console.log(`Transactions Skipped:    ${stats.transactionsSkipped}`);
    console.log(`Leads Linked:            ${stats.leadsLinked}`);
    console.log(`LTV Recalculated:        ${stats.ltvRecalculated}`);
    console.log(`Errors:                  ${stats.errors.length}`);
    console.log(`${'='.repeat(60)}\n`);

    if (stats.errors.length > 0) {
        console.log('Errors encountered:');
        stats.errors.forEach((err, idx) => {
            console.log(`  ${idx + 1}. [${err.type}] ${err.message}`);
        });
        console.log();
    }

    return stats;
}

// Main execution
async function main() {
    const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

    if (!dryRun) {
        console.log('\n⚠️  WARNING: Running in LIVE mode. Data will be modified!\n');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const stats = await migratePaymentsToTransactions(dryRun);

    await prisma.$disconnect();

    if (dryRun) {
        console.log('✅ Dry run complete. Run with --execute to apply changes.\n');
    } else {
        console.log('✅ Migration complete!\n');
    }

    process.exit(stats.errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
