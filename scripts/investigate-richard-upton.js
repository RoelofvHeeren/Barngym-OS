const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function investigateRichardUpton() {
    console.log('Investigating Richard Upton / Derek The Donkey...');

    try {
        // 1. Find the Contact "Derek The Donkey"
        // Search by name or email if possible, or fuzzy match
        const contacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { fullName: { contains: 'Derek', mode: 'insensitive' } },
                    { fullName: { contains: 'Donkey', mode: 'insensitive' } },
                    { fullName: { contains: 'Richard Upton', mode: 'insensitive' } },
                    { email: { contains: 'richard@areyou.place', mode: 'insensitive' } } // From screenshot
                ]
            },
            include: {
                transactions: true
            }
        });

        console.log(`\nFound ${contacts.length} potential contacts:`);
        for (const c of contacts) {
            console.log(`- Contact ID: ${c.id}, Name: ${c.fullName}, Email: ${c.email}, Transaction Count: ${c.transactions.length}`);
        }

        // 2. Search for transactions with "Richard Upton" or "R Upton"
        const transactions = await prisma.transaction.findMany({
            where: {
                OR: [
                    { personName: { contains: 'Richard Upton', mode: 'insensitive' } },
                    { personName: { contains: 'R Upton', mode: 'insensitive' } },
                    { description: { contains: 'Richard Upton', mode: 'insensitive' } },
                    { description: { contains: 'R Upton', mode: 'insensitive' } },
                ]
            },
            include: {
                lead: true,
                contact: true
            }
        });

        console.log(`\nFound ${transactions.length} transactions matching 'Richard Upton' or 'R Upton':`);

        let uptonTxCount = 0;

        for (const tx of transactions) {
            // Exclude Patricia Upton if needed, though simple contains might be enough first
            if (tx.personName?.toLowerCase().includes('patricia') || tx.description?.toLowerCase().includes('patricia')) {
                continue;
            }

            uptonTxCount++;
            console.log(`\nTransaction ID: ${tx.id}`);
            console.log(`  Occurred: ${tx.occurredAt}, Amount: ${tx.amountMinor}`);
            console.log(`  Name: ${tx.personName}, Ref: ${tx.reference}`);
            console.log(`  Status: ${tx.status}, Confidence: ${tx.confidence}`);
            console.log(`  Lead ID: ${tx.leadId} (Lead Name: ${tx.lead?.firstName} ${tx.lead?.lastName})`);
            console.log(`  Contact ID: ${tx.contactId} (Contact Name: ${tx.contact?.fullName})`);

            const isDerek = contacts.some(c => c.id === tx.contactId);
            console.log(`  -> Linked to Derek Contact? ${isDerek ? 'YES' : 'NO'}`);
        }

        console.log(`\nTotal Relevant Transactions: ${uptonTxCount}`);

    } catch (error) {
        console.error('Error during investigation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateRichardUpton();
