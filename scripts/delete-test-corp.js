
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const deleteResult = await prisma.lead.deleteMany({
            where: {
                companyName: 'Test Corp',
            },
        });
        console.log(`Deleted ${deleteResult.count} Test Corp leads.`);
    } catch (error) {
        console.error('Error deleting Test Corp:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
