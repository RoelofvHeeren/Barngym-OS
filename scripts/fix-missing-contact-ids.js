const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMissingContactIds() {
    console.log('Starting fix for transactions with leadId but missing contactId...');

    try {
        // Find transactions that have a leadId but no contactId
        const transactions = await prisma.transaction.findMany({
            where: {
                leadId: { not: null },
                contactId: null,
            },
            include: {
                lead: true,
            },
        });

        console.log(`Found ${transactions.length} transactions to check.`);

        let updated = 0;
        let skipped = 0;

        for (const tx of transactions) {
            if (!tx.lead) {
                skipped++;
                continue;
            }

            const { email, phone } = tx.lead;

            if (!email && !phone) {
                console.log(`Transaction ${tx.id} lead has no email or phone. Skipping.`);
                skipped++;
                continue;
            }

            // Find contact
            const contact = await prisma.contact.findFirst({
                where: {
                    OR: [
                        email ? { email: { equals: email, mode: 'insensitive' } } : undefined,
                        phone ? { phone: { equals: phone, mode: 'insensitive' } } : undefined,
                    ].filter(Boolean)
                },
                select: { id: true }
            });

            if (contact) {
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { contactId: contact.id }
                });
                updated++;
            } else {
                // Optional: Create contact if missing?
                // For now, let's just log. Creating might be aggressive if they really don't exist.
                console.log(`No contact found for lead ${tx.leadId} (email: ${email}, phone: ${phone}). Transaction ${tx.id} skipped.`);
                skipped++;
            }
        }

        console.log(`Fix complete.`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);

    } catch (error) {
        console.error('Error during fix:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixMissingContactIds();
