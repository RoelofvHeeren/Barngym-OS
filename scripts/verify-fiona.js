const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function verifyFiona() {
    console.log('Verifying Fiona McIntosh...');
    try {
        const leads = await prisma.lead.findMany({
            where: {
                firstName: { equals: 'Fiona', mode: 'insensitive' },
                lastName: { equals: 'McIntosh', mode: 'insensitive' }
            },
            include: { transactions: true }
        });

        console.log(`Found ${leads.length} record(s) for Fiona McIntosh.`);
        for (const l of leads) {
            console.log(`- ID: ${l.id}`);
            console.log(`  Email: ${l.email}`);
            console.log(`  Transactions: ${l.transactions.length}`);
            console.log(`  IsClient: ${l.isClient}`);
        }
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyFiona();
