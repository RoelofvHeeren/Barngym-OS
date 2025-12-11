
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const companiesToDelete = ["Decathlon", "Unity Care", "Infinity Group"];
        const deleteResult = await prisma.lead.deleteMany({
            where: {
                companyName: { in: companiesToDelete },
            },
        });
        console.log(`Deleted ${deleteResult.count} placeholder leads.`);
    } catch (error) {
        console.error('Error deleting placeholders:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
