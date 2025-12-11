import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'marksheldonghl@gmail.com'; // From screenshot

    console.log(`Investigating ${email}...`);

    const contact = await prisma.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
            transactions: true
        }
    });

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
            transactions: true,
            payments: true
        }
    });

    console.log('\n--- Contact Data ---');
    if (contact) {
        console.log(`ID: ${contact.id}`);
        console.log(`LTV All: £${contact.ltvAllCents / 100}`);
        console.log(`Transaction Count: ${contact.transactions.length}`);
        contact.transactions.forEach(t => {
            console.log(`  - ${t.occurredAt.toISOString().split('T')[0]} £${(t.amountMinor || 0) / 100} (${t.status}) Source:${t.source}`);
        });
    } else {
        console.log('Contact not found');
    }

    console.log('\n--- Lead Data ---');
    if (lead) {
        console.log(`ID: ${lead.id}`);
        console.log(`Source: ${lead.source}`);
        console.log(`LTV All: £${lead.ltvAllCents / 100}`);
        console.log(`LTV Ads: £${lead.ltvAdsCents / 100}`);
        console.log(`Transaction Count: ${lead.transactions.length}`);
        console.log(`Payment Count: ${lead.payments.length}`);
    } else {
        console.log('Lead not found');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
