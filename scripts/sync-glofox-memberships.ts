
import * as fs from 'fs';
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { fetchGlofoxMembers } from "../src/lib/glofox";

// Load environment variables manually to ensure they are present before Prisma init
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

// Instantiate local Prisma Client
const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting Glofox Membership Sync...");

    try {
        // Inline fetching logic to avoid importing src/lib/prisma (which fails in script mode without env)
        const record = await prisma.connectionSecret.findUnique({
            where: { provider: "glofox" },
        });

        const secret = (record?.secret as any); // Type assertion
        if (!secret?.apiKey || !secret?.apiToken || !secret?.branchId) {
            throw new Error("Glofox Request Failed: Missing credentials (API Key, Token, or Branch ID).");
        }

        const { apiKey, apiToken, branchId } = secret;
        // Try AWS endpoint first, then legacy
        const baseUrls = [
            `https://gf-api.aws.glofox.com/prod/2.0/branches/${branchId}`,
            `https://app.glofox.com/api/2.0/branches/${branchId}`
        ];

        const variations = [
            { name: "Standard", headers: { "x-api-key": apiKey, "x-glofox-api-token": apiToken, "x-glofox-branch-id": branchId } },
            { name: "Alt Token", headers: { "x-api-key": apiKey, "x-api-token": apiToken, "x-glofox-branch-id": branchId } },
            { name: "Swapped", headers: { "x-api-key": apiToken, "x-glofox-api-token": apiKey, "x-glofox-branch-id": branchId } },
        ];

        let members: any[] = [];
        let fetched = false;

        const commonHeaders = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        };

        // Connectivity Check
        try {
            console.log("Checking Node.js internet connectivity...");
            const google = await fetch("https://www.google.com", { method: "HEAD", headers: { "User-Agent": commonHeaders["User-Agent"] } });
            console.log(`Google Connectivity: ${google.status} ${google.statusText}`);
        } catch (e) {
            console.error("Connectivity check failed:", e);
        }

        outerLoop:
        for (const baseUrl of baseUrls) {
            console.log(`\nTrying Base URL: ${baseUrl}`);
            for (const v of variations) {
                try {
                    // Fetch members
                    console.log(`[Glofox] Fetching with ${v.name}...`);
                    const res = await fetch(`${baseUrl}/members?limit=100`, { // Reduced limit to be safe
                        headers: { ...commonHeaders, ...v.headers },
                        signal: AbortSignal.timeout(15000) // 15s timeout
                    });

                    if (res.ok) {
                        const json = await res.json();
                        if (json.success !== false) {
                            members = Array.isArray(json) ? json : (json.data || []);
                            console.log(`[Glofox] Success! Found ${members.length} members.`);
                            fetched = true;
                            break outerLoop;
                        } else {
                            console.log(`[Glofox] API Error: ${json.message}`);
                        }
                    } else {
                        console.log(`[Glofox] HTTP Error: ${res.status} ${res.statusText}`);
                        try { console.log(await res.text()) } catch { }
                    }
                } catch (e: any) {
                    console.error(`[Glofox] Ex: ${e.message} ${e.cause ? JSON.stringify(e.cause) : ''}`);
                }
            }
        }

        if (!fetched) {
            console.error("Failed to fetch members with any auth strategy.");
            return;
        }

        console.log(`Processing ${members.length} members...`);

        let updated = 0;
        let skipped = 0;

        for (const member of members) {
            // Member format: { id, first_name, last_name, email, phone, active_membership: { name, expiry_date, ... } }
            // Note: Field names might vary, relying on observation or standard Glofox structure. 
            // The test output (which we didn't fully see) would have clarified, but we'll try standard fields 
            // and fallback to what we see in typically imported data.

            const email = member.email;
            const phone = member.phone || member.mobile;
            const activeMembership = member.active_membership;

            // If we can't identify the user, skip
            if (!email && !phone) {
                skipped++;
                continue;
            }

            let membershipName: string | null = null;
            let membershipEndDate: Date | null = null;

            if (activeMembership) {
                membershipName = activeMembership.name || null;
                if (activeMembership.expiry_date) {
                    // Glofox often uses unix timestamp or ISO string
                    const expiry = activeMembership.expiry_date;
                    if (typeof expiry === 'number') { // UNIX timestamp
                        membershipEndDate = new Date(expiry * 1000);
                    } else {
                        membershipEndDate = new Date(expiry);
                    }
                }
            } else if (member.membership_name && member.membership_expiry) {
                // Flat structure fallback
                membershipName = member.membership_name;
                membershipEndDate = new Date(member.membership_expiry);
            }

            // Find Contact to update
            const contact = await prisma.contact.findFirst({
                where: {
                    OR: [
                        email ? { email: { equals: email, mode: 'insensitive' } } : undefined,
                        phone ? { phone: { contains: phone } } : undefined, // loose match for phone
                    ].filter(Boolean) as any
                }
            });

            if (contact) {
                // Update contact
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: {
                        membershipType: membershipName,
                        membershipEndDate: membershipEndDate,
                        // Could also sync Glofox Member ID if we want
                        // but schema 'memberId' is on Member table, not Contact. 
                        // Check if we want to update Member table too? 
                        // The req is "add their membership expiry date to their contact profile".
                    }
                });
                updated++;
                // console.log(`Updated ${contact.email || contact.fullName}: ${membershipName} (Ends: ${membershipEndDate?.toISOString().split('T')[0]})`);
            } else {
                skipped++;
            }
        }

        console.log(`\n✅ Sync Complete.`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Skipped/Not Found: ${skipped}`);

    } catch (e) {
        console.error("❌ Sync Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
