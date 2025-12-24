import { prisma } from '../src/lib/prisma';

async function debugYvonne() {
    console.log('Searching for "Yvonne Wallace" or "the.wallacefamily@btinternet.com"...');

    const contacts = await prisma.contact.findMany({
        where: {
            OR: [
                { fullName: { contains: 'Yvonne Wallace', mode: 'insensitive' } },
                { email: { contains: 'the.wallacefamily@btinternet.com', mode: 'insensitive' } },
                { email: { contains: 'stephen.evans@evans-structures.co.uk', mode: 'insensitive' } }
            ]
        },
        include: {
            transactions: {
                orderBy: { occurredAt: 'desc' }
            }
        }
    });

    console.log(`\nFound ${contacts.length} Contacts:`);
    for (const c of contacts) {
        console.log(`- ID: ${c.id} (${c.fullName})`);
        for (const t of c.transactions) {
            console.log(`  > ${t.occurredAt.toISOString().split('T')[0]} | £${(t.amountMinor / 100).toFixed(2)} | ${t.provider} | ${t.productType} | Status: ${t.status}`);
            // Log metadata for the suspicious ones
            if (t.amountMinor === 113 || t.amountMinor === 2000) {
                console.log(`    Metadata:`, JSON.stringify(t.metadata, null, 2));
                console.log(`    Raw:`, JSON.stringify(t.raw, null, 2));
            }
        }
    }
}

debugYvonne()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
