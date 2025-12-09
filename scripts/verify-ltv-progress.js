const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function checkLtvProgress() {
    console.log('Checking LTV Update Progress...');

    try {
        const totalContacts = await prisma.contact.count();

        const contactsWithLtv = await prisma.contact.count({
            where: { ltvAllCents: { gt: 0 } }
        });

        // Check a sample of contacts that SHOULD have LTV but might not yet
        const sample = await prisma.contact.findMany({
            where: {
                ltvAllCents: 0,
                transactions: { some: { status: { in: ['Completed', 'succeeded', 'SETTLED'] } } }
            },
            take: 5,
            select: { id: true, fullName: true, email: true }
        });

        console.log(`Total Contacts: ${totalContacts}`);
        console.log(`Contacts with LTV > 0: ${contactsWithLtv}`);
        console.log(`Remaining contacts needing update (estimate based on sample): ${sample.length > 0 ? 'Some found' : 'None found in sample'}`);

        if (sample.length > 0) {
            console.log('Sample of pending updates:');
            sample.forEach(c => console.log(` - ${c.fullName} (${c.email})`));
        } else {
            console.log('All eligible contacts appear to be updated!');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLtvProgress();
