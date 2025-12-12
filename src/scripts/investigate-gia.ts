import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'badgix@gmail.com'; // From screenshot

    console.log(`Investigating ${email}...`);

    const contact = await prisma.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' as const } },
        include: { transactions: true }
    });

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' as const } },
        include: { transactions: true }
    });

    console.log('\n--- Contact Data ---');
    if (contact) {
        console.log(`Email: ${contact.email}`);
        console.log(`LTV All: £${contact.ltvAllCents / 100}`);
    } else {
        console.log('Contact not found');
    }

    console.log('\n--- Lead Data ---');
    if (lead) {
        console.log(`ID: ${lead.id}`);
        console.log(`LTV All: £${lead.ltvAllCents / 100}`);

        // Check if lead has transactions
        if (lead.transactions.length > 0) {
            console.log(`Lead has ${lead.transactions.length} transactions. Identifying their contact linkage...`);
            const tx = lead.transactions[0];
            console.log(`Sample Tx Contact ID: ${tx.contactId}`);

            if (tx.contactId) {
                const linkedContact = await prisma.contact.findUnique({
                    where: { id: tx.contactId }
                });
                console.log(`Linked Contact Email: ${linkedContact?.email}`);
            }
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
