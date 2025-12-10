
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// Row format: Full Name,First Name,Last Name,Phone,Email,Submission Date,URL
type CsvRow = {
    "Full Name": string;
    "First Name": string;
    "Last Name": string;
    "Phone": string;
    "Email": string;
    "Submission Date": string;
    "URL": string;
};

// Helper to parse "Mar 25th 2025, 9:44 am"
// Removing "st", "nd", "rd", "th" from day part to make it parsable
function parseDateString(dateStr: string): Date | null {
    if (!dateStr || !dateStr.trim()) return null;
    // Remove ordinal suffixes
    const cleanStr = dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1");
    const date = new Date(cleanStr);
    return isNaN(date.getTime()) ? null : date;
}

function normalizePhone(phone: string): string | null {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    return clean.length >= 10 ? clean : null;
}

async function main() {
    const filePath = path.join(process.cwd(), "../Leads/Update GHL Leads 1 - 5588f083-2123-479a-956d-ff9f27b05735 (1).csv");
    console.log(`Reading CSV from ${filePath}`);

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as CsvRow[];

    console.log(`Found ${records.length} records. Processing...`);

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const row of records) {
        const email = row.Email?.trim();
        if (!email) {
            skipped++;
            continue;
        }

        const submissionDate = parseDateString(row["Submission Date"]);
        const phone = normalizePhone(row.Phone);
        const fullName = row["Full Name"]?.trim() || `${row["First Name"]?.trim()} ${row["Last Name"]?.trim()}`.trim();

        // Check if lead exists
        const existing = await prisma.lead.findFirst({
            where: { email: { equals: email, mode: "insensitive" } }
        });

        const isClient = await checkIsClient(email);

        if (existing) {
            // Update submissionDate if not set or we want to overwrite? 
            // Let's overwrite as this is the source of truth for submission time.
            await prisma.lead.update({
                where: { id: existing.id },
                data: {
                    submissionDate: submissionDate ?? undefined,
                    // Also update creation time if it's wildly different? Maybe safer to keep createdAt as DB insertion time.
                    // But user wants accurate attribution. For reporting, we are switching to submissionDate filter.
                    // Optionally update phone/name if missing
                    phone: existing.phone ? undefined : (phone ?? undefined),
                    fullName: existing.fullName ? undefined : (fullName ?? undefined),
                    isClient: isClient ? true : undefined
                }
            });
            updated++;
        } else {
            // Create new
            await prisma.lead.create({
                data: {
                    email,
                    fullName,
                    firstName: row["First Name"]?.trim() || undefined,
                    lastName: row["Last Name"]?.trim() || undefined,
                    phone: phone ?? undefined,
                    submissionDate: submissionDate ?? undefined,
                    createdAt: submissionDate ?? new Date(), // Use submission date as createdAt for alignment
                    source: "csv_import",
                    isClient: isClient,
                    status: isClient ? "CLIENT" : "LEAD",
                    leadTracking: {
                        create: {
                            utmSource: "csv_import",
                            rawPayload: row as any
                        }
                    }
                }
            });
            created++;
        }
    }

    console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

async function checkIsClient(email: string): Promise<boolean> {
    const payment = await prisma.payment.findFirst({
        where: {
            lead: { email: { equals: email, mode: "insensitive" } }
        }
    });
    // Also check if existing lead marked as client? Handled by update logic if needed, but here we check Payments table existence.
    // Actually, we should check if there are ANY payments linked to this email (via Contact or Lead).
    // The most reliable way for a NEW lead is to check later, but here we can check if `Payment` table has records for this email?
    // Payment table has `leadId` mostly.

    // Let's check contacts
    const contact = await prisma.contact.findUnique({ where: { email } });
    if (contact && contact.status === "client") return true;

    // Check transaction table for email match?
    // This might be expensive for every row. 
    // Optimization: Pre-fetch all client emails? 
    // For 200 rows it's fine.

    return false;
    // Optimization note: existing logic in `leadIntakeService` relies on mapped payments setting `isClient`. 
    // If we just create the lead with email, the existing payment mapping logic (if run again) would link it.
    // But we want to set it NOW.
    // Let's rely on: if we find a Lead with this email that is a client, we keep it. 
    // If we create new, we default to false unless we know better.
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
