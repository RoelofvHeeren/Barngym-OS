import { prisma } from '@/lib/prisma';

async function main() {
    const nameQuery = 'Badenhorst';
    console.log(`Searching for "${nameQuery}"...`);

    // Search Transactions by personName
    const transactions = await prisma.transaction.findMany({
        where: { personName: { contains: nameQuery, mode: 'insensitive' as const } },
    });

    console.log(`\nFound ${transactions.length} Transactions:`);
    transactions.forEach(t => {
        console.log(` - [${t.id}] ${t.personName} | £${(t.amountMinor || 0) / 100} | ${t.occurredAt.toISOString().split('T')[0]}`);
    });

    // Search Contacts by name
    const contacts = await prisma.contact.findMany({
        where: { fullName: { contains: nameQuery, mode: 'insensitive' as const } },
    });
    console.log(`\nFound ${contacts.length} Contacts:`);
    contacts.forEach(c => {
        console.log(` - [${c.id}] ${c.fullName} (${c.email}) | LTV: £${c.ltvAllCents / 100}`);
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
