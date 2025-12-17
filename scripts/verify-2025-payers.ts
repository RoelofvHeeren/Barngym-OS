
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function verify2025Transactions() {
    console.log("Starting verification for 2025 transactions...");

    // Date range for 2025
    const startOfYear = new Date('2025-01-01T00:00:00.000Z');
    const endOfYear = new Date('2025-12-31T23:59:59.999Z');

    // Find all transactions in 2025
    const transactions = await prisma.transaction.findMany({
        where: {
            occurredAt: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        include: {
            contact: true,
            lead: true
        }
    });

    console.log(`Found ${transactions.length} total transactions in 2025.`);

    // Aggregate by person
    const personMap = new Map();

    for (const t of transactions) {
        let type = 'unknown';
        let id = 'unknown';
        let name = t.personName || 'Unknown';
        let email = 'unknown';
        let phone = 'unknown';

        if (t.contact) {
            type = 'contact';
            id = t.contact.id;
            name = t.contact.fullName || name;
            email = t.contact.email || email;
            phone = t.contact.phone || phone;
        } else if (t.lead) {
            type = 'lead';
            id = t.lead.id;
            name = t.lead.fullName || name;
            email = t.lead.email || email;
            phone = t.lead.phone || phone;
        } else {
            // Try to identify unmapped people by name if possible, but keep separate
            type = 'unmapped';
            id = `unmapped_${name}`;
        }

        // Create a unique key for the map
        const key = `${type}:${id}`;

        if (!personMap.has(key)) {
            personMap.set(key, {
                type,
                id,
                name,
                email,
                phone,
                txCount: 0,
                totalAmount: 0,
                sources: new Set()
            });
        }

        const entry = personMap.get(key);
        entry.txCount += 1;
        entry.totalAmount += (t.amountMinor || 0);
        entry.sources.add(t.provider || t.source);
    }

    // Convert to list
    const results = Array.from(personMap.values())
        .filter(r => r.type !== 'unknown') // Filter out completely unknown if needed, but 'unmapped_name' is useful
        .sort((a, b) => b.totalAmount - a.totalAmount); // Sort by spend

    console.log(`Identified ${results.length} unique paying individuals.`);

    // Generate CSV
    // Name, Email, Phone, TxCount, TotalSpend
    const csvRows = [
        'Name,Email,Phone,Transaction Count,Total Spend (GBP),Sources'
    ];

    results.forEach(r => {
        const spend = (r.totalAmount / 100).toFixed(2);
        const sources = Array.from(r.sources).join(';');
        // Escape quotes in name
        const safeName = r.name ? `"${r.name.replace(/"/g, '""')}"` : 'Unknown';
        const safePhone = r.phone !== 'unknown' ? r.phone : 'N/A';
        const safeEmail = r.email !== 'unknown' ? r.email : 'N/A';

        csvRows.push(`${safeName},${safeEmail},${safePhone},${r.txCount},${spend},${sources}`);
    });

    const fileName = 'verify_2025.csv';
    fs.writeFileSync(fileName, csvRows.join('\n'));
    console.log(`Results written to ${fileName}`);
}

verify2025Transactions()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
