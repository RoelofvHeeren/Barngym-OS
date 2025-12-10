import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.resolve(__dirname, '../../../Barn Gym Transaction : Member Data/Glofox 5 - 10 dec.csv');
const API_URL = 'https://barngym-os.up.railway.app/api/backfill';

function toIso(value: string): string {
    if (!value) return new Date().toISOString();
    const str = String(value).trim();

    // Handle DD/MM/YYYY format
    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const m = str.match(ddmmyyyy);
    if (m) {
        const [, dd, mm, yyyy] = m;
        const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        return date.toISOString();
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function main() {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
    const rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });

    console.log(`Found ${rows.length} transactions in CSV`);

    const transactions = rows.map((row: any) => {
        const date = row['Date'] || '';
        const time = row['Time'] || '00:00';
        const dateTimeStr = `${date} ${time}`;

        return {
            externalId: `glofox_manual_${date}_${time}_${row['Email address'] || 'unknown'}`.replace(/[^a-zA-Z0-9_]/g, '_'),
            provider: 'Glofox',
            amountMinor: Math.round(parseFloat(row['Amount (GBP)'] || '0') * 100),
            status: row['Status'] || 'PAID',
            occurredAt: toIso(dateTimeStr),
            productType: row['Charge']?.includes('Personal Training') ? 'pt' :
                row['Charge']?.includes('Membership') ? 'classes' :
                    row['Charge']?.includes('Small group') ? 'classes' : 'other',
            personName: row['Member'] || null,
            currency: 'GBP',
            confidence: 'High',
            description: row['Charge'] || '',
            reference: row['Transaction ID'] || null,
            metadata: {
                email: row['Email address'],
                method: row['Method'],
                plan: row['Plan'],
                raw: row
            }
        };
    });

    console.log(`Importing ${transactions.length} transactions to production...`);
    console.log('Sample transaction:', JSON.stringify(transactions[0], null, 2));

    // Note: This would need an authenticated endpoint or we can manually add them via the UI
    console.log('\n⚠️  These transactions need to be added manually via the dashboard UI or by running this script on production.');
    console.log('\nTransactions to add:');
    transactions.forEach((t, i) => {
        console.log(`${i + 1}. ${t.occurredAt.slice(0, 10)} - ${t.personName} - £${(t.amountMinor / 100).toFixed(2)} - ${t.description.slice(0, 50)}`);
    });
}

main().catch(console.error);
