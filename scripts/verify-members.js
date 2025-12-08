const { PrismaClient } = require('@prisma/client');

async function verifyMembers() {
    const prisma = new PrismaClient();

    try {
        console.log('Verifying member data...');

        const total = await prisma.contact.count();
        const clients = await prisma.contact.count({ where: { status: 'client' } });
        const leads = await prisma.contact.count({ where: { status: 'lead' } });

        // Tags
        const trainerize = await prisma.contact.count({ where: { sourceTags: { has: 'trainerize' } } });
        const glofox = await prisma.contact.count({ where: { sourceTags: { has: 'glofox' } } });
        const ads = await prisma.contact.count({ where: { sourceTags: { has: 'ads' } } });
        const stripe = await prisma.contact.count({ where: { sourceTags: { has: 'stripe' } } });
        const starling = await prisma.contact.count({ where: { sourceTags: { has: 'starling' } } });

        // Ad Conversions
        const adsClients = await prisma.contact.count({
            where: {
                status: 'client',
                sourceTags: { has: 'ads' }
            }
        });

        // Revenue / LTV
        const ltvSum = await prisma.contact.aggregate({
            _sum: { ltvAllCents: true }
        });
        const totalRevenue = (ltvSum._sum.ltvAllCents || 0) / 100;

        console.log('\n📊 DATABASE STATS:');
        console.log('------------------');
        console.log(`Total Contacts: ${total}`);
        console.log(`Clients (Members): ${clients}`);
        console.log(`Leads: ${leads}`);
        console.log('');
        console.log(`Glofox Tagged: ${glofox}`);
        console.log(`Stripe Tagged: ${stripe}`);
        console.log(`Starling Tagged: ${starling}`);
        console.log(`Trainerize Tagged: ${trainerize}`);
        console.log(`Ads (GHL) Tagged: ${ads}`);
        console.log('');
        console.log(`🚀 CONVERSIONS (Ads -> Client): ${adsClients}`);
        console.log('');
        console.log(`💰 TOTAL TRACKED REVENUE (LTV): £${totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
        console.log('------------------');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyMembers();
