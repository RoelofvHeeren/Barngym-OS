const { PrismaClient } = require('@prisma/client');

async function clearDatabase() {
    const prisma = new PrismaClient();

    try {
        console.log('🔥 STARTING AGGRESSIVE DATABASE CLEANUP 🔥');
        console.log('This will delete ALL data from the database...\n');

        // Run cleanup multiple times to ensure everything is gone
        for (let i = 1; i <= 3; i++) {
            console.log(`\n--- Cleanup Pass ${i}/3 ---`);

            // Delete all manual match queue items
            try {
                const deletedManualMatches = await prisma.manualMatchQueue.deleteMany({});
                console.log(`✓ Deleted ${deletedManualMatches.count} manual match queue items`);
            } catch (e) {
                console.log('  (No manual match queue items to delete)');
            }

            // Delete all transactions (must be before contacts/leads due to foreign keys)
            const deletedTransactions = await prisma.transaction.deleteMany({});
            console.log(`✓ Deleted ${deletedTransactions.count} transactions`);

            // Delete all payments
            const deletedPayments = await prisma.payment.deleteMany({});
            console.log(`✓ Deleted ${deletedPayments.count} payments`);

            // Delete all contacts
            const deletedContacts = await prisma.contact.deleteMany({});
            console.log(`✓ Deleted ${deletedContacts.count} contacts`);

            // Delete all lead events
            try {
                const deletedLeadEvents = await prisma.leadEvent.deleteMany({});
                console.log(`✓ Deleted ${deletedLeadEvents.count} lead events`);
            } catch (e) {
                console.log('  (No lead events to delete)');
            }

            // Delete all lead tracking
            try {
                const deletedLeadTracking = await prisma.leadTracking.deleteMany({});
                console.log(`✓ Deleted ${deletedLeadTracking.count} lead tracking records`);
            } catch (e) {
                console.log('  (No lead tracking to delete)');
            }

            // Delete all counterparty mappings
            try {
                const deletedMappings = await prisma.counterpartyMapping.deleteMany({});
                console.log(`✓ Deleted ${deletedMappings.count} counterparty mappings`);
            } catch (e) {
                console.log('  (No counterparty mappings to delete)');
            }

            // Delete all ads revenue
            try {
                const deletedAdsRevenue = await prisma.adsRevenue.deleteMany({});
                console.log(`✓ Deleted ${deletedAdsRevenue.count} ads revenue records`);
            } catch (e) {
                console.log('  (No ads revenue to delete)');
            }

            // Delete all leads
            const deletedLeads = await prisma.lead.deleteMany({});
            console.log(`✓ Deleted ${deletedLeads.count} leads`);

            // Check if anything remains
            const remainingContacts = await prisma.contact.count();
            const remainingLeads = await prisma.lead.count();
            const remainingTransactions = await prisma.transaction.count();

            console.log(`\nRemaining after pass ${i}:`);
            console.log(`  - Contacts: ${remainingContacts}`);
            console.log(`  - Leads: ${remainingLeads}`);
            console.log(`  - Transactions: ${remainingTransactions}`);

            if (remainingContacts === 0 && remainingLeads === 0 && remainingTransactions === 0) {
                console.log('\n✅ Database is completely clean!');
                break;
            }
        }

        console.log('\n🎉 AGGRESSIVE DATABASE CLEANUP COMPLETED! 🎉');
        console.log('All data has been permanently deleted.');

    } catch (error) {
        console.error('❌ Database cleanup failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

clearDatabase();
