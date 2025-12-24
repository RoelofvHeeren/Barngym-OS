// @ts-nocheck
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// Load Env
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) {
            process.env[key] = rest.join("=").trim();
        }
    }
}

// Now we can import things that rely on env
const { prisma } = require("../src/lib/prisma");
const { attachLead } = require("../src/lib/transactionMatcher");

// Helper to normalize strings
function normalizeEmail(value: unknown): string | null {
    if (!value) return null;
    const cleaned = String(value).trim().toLowerCase();
    return cleaned.length ? cleaned : null;
}

function normalizePhone(value: unknown): string | null {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, "");
    return digits.length ? digits : null;
}

function normalizeName(value: unknown): string | null {
    if (!value) return null;
    const txt = String(value)
        .replace(/[.,]/g, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter(
            (part) =>
                part &&
                !["ltd", "limited", "inc", "llc", "co", "company", "plc", "gmbh"].includes(part)
        );
    if (!txt.length) return null;
    return txt.join(" ");
}

function getField(row: any, keys: string[]): string | null {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) {
            return String(row[key]).trim();
        }
    }
    return null;
}

async function main() {
    const filePath = path.resolve(__dirname, "../../Members/Update Glofox Members.csv");
    console.log(`Reading CSV from ${filePath}...`);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, "utf8");
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });

    console.log(`Found ${rows.length} rows. Starting import...`);

    let created = 0;
    let updated = 0;
    const processedEmails = new Set<string>();

    for (const row of rows) {
        try {
            // Extract fields matchings the CSV headers
            const email = normalizeEmail(getField(row, ["Email", "email"]));
            const phone = normalizePhone(getField(row, ["Phone", "phone"]));
            const firstName = getField(row, ["First Name", "first_name"]);
            const lastName = getField(row, ["Last Name", "last_name"]);
            const membership = getField(row, ["Membership Name", "Membership Plan"]);
            const addedDate = getField(row, ["Added"]);

            // We don't have member ID in this CSV apparently? 
            // The CSV dump shows "Added","First Name"... no "Member ID".
            // Wait, let's double check the CSV headers from the view_file output.
            // Headers: "Added","First Name","Last Name","Email","Phone","Gender","Date of Birth","Street","State","City","Country","Zip Code","Source","Last Contacted","Total Bookings","Last Booking","Total Attendances","Membership Name","Membership Plan","Membership Expiry Date","Credits Remaining","Studio Waiver","Email Consent","SMS Consent"
            // There is NO Glofox Member ID explicitly in the headers. 
            // We will have to rely on Email as the unique key.

            if (!email) {
                // console.warn("Skipping row without email:", firstName, lastName);
                continue;
            }

            processedEmails.add(email);

            const data = {
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                email,
                phone: phone || undefined,
                channel: getField(row, ["Source"]) || "Glofox (CSV)",
                membershipName: membership || undefined,
                primaryMembershipPlan: getField(row, ["Membership Plan"]) || undefined,
                tags: {
                    imported: true,
                    source: "Update Glofox Members.csv",
                    membership: membership,
                    totalBookings: row["Total Bookings"],
                    totalAttendances: row["Total Attendances"],
                },
                metadata: {
                    raw: row,
                    normalizedName: normalizeName(`${firstName ?? ""} ${lastName ?? ""}`),
                },
                // We'll update submissionDate to reflect "Added" if available, or just keep it.
                // Actually, let's not overwrite critical timestamps if they exist.
            };

            // Upsert based on Email (since we lack Glofox ID)
            const existing = await prisma.lead.findFirst({
                where: { email: { equals: email, mode: "insensitive" } },
            });

            if (existing) {
                await prisma.lead.update({
                    where: { id: existing.id },
                    data: {
                        ...data,
                        // Only update empty fields or specific ones? 
                        // The user wants to "add" missing people. 
                        // If they exist, we might update their membership info.
                        membershipName: data.membershipName,
                        primaryMembershipPlan: data.primaryMembershipPlan,
                        // Don't overwrite channel if already set to something else? 
                        // Actually user said "new members... add them". 
                        // Safe to update details.
                    },
                });
                updated++;
            } else {
                await prisma.lead.create({
                    data: {
                        ...data,
                        stage: "New", // Default for new import
                        createdAt: addedDate ? new Date(addedDate) : new Date(),
                    },
                });
                created++;
            }

            if ((created + updated) % 50 === 0) {
                console.log(`Progress: ${created + updated} processed...`);
            }

        } catch (e) {
            console.error("Failed to process row:", row, e);
        }
    }

    console.log(`Import complete. Created: ${created}, Updated: ${updated}`);

    // --- TRANSACTION MAPPING ---
    console.log("Starting Transaction Mapping for unmapped transactions...");

    // Find all unmapped transactions
    const unmapped = await prisma.transaction.findMany({
        where: {
            leadId: null,
            contactId: null,
            NOT: { status: "Failed" } // Retry Failed? Maybe not. Retry Needs Review or Completed.
        },
        // Limit to reasonable batch? Or all? 
        // Let's do all, but fetching might be heavy. 
        // Fetch only needed fields.
        include: {
            lead: false,
            contact: false
        }
    });

    console.log(`Found ${unmapped.length} unmapped transactions.`);

    let mapped = 0;
    for (const tx of unmapped) {
        // We need to construct a "NormalizedTransaction" lookalike or just use attachLead logic
        // attachLead expects NormalizedTransaction but it really just needs metadata/personName.
        // We can cast the prisma transaction to a simplified object for attachLead or just call logic manually.
        // But attachLead is cleaner. 

        // Convert Prisma Record to Normalized (partial)
        const normalized: any = {
            ...tx,
            occurredAt: tx.occurredAt.toISOString(),
            metadata: (tx.metadata as Record<string, unknown>) || {},
            raw: (tx.raw as Record<string, unknown>) || {},
        };

        try {
            const enriched = await attachLead(normalized);
            if (enriched.leadId || enriched.contactId) {
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: {
                        leadId: enriched.leadId,
                        contactId: enriched.contactId,
                        status: enriched.status,
                        confidence: enriched.confidence
                    }
                });
                mapped++;
                // console.log(`Mapped transaction ${tx.externalId} to Lead/Contact ${enriched.leadId || enriched.contactId}`);
            }
        } catch (e) {
            console.error(`Failed to map transaction ${tx.id}`, e);
        }

        if ((mapped > 0 && mapped % 50 === 0)) {
            console.log(`Mapped ${mapped} transactions so far...`);
        }
    }

    console.log(`Mapping complete. Mapped ${mapped} transactions.`);
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
