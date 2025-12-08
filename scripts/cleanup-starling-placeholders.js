const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupStarling() {
    try {
        console.log('Searching for Starling Placeholder contacts...');

        // Find contacts with placeholder emails or unknown_ prefix
        // AND confirmed to be Starling origin
        const placeholders = await prisma.contact.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { email: { contains: 'placeholder.com' } },
                            { email: { startsWith: 'unknown_' } }
                        ]
                    },
                    {
                        sourceTags: { has: 'starling' }
                    }
                ]
            },
            include: { transactions: true }
        });

        console.log(`Found ${placeholders.length} placeholder contacts.`);

        if (placeholders.length === 0) {
            console.log('No placeholders found. Exiting.');
            return;
        }

        const txIds = [];
        for (const p of placeholders) {
            if (p.transactions.length > 0) {
                txIds.push(...p.transactions.map(t => t.id));
            }
        }
        console.log(`Found ${txIds.length} associated transactions.`);

        // 1. Unlink Transactions
        if (txIds.length > 0) {
            console.log('Unlinking transactions...');
            await prisma.transaction.updateMany({
                where: { id: { in: txIds } },
                data: {
                    contactId: null,
                    leadId: null,
                    status: 'Needs Review', // Reset status so it appears as "New" in lists if needed, or matches query for manual queue
                    confidence: 'Unmatched'
                }
            });
        }

        // 2. Add to Manual Queue
        console.log('Adding to Manual Match Queue...');
        let added = 0;
        for (const txId of txIds) {
            const exists = await prisma.manualMatchQueue.findFirst({ where: { transactionId: txId } });
            if (!exists) {
                await prisma.manualMatchQueue.create({
                    data: {
                        transactionId: txId,
                        reason: 'Starling Cleanup',
                        createdAt: new Date(),
                        suggestedMemberIds: []
                    }
                });
                added++;
            }
        }
        console.log(`Added ${added} transactions to Queue.`);

        // 3. Delete Contacts
        console.log('Deleting placeholder contacts...');
        const deleted = await prisma.contact.deleteMany({
            where: { id: { in: placeholders.map(p => p.id) } }
        });
        console.log(`✓ Deleted ${deleted.count} contacts.`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupStarling();
