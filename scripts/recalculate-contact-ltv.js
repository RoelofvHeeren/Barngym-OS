const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recalculateContactLtv() {
    console.log('Starting LTV recalculation for all contacts...');

    try {
        const contacts = await prisma.contact.findMany({
            select: { id: true }
        });

        console.log(`Found ${contacts.length} contacts.`);

        let updatedCount = 0;

        for (const contact of contacts) {
            // Sum all completed transactions for this contact
            const aggregates = await prisma.transaction.aggregate({
                where: {
                    contactId: contact.id,
                    status: { in: ['Completed', 'succeeded', 'SETTLED'] }
                },
                _sum: {
                    amountMinor: true,
                },
            });

            const totalLtv = aggregates._sum.amountMinor || 0;

            await prisma.contact.update({
                where: { id: contact.id },
                data: { ltvAllCents: totalLtv },
            });

            updatedCount++;
            if (updatedCount % 50 === 0) {
                process.stdout.write(`.`);
            }
        }

        console.log(`\nRecalculation complete.`);
        console.log(`Updated ${updatedCount} contacts.`);

    } catch (error) {
        console.error('Error during recalculation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

recalculateContactLtv();
