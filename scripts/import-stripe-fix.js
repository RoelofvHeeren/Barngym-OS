const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function importStripeFix() {
    const prisma = new PrismaClient();

    try {
        console.log('🚀 Starting Stripe Transaction Fix...');

        // 1. Delete existing Stripe transactions ($0 ones)
        console.log('Deleting old Stripe transactions...');
        const deleted = await prisma.transaction.deleteMany({
            where: { provider: 'stripe' }
        });
        console.log(`✓ Deleted ${deleted.count} old Stripe transactions.`);

        // 2. Parse new CSV
        function parseCSV(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            const firstLine = lines[0].replace(/^\uFEFF/, '');
            const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));

            return lines.slice(1).map(line => {
                const values = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim().replace(/^"|"$/g, ''));
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim().replace(/^"|"$/g, ''));
                const obj = {};
                headers.forEach((header, index) => obj[header] = values[index] || null);
                return obj;
            });
        }

        function parseAmount(amtStr) {
            if (!amtStr) return 0;
            let clean = amtStr.replace(/[£\s]/g, '');
            if (clean.includes(',') && !clean.includes('.')) clean = clean.replace(',', '.');
            else if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/,/g, '');
            return Math.round(parseFloat(clean) * 100) || 0;
        }

        // Helper: Update Contact
        async function updateContact(email) {
            if (!email) return null;
            let contact = await prisma.contact.findUnique({ where: { email: email.toLowerCase() } });

            if (contact) {
                const tags = new Set(contact.sourceTags || []);
                tags.add('stripe');
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { status: 'client', sourceTags: Array.from(tags) }
                });
                return contact.id;
            } else {
                const newContact = await prisma.contact.create({
                    data: {
                        email: email.toLowerCase(),
                        fullName: email.split('@')[0],
                        status: 'client',
                        sourceTags: ['stripe'],
                    }
                });
                return newContact.id;
            }
        }

        const stripePath = path.join(__dirname, '../../Transactions/Dashboard OS - Stripe.csv');
        if (!fs.existsSync(stripePath)) {
            console.error('❌ File not found: ' + stripePath);
            return;
        }

        console.log('Importing new Stripe data...');
        const rows = parseCSV(stripePath);
        let count = 0;

        for (const row of rows) {
            // Status filter? 'Paid' usually.
            if (row.Status && row.Status.toLowerCase() !== 'paid') continue;

            const email = row['Customer Email'];
            const amount = parseAmount(row['Amount']);
            const dateStr = row['Created date (UTC)'];
            if (!dateStr || !email) continue;

            const date = new Date(dateStr);
            // Use Invoice ID if available, else synthesize
            const extId = row['Invoice ID'] || `stripe_${email}_${date.getTime()}_${amount}_${Math.random()}`;

            const contactId = await updateContact(email);

            await prisma.transaction.create({
                data: {
                    externalId: extId,
                    contactId,
                    amountMinor: amount,
                    currency: 'GBP',
                    status: 'succeeded',
                    provider: 'stripe',
                    occurredAt: date,
                    productType: row['Description'] || 'stripe_payment',
                    source: 'stripe',
                    confidence: 'high'
                }
            });

            count++;
            if (count % 50 === 0) process.stdout.write('.');
        }

        console.log(`\n✅ Imported ${count} Stripe transactions with amounts!`);

    } catch (error) {
        console.error('❌ Stripe fix failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

importStripeFix();
