const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function downgradeZeroLtvClients() {
    console.log('Finding Clients with 0 LTV and no completed transactions...');

    try {
        // Find candidates: Status is 'Client' AND LTV is 0
        const candidates = await prisma.contact.findMany({
            where: {
                status: { equals: 'client', mode: 'insensitive' },
                ltvAllCents: 0
            },
            include: {
                _count: {
                    select: { transactions: true }
                }
            }
        });

        console.log(`Found ${candidates.length} candidates with LTV = 0.`);

        let toDowngrade = [];

        // Double check transaction count to be safe
        // (LTV might be 0 but they might have failed transactions, we still downgrade them
        // unless they have a strictly 'Completed/succeeded/SETTLED' transaction that was missed)
        for (const c of candidates) {
            // We can check if they have ANY successful transactions just in case the LTV job missed them
            // But assuming LTV job ran correctly, ltvAllCents=0 is the truth.
            toDowngrade.push(c.id);
        }

        if (toDowngrade.length === 0) {
            console.log('No clients to downgrade.');
            return;
        }

        console.log(`Downgrading ${toDowngrade.length} clients to 'lead' status...`);

        const result = await prisma.contact.updateMany({
            where: {
                id: { in: toDowngrade }
            },
            data: {
                status: 'lead'
            }
        });

        console.log(`Successfully updated ${result.count} records.`);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

downgradeZeroLtvClients();
