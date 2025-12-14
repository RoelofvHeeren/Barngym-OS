
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), 'app/.env.local') });

const prisma = new PrismaClient();

async function breakdownAdsRevenue() {
    const now = new Date();
    const end = now;
    const start = new Date(now);
    start.setDate(start.getDate() - 30);

    console.log(`Analyzing Revenue for range: ${start.toISOString()} to ${end.toISOString()}`);

    // Use 'has: "ads"' for String[] column.
    const payments = await prisma.payment.findMany({
        where: {
            timestamp: {
                gte: start,
                lte: end,
            },
            lead: {
                tags: {
                    array_contains: "ads"
                }
            }
        },
        include: {
            lead: true
        }
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amountCents, 0);

    console.log(`Total Revenue Found: ${(totalRevenue / 100).toFixed(2)}`);

    const byLead = {};

    for (const p of payments) {
        const name = (p.lead.firstName || "") + " " + (p.lead.lastName || "");
        const cleanName = name.trim() || p.lead.email || "Unknown";

        if (!byLead[cleanName]) byLead[cleanName] = 0;
        byLead[cleanName] += p.amountCents;
    }

    console.log("\n--- Contributors ---");
    const sorted = Object.entries(byLead).sort((a, b) => b[1] - a[1]);
    for (const [name, cents] of sorted) {
        console.log(`${name}: £${(cents / 100).toFixed(2)}`);
    }
}

breakdownAdsRevenue()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
