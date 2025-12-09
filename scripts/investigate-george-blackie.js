const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function investigateGeorgeBlackie() {
    console.log('Investigating George Blackie...');

    try {
        // 1. Search Contacts
        const contacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { fullName: { contains: 'George', mode: 'insensitive' } },
                    { fullName: { contains: 'Blackie', mode: 'insensitive' } },
                    { email: { contains: 'blackie', mode: 'insensitive' } }
                ]
            },
            include: {
                transactions: true
            }
        });

        console.log(`\nFound ${contacts.length} potential CONTACTS:`);
        for (const c of contacts) {
            console.log(`- Contact ID: ${c.id}`);
            console.log(`  Name: ${c.fullName}`);
            console.log(`  Email: ${c.email}`);
            console.log(`  Phone: ${c.phone}`);
            console.log(`  Transactions: ${c.transactions.length}`);
        }

        // 2. Search Leads
        const leads = await prisma.lead.findMany({
            where: {
                OR: [
                    { firstName: { contains: 'George', mode: 'insensitive' } },
                    { lastName: { contains: 'Blackie', mode: 'insensitive' } },
                    { email: { contains: 'blackie', mode: 'insensitive' } }
                ]
            }
        });

        console.log(`\nFound ${leads.length} potential LEADS:`);
        for (const l of leads) {
            console.log(`- Lead ID: ${l.id}`);
            console.log(`  Name: ${l.firstName} ${l.lastName}`);
            console.log(`  Email: ${l.email}`);
        }

        // 3. Search Transactions (unmapped?)
        const transactions = await prisma.transaction.findMany({
            where: {
                OR: [
                    { personName: { contains: 'George', mode: 'insensitive' } },
                    { personName: { contains: 'Blackie', mode: 'insensitive' } },
                    { reference: { contains: 'Blackie', mode: 'insensitive' } }
                ]
            },
            include: {
                lead: true,
                contact: true
            }
        });

        console.log(`\nFound ${transactions.length} potential TRANSACTIONS:`);
        for (const tx of transactions) {
            // Filter out clearly unrelated Georges if list is huge, but 'Blackie' should be specific enough
            if (!tx.personName?.toLowerCase().includes('blackie') && !tx.reference?.toLowerCase().includes('blackie')) {
                // Keep it loose for now but log specific matches
            }
            console.log(`- Tx ID: ${tx.id}`);
            console.log(`  Date: ${tx.occurredAt}, Amount: ${tx.amountMinor}`);
            console.log(`  Name: ${tx.personName}, Ref: ${tx.reference}`);
            console.log(`  Lead: ${tx.leadId ? 'YES' : 'NO'} (${tx.lead?.firstName} ${tx.lead?.lastName})`);
            console.log(`  Contact: ${tx.contactId ? 'YES' : 'NO'} (${tx.contact?.fullName})`);
        }

    } catch (error) {
        console.error('Error during investigation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateGeorgeBlackie();
