const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function investigateConnor() {
    console.log('Investigating Connor Todd...');
    const email = 'connortodd2000@gmail.com';

    try {
        // 1. Search Leads
        const leads = await prisma.lead.findMany({
            where: {
                OR: [
                    { email: { equals: email, mode: 'insensitive' } },
                    { firstName: { equals: 'Connor', mode: 'insensitive' }, lastName: { equals: 'Todd', mode: 'insensitive' } }
                ]
            },
            include: { transactions: true }
        });
        console.log(`\nFound ${leads.length} LEADS:`);
        leads.forEach(l => {
            console.log(`- ID: ${l.id}`);
            console.log(`  Name: ${l.firstName} ${l.lastName}`);
            console.log(`  Email: ${l.email}`);
            console.log(`  Status: ${l.status}, IsClient: ${l.isClient}`);
            console.log(`  Source: ${l.source}`);
            console.log(`  Tags: ${l.tags}`);
            console.log(`  Metadata: ${JSON.stringify(l.metadata)}`);
        });

        // 2. Search Contacts
        const contacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { email: { equals: email, mode: 'insensitive' } },
                    { fullName: { contains: 'Connor Todd', mode: 'insensitive' } }
                ]
            },
            include: { transactions: true }
        });
        console.log(`\nFound ${contacts.length} CONTACTS:`);
        contacts.forEach(c => {
            console.log(`- ID: ${c.id}`);
            console.log(`  Name: ${c.fullName}`);
            console.log(`  Email: ${c.email}`);
            console.log(`  Status: ${c.status}`);
            console.log(`  Tags: ${c.sourceTags}`);
            console.log(`  Transactions: ${c.transactions.length}`);
        });

        // 3. Search Transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                OR: [
                    { personName: { contains: 'Connor', mode: 'insensitive' } },
                    { personName: { contains: 'Todd', mode: 'insensitive' } },
                    { reference: { contains: 'Todd', mode: 'insensitive' } }
                ]
            }
        });

        // Filter specifically for Connor Todd
        const relevantTx = transactions.filter(t =>
            (t.personName && t.personName.toLowerCase().includes('connor') && t.personName.toLowerCase().includes('todd')) ||
            (t.reference && t.reference.toLowerCase().includes('todd'))
        );

        console.log(`\nFound ${relevantTx.length} potential TRANSACTIONS:`);
        relevantTx.forEach(tx => {
            console.log(`- Tx ID: ${tx.id}`);
            console.log(`  Date: ${tx.occurredAt}, Amount: ${tx.amountMinor}`);
            console.log(`  Name: ${tx.personName}, Ref: ${tx.reference}`);
            console.log(`  LeadID: ${tx.leadId}, ContactID: ${tx.contactId}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateConnor();
