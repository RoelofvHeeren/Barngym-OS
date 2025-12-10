import { prisma } from '@/lib/prisma';
import { upsertTransactions } from '@/lib/transactions';

const transactions = [
    { date: '09/12/2025', time: '15:55', name: 'Katie Preston', email: 'katiepreston3@gmail.com', amount: 12, desc: 'Pay As You Go Small group training sessions (1 Small Group Training Session)' },
    { date: '09/12/2025', time: '12:34', name: 'Katie Brinsmead-Stockham', email: 'katie.brinsmead@gmail.com', amount: 100, desc: 'Pay As You Go Small group training sessions (10 Small Group Training Sessions)' },
    { date: '09/12/2025', time: '12:07', name: 'Katie Brinsmead-Stockham', email: 'katie.brinsmead@gmail.com', amount: 550, desc: 'Personal Training (Personal Training Block of 10 Sessions)' },
    { date: '09/12/2025', time: '11:46', name: 'Yvonne Wallace', email: 'the.wallacefamily@btinternet.com', amount: 1125, desc: '1 year Membership' },
    { date: '09/12/2025', time: '05:24', name: 'Dawn Burfitt', email: 'd.burfitt@arkalexandra.org', amount: 100, desc: 'Pay As You Go Small group training sessions (10 Small Group Training Sessions)' },
    { date: '08/12/2025', time: '21:49', name: 'Paul Budge', email: 'cp.budge@gmail.com', amount: 60, desc: 'Personal Training (Personal Training Session)' },
    { date: '08/12/2025', time: '13:16', name: 'Lizzie Lawrence', email: 'lizzielawrence@icloud.com', amount: 12, desc: 'Pay As You Go Small group training sessions (1 Small Group Training Session)' },
    { date: '07/12/2025', time: '21:19', name: 'Piers Cronk', email: 'pierscronk@ymail.com', amount: 100, desc: 'Pay As You Go Small group training sessions (10 Small Group Training Sessions)' },
    { date: '07/12/2025', time: '17:40', name: 'James Davies', email: 'jdavies1976@btinternet.com', amount: 12, desc: 'Pay As You Go Small group training sessions (1 Small Group Training Session)' },
    { date: '07/12/2025', time: '11:14', name: 'Jennie Lever', email: 'jennie@abowlofhealth.com', amount: 12, desc: 'Pay As You Go Small group training sessions (1 Small Group Training Session)' },
    { date: '06/12/2025', time: '14:54', name: 'Nicola Farrington', email: 'info@elementalbeauty.co.uk', amount: 100, desc: 'Pay As You Go Small group training sessions (10 Small Group Training Sessions)' },
    { date: '06/12/2025', time: '08:52', name: 'Aljenka Franklin', email: 'aljenkafranklin@icloud.com', amount: 315, desc: 'Barn Gym Membership (Barn Gym 3 Month Membership)' },
    { date: '05/12/2025', time: '19:37', name: 'Susan Mann', email: 'susanmann364@btinternet.com', amount: 12, desc: 'Pay As You Go Small group training sessions (1 Small Group Training Session)' },
    { date: '05/12/2025', time: '19:04', name: 'Debra Thackerary', email: 'debrathackeray01@gmail.com', amount: 100, desc: 'Pay As You Go Small group training sessions (10 Small Group Training Sessions)' },
    { date: '05/12/2025', time: '11:56', name: 'Daniel Laidler', email: 'daniellaidler5000@gmail.com', amount: 100, desc: 'Pay As You Go Small group training sessions (10 Small Group Training Sessions)' },
    { date: '05/12/2025', time: '11:55', name: 'Lena Cunha', email: 'lena.cunha7@hotmail.com', amount: 12, desc: 'Pay As You Go Small group training sessions (1 Small Group Training Session)' },
    { date: '05/12/2025', time: '00:00', name: 'Jo Raisey', email: 'joraisey@gmail.com', amount: 0, desc: 'Barn Gym Membership' },
];

function parseDate(dateStr: string, timeStr: string): Date {
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
}

async function main() {
    console.log(`Importing ${transactions.length} Glofox transactions...`);

    const normalized = transactions.map((t) => {
        const occurredAt = parseDate(t.date, t.time);
        const productType = t.desc.includes('Personal Training') ? 'pt' :
            t.desc.includes('Membership') ? 'classes' :
                t.desc.includes('Small group') ? 'classes' : 'other';

        return {
            externalId: `glofox_manual_${t.date.replace(/\//g, '')}_${t.time.replace(/:/g, '')}_${t.email}`,
            provider: 'Glofox' as const,
            amountMinor: Math.round(t.amount * 100),
            status: 'completed',
            occurredAt: occurredAt.toISOString(),
            productType,
            personName: t.name,
            currency: 'GBP',
            confidence: 'Matched' as const,
            description: t.desc,
            reference: undefined,
            metadata: {
                email: t.email,
                method: 'Card',
                source: 'manual_import_dec_5_10',
            },
        };
    });

    const result = await upsertTransactions(normalized);

    console.log(`✅ Successfully imported ${result.added} new transactions (total: ${result.total})`);

    // Log which leads should now be promoted to clients
    console.log('\n📊 Checking lead status updates...');
    const emails = transactions.map(t => t.email.toLowerCase());
    const contacts = await prisma.contact.findMany({
        where: {
            email: { in: emails, mode: 'insensitive' }
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            ltvAllCents: true,
        }
    });

    console.log('\nContacts that should be updated:');
    contacts.forEach(c => {
        console.log(`- ${c.fullName} (${c.email}): ${c.status} → ${c.ltvAllCents > 0 ? 'Client' : c.status} (LTV: £${(c.ltvAllCents / 100).toFixed(2)})`);
    });
}

main()
    .catch((err) => {
        console.error('❌ Import failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
