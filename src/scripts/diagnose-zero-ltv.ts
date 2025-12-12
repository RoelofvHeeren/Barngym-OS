
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function diagnoseMultiple() {
    const emails = [
        "rtbequinetherapies@gmail.com", // Becky Bray
        "francesca_nella@hotmail.com", // Francesca Nella
        "joshfair@hotmail.co.uk", // Josh faircloth
        "garyablwht@aol.com", // Gary Ablewhite
        "dcoburn1981@gmail.com" // Deborah Coburn
    ];

    for (const email of emails) {
        console.log(`\n=== Diagnosing ${email} ===`);

        const lead = await prisma.lead.findFirst({
            where: { email: { equals: email, mode: "insensitive" as const } },
            include: { payments: true, transactions: true }
        });

        if (lead) {
            console.log(`Lead ID: ${lead.id}`);
            console.log(`LTV: ${lead.ltvAllCents} cents`);
            console.log(`Payments linked: ${lead.payments.length}`);
            console.log(`Transactions linked: ${lead.transactions.length}`);
        } else {
            console.log("No lead found");
        }

        const contact = await prisma.contact.findUnique({
            where: { email: email },
            include: { transactions: true }
        });

        if (contact) {
            console.log(`Contact ID: ${contact.id}`);
            console.log(`Contact Transactions: ${contact.transactions.length}`);

            if (contact.transactions.length > 0) {
                const txIds = contact.transactions.map(t => t.externalId);
                const chargeIds = contact.transactions.map(t => t.stripeChargeId).filter(Boolean) as string[];

                const payments = await prisma.payment.findMany({
                    where: {
                        OR: [
                            { externalPaymentId: { in: txIds } },
                            { externalPaymentId: { in: chargeIds } }
                        ]
                    }
                });

                console.log(`Matching Payments found: ${payments.length}`);
                payments.forEach(p => {
                    console.log(`  - Payment ${p.id}: ${p.amountCents} cents, leadId: ${p.leadId ?? "NULL"}`);
                });
            }
        } else {
            console.log("No contact found");
        }
    }
}

diagnoseMultiple()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
