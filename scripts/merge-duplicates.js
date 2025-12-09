const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function mergeDuplicateLeads() {
    console.log('Starting duplicate lead merge...');

    try {
        // 1. Group by fullName
        const groups = await prisma.lead.groupBy({
            by: ['firstName', 'lastName'],
            _count: { id: true },
            having: { id: { _count: { gt: 1 } } }
        });

        console.log(`Found ${groups.length} sets of duplicates.`);

        let mergedCount = 0;

        for (const group of groups) {
            if (!group.firstName || !group.lastName) continue;

            const name = `${group.firstName} ${group.lastName}`;
            if (name.length < 4 || name.includes('-') || name.toLowerCase().includes('unknown')) {
                console.log(`Skipping ignored name: ${name}`);
                continue;
            }

            console.log(`\nProcessing: ${name}`);

            // Fetch all records for this name
            const leads = await prisma.lead.findMany({
                where: {
                    firstName: { equals: group.firstName, mode: 'insensitive' },
                    lastName: { equals: group.lastName, mode: 'insensitive' }
                },
                include: { transactions: true },
                orderBy: { updatedAt: 'desc' } // Newest first by default
            });

            if (leads.length < 2) continue;

            // Determine Master
            // Prefer: linked to contact > isClient > newest
            // Since we don't have direct contact link on Lead (only via shared email logic mostly), 
            // we'll rely on isClient and data richness.

            let master = leads[0]; // Default to newest
            const clientLead = leads.find(l => l.isClient || l.status === 'CLIENT');
            if (clientLead) {
                master = clientLead;
            }

            const victims = leads.filter(l => l.id !== master.id);
            console.log(`  Master: ${master.id} (${master.email}, Client: ${master.isClient})`);
            console.log(`  Victims: ${victims.length}`);

            for (const victim of victims) {
                console.log(`    Merging victim: ${victim.id} (${victim.email})`);

                // Move transactions
                if (victim.transactions.length > 0) {
                    console.log(`      Moving ${victim.transactions.length} transactions...`);
                    await prisma.transaction.updateMany({
                        where: { leadId: victim.id },
                        data: { leadId: master.id }
                    });
                }

                // Delete victim
                await prisma.lead.delete({ where: { id: victim.id } });
            }
            mergedCount++;
        }

        console.log(`\nMerge complete. Processed ${mergedCount} groups.`);

    } catch (error) {
        console.error('Error during merge:', error);
    } finally {
        await prisma.$disconnect();
    }
}

mergeDuplicateLeads();
