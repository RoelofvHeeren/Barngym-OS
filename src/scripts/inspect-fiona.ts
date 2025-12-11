import { prisma } from '@/lib/prisma';

async function main() {
    const emails = ['fionamcintosh1169@gmail.com', 'fionamcntosh1169@gmail.com'];
    console.log(`Inspecting candidates for Fiona...`);

    const contacts = await prisma.contact.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        include: { transactions: true }
    });

    console.log(`\nFound ${contacts.length} Contacts:`);
    contacts.forEach(c => {
        console.log(`\n[CONTACT] ID: ${c.id}`);
        console.log(`  Name: ${c.fullName}`);
        console.log(`  Email: ${c.email}`);
        console.log(`  LTV: £${c.ltvAllCents / 100}`);
        console.log(`  Tx Count: ${c.transactions.length}`);
        console.log(`  Tags: ${c.sourceTags.join(', ')}`);
    });

    const leads = await prisma.lead.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        include: { transactions: true, payments: true }
    });

    console.log(`\nFound ${leads.length} Leads:`);
    leads.forEach(l => {
        console.log(`\n[LEAD] ID: ${l.id}`);
        console.log(`  Name: ${l.fullName}`);
        console.log(`  Email: ${l.email}`);
        console.log(`  LTV: £${l.ltvAllCents / 100}`);
        console.log(`  Tx Count: ${l.transactions.length}`);
        console.log(`  Pay Count: ${l.payments.length}`);
        console.log(`  Source: ${l.source}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
