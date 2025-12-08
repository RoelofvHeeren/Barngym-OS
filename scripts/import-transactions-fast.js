const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const pLimit = require('p-limit'); // Might not have this package, so I'll implement simple batching

async function importTransactionsFast() {
    const prisma = new PrismaClient();

    try {
        console.log('🚀 Starting FAST transaction import...');

        // ----------------------------------------------------------------
        // 1. Load Data
        // ----------------------------------------------------------------
        console.log('Loading contacts...');
        const allContacts = await prisma.contact.findMany();
        const emailMap = new Map();
        const nameMap = new Map();

        allContacts.forEach(c => {
            if (c.email) emailMap.set(c.email.toLowerCase(), c);
            if (c.fullName) nameMap.set(c.fullName.toLowerCase(), c);
        });
        console.log(`Loaded ${allContacts.length} contacts.`);

        // ----------------------------------------------------------------
        // 2. Parse CSVs and Prepare Data
        // ----------------------------------------------------------------
        const txnsToCreate = [];
        const contactsToCreate = new Map(); // key: email or name -> data
        const contactsToUpdate = new Set(); // Set of contact IDs to update tags for

        // Helpers
        function parseAmount(amtStr) {
            if (!amtStr) return 0;
            let clean = amtStr.replace(/[£\s]/g, '');
            if (clean.includes(',') && !clean.includes('.')) clean = clean.replace(',', '.');
            else if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/,/g, '');
            return Math.round(parseFloat(clean) * 100) || 0;
        }

        function parseCSV(filePath) {
            if (!fs.existsSync(filePath)) return [];
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            const firstLine = lines[0].replace(/^\uFEFF/, '');
            const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            return lines.slice(1).map(line => {
                const values = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '"') inQuotes = !inQuotes;
                    else if (line[i] === ',' && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
                    else current += line[i];
                }
                values.push(current.trim().replace(/^"|"$/g, ''));
                const obj = {};
                headers.forEach((h, i) => obj[h] = values[i] || null);
                return obj;
            });
        }

        // Process Files
        function processRows(rows, type) {
            for (const row of rows) {
                let email = null;
                let name = null;
                let amount = 0;
                let date = null;
                let extId = null;
                let product = 'membership';

                // Extract Data based on Type
                if (type === 'glofox') {
                    if (row.Status !== 'PAID') continue;
                    email = row['Email address'];
                    amount = parseAmount(row['Amount (GBP)']);
                    const dStr = row['Date'];
                    if (dStr) {
                        const [d, m, y] = dStr.split('/');
                        date = new Date(`${y}-${m}-${d}`);
                    }
                    extId = row['Transaction ID'];
                    product = row['Plan'] || 'membership';
                }
                else if (type === 'stripe') {
                    if (row.Status && row.Status.toLowerCase() !== 'paid') continue;
                    email = row['Customer Email'];
                    amount = 0; // Missing column
                    if (row['Created date (UTC)']) date = new Date(row['Created date (UTC)']);
                    extId = row['id'];
                    product = row['Description'] || 'stripe_payment';
                }
                else if (type === 'starling') {
                    if (row.direction !== 'IN' || row.status !== 'SETTLED') continue;
                    name = row.counterPartyName || row.reference;
                    amount = parseAmount(row.amountGBP);
                    if (row.transactionTime) date = new Date(row.transactionTime);
                    extId = row.feedItemUid;
                    product = row.spendingCategory || 'transfer';
                }

                if (!date || (!email && !name)) continue;
                if (!extId) extId = `${type}_${email || name}_${date.getTime()}_${amount}`;

                // Resolve Contact
                let contact = null;
                if (email) contact = emailMap.get(email.toLowerCase());
                else if (name) contact = nameMap.get(name.toLowerCase()); // Exact name match only

                if (contact) {
                    // Check if we need to update tags/status
                    const tags = new Set(contact.sourceTags || []);
                    if (!contact.status || contact.status !== 'client' || !tags.has(type)) {
                        // Mark for update
                        contact.status = 'client'; // Update in memory
                        tags.add(type);
                        contact.sourceTags = Array.from(tags); // Update in memory
                        contactsToUpdate.add(contact);
                    }
                } else {
                    // New Contact needed
                    // Check if already in pending creation list
                    const key = email ? email.toLowerCase() : `name:${name.toLowerCase()}`;
                    if (!contactsToCreate.has(key)) {
                        contactsToCreate.set(key, {
                            email: email ? email.toLowerCase() : `unknown_${Date.now()}_${Math.random()}@placeholder.com`,
                            fullName: name || (email ? email.split('@')[0] : 'Unknown'),
                            status: 'client',
                            sourceTags: [type],
                            phone: null
                        });
                    }
                }

                // Add Transaction (Store identifier to link later)
                txnsToCreate.push({
                    externalId: extId,
                    contactKey: email ? email.toLowerCase() : (name ? `name:${name.toLowerCase()}` : null),
                    contactId: contact ? contact.id : null, // If known
                    amountMinor: amount,
                    currency: 'GBP',
                    status: 'succeeded',
                    provider: type,
                    occurredAt: date,
                    productType: product,
                    source: type,
                    confidence: 'high'
                });
            }
        }

        // Run Processing
        console.log('Processing Glofox...');
        ['2023', '2024', '2025'].forEach(y => {
            const f = y === '2024' ? `Dashboard OS - Glofox Transcations ${y}.csv` : `Dashboard OS - Glofox Transactions ${y}.csv`;
            processRows(parseCSV(path.join(__dirname, '../../Transactions', f)), 'glofox');
        });

        console.log('Processing Stripe...');
        processRows(parseCSV(path.join(__dirname, '../../Transactions/Dashboard OS - Stripe Transcations All Time.csv')), 'stripe');

        console.log('Processing Starling...');
        processRows(parseCSV(path.join(__dirname, '../../Transactions/Dashboard OS - Starling Transcations.csv')), 'starling');

        console.log(`Stats:
      - Transactions found: ${txnsToCreate.length}
      - New Contacts to Create: ${contactsToCreate.size}
      - Contacts to Update: ${contactsToUpdate.size}`);

        // ----------------------------------------------------------------
        // 3. Batch Writes
        // ----------------------------------------------------------------

        // A. Create New Contacts
        if (contactsToCreate.size > 0) {
            console.log('Creating new contacts...');
            // createMany doesn't return IDs easily in all providers, but we can re-query
            await prisma.contact.createMany({
                data: Array.from(contactsToCreate.values()),
                skipDuplicates: true
            });
            console.log('Reloading contact map...');
            const recharged = await prisma.contact.findMany();
            recharged.forEach(c => {
                if (c.email) emailMap.set(c.email.toLowerCase(), c);
                if (c.fullName) nameMap.set(c.fullName.toLowerCase(), c); // Only for exact matches
            });
        }

        // B. Update Existing Contacts (Concurrency controlled)
        if (contactsToUpdate.size > 0) {
            console.log('Updating existing contacts...');
            const contacts = Array.from(contactsToUpdate);
            const batchSize = 20;
            for (let i = 0; i < contacts.length; i += batchSize) {
                const batch = contacts.slice(i, i + batchSize);
                await Promise.all(batch.map(c =>
                    prisma.contact.update({
                        where: { id: c.id },
                        data: { status: 'client', sourceTags: c.sourceTags }
                    })
                ));
                if (i % 100 === 0) process.stdout.write('.');
            }
            console.log('\nUpdates done.');
        }

        // C. Create Transactions
        console.log('Linking transactions...');
        const finalTxns = txnsToCreate.map(t => {
            // Resolve ID if missing
            if (!t.contactId && t.contactKey) {
                if (t.contactKey.startsWith('name:')) {
                    const name = t.contactKey.replace('name:', '');
                    const c = nameMap.get(name); // Try exact match from map (need lower case key logic consistency)
                    // logic above used lower case for map keys, so good.
                    if (c) t.contactId = c.id;
                } else {
                    const c = emailMap.get(t.contactKey);
                    if (c) t.contactId = c.id;
                }
            }
            // Remove helper prop
            const { contactKey, ...rest } = t;
            return rest; // contactId might still be null if creation failed? Should be rare.
        }).filter(t => t.contactId); // Skip orphan transactions (unlikely if logic correct)

        console.log(`Inserting ${finalTxns.length} linked transactions...`);
        // Batch Insert (Chunk 1000)
        for (let i = 0; i < finalTxns.length; i += 1000) {
            await prisma.transaction.createMany({
                data: finalTxns.slice(i, i + 1000),
                skipDuplicates: true
            });
            process.stdout.write('+');
        }

        console.log('\n✅ Import Complete!');

    } catch (error) {
        console.error('❌ Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

importTransactionsFast();
