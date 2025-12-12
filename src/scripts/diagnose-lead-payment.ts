
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function diagnose() {
    const email = "fionamcintosh1169@gmail.com";
    console.log(`Diagnosing ${email}...`);

    // 1. Check Leads
    const leads = await prisma.lead.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        include: { payments: true }
    });

    console.log(`Found ${leads.length} leads.`);
    leads.forEach(l => {
        console.log(`Lead ID: ${l.id}, Email: ${l.email}, Source: ${l.source}, LTV: ${l.ltvAllCents}, Payments Linked: ${l.payments.length}`);
    });

    // 2. Check Contacts & Transactions
    const contacts = await prisma.contact.findMany({
        where: { email: { equals: email, mode: "insensitive" as const } },
        include: { transactions: true }
    });

    console.log(`Found ${contacts.length} contacts.`);

    for (const c of contacts) {
        console.log(`Contact ID: ${c.id}, Transactions: ${c.transactions.length}`);
        const txIds = c.transactions.map(t => t.externalId);

        // 3. Find Payments matching Transaction External IDs
        // Assuming Payment.externalPaymentId might match Transaction.externalId or Transaction.stripeChargeId etc.
        // Let's check matching externalPaymentId first.

        if (txIds.length > 0) {
            const matchingPayments = await prisma.payment.findMany({
                where: {
                    externalPaymentId: { in: txIds }
                }
            });
            console.log(`Found ${matchingPayments.length} Payments matching Transaction External IDs.`);
            matchingPayments.forEach(p => {
                console.log(` - Payment ${p.id}: ${p.amountCents} cents. Linked Lead: ${p.leadId ?? "NULL"}`);
            });

            if (matchingPayments.length === 0) {
                console.log("No payments matched directly by externalPaymentId. Checking if transactions have separate charge IDs...");
                // Check other fields
                const chargeIds = c.transactions.map(t => t.stripeChargeId).filter(Boolean) as string[];
                const matchingPaymentsByCharge = await prisma.payment.findMany({
                    where: {
                        externalPaymentId: { in: chargeIds }
                    }
                });
                console.log(`Found ${matchingPaymentsByCharge.length} Payments matching Stripe Charge IDs.`);
                matchingPaymentsByCharge.forEach(p => {
                    console.log(` - Payment ${p.id}: ${p.amountCents} cents. Linked Lead: ${p.leadId ?? "NULL"}`);
                });
            }
        }
    }

    // 4. Search Payments by Email in Raw Payload (slow but useful)
    console.log("Searching Payments by email in rawPayload...");
    // Note: This matches raw JSON, might be tricky. Using contains on stringified json
    const rawPayments = await prisma.payment.findMany({
        where: {
            rawPayload: {
                path: [],
                string_contains: email
            }
        },
        take: 5
    });
    console.log(`Found ${rawPayments.length} Payments containing email in payload.`);
    rawPayments.forEach(p => {
        console.log(` - Payment ${p.id}: ${p.amountCents}. Linked Lead: ${p.leadId ?? "NULL"}`);
    });

}

diagnose()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
