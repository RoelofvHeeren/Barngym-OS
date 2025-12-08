const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function importTransactions() {
    const prisma = new PrismaClient();

    try {
        console.log('Starting transaction import...');

        // Helper: Parse CSV
        function parseCSV(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            // Handle BOM
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
                headers.forEach((header, index) => {
                    obj[header] = values[index] || null;
                });
                return obj;
            });
        }

        // Helper: Parse Amount
        function parseAmount(amtStr) {
            if (!amtStr) return 0;
            let clean = amtStr.replace(/[£\s]/g, '');
            if (clean.includes(',') && !clean.includes('.')) {
                clean = clean.replace(',', '.');
            } else if (clean.includes(',') && clean.includes('.')) {
                clean = clean.replace(/,/g, '');
            }
            return Math.round(parseFloat(clean) * 100) || 0;
        }

        // Helper: Update Contact
        async function updateContact(email, name, provider) {
            let contact = null;
            if (email) {
                contact = await prisma.contact.findUnique({ where: { email: email.toLowerCase() } });
            } else if (name) {
                contact = await prisma.contact.findFirst({
                    where: { fullName: { equals: name, mode: 'insensitive' } }
                });
            }

            if (contact) {
                const tags = new Set(contact.sourceTags || []);
                tags.add(provider);
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: {
                        status: 'client',
                        sourceTags: Array.from(tags),
                    }
                });
                return contact.id;
            } else {
                const newEmail = email ? email.toLowerCase() : `unknown_${Date.now()}_${Math.random()}@placeholder.com`;
                const newName = name || (email ? email.split('@')[0] : 'Unknown');

                const newContact = await prisma.contact.create({
                    data: {
                        email: newEmail,
                        fullName: newName,
                        status: 'client',
                        sourceTags: [provider],
                    }
                });
                return newContact.id;
            }
        }

        // 1. Import Glofox Transactions
        const glofoxFiles = [
            'Dashboard OS - Glofox Transactions 2023.csv',
            'Dashboard OS - Glofox Transcations 2024.csv',
            'Dashboard OS - Glofox Transactions 2025.csv'
        ];

        for (const file of glofoxFiles) {
            const p = path.join(__dirname, '../../Transactions', file);
            if (fs.existsSync(p)) {
                console.log(`\nImporting Glofox: ${file}...`);
                const rows = parseCSV(p);
                let count = 0;
                for (const row of rows) {
                    if (row.Status !== 'PAID') continue;
                    const amount = parseAmount(row['Amount (GBP)']);
                    const email = row['Email address'];
                    const dateStr = row['Date'];
                    if (!dateStr) continue;

                    const [day, month, year] = dateStr.split('/');
                    const date = new Date(`${year}-${month}-${day}`);
                    if (!email) continue;

                    const contactId = await updateContact(email, null, 'glofox');
                    const extId = row['Transaction ID'] || `glofox_${email}_${date.getTime()}_${amount}`;

                    await prisma.transaction.upsert({
                        where: { externalId: extId },
                        update: {},
                        create: {
                            externalId: extId,
                            contactId,
                            amountMinor: amount,
                            currency: 'GBP',
                            status: 'succeeded',
                            provider: 'glofox',
                            occurredAt: date,
                            productType: row['Plan'] || 'membership',
                            source: 'glofox',
                            confidence: 'high'
                        }
                    });
                    count++;
                    if (count % 100 === 0) process.stdout.write('.');
                }
                console.log(`\n✓ Imported ${count} transactions from ${file}`);
            }
        }

        // 2. Import Stripe Transactions
        const stripePath = path.join(__dirname, '../../Transactions/Dashboard OS - Stripe Transcations All Time.csv');
        if (fs.existsSync(stripePath)) {
            console.log(`\nImporting Stripe from: ${path.basename(stripePath)}...`);
            console.warn('⚠️  WARNING: Stripe CSV appears to be missing "Amount". LTV will be 0.');

            const rows = parseCSV(stripePath);
            let count = 0;
            for (const row of rows) {
                if (row.Status && row.Status.toLowerCase() !== 'paid') continue;
                const email = row['Customer Email'];
                const amount = 0;
                const dateStr = row['Created date (UTC)'];
                if (!dateStr) continue;
                const date = new Date(dateStr);
                const extId = row['id'];

                if (!email) continue;
                const contactId = await updateContact(email, null, 'stripe');

                await prisma.transaction.upsert({
                    where: { externalId: extId },
                    update: {},
                    create: {
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
                if (count % 100 === 0) process.stdout.write('.');
            }
            console.log(`\n✓ Imported ${count} transactions from Stripe`);
        }

        // 3. Import Starling
        const starlingPath = path.join(__dirname, '../../Transactions/Dashboard OS - Starling Transcations.csv');
        if (fs.existsSync(starlingPath)) {
            console.log(`\nImporting Starling from: ${path.basename(starlingPath)}...`);
            const rows = parseCSV(starlingPath);
            let count = 0;
            for (const row of rows) {
                if (row.direction !== 'IN' || row.status !== 'SETTLED') continue;
                const amount = parseAmount(row.amountGBP);
                if (!row.transactionTime) continue;
                const date = new Date(row.transactionTime);
                const extId = row.feedItemUid;

                const name = row.counterPartyName || row.reference;
                if (!name) continue;

                const contactId = await updateContact(null, name, 'starling');

                await prisma.transaction.upsert({
                    where: { externalId: extId },
                    update: {},
                    create: {
                        externalId: extId,
                        contactId,
                        amountMinor: amount,
                        currency: 'GBP',
                        status: 'succeeded',
                        provider: 'starling',
                        occurredAt: date,
                        productType: row.spendingCategory || 'transfer',
                        source: 'starling',
                        confidence: 'high'
                    }
                });
                count++;
                if (count % 100 === 0) process.stdout.write('.');
            }
            console.log(`\n✓ Imported ${count} transactions from Starling`);
        }

        console.log('\n✅ Transaction import completed!');

    } catch (error) {
        console.error('❌ Transaction import failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

importTransactions();
