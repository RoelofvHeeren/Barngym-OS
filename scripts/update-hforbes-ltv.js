const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function updateHforbes() {
    console.log('Updating Hforbes LTV...');

    try {
        const contact = await prisma.contact.findFirst({
            where: {
                OR: [
                    { email: { contains: 'hforbes88', mode: 'insensitive' } },
                    { fullName: { contains: 'Hforbes', mode: 'insensitive' } }
                ]
            }
        });

        if (!contact) {
            console.log('Contact not found.');
            return;
        }

        console.log(`Found contact: ${contact.fullName} (${contact.id})`);
        console.log(`Current LTV: ${contact.ltvAllCents}`);

        const aggregates = await prisma.transaction.aggregate({
            where: {
                contactId: contact.id,
                status: { in: ['Completed', 'succeeded', 'SETTLED'] }
            },
            _sum: {
                amountMinor: true
            }
        });

        const newTotal = aggregates._sum.amountMinor || 0;
        console.log(`Calculated New LTV: ${newTotal}`);

        await prisma.contact.update({
            where: { id: contact.id },
            data: { ltvAllCents: newTotal }
        });
        console.log('LTV updated successfully.');

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

updateHforbes();
