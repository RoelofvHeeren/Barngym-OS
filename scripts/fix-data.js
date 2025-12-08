const { PrismaClient } = require('@prisma/client');

async function fixData() {
    const prisma = new PrismaClient();

    try {
        console.log('Running data fix...');

        // Fix null provider values
        const providerResult = await prisma.$executeRaw`
      UPDATE "Transaction" 
      SET "provider" = 'Unknown' 
      WHERE "provider" IS NULL
    `;
        console.log(`Fixed ${providerResult} rows with null provider`);

        // Fix null confidence values
        const confidenceResult = await prisma.$executeRaw`
      UPDATE "Transaction" 
      SET "confidence" = 'Needs Review' 
      WHERE "confidence" IS NULL
    `;
        console.log(`Fixed ${confidenceResult} rows with null confidence`);

        // Fix null status values
        const statusResult = await prisma.$executeRaw`
      UPDATE "Transaction" 
      SET "status" = 'Needs Review' 
      WHERE "status" IS NULL
    `;
        console.log(`Fixed ${statusResult} rows with null status`);

        // Fix null source values (copy from provider)
        const sourceResult = await prisma.$executeRaw`
      UPDATE "Transaction" 
      SET "source" = COALESCE("provider", 'Unknown')
      WHERE "source" IS NULL
    `;
        console.log(`Fixed ${sourceResult} rows with null source`);

        console.log('Data fix completed successfully');
    } catch (error) {
        console.error('Data fix failed:', error);
        // Don't throw - allow build to continue
    } finally {
        await prisma.$disconnect();
    }
}

fixData();
