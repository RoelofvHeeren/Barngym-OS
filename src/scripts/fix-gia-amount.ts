import { prisma } from '@/lib/prisma';

async function main() {
    const txId = 'cmiwraeda006fuqrwplsumz93';
    const newAmountMinor = 120000; // £1,200.00 in pennies

    console.log(`Fixing Transaction Amount for ${txId}...`);
    console.log(`Old Amount: 120 -> New Amount: ${newAmountMinor}`);

    const updatedTx = await prisma.transaction.update({
        where: { id: txId },
        data: {
            amountMinor: newAmountMinor
        }
    });
    console.log('Transaction updated.');

    // Now recalc LTV for Gia
    const emails = ['badgix@gmail.com', 'gia@giabadenhorst.co.uk'];

    // Update Contact
    const contacts = await prisma.contact.findMany({
        where: { email: { in: emails, mode: 'insensitive' as const } },
        include: { transactions: true }
    });

    for (const contact of contacts) {
        const validTx = contact.transactions.filter(t =>
            ['completed', 'succeeded', 'paid', 'SETTLED'].includes(t.status)
        );
        const newLtv = validTx.reduce((sum, t) => sum + (t.amountMinor || 0), 0);

        await prisma.contact.update({
            where: { id: contact.id },
            data: { ltvAllCents: newLtv }
        });
        console.log(`Updated Contact ${contact.email} LTV to £${newLtv / 100}`);
    }

    // Update Lead
    const leads = await prisma.lead.findMany({
        where: { email: { in: emails, mode: 'insensitive' as const } },
        include: { transactions: true }
    });

    for (const lead of leads) {
        const validTx = lead.transactions.filter(t =>
            ['completed', 'succeeded', 'paid', 'SETTLED', 'Completed'].includes(t.status)
        );
        const leadDirectLTV = validTx.reduce((sum, t) => sum + (t.amountMinor || 0), 0);

        // Check contact match
        let contactLTV = 0;
        if (lead.email) {
            const c = await prisma.contact.findFirst({
                where: { email: { equals: lead.email, mode: 'insensitive' as const } }
            });
            if (c) contactLTV = c.ltvAllCents;
        }

        const bestLTV = Math.max(leadDirectLTV, contactLTV);

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                ltvAllCents: bestLTV,
                // also update Ads LTV if applicable
                ltvAdsCents: lead.source?.includes('ads') || lead.source?.includes('facebook') ? bestLTV : lead.ltvAdsCents,
                isClient: bestLTV > 0
            }
        });
        console.log(`Updated Lead ${lead.email} LTV to £${bestLTV / 100}`);
    }

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
