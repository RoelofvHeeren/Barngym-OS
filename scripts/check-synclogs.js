
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Sync Logs...");

    try {
        const logs = await prisma.syncLog.findMany({
            where: { source: "Glofox" },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        console.log(`Found ${logs.length} logs.`);

        if (logs.length === 0) {
            console.log("No Glofox logs found.");
        } else {
            logs.forEach(log => {
                console.log(`[${log.createdAt.toISOString()}] ${log.detail}`);
                if (log.errors) console.log(`   ERROR: ${log.errors}`);
                console.log(`   Recs: ${log.records}`);
            });
        }
    } catch (e) {
        console.error("Error querying DB:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
