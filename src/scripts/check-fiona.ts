
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkFiona() {
    const email = "fionamcintosh1169@gmail.com";

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: "insensitive" as const } },
        include: { payments: true }
    });

    if (lead) {
        console.log("Lead found:");
        console.log(`  ID: ${lead.id}`);
        console.log(`  Email: ${lead.email}`);
        console.log(`  ltvAllCents: ${lead.ltvAllCents}`);
        console.log(`  ltvAdsCents: ${lead.ltvAdsCents}`);
        console.log(`  Payments count: ${lead.payments.length}`);
        console.log(`  Payments total: ${lead.payments.reduce((sum, p) => sum + p.amountCents, 0)} cents`);

        lead.payments.forEach(p => {
            console.log(`    - ${p.amountCents} cents on ${p.timestamp}`);
        });
    } else {
        console.log("No lead found");
    }
}

checkFiona()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
