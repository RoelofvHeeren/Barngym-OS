import { prisma } from '@/lib/prisma';

async function main() {
    const nameQuery = 'Gia';
    console.log(`Searching for "${nameQuery}"...`);

    // 1. Search Contacts by name
    const contacts = await prisma.contact.findMany({
        where: { fullName: { contains: nameQuery, mode: 'insensitive' } },
        include: { transactions: true }
    });

    console.log(`\nFound ${contacts.length} Contacts:`);
    contacts.forEach(c => {
        console.log(` - [${c.id}] ${c.fullName} (${c.email}) | LTV: £${c.ltvAllCents / 100} | Tx: ${c.transactions.length}`);
    });

    // 2. Search Leads by name
    const leads = await prisma.lead.findMany({
        where: {
            OR: [
                { fullName: { contains: nameQuery, mode: 'insensitive' } },
                { firstName: { contains: nameQuery, mode: 'insensitive' } }
            ]
        },
        include: { transactions: true }
    });

    console.log(`\nFound ${leads.length} Leads:`);
    leads.forEach(l => {
        console.log(` - [${l.id}] ${l.fullName} (${l.email}) | LTV: £${l.ltvAllCents / 100} | Tx: ${l.transactions.length}`);
    });

    // 3. Search Transactions by personName
    const transactions = await prisma.transaction.findMany({
        where: { personName: { contains: nameQuery, mode: 'insensitive' } },
        take: 20
    });

    console.log(`\nFound ${transactions.length} Transactions (first 20):`);
    transactions.forEach(t => {
        console.log(` - [${t.id}] ${t.personName} | £${(t.amountMinor || 0) / 100} | ${t.occurredAt.toISOString().split('T')[0]} | Contact: ${t.contactId} | Lead: ${t.leadId}`);
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
