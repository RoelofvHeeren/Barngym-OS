
import * as fs from 'fs';
import * as path from "path";
import { PrismaClient } from "@prisma/client";

// Load environment variables manually
function loadEnv() {
    const envPath = path.resolve(__dirname, "../.env.local");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) process.env[key] = rest.join("=")?.trim();
    }
}

loadEnv();

const prisma = new PrismaClient();

// CSV Parser Helper
function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Format: DD/MM/YYYY e.g., 20/06/2026 or 31/12/2025
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    // Validate date logic
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        return null;
    }

    return date;
}

async function main() {
    const csvPath = path.resolve(__dirname, "../../Members/Dashboard OS - Glofox Members.csv");

    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found at: ${csvPath}`);
        process.exit(1);
    }

    console.log(`📖 Reading CSV from: ${csvPath}`);
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    if (lines.length < 2) {
        console.error("❌ CSV file is empty or has no data.");
        process.exit(1);
    }

    // Header mapping (based on file view)
    // 0: Added, 1: First Name, 2: Last Name, 3: Email ... 
    // 17: Membership Name, 18: Membership Plan, 19: Membership Expiry Date

    const headers = parseCSVLine(lines[0]);
    const emailIdx = headers.indexOf('Email');
    const nameIdx = headers.indexOf('Membership Name');
    const expiryIdx = headers.indexOf('Membership Expiry Date');
    const creditsIdx = headers.indexOf('Credits Remaining');

    console.log(`Headers found: Email=${emailIdx}, Name=${nameIdx}, Expiry=${expiryIdx}`);

    if (emailIdx === -1 || expiryIdx === -1) {
        console.error("❌ Critical columns missing (Email or Membership Expiry Date)");
        process.exit(1);
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line);
        const email = cols[emailIdx];
        const membershipName = cols[nameIdx];
        const expiryStr = cols[expiryIdx];
        const credits = cols[creditsIdx]; // Optional: Could be useful later

        if (!email) {
            skippedCount++;
            continue;
        }

        const expiryDate = parseDate(expiryStr);

        // Normalize data for update
        const updateData: any = {};
        let needsUpdate = false;

        if (membershipName) {
            updateData.membershipType = membershipName.replace(/^"|"$/g, ''); // Remove quotes if stuck
            needsUpdate = true;
        }

        if (expiryDate) {
            updateData.membershipEndDate = expiryDate;
            needsUpdate = true;
        }

        // Also if we have no expiry but it's a known membership, maybe clear it? 
        // For now, only update if we have new values.

        if (needsUpdate) {
            try {
                // Find contact first to see if it exists
                const contact = await prisma.contact.findFirst({
                    where: { email: { equals: email, mode: 'insensitive' } }
                });

                if (contact) {
                    await prisma.contact.update({
                        where: { id: contact.id },
                        data: updateData
                    });
                    process.stdout.write(`✅ Updated ${email} -> ${expiryStr || 'No Expiry'}\n`);
                    updatedCount++;
                } else {
                    // console.warn(`⚠️ Contact not found: ${email}`);
                    notFoundCount++;
                }
            } catch (err: any) {
                console.error(`❌ Error updating ${email}: ${err.message}`);
            }
        } else {
            skippedCount++;
        }
    }

    console.log("\n-------------------------------------------");
    console.log(`Summary:`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⚠️ Not Found: ${notFoundCount}`);
    console.log(`⏩ Skipped (No Data/Email): ${skippedCount}`);
    console.log("-------------------------------------------");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
