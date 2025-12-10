import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'hforbes88@hotmail.com';

    console.log(`Investigating ${email}...`);

    const contact = await prisma.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { transactions: true }
    });

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { transactions: true }
    });

    console.log('\n--- Contact Data ---');
    if (contact) {
        console.log(`LTV All: £${contact.ltvAllCents / 100}`);
        console.log(`Transaction Count: ${contact.transactions.length}`);
    }

    console.log('\n--- Lead Data ---');
    if (lead) {
        console.log(`LTV All: £${lead.ltvAllCents / 100}`);
        console.log(`Transaction Count: ${lead.transactions.length}`);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
