
const fs = require("fs");
const path = require("path");

// Load Env
const envPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) {
            process.env[key] = rest.join("=").trim();
        }
    }
}

const { prisma } = require('./src/lib/prisma');

async function checkMike() {
    const count = await prisma.transaction.count();
    console.log("Total Transactions:", count);

    const transactions = await prisma.transaction.findMany({
        where: {
            provider: 'Glofox',
            amountMinor: 112500
        },
        take: 10,
        select: {
            id: true,
            externalId: true,
            status: true,
            amountMinor: true,
            occurredAt: true,
            personName: true,
            productType: true
        }
    });
    console.log("Found matching transactions:", JSON.stringify(transactions, null, 2));

    // If no match, list some recent Glofox transactions
    if (transactions.length === 0) {
        const recent = await prisma.transaction.findMany({
            where: { provider: 'Glofox' },
            take: 5,
            orderBy: { occurredAt: 'desc' },
            select: {
                id: true,
                externalId: true,
                status: true,
                amountMinor: true,
                occurredAt: true,
                personName: true,
                productType: true
            }
        });
        console.log("Recent Glofox transactions:", JSON.stringify(recent, null, 2));
    }
}

checkMike()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
