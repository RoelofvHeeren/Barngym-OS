
import { prisma } from '@/lib/prisma';

// List extracted from user's message
const expectedClients = [
    { name: 'Fiona McIntosh', email: 'fionamcintosh1169@gmail.com' },
    { name: 'Tash Thirkell', email: 'natasha-t@hotmail.co.uk' },
    { name: 'Jim Laidler', email: 'jimlaidler28@gmail.com' },
    { name: 'Benjamin Sutch', email: 'sutch3@gmail.com' },
    { name: 'Becky Bray', email: 'rtbequinetherapies@gmail.com' },
    { name: 'Ali Wilkins', email: 'ali.wilkins40@gmail.com' },
    { name: 'Katie Brinsmead-Stockham', email: 'katie.brinsmead@gmail.com' },
    { name: 'Paul Budge', email: 'cp.budge@gmail.com' },
    { name: 'Jmws', email: 'jmws0317@gmail.com' },
    { name: 'Georgie Surrey', email: 'georgiejsurrey@gmail.com' },
    { name: 'Hforbes', email: 'hforbes88@hotmail.com' },
    { name: 'Donna Potter', email: 'minihaha5165@gmail.com' },
    { name: 'Francesca Nella', email: 'francesca_nella@hotmail.com' },
    { name: 'Meg Capon', email: 'megancapon15@gmail.com' },
    { name: 'Sara Vidler', email: 'sara.vidler@outlook.com', altEmail: 'sara.vidler@outlook.co.uk' }, // Note 2 Sara Vidler entries?
    { name: 'Fiona Bruce-Smythe', email: 'fionabrucesmythe@btinternet.com' },
    { name: 'Josh faircloth', email: 'joshfair@hotmail.co.uk' },
    { name: 'Matthew Brown', email: 'matthewhenrybrown@gmail.com' },
    { name: 'Robert Gearing', email: 'robertgearing@gmail.com' },
    { name: 'Lucy Richardson', email: 'lucyrichardson2004@gmail.com' },
    { name: 'Gary Ablewhite', email: 'garyablwht@aol.com' },
    { name: 'Deborah Coburn', email: 'dcoburn1981@gmail.com' },
    { name: 'Bernice Munday', email: 'bchurmson@aol.com' },
    { name: 'Judy Hempstead', email: 'cuvanawhiptails@yahoo.co.uk' },
    { name: 'Neil Thomas', email: 'neilthomas.gb@googlemail.com' },
    { name: 'Tony Harris', email: 'th@portdesigns.com' },
    { name: 'Fiona McGuire', email: 'fionamcguire82@gmail.com' },
    { name: 'Alex Potter', email: 'alexjpotter24@icloud.com' },
    { name: 'Luke Woodhams', email: 'luke-3281@outlook.com' },
    { name: 'James Tucker', email: 'jstucker1965@gmail.com' },
    { name: 'Katrina Blench', email: 'katrinablench@hotmail.com' },
    { name: 'Joe Brisbourne', email: 'jbrisbourne15@gmail.com' },
    { name: 'Claire Jones', email: 'cjsfolio@hotmail.com' },
    { name: 'Caroline Hunn', email: 'carolinehunn@me.com' },
    { name: 'Suki McConnon', email: 'suki_tyler@hotmail.com' },
    { name: 'Kyle Adkins', email: 'kyle.adkins14@gmail.com' },
    { name: 'Nunn Punyer', email: 'nunntoben@icloud.com' },
    { name: 'Maria Kibblewhite', email: 'mariakibblewhite@yahoo.co.uk' },
    { name: 'Alastair Clark', email: 'alastairgclark@yahoo.co.uk' },
    { name: 'Sarah Lawler', email: 'sarahlawler1972@outlook.co.uk' }, // listed twice with diff emails?
    { name: 'Chris Akrimi', email: 'chrisakrimi@hotmail.com' },
    { name: 'Mark Borland', email: 'markborland2003@yahoo.co.uk' },
    { name: 'Joshua Becker', email: 'joshbecker16@yahoo.co.uk' },
    { name: 'KATHERINE FUDAKOWSKI', email: 'katherinefudakowski@gmail.com' },
    { name: 'Ellis Piddock', email: 'ellispiddock@gmail.com' },
    { name: 'Paul Roberts', email: 'paulrobertsbridge@gmail.com' },
    { name: 'Saffron Goldsmith', email: 'saffron.goldsmith4@icloud.com' },
    { name: 'Dom Donoghue', email: 'domdonoghue@yahoo.co.uk' },
    { name: 'Sarah Roberts-Favell', email: 'charliefavell@hotmail.com' },
    { name: 'Sarah Grant', email: 'sarahegrant74@gmail.com' },
    // Second Sarah Lawler in list was Same Email but diff amounts? 
    // List says: Sarah Lawler sarahlawler1972@outlook.co.uk £2,150.03
    // And at bottom: Sarah Lawler sarahlawler1972@outlook.com £745.00
    // Note outlook.CO.UK vs outlook.COM
    { name: 'Sarah Lawler (COM)', email: 'sarahlawler1972@outlook.com' }
];

async function auditLtv() {
    console.log("--- Auditing Ads LTV ---");
    const emails = expectedClients.map(c => c.email);

    // 1. Fetch Contacts in DB matching these emails
    const contacts = await prisma.contact.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true, ltvAllCents: true }
    });

    let sum = 0;
    let foundCount = 0;

    console.log(`Found ${contacts.length} / ${expectedClients.length} contacts from list.`);

    for (const c of contacts) {
        sum += c.ltvAllCents;
        foundCount++;
        // console.log(`${c.email}: £${c.ltvAllCents/100}`);
    }

    console.log(`Sum of User List LTV: £${(sum / 100).toFixed(2)}`);

    // 2. Compare with Global Ads LTV Query
    const isAdsLeadFilter = {
        OR: [
            { tags: { array_contains: "ads" } },
            { tags: { path: ["ghlTags"], array_contains: "ads" } },
            { source: { contains: "ads", mode: "insensitive" as const } },
            { source: { contains: "facebook", mode: "insensitive" as const } },
            { source: { contains: "instagram", mode: "insensitive" as const } },
            { source: { contains: "meta", mode: "insensitive" as const } },
            { source: { contains: "tiktok", mode: "insensitive" as const } },
            { source: { equals: "ghl_ads", mode: "insensitive" as const } },
        ],
    };

    const adsClientsLeads = await prisma.lead.findMany({
        where: {
            ...isAdsLeadFilter,
            isClient: true,
            payments: { some: {} }
        },
        select: { email: true }
    });

    const dbAdsEmails = adsClientsLeads.map(l => l.email).filter(Boolean);
    const adsContacts = await prisma.contact.findMany({
        where: { email: { in: dbAdsEmails } },
        select: { ltvAllCents: true, email: true }
    });

    let dbSum = 0;
    for (const c of adsContacts) dbSum += c.ltvAllCents;

    console.log(`System Total Ads LTV: £${(dbSum / 100).toFixed(2)} (${adsContacts.length} clients)`);

    // 3. Find missing
    const missingInDb = contacts.filter(c => !dbAdsEmails.includes(c.email));
    if (missingInDb.length > 0) {
        console.log("WARNING: Following contacts from user list are NOT considered 'Ads Clients' by system:");
        missingInDb.forEach(c => console.log(` - ${c.email}`));
    }
}

auditLtv()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
