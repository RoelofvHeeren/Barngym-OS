
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createPaymentsFromTransactions() {
    console.log("Creating Payment records from Transactions that don't have them...");

    // Find all transactions that don't have a corresponding payment
    const transactions = await prisma.transaction.findMany({
        where: {
            leadId: { not: null },
            status: { in: ["completed", "succeeded", "success", "paid"] }
        },
        include: { lead: true }
    });

    console.log(`Found ${transactions.length} transactions linked to leads.`);

    let created = 0;
    let skipped = 0;

    for (const tx of transactions) {
        if (!tx.leadId) continue;

        // Check if payment already exists for this transaction
        const existingPayment = await prisma.payment.findFirst({
            where: {
                externalPaymentId: tx.externalId
            }
        });

        if (existingPayment) {
            skipped++;
            continue;
        }

        // Create payment from transaction
        await prisma.payment.create({
            data: {
                externalPaymentId: tx.externalId,
                amountCents: tx.amountMinor,
                currency: tx.currency,
                timestamp: tx.occurredAt,
                productName: tx.description || tx.productType || "Transaction",
                productType: tx.productType,
                sourceSystem: tx.source,
                rawPayload: tx.raw || {},
                leadId: tx.leadId
            }
        });

        created++;
        if (created % 10 === 0) {
            console.log(`Created ${created} payments...`);
        }
    }

    console.log(`\nFinished. Created: ${created}, Skipped (already exist): ${skipped}`);

    // Now recalculate LTVs
    console.log("\nRecalculating LTVs...");
    const allLeads = await prisma.lead.findMany({
        include: { payments: true }
    });

    let updated = 0;
    for (const lead of allLeads) {
        const ltv = lead.payments.reduce((sum, p) => sum + p.amountCents, 0);

        const isAds = lead.source?.toLowerCase().includes("ads") ||
            lead.source === "ghl_ads" ||
            lead.tags?.toString().toLowerCase().includes("ads");

        const adsLtv = isAds ? ltv : 0;

        if (ltv !== lead.ltvAllCents || adsLtv !== lead.ltvAdsCents || (ltv > 0 && !lead.isClient)) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    ltvAllCents: ltv,
                    ltvAdsCents: adsLtv,
                    isClient: ltv > 0 ? true : lead.isClient,
                    status: ltv > 0 ? "CLIENT" : lead.status
                }
            });
            updated++;
        }
    }

    console.log(`Updated LTV for ${updated} leads.`);
}

createPaymentsFromTransactions()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
