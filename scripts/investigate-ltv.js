const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function investigateHforbes() {
    console.log('Investigating Hforbes...');

    try {
        const contacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { email: { contains: 'hforbes88', mode: 'insensitive' } },
                    { fullName: { contains: 'Hforbes', mode: 'insensitive' } }
                ]
            },
            include: { transactions: true }
        });

        console.log(`Found ${contacts.length} contacts.`);

        for (const c of contacts) {
            console.log(`\nID: ${c.id}`);
            console.log(`Name: ${c.fullName}`);
            console.log(`LTV All Cents (DB Valid): ${c.ltvAllCents}`);
            console.log(`Transactions: ${c.transactions.length}`);

            let sum = 0;
            c.transactions.forEach(t => {
                console.log(`  - ${t.occurredAt.toISOString()} | Amount: ${t.amountMinor} | Status: ${t.status} | Currency: ${t.currency}`);
                if (t.status === 'Completed' || t.status === 'succeeded' || !t.status) { // Checking strict status math
                    sum += (t.amountMinor || 0);
                }
            });
            console.log(`Manual Sum of Completed Tx: ${sum}`);
        }

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateHforbes();
