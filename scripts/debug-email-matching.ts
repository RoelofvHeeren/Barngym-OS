import { prisma } from '../src/lib/prisma';

async function debugEmailMatching() {
    console.log('Testing email matching sensitivity...');

    // 1. Fetch all ads leads (simulate Overview query start)
    const isAdsLeadFilter = {
        OR: [
            { tags: { array_contains: "ads" } },
            { tags: { path: ["ghlTags"], array_contains: "ads" } },
            { source: { contains: "ads", mode: "insensitive" as const } },
        ],
    };

    const adsLeads = await prisma.lead.findMany({
        where: {
            ...isAdsLeadFilter,
            isClient: true
        },
        select: { id: true, email: true }
    });

    const leadEmails = adsLeads.map(l => l.email).filter(Boolean) as string[];
    console.log(`Found ${leadEmails.length} Ads Client Lead emails.`);

    // 2. Overview Method: 'in' clause
    const overviewContacts = await prisma.contact.findMany({
        where: { email: { in: leadEmails } },
        select: { id: true, email: true, ltvAllCents: true }
    });

    const overviewSum = overviewContacts.reduce((sum, c) => sum + c.ltvAllCents, 0);
    console.log(`Overview Method ('in' clause): Found ${overviewContacts.length} contacts. Sum: £${(overviewSum / 100).toFixed(2)}`);

    // 3. Leads Method: logical OR / finding manually (Simulation)
    // Actually, 'api/ads/leads/route.ts' ALSO uses 'in' clause for the initial fetch!
    // Line 165: where: { email: { in: leadEmails } }

    // So if both use 'in' clause, why the difference?
    // Let's verify if 'leads' endpoint does something else.

    // Maybe 'leads' endpoint fetches contacts, BUT then iterates 'leads' array and finds contact?
    // Yes, but it only has the contacts returned by the 'in' query to search within.
    // const contacts = await prisma.contact.findMany({ where: { email: { in: leadEmails } } ... })
    // leads.forEach(lead => { const c = contacts.find(...) })

    // So if 'in' misses them, 'leads' endpoint should also see 0 LTV for them.
    // UNLESS the table logic falls back to something else? 
    // No, I saw "ltvCents: paymentInfo?.totalLtvCents ?? 0".

    // Wait, did I miss something in my implementation of overview?
    // I only count LTV if > 0.

    // Let's check for case mismatches specifically.
    const lowerCaseLeadEmails = leadEmails.map(e => e.toLowerCase());
    const insensitiveContacts = await prisma.contact.findMany({
        where: {
            email: { in: lowerCaseLeadEmails, mode: 'insensitive' }
        },
        select: { id: true, email: true, ltvAllCents: true }
    });

    const insensitiveSum = insensitiveContacts.reduce((sum, c) => sum + c.ltvAllCents, 0);
    console.log(`Insensitive Check: Found ${insensitiveContacts.length} contacts. Sum: £${(insensitiveSum / 100).toFixed(2)}`);

    // Let's see the diff
    const overviewIds = new Set(overviewContacts.map(c => c.id));
    const missing = insensitiveContacts.filter(c => !overviewIds.has(c.id));

    if (missing.length > 0) {
        console.log(`\nFound ${missing.length} contacts missed by sensitive match:`);
        missing.forEach(c => console.log(`- ${c.email} (LTV £${c.ltvAllCents / 100})`));
    } else {
        console.log('\nNo contacts missed by sensitive match.');
    }

}

debugEmailMatching()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
