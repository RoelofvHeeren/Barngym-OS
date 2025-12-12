import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'hforbes88@hotmail.com';

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' as const } },
        include: {
            transactions: true
        }
    });

    console.log('\n--- Hforbes Lead Transactions Detail ---');
    if (lead) {
        console.log(`Lead ID: ${lead.id}`);
        lead.transactions.forEach(t => {
            console.log(`  - ID: ${t.id}`);
            console.log(`    Date: ${t.occurredAt.toISOString()}`);
            console.log(`    Amount: £${(t.amountMinor || 0) / 100}`);
            console.log(`    Ref: ${t.reference}`);
            console.log(`    Contact ID: ${t.contactId}`);
            console.log(`    Lead ID: ${t.leadId}`);
            console.log('    ---');
        });
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
