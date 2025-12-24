
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

async function checkRevenue() {
    const transactions = await prisma.transaction.aggregate({
        _sum: {
            amountMinor: true
        },
        where: {
            personName: { contains: 'Mike Patrick-Dawson', mode: 'insensitive' },
            provider: 'Glofox'
        }
    });

    const rawTotal = transactions._sum.amountMinor;
    console.log(`Raw Total (Current): ${rawTotal}`);

    const activeTransactions = await prisma.transaction.aggregate({
        _sum: {
            amountMinor: true
        },
        where: {
            personName: { contains: 'Mike Patrick-Dawson', mode: 'insensitive' },
            provider: 'Glofox',
            status: { in: ['Completed', 'Paid', 'PAID', 'succeeded'] }
        }
    });

    const correctTotal = activeTransactions._sum.amountMinor;
    console.log(`Corrected Total (Filtered): ${correctTotal}`);
}

checkRevenue()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
