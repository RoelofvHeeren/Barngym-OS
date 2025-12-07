/**
 * One-off helper to remove outgoing Starling feed items from the DB.
 * Keeps only incoming (credits). Safe to run multiple times.
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const deleted = await prisma.$executeRawUnsafe(`
      DELETE FROM "Transaction"
      WHERE provider = 'Starling'
      AND (
        "amountMinor" < 0
        OR (
          "metadata"->>'direction' IS NOT NULL
          AND upper("metadata"->>'direction') NOT IN ('IN', 'CREDIT')
        )
      );
    `);
    console.log(`Removed ${deleted} outgoing Starling transactions.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Cleanup failed", error);
  process.exit(1);
});
