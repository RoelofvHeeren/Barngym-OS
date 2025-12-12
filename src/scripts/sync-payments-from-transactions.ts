import { prisma } from '@/lib/prisma';

async function main() {
    console.log("🔄 Syncing Payments from Transactions for Ads Leads...");

    // 1. Get all ads leads
    const adLeads = await prisma.lead.findMany({
        where: {
            OR: [
                { source: { contains: 'ads', mode: 'insensitive' as const } },
                { source: { contains: 'facebook', mode: 'insensitive' as const } },
                { source: { contains: 'instagram', mode: 'insensitive' as const } },
                { source: { contains: 'meta', mode: 'insensitive' as const } },
                { source: { contains: 'tiktok', mode: 'insensitive' as const } }
            ]
        },
        include: {
            transactions: true,
            payments: true
        }
    });

    console.log(`Checking ${adLeads.length} ads leads...`);

    let createdCount = 0;

    for (const lead of adLeads) {
        // Get existing payment external IDs to avoid duplicates
        const existingPaymentIds = new Set(lead.payments.map(p => p.externalPaymentId));

        for (const tx of lead.transactions) {
            // Skip if valid payment already exists for this transaction
            // Mapping: Payment.externalPaymentId <-> Transaction.externalId (or id)

            // Logic: We want to create a payment if one doesn't exist for this transaction
            // Use transaction.externalId as the key if present, else transaction.id

            if (tx.status !== 'completed' && tx.status !== 'succeeded' && tx.status !== 'paid' && tx.status !== 'SETTLED' && tx.status !== 'Completed') {
                continue;
            }

            const externalId = tx.externalId || tx.id;

            if (existingPaymentIds.has(externalId)) {
                continue;
            }

            // Double check globally to be safe (maybe linked to another lead?)
            const globalCheck = await prisma.payment.findFirst({
                where: { externalPaymentId: externalId }
            });

            if (globalCheck) {
                if (globalCheck.leadId !== lead.id) {
                    // It exists but linked to wrong lead? Or null?
                    // For now, let's just update it if null, or skip. 
                    // Safer to skip/log for now.
                    // console.log(`Skipping Tx ${externalId} - Payment exists for other Lead ${globalCheck.leadId}`);
                }
                continue;
            }

            // CREATE KEY: Only create if we are sure it's missing
            /*
              model Payment {
                  id                String       @id @default(cuid())
                  externalPaymentId String
                  amountCents       Int
                  currency          String
                  timestamp         DateTime
                  productName       String?
                  productType       String?
                  sourceSystem      String
                  rawPayload        Json
                  leadId            String?
                  lead              Lead?        @relation(fields: [leadId], references: [id])
                  adsRevenue        AdsRevenue[]
                  createdAt         DateTime     @default(now())
  
                  @@index([externalPaymentId, sourceSystem])
              }
            */

            await prisma.payment.create({
                data: {
                    externalPaymentId: externalId,
                    amountCents: tx.amountMinor || 0,
                    currency: tx.currency || 'GBP',
                    timestamp: tx.occurredAt,
                    productName: tx.description || 'Transaction Import',
                    productType: tx.productType,
                    sourceSystem: tx.source || 'system',
                    rawPayload: tx.raw || {},
                    leadId: lead.id
                }
            });

            createdCount++;
            // process.stdout.write('.');
        }
    }

    console.log(`\n\n✅ Created ${createdCount} missing Payment records.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
