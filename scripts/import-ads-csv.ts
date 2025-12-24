
import { config } from 'dotenv';
config({ path: '.env.local' });
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

// CSV Columns:
// 0: Reporting starts (YYYY-MM-DD)
// 1: Reporting ends
// 2: Campaign name
// ...
// 9: Amount spent (GBP)

const CSV_PATH = path.join(process.cwd(), '..', 'Ads Data.csv');

async function importCsv() {
    console.log(`Reading CSV from ${CSV_PATH}...`);

    if (!fs.existsSync(CSV_PATH)) {
        console.error("File not found!");
        return;
    }

    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(','); // Naive split, assuming no commas in headers (headers are quoted though)

    // Robust CSV parsing for quoted fields
    const parseLine = (line: string) => {
        const res = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                inQuotes = !inQuotes;
            } else if (c === ',' && !inQuotes) {
                res.push(current);
                current = '';
            } else {
                current += c;
            }
        }
        res.push(current);
        return res.map(s => s.trim().replace(/^"|"$/g, ''));
    };

    // Skip header
    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseLine(line);

        // Safety check
        if (cols.length < 10) continue;

        const startDate = new Date(cols[0]);
        const endDate = new Date(cols[1]);
        const campaignName = cols[2];
        const spendStr = cols[9];
        const spendCents = Math.round(parseFloat(spendStr || "0") * 100);

        if (spendCents > 0) {
            // Upsert into AdsSpend
            // Identification key? AdsSpend doesn't have a unique constraint on source/period.
            // We should check if it exists to avoid dupes?
            // Let's use `source` string as a unique key equivalent for this specific import.
            const sourceName = `CSV_FALLBACK_2025_12_24_${campaignName}`;

            // Find existing to update or create
            const existing = await prisma.adsSpend.findFirst({
                where: {
                    source: sourceName,
                    periodStart: startDate,
                    periodEnd: endDate
                }
            });

            if (existing) {
                await prisma.adsSpend.update({
                    where: { id: existing.id },
                    data: { amountCents: spendCents }
                });
            } else {
                await prisma.adsSpend.create({
                    data: {
                        periodStart: startDate,
                        periodEnd: endDate,
                        amountCents: spendCents,
                        currency: 'GBP',
                        source: sourceName
                    }
                });
            }
            importedCount++;
            console.log(`Imported ${campaignName}: £${spendCents / 100}`);
        }
    }
    console.log(`Imported ${importedCount} records.`);
}

importCsv()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
