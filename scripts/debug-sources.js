const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listSources() {
    console.log('Debugging DB Content...');
    try {
        const leadCount = await prisma.lead.count();
        console.log(`Total Leads: ${leadCount}`);

        const leads = await prisma.lead.groupBy({
            by: ['source'],
            _count: { source: true }
        });
        console.log('Lead Sources:', leads);

        const paymentCount = await prisma.payment.count();
        console.log(`Total Payments: ${paymentCount}`);

        const contactCount = await prisma.contact.count();
        console.log(`Total Contacts: ${contactCount}`);

        const txCount = await prisma.transaction.count();
        console.log(`Total Transactions: ${txCount}`);

        const txProviders = await prisma.transaction.groupBy({
            by: ['provider'],
            _count: { provider: true }
        });
        console.log('Transaction Providers:', txProviders);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listSources();
