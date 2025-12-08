const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function populateQueue() {
    try {
        console.log('Populating Manual Match Queue with Orphan Transactions...');

        // Find "Orphan" contacts: Start with those tagged Stripe/Starling
        // AND who have NO leadId (Prisma usage often links Transaction to Lead or Contact. 
        // My previous scripts linked Transaction to Contact.
        // ManualQueue typically links to Transaction.
        // 
        // Strategy: Find transactions linked to Contacts that look like Orphans.
        // Orphan definition: Created by import, has tag 'stripe'/'starling', AND maybe verify name matches email or low confidence?

        // Actually, user wants "Unmapped".
        // I mapped them to New Contacts.
        // I should put ALL Stripe/Starling transactions into the queue IF they are not explicitly linked to a "Verified" member?
        // 
        // Safer: Find transactions where Contact is recently created Stripe/Starling orphan.

        const orphans = await prisma.contact.findMany({
            where: {
                sourceTags: { hasSome: ['stripe', 'starling'] },
                // Exclude if also has "glofox" or "trainerize" (Real members)
                NOT: {
                    sourceTags: { hasSome: ['glofox', 'trainerize', 'ads', 'lead'] }
                }
            },
            include: {
                transactions: true
            }
        });

        let count = 0;
        for (const orphan of orphans) {
            for (const tx of orphan.transactions) {
                // Check if already in queue
                const exists = await prisma.manualMatchQueue.findFirst({ where: { transactionId: tx.id } });
                if (!exists) {
                    await prisma.manualMatchQueue.create({
                        data: {
                            transactionId: tx.id,
                            reason: 'Orphaned Import',
                            createdAt: new Date(),
                            suggestedMemberIds: []
                        }
                    });
                    count++;
                }
            }
        }

        console.log(`Added ${count} transactions to Manual Queue.`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

populateQueue();
