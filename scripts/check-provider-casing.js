
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tx = await prisma.transaction.findFirst({
        where: {
            provider: {
                contains: 'tarlin', // fuzzy match to find any casing
                mode: 'insensitive'
            }
        },
        select: {
            id: true,
            provider: true,
            personName: true,
            reference: true,
            raw: true,
        },
    });

    if (tx) {
        console.log("Found transaction:", tx.id);
        console.log("Provider:", tx.provider);
        console.log("Raw keys:", tx.raw ? Object.keys(tx.raw) : 'null');
        console.log("Raw full:", JSON.stringify(tx.raw, null, 2));
    } else {
        console.log("No matching transaction found.");
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
