import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Scanning for duplicate Lead-only transactions...');

    // 1. Find all transactions with leadId but NO contactId
    const orphanTransactions = await prisma.transaction.findMany({
        where: {
            AND: [
                { leadId: { not: null } },
                { contactId: null }
            ]
        }
    });

    console.log(`Found ${orphanTransactions.length} transactions linked ONLY to Leads.`);

    let duplicatesFound = 0;
    let confirmDeleteIds: string[] = [];

    for (const orphan of orphanTransactions) {
        // 2. Find a matching transaction that HAS a contactId
        // Match by: amount, reference (if exists), and approx time

        const timeWindow = 1000 * 60 * 60 * 24; // 24 hours just to be safe, exact match preferred

        const match = await prisma.transaction.findFirst({
            where: {
                AND: [
                    { contactId: { not: null } },
                    { amountMinor: orphan.amountMinor },
                    { reference: orphan.reference }, // Important for Starling
                    {
                        occurredAt: orphan.occurredAt
                        // Alternatively use range if needed, but exact match is likely for these duplicates
                    }
                ]
            }
        });

        if (match) {
            duplicatesFound++;
            console.log(`\n🚨 FOUND DUPLICATE:`);
            console.log(`   Orphan (Lead Only): ${orphan.id} | ${orphan.occurredAt.toISOString()} | £${(orphan.amountMinor || 0) / 100} | Ref: ${orphan.reference}`);
            console.log(`   Match  (Contact):   ${match.id}  | ${match.occurredAt.toISOString()} | £${(match.amountMinor || 0) / 100} | Ref: ${match.reference}`);
            console.log(`   Lead ID: ${orphan.leadId}`);

            confirmDeleteIds.push(orphan.id);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total Lead-only Orphans: ${orphanTransactions.length}`);
    console.log(`   Confirmed Duplicates: ${duplicatesFound}`);

    if (confirmDeleteIds.length > 0) {
        console.log(`\n🗑️  Deleting ${confirmDeleteIds.length} duplicate transactions...`);
        const { count } = await prisma.transaction.deleteMany({
            where: {
                id: { in: confirmDeleteIds }
            }
        });
        console.log(`✅ Deleted ${count} transactions.`);
    }

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
