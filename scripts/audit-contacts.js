const { PrismaClient } = require('@prisma/client');

async function auditContacts() {
    const prisma = new PrismaClient();

    try {
        console.log('Auditing Contact Origins...');
        const contacts = await prisma.contact.findMany({
            select: { id: true, sourceTags: true, status: true }
        });

        let originLead = 0;       // Started as Lead (has 'lead' or 'ads' tag)
        let originMember = 0;     // Came from Member Lists (glofox/trainerize) AND NOT Lead
        let originTransaction = 0; // Came purely from Transactions (stripe/starling/glofox-txn) AND NOT Member/Lead
        let unknown = 0;

        let overlapLeadMember = 0; // Started as Lead AND became Member

        for (const c of contacts) {
            const tags = c.sourceTags || [];
            const hasLead = tags.includes('lead') || tags.includes('ads');
            const hasMember = tags.includes('glofox') || tags.includes('trainerize');
            const hasTxnOnly = !hasLead && !hasMember && (tags.includes('stripe') || tags.includes('starling') || tags.includes('glofox'));

            if (hasLead) {
                originLead++;
                if (hasMember || c.status === 'client') overlapLeadMember++;
            } else if (hasMember) {
                originMember++;
            } else if (hasTxnOnly) {
                originTransaction++;
            } else {
                // Check if created from transaction but maybe tag mismatch?
                // If it has ANY source tag, classify it.
                if (tags.length > 0) originTransaction++; // Catch-all for other transaction providers
                else unknown++;
            }
        }

        console.log(`\n\n📊 CONTACT SOURCE BREAKDOWN (Total: ${contacts.length})`);
        console.log('------------------------------------------------');
        console.log(`1️⃣  ORIGINAL LEADS:         ${originLead}`);
        console.log(`    (Converted to Client: ${overlapLeadMember})`);
        console.log(`    (Still Leads:         ${originLead - overlapLeadMember})`);
        console.log('------------------------------------------------');
        console.log(`2️⃣  DIRECT MEMBER IMPORTS:  ${originMember}`);
        console.log(`    (From Glofox/Trainerize CSVs, not in Lead list)`);
        console.log('------------------------------------------------');
        console.log(`3️⃣  TRANSACTION ORPHANS:    ${originTransaction}`);
        console.log(`    (Created solely from Stripe/Starling transactions)`);
        console.log(`    (Likely different email/name than Member list)`);
        console.log('------------------------------------------------');
        console.log(`❓  UNKNOWN / MANUAL:       ${unknown}`);
        console.log('------------------------------------------------');
        console.log(`= TOTAL: ${originLead + originMember + originTransaction + unknown}`);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

auditContacts();
