
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const record = await prisma.connectionSecret.findUnique({ where: { provider: "glofox" } });
    if (!record || !record.secret) {
        console.log("No Glofox secret found.");
        return;
    }
    const secret = record.secret as any;
    console.log(`Webhook Salt in DB: ${secret.webhookSalt}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
