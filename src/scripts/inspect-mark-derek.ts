import { prisma } from '@/lib/prisma';

async function main() {
    console.log('--- Inspector 🕵️ ---');

    // 1. Mark Sheldon
    const markEmail = 'marksheldonghl@gmail.com';
    console.log(`\nChecking Mark Sheldon (${markEmail})...`);

    const markLead = await prisma.lead.findFirst({
        where: { email: { equals: markEmail, mode: 'insensitive' } },
        select: { id: true, ltvAllCents: true, ltvAdsCents: true, isClient: true, source: true }
    });
    console.log('Lead:', markLead);

    const markContact = await prisma.contact.findFirst({
        where: { email: { equals: markEmail, mode: 'insensitive' } },
        select: { id: true, ltvAllCents: true }
    });
    console.log('Contact:', markContact);

    // 2. Derek the Donkey (Search by name if email unknown)
    console.log(`\nChecking "Derek"...`);
    const dereks = await prisma.lead.findMany({
        where: { fullName: { contains: 'Derek', mode: 'insensitive' } },
        include: { transactions: true }
    });

    dereks.forEach(d => {
        console.log(`User: ${d.fullName} | Email: ${d.email} | Source: "${d.source}"`);
        console.log(`  LTV All: ${d.ltvAllCents} | LTV Ads: ${d.ltvAdsCents}`);
        console.log(`  Tx Count: ${d.transactions.length}`);

        // Calculate simplistic sum of transactions
        const sum = d.transactions.reduce((acc, t) => acc + (t.amountMinor || 0), 0);
        console.log(`  Sum of Tx: ${sum}`);
    });

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
