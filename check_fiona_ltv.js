// Quick script to check Fiona's actual LTV data
import { prisma } from './src/lib/prisma.js';

async function checkFiona() {
    const email = 'fionamcintosh1169@gmail.com';

    console.log('\\n=== Checking Fiona McIntosh ===\\n');

    // Check Lead
    const lead = await prisma.lead.findFirst({
        where: { email },
        include: {
            transactions: {
                orderBy: { occurredAt: 'desc' }
            },
            payments: {
                orderBy: { timestamp: 'desc' }
            }
        }
    });

    // Check Contact
    const contact = await prisma.contact.findFirst({
        where: { email },
        include: {
            transactions: {
                orderBy: { occurredAt: 'desc' }
            }
        }
    });

    if (lead) {
        console.log('LEAD FOUND:');
        console.log('  ID:', lead.id);
        console.log('  ltvAllCents:', lead.ltvAllCents);
        console.log('  ltvAdsCents:', lead.ltvAdsCents);
        console.log('  Transactions count:', lead.transactions.length);
        console.log('  Payments count:', lead.payments.length);

        console.log('\\n  TRANSACTIONS:');
        let txSum = 0;
        lead.transactions.forEach(t => {
            console.log(`    ${t.occurredAt.toISOString().split('T')[0]} - ${t.status} - £${(t.amountMinor || 0) / 100} - ${t.provider || t.source}`);
            if (['completed', 'paid', 'succeeded', 'success'].includes(t.status?.toLowerCase() || '')) {
                txSum += (t.amountMinor || 0);
            }
        });
        console.log(`  Sum of successful transactions: £${txSum / 100}`);

        console.log('\\n  PAYMENTS:');
        let paySum = 0;
        lead.payments.forEach(p => {
            console.log(`    ${p.timestamp.toISOString().split('T')[0]} - £${(p.amountCents || 0) / 100}`);
            paySum += (p.amountCents || 0);
        });
        console.log(`  Sum of payments: £${paySum / 100}`);
    }

    if (contact) {
        console.log('\\nCONTACT FOUND:');
        console.log('  ID:', contact.id);
        console.log('  ltvAllCents:', contact.ltvAllCents);
        console.log('  ltvAdsCents:', contact.ltvAdsCents);
        console.log('  Transactions count:', contact.transactions.length);

        let txSum = 0;
        contact.transactions.forEach(t => {
            console.log(`    ${t.occurredAt.toISOString().split('T')[0]} - ${t.status} - £${(t.amountMinor || 0) / 100}`);
            if (['completed', 'paid', 'succeeded', 'success'].includes(t.status?.toLowerCase() || '')) {
                txSum += (t.amountMinor || 0);
            }
        });
        console.log(`  Sum of successful transactions: £${txSum / 100}`);
    }

    await prisma.$disconnect();
}

checkFiona();
