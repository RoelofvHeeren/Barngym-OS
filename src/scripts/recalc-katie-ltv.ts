import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔧 Recalculating LTV for Katie Brinsmead-Stockham...\n');

    const contact = await prisma.contact.findFirst({
        where: { email: { equals: 'katie.brinsmead@gmail.com', mode: 'insensitive' } },
        include: {
            transactions: {
                where: { status: 'completed' }
            }
        }
    });

    if (!contact) {
        console.log('❌ Contact not found');
        return;
    }

    console.log(`✅ Found contact: ${contact.fullName}`);
    console.log(`📊 Current LTV: £${(contact.ltvAllCents / 100).toFixed(2)}`);
    console.log(`💳 Linked transactions: ${contact.transactions.length}\n`);

    const totalLTV = contact.transactions.reduce((sum, t) => sum + t.amountMinor, 0);

    console.log('📋 Transaction breakdown:');
    contact.transactions.forEach(t => {
        console.log(`  - ${t.occurredAt.toISOString().slice(0, 10)} | £${(t.amountMinor / 100).toFixed(2)} | ${t.description?.slice(0, 50)}`);
    });

    console.log(`\n💰 Calculated LTV: £${(totalLTV / 100).toFixed(2)}`);

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            ltvAllCents: totalLTV,
            status: totalLTV > 0 ? 'client' : 'lead',
        }
    });

    console.log(`✅ Updated LTV to: £${(totalLTV / 100).toFixed(2)}`);
    console.log(`✅ Status updated to: ${totalLTV > 0 ? 'client' : 'lead'}`);
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
