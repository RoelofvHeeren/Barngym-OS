/**
 * One-off helper to remove outgoing Starling feed items from the DB.
 * Keeps only incoming (credits). Safe to run multiple times.
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.transaction.deleteMany({
      where: {
        provider: "Starling",
        amountMinor: { lt: 0 },
      },
    });
    console.log(`Removed ${result.count} outgoing Starling transactions.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Cleanup failed", error);
  process.exit(1);
});
