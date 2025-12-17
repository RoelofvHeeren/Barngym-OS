
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Connection Secrets...");

    try {
        const ghl = await prisma.connectionSecret.findUnique({ where: { provider: "ghl" } });
        const glofox = await prisma.connectionSecret.findUnique({ where: { provider: "glofox" } });

        console.log("GHL Secret Found:", !!ghl);
        if (ghl && ghl.secret) {
            const s = ghl.secret;
            console.log(" - API Key present:", !!s.apiKey);
            console.log(" - Location ID:", s.locationId);
        }

        console.log("Glofox Secret Found:", !!glofox);
        if (glofox && glofox.secret) {
            const s = glofox.secret;
            console.log(" - Webhook Salt present:", !!s.webhookSalt);
            console.log(" - API Key present:", !!s.apiKey);
            console.log(" - Branch ID present:", !!s.branchId);
        }
    } catch (e) {
        console.error("Error querying DB:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
