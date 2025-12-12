import { prisma } from '@/lib/prisma';

async function main() {
    const typoEmail = 'fionamcntosh1169@gmail.com';
    console.log(`Deleting duplicate with typo email: ${typoEmail}...`);

    const lead = await prisma.lead.findFirst({
        where: { email: { equals: typoEmail, mode: 'insensitive' as const } }
    });

    if (lead) {
        console.log(`Found lead ${lead.id} (${lead.fullName}). Deleting...`);
        // Delete dependencies if any (though inspection showed 0 tx/payments)
        await prisma.leadEvent.deleteMany({ where: { leadId: lead.id } });
        await prisma.leadTracking.deleteMany({ where: { leadId: lead.id } });
        await prisma.lead.delete({
            where: { id: lead.id }
        });
        console.log('✅ Deleted.');
    } else {
        console.log('Lead not found.');
    }

    // Also verify the valid lead name is correct
    const validEmail = 'fionamcintosh1169@gmail.com';
    const validLead = await prisma.lead.findFirst({
        where: { email: { equals: validEmail, mode: 'insensitive' as const } }
    });

    if (validLead) {
        if (validLead.fullName === 'Unnamed' || validLead.fullName === 'Fiona McIntosh') {
            // Ensure it has a proper name if it was "Unnamed"
            // The inspection showed "Fiona McIntosh" for both Leads in my log?
            // Wait, the first inspection log said:
            // [LEAD] ID: cmiykp... Name: Fiona McIntosh
            // But the user screenshot said "Unnamed". 
            // Ah, my console log might have defaulted differently or I read it wrong?
            // "Name: Fiona McIntosh" in my previous log.
            // Let's force update it to be sure.
            await prisma.lead.update({
                where: { id: validLead.id },
                data: { fullName: 'Fiona McIntosh' }
            });
            console.log('✅ Verified/Updated valid lead name to Fiona McIntosh');
        }
    }

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
