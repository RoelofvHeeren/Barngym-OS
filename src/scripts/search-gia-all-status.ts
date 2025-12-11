import { prisma } from '@/lib/prisma';

async function main() {
    const emails = ['badgix@gmail.com', 'gia@giabadenhorst.co.uk'];
    console.log(`Searching ALL types of transactions for: ${emails.join(', ')}`);

    // Search by related emails in Lead or Contact
    const leads = await prisma.lead.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true }
    });

    const contacts = await prisma.contact.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true }
    });

    const leadIds = leads.map(l => l.id);
    const contactIds = contacts.map(c => c.id);

    console.log(`Lead Ids: ${leadIds}`);
    console.log(`Contact Ids: ${contactIds}`);

    const allTransactions = await prisma.transaction.findMany({
        where: {
            OR: [
                { leadId: { in: leadIds } },
                { contactId: { in: contactIds } },
                { personName: { contains: 'Badenhorst', mode: 'insensitive' } }
            ]
        }
    });

    console.log(`\nFound ${allTransactions.length} transactions (ALL statuses):`);
    allTransactions.forEach(t => {
        console.log(` - £${(t.amountMinor || 0) / 100} | Status: ${t.status} | Date: ${t.occurredAt.toISOString()} | Name: ${t.personName}`);
    });

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
