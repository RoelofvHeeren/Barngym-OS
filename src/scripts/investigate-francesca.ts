import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'francesca_nella@hotmail.com'; // From screenshot

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
            transactions: true
        }
    });

    console.log('\n--- Contact Data ---');
    if (contact) {
        console.log(`ID: ${contact.id}`);
        console.log(`LTV All: £${contact.ltvAllCents / 100}`);
        console.log(`LTV Glofox: £${contact.ltvGlofoxCents / 100}`);
        console.log(`LTV Stripe: £${contact.ltvStripeCents / 100}`);
        console.log(`LTV Starling: £${contact.ltvStarlingCents / 100}`);
        console.log(`Transaction Count: ${contact.transactions.length}`);
        console.log('Transactions:');
        let sum = 0;
        contact.transactions.forEach(t => {
            console.log(`  - ${t.occurredAt.toISOString().split('T')[0]} ${t.description?.substring(0, 30)}: £${(t.amountMinor || 0) / 100} (${t.status})`);
            if (t.status === 'succeeded' || t.status === 'paid' || t.status === 'to_be_paid_out' || t.status === 'Completed' || t.status === 'completed' || t.status === 'SETTLED') {
                sum += (t.amountMinor || 0);
            }
        });
        console.log(`Calculated Sum from Transactions: £${sum / 100}`);
    } else {
        console.log('Contact not found');
    }

    console.log('\n--- Lead Data ---');
    if (lead) {
        console.log(`ID: ${lead.id}`);
        console.log(`LTV All: £${lead.ltvAllCents / 100}`);
        console.log(`LTV Ads: £${lead.ltvAdsCents / 100}`);
        console.log(`Transaction Count (Linked directly): ${lead.transactions.length}`);
    } else {
        console.log('Lead not found');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
