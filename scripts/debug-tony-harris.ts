import { prisma } from '../src/lib/prisma';

async function debugTonyHarris() {
    console.log('Searching for "Tony Harris" or "th@portdesigns.com"...');

    // 1. Find Contacts
    const contacts = await prisma.contact.findMany({
        where: {
            OR: [
                { fullName: { contains: 'Tony Harris', mode: 'insensitive' } },
                { email: { contains: 'th@portdesigns.com', mode: 'insensitive' } }
            ]
        },
        include: {
            transactions: true
        }
    });

    console.log(`\nFound ${contacts.length} Contacts:`);
    contacts.forEach(c => {
        console.log(`- ID: ${c.id}`);
        console.log(`  Name: ${c.fullName}`);
        console.log(`  Email: ${c.email}`);
        console.log(`  LTV: £${c.ltvAllCents / 100}`);
        console.log(`  Transactions: ${c.transactions.length}`);
        c.transactions.forEach(t => console.log(`    > ${t.occurredAt.toISOString().split('T')[0]} - £${t.amountMinor / 100} (${t.status})`));
    });

    // 2. Find Leads
    const leads = await prisma.lead.findMany({
        where: {
            OR: [
                { fullName: { contains: 'Tony Harris', mode: 'insensitive' } },
                { email: { contains: 'th@portdesigns.com', mode: 'insensitive' } }
            ]
        },
        include: {
            payments: true
        }
    });

    console.log(`\nFound ${leads.length} Leads:`);
    leads.forEach(l => {
        console.log(`- ID: ${l.id}`);
        console.log(`  Name: ${l.fullName}`);
        console.log(`  Email: ${l.email}`);
        console.log(`  Payments: ${l.payments.length}`);
    });

    // 3. Find the specific 1125 transaction
    console.log('\nSearching for transaction with amount 1125 GBP (112500 cents)...');
    const transactions = await prisma.transaction.findMany({
        where: {
            amountMinor: 112500
        },
        include: {
            contact: true,
            lead: true
        }
    });

    console.log(`Found ${transactions.length} matching transactions:`);
    transactions.forEach(t => {
        console.log(`- ID: ${t.id}`);
        console.log(`  Name on Tx: ${t.personName}`);
        console.log(`  Date: ${t.occurredAt}`);
        console.log(`  Status: ${t.status}`);
        console.log(`  Linked Contact: ${t.contact?.email ?? 'NONE'} (ID: ${t.contactId})`);
        console.log(`  Linked Lead: ${t.lead?.email ?? 'NONE'} (ID: ${t.leadId})`);
    });
}

debugTonyHarris()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
