
import { prisma } from "@/lib/prisma";

async function main() {
    console.log("Checking Connection Secrets...");

    const ghl = await prisma.connectionSecret.findUnique({ where: { provider: "ghl" } });
    const glofox = await prisma.connectionSecret.findUnique({ where: { provider: "glofox" } });

    console.log("GHL Secret Found:", !!ghl);
    if (ghl?.secret) {
        const s = ghl.secret as any;
        console.log(" - API Key present:", !!s.apiKey);
        console.log(" - Location ID:", s.locationId);
    }

    console.log("Glofox Secret Found:", !!glofox);
    if (glofox?.secret) {
        const s = glofox.secret as any;
        console.log(" - Webhook Salt present:", !!s.webhookSalt);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
