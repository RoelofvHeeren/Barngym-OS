import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'marksheldonghl@gmail.com';

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
            transactions: true
        }
    });

    console.log('\n--- Mark Lead Transactions Detail ---');
    if (lead) {
        lead.transactions.forEach(t => {
            console.log(`  - ID: ${t.id}`);
            console.log(`    Date: ${t.occurredAt.toISOString()}`);
            console.log(`    Amount: £${(t.amountMinor || 0) / 100}`);
            console.log(`    Ref: ${t.reference}`);
            console.log(`    Source: ${t.source}`);
            console.log(`    Contact ID: ${t.contactId}`);
            console.log(`    Lead ID: ${t.leadId}`);
            console.log('    ---');
        });
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
