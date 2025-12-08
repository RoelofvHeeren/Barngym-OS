const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupGhosts() {
    try {
        console.log('Cleaning up Ghost Contacts (Stripe/Starling orphans with 0 transactions)...');

        // Find contacts with ONLY stripe/starling tags (no glofox/lead)
        // AND who have NO transactions.

        const ghosts = await prisma.contact.findMany({
            where: {
                sourceTags: { hasSome: ['stripe', 'starling'] },
                NOT: {
                    sourceTags: { hasSome: ['glofox', 'trainerize', 'ads', 'lead'] }
                },
                transactions: { none: {} }
            },
            select: { id: true, email: true, fullName: true }
        });

        console.log(`Found ${ghosts.length} ghost contacts.`);
        if (ghosts.length > 0) {
            console.log('Samples:', ghosts.slice(0, 3).map(g => g.email));

            const deleted = await prisma.contact.deleteMany({
                where: {
                    id: { in: ghosts.map(g => g.id) }
                }
            });
            console.log(`✓ Deleted ${deleted.count} ghost contacts.`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupGhosts();
