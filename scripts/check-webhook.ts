
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking for recent Glofox Webhooks...");

    const logs = await prisma.syncLog.findMany({
        where: { source: "Glofox" },
        orderBy: { createdAt: "desc" },
        take: 3
    });

    if (logs.length === 0) {
        console.log("   ❌ No Glofox sync logs found.");
    } else {
        logs.forEach(log => {
            console.log(`   📝 [${log.createdAt.toISOString()}] ${log.detail}`);
            if (log.errors) console.log(`      ⚠️ Error: ${log.errors}`);
            console.log(`      Payload: ${log.records}`);
        });
    }

    console.log("\n🔍 Checking for recent Glofox Transactions...");
    const txs = await prisma.transaction.findMany({
        where: { provider: "Glofox" },
        orderBy: { occurredAt: "desc" },
        take: 3
    });

    if (txs.length === 0) {
        console.log("   ❌ No Glofox transactions found.");
    } else {
        txs.forEach(tx => {
            console.log(`   💰 [${tx.occurredAt.toISOString()}] ${tx.description} (${tx.amountMinor / 100} ${tx.currency})`);
            console.log(`      Ref: ${tx.reference}`);
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
