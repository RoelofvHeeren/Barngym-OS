import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Finding which contact has Katie Brinsmead-Stockham transactions...\n');

    // Find the transactions
    const transactions = await prisma.transaction.findMany({
        where: {
            personName: { contains: 'Katie Brinsmead-Stockham', mode: 'insensitive' as const }
        },
        include: {
            contact: true,
        }
    });

    console.log(`Found ${transactions.length} transactions:\n`);

    transactions.forEach(t => {
        console.log(`Transaction: ${t.occurredAt.toISOString().slice(0, 10)} | £${(t.amountMinor / 100).toFixed(2)}`);
        console.log(`  Person Name: ${t.personName}`);
        console.log(`  Contact ID: ${t.contactId}`);
        if (t.contact) {
            console.log(`  Linked to: ${t.contact.fullName} (${t.contact.email})`);
            console.log(`  Contact LTV: £${(t.contact.ltvAllCents / 100).toFixed(2)}`);
        } else {
            console.log(`  NOT LINKED TO ANY CONTACT`);
        }
        console.log('');
    });

    // Now find the correct Katie contact
    console.log('\n🔍 Finding Katie Brinsmead-Stockham contact...');
    const katieContact = await prisma.contact.findFirst({
        where: { email: { equals: 'katie.brinsmead@gmail.com', mode: 'insensitive' as const } }
    });

    if (katieContact) {
        console.log(`\nCorrect Katie contact:`);
        console.log(`  ID: ${katieContact.id}`);
        console.log(`  Name: ${katieContact.fullName}`);
        console.log(`  Email: ${katieContact.email}`);
        console.log(`  LTV: £${(katieContact.ltvAllCents / 100).toFixed(2)}`);

        // If transactions are linked to wrong contact, fix them
        if (transactions.length > 0 && transactions[0].contactId !== katieContact.id) {
            console.log(`\n⚠️  Transactions are linked to WRONG contact!`);
            console.log(`  Moving transactions to correct contact...`);

            const transactionIds = transactions.map(t => t.id);
            await prisma.transaction.updateMany({
                where: { id: { in: transactionIds } },
                data: { contactId: katieContact.id }
            });

            // Recalculate LTV
            const totalLTV = transactions.reduce((sum, t) => sum + t.amountMinor, 0);
            await prisma.contact.update({
                where: { id: katieContact.id },
                data: {
                    ltvAllCents: totalLTV,
                    status: 'client',
                }
            });

            console.log(`  ✅ Moved ${transactions.length} transactions`);
            console.log(`  ✅ Updated LTV to: £${(totalLTV / 100).toFixed(2)}`);
        }
    }
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
