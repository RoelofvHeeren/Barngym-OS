const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function findNameDuplicates() {
    console.log('Searching for duplicates by Name...');

    try {
        // 1. Group by fullName in Leads
        const leadGroups = await prisma.lead.groupBy({
            by: ['firstName', 'lastName'],
            _count: { id: true },
            having: { id: { _count: { gt: 1 } } }
        });

        console.log(`\nFound ${leadGroups.length} names with multiple LEAD records:`);
        for (const group of leadGroups) {
            if (!group.firstName || !group.lastName) continue;
            const name = `${group.firstName} ${group.lastName}`;
            console.log(`- ${name} (${group._count.id})`);

            const records = await prisma.lead.findMany({
                where: { firstName: group.firstName, lastName: group.lastName },
                select: { id: true, email: true, createdAt: true }
            });
            records.forEach(r => console.log(`   ID: ${r.id}, Email: ${r.email}, Created: ${r.createdAt.toISOString()}`));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findNameDuplicates();
