import { prisma } from '@/lib/prisma';

const CONTACTS_TO_FIX = [
    { name: 'Daniel Laidler', email: 'daniellaidler5000@gmail.com' },
    { name: 'Katie Preston', email: 'katiepreston3@gmail.com' },
    { name: 'Katie Brinsmead-Stockham', email: 'katie.brinsmead@gmail.com' },
];

async function main() {
    console.log('🔍 Checking unmatched transactions for 3 contacts...\n');

    for (const { name, email } of CONTACTS_TO_FIX) {
        console.log(`\n📧 Processing: ${name} (${email})`);

        // Find the contact
        const contact = await prisma.contact.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            include: {
                transactions: true,
            }
        });

        if (!contact) {
            console.log(`  ❌ Contact not found in database`);
            continue;
        }

        console.log(`  ✅ Found contact: ${contact.fullName} (ID: ${contact.id})`);
        console.log(`  📊 Current LTV: £${(contact.ltvAllCents / 100).toFixed(2)}`);
        console.log(`  📝 Current status: ${contact.status}`);
        console.log(`  💳 Linked transactions: ${contact.transactions.length}`);

        // Find unmatched transactions with matching email in metadata
        const unmatchedTransactions = await prisma.transaction.findMany({
            where: {
                contactId: null,
                OR: [
                    { personName: { contains: name.split(' ')[0], mode: 'insensitive' } },
                    { personName: { contains: name.split(' ')[1], mode: 'insensitive' } },
                ]
            }
        });

        console.log(`  🔍 Found ${unmatchedTransactions.length} potentially matching unmatched transactions`);

        if (unmatchedTransactions.length > 0) {
            // Match transactions to contact
            const transactionIds = unmatchedTransactions.map(t => t.id);

            const updateResult = await prisma.transaction.updateMany({
                where: { id: { in: transactionIds } },
                data: { contactId: contact.id }
            });

            console.log(`  ✅ Matched ${updateResult.count} transactions to contact`);

            // Recalculate LTV
            const allTransactions = await prisma.transaction.findMany({
                where: {
                    contactId: contact.id,
                    status: 'completed'
                }
            });

            const totalLTV = allTransactions.reduce((sum, t) => sum + t.amountMinor, 0);

            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    ltvAllCents: totalLTV,
                    status: totalLTV > 0 ? 'client' : 'lead',
                }
            });

            console.log(`  💰 Updated LTV: £${(totalLTV / 100).toFixed(2)}`);
            console.log(`  ✅ Status updated to: ${totalLTV > 0 ? 'client' : 'lead'}`);

            // Show transaction details
            console.log(`  📋 Matched transactions:`);
            unmatchedTransactions.forEach(t => {
                console.log(`     - ${t.occurredAt.toISOString().slice(0, 10)} | £${(t.amountMinor / 100).toFixed(2)} | ${t.description?.slice(0, 50)}`);
            });
        } else {
            console.log(`  ℹ️  No unmatched transactions found for this contact`);
        }
    }

    console.log('\n✅ Finished processing all contacts');
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
