import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'badgix@gmail.com';
    console.log(`Investigating ${email} DETAILED...`);

    // 1. Check Lead
    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' as const } },
        include: { transactions: true }
    });

    if (lead) {
        console.log(`\nLead ID: ${lead.id}`);
        console.log(`Lead LTV All: £${lead.ltvAllCents / 100}`);
        console.log(`Lead Transactions: ${lead.transactions.length}`);
        lead.transactions.forEach(t => {
            console.log(` - ${t.occurredAt.toISOString()} | £${(t.amountMinor || 0) / 100} | Status: ${t.status} | Source: ${t.source} | Ref: ${t.reference} | ID: ${t.id}`);
        });
    } else {
        console.log('Lead not found');
    }

    // 2. Check Contact (matched by email)
    const contact = await prisma.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' as const } },
        include: { transactions: true }
    });

    if (contact) {
        console.log(`\nContact ID: ${contact.id}`);
        console.log(`Contact LTV All: £${contact.ltvAllCents / 100}`);
        console.log(`Contact Transactions: ${contact.transactions.length}`);
        contact.transactions.forEach(t => {
            console.log(` - ${t.occurredAt.toISOString()} | £${(t.amountMinor || 0) / 100} | Status: ${t.status} | Source: ${t.source}`);
        });
    } else {
        console.log('Contact not found');
    }

    // 3. Check for any other transactions with this email in "personName" or metadata?
    // Sometimes transactions aren't linked.
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
