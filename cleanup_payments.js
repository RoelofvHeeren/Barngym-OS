
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

const { prisma } = require("./src/lib/prisma");

const REVENUE_STATUSES = ["Completed", "Paid", "PAID", "succeeded", "SETTLED", "success", "COMPLETED"];

async function cleanupPayments() {
    console.log("Starting Payment details cleanup...");

    const payments = await prisma.payment.findMany({
        select: { id: true, rawPayload: true, sourceSystem: true }
    });

    let deleted = 0;

    for (const p of payments) {
        if (p.sourceSystem === 'glofox') {
            const raw = p.rawPayload;
            // Glofox payload wrapper
            const data = raw.payment ?? raw;
            const status = (data.payment_status ?? data.status ?? "").toString();

            const isRevenue = REVENUE_STATUSES.some(s => s.toLowerCase() === status.toLowerCase());

            if (!isRevenue) {
                console.log(`Deleting non-revenue payment ${p.id} (Status: ${status})`);
                await prisma.payment.delete({ where: { id: p.id } });
                deleted++;
            }
        }
    }

    console.log(`Cleanup complete. Deleted ${deleted} records.`);
}

cleanupPayments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
