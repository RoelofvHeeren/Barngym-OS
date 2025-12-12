import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'francesca_nella@hotmail.com';

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' as const } },
        include: {
            transactions: true
        }
    });

    console.log('\n--- Lead Transactions Detail ---');
    if (lead) {
        console.log(`Lead ID: ${lead.id}`);
        lead.transactions.forEach(t => {
            console.log(`  - ID: ${t.id}`);
            console.log(`    Date: ${t.occurredAt.toISOString()}`);
            console.log(`    Amount: £${(t.amountMinor || 0) / 100}`);
            console.log(`    Description: ${t.description}`);
            console.log(`    Source: ${t.source}`);
            console.log(`    Provider: ${t.provider}`);
            console.log(`    Reference: ${t.reference}`);
            console.log(`    Contact ID: ${t.contactId}`);
            console.log(`    Lead ID: ${t.leadId}`);
            console.log('    ---');
        });
    } else {
        console.log('Lead not found');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
