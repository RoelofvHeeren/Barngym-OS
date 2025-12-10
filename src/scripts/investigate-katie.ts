import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Investigating Katie Brinsmead-Stockham transactions...\n');

    // Find the contact
    const contact = await prisma.contact.findFirst({
        where: { email: { equals: 'katie.brinsmead@gmail.com', mode: 'insensitive' } },
    });

    if (!contact) {
        console.log('❌ Contact not found');
        return;
    }

    console.log(`✅ Found contact: ${contact.fullName} (ID: ${contact.id})`);
    console.log(`Email: ${contact.email}\n`);

    // Search for transactions with various name patterns
    const namePatterns = [
        'Katie Brinsmead-Stockham',
        'Katie Brinsmead',
        'Brinsmead-Stockham',
        'Brinsmead',
    ];

    for (const pattern of namePatterns) {
        console.log(`\n🔍 Searching for transactions with name pattern: "${pattern}"`);

        const transactions = await prisma.transaction.findMany({
            where: {
                personName: { contains: pattern, mode: 'insensitive' }
            },
            select: {
                id: true,
                personName: true,
                amountMinor: true,
                occurredAt: true,
                description: true,
                contactId: true,
                provider: true,
            },
            take: 10,
        });

        console.log(`  Found ${transactions.length} transactions:`);
        transactions.forEach(t => {
            console.log(`    - ${t.occurredAt.toISOString().slice(0, 10)} | £${(t.amountMinor / 100).toFixed(2)} | ${t.personName} | Contact: ${t.contactId ? 'Linked' : 'UNMATCHED'} | ${t.provider}`);
        });
    }

    // Also search by email in metadata
    console.log(`\n🔍 Searching for transactions with email in metadata...`);
    const allTransactions = await prisma.transaction.findMany({
        where: {
            OR: [
                { personName: { contains: 'Katie', mode: 'insensitive' } },
                { personName: { contains: 'Brinsmead', mode: 'insensitive' } },
            ],
            occurredAt: {
                gte: new Date('2025-12-05'),
                lte: new Date('2025-12-10'),
            }
        },
        select: {
            id: true,
            personName: true,
            amountMinor: true,
            occurredAt: true,
            contactId: true,
            provider: true,
            metadata: true,
        }
    });

    console.log(`\nFound ${allTransactions.length} transactions from Dec 5-10 with 'Katie' or 'Brinsmead':`);
    allTransactions.forEach(t => {
        const metadata = t.metadata as any;
        console.log(`  - ${t.occurredAt.toISOString().slice(0, 10)} | £${(t.amountMinor / 100).toFixed(2)} | ${t.personName} | Email: ${metadata?.email || 'N/A'} | Contact: ${t.contactId ? 'Linked' : 'UNMATCHED'}`);
    });
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
