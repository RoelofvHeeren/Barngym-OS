import { prisma } from '@/lib/prisma';

async function main() {
    const email = 'hforbes88@hotmail.com'; // Hforbes email from previous logs
    console.log(`Inspecting Payments for ${email}...`);

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: email, mode: 'insensitive' as const } },
        include: {
            payments: true,
            transactions: true
        }
    });

    if (!lead) {
        console.log('Lead not found');
        return;
    }

    console.log(`Lead ID: ${lead.id}`);
    console.log(`LTV Ads: £${lead.ltvAdsCents / 100}`);
    console.log(`LTV All: £${lead.ltvAllCents / 100}`);

    console.log(`\n--- Transactions (${lead.transactions.length}) ---`);
    const txSum = lead.transactions.reduce((sum, t) => sum + (t.amountMinor || 0), 0);
    console.log(`Sum of Transactions: £${txSum / 100}`);
    lead.transactions.forEach(t => {
        console.log(` - ${t.occurredAt.toISOString()} | £${(t.amountMinor || 0) / 100} | ${t.status} | ID: ${t.id}`);
    });

    console.log(`\n--- Payments (${lead.payments.length}) ---`);
    const paySum = lead.payments.reduce((sum, p) => sum + p.amountCents, 0);
    console.log(`Sum of Payments: £${paySum / 100}`);

    // Sort by date to see duplicates easily
    const sortedPayments = lead.payments.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    sortedPayments.forEach(p => {
        console.log(` - ${p.timestamp.toISOString()} | £${p.amountCents / 100} | Ext: ${p.externalPaymentId} | ID: ${p.id}`);
    });

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
