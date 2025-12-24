
import { prisma } from '@/lib/prisma';

async function pruneOldMetaData() {
    const CUTOFF = new Date("2024-09-25T00:00:00.000Z");

    console.log("--- Pruning Meta Data Before 2024-09-25 ---");
    const count = await prisma.metaDailyInsight.count({
        where: {
            date: { lt: CUTOFF }
        }
    });
    console.log(`Found ${count} records to delete.`);

    if (count > 0) {
        const deleted = await prisma.metaDailyInsight.deleteMany({
            where: {
                date: { lt: CUTOFF }
            }
        });
        console.log(`Deleted ${deleted.count} records.`);
    }

    // Verify new Spend Total
    const agg = await prisma.metaDailyInsight.aggregate({
        _sum: { spend: true }
    });
    console.log(`New Meta Total Spend: £${agg._sum.spend}`);
}

pruneOldMetaData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
