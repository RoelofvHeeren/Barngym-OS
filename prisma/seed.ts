import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.revenueGoal.count();
  if (count > 0) {
    console.log("RevenueGoal already seeded. Skipping.");
    return;
  }

  const baseGoals = [
    // Yearly total
    { category: "Total Revenue", period: "Yearly", targetAmount: 600000, notes: "Annual target" },
    // Quarterly totals
    { category: "Q1", period: "Quarterly", targetAmount: 150000, notes: "Q1 target" },
    { category: "Q2", period: "Quarterly", targetAmount: 150000, notes: "Q2 target" },
    { category: "Q3", period: "Quarterly", targetAmount: 150000, notes: "Q3 target" },
    { category: "Q4", period: "Quarterly", targetAmount: 150000, notes: "Q4 target" },
    // Streams yearly
    { category: "PT", period: "Yearly", targetAmount: 200000, notes: "PT stream" },
    { category: "Classes", period: "Yearly", targetAmount: 120000, notes: "Classes stream" },
    { category: "Online Coaching", period: "Yearly", targetAmount: 150000, notes: "Online stream" },
    { category: "Corporate Wellness", period: "Yearly", targetAmount: 80000, notes: "Corporate stream" },
    { category: "Retreats", period: "Yearly", targetAmount: 50000, notes: "Retreats stream" },
  ];

  // Cast to any to avoid compile-time drift if client types are stale before migration.
  await prisma.revenueGoal.createMany({ data: baseGoals as any });
  console.log("Seeded RevenueGoal with baseline plan.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
