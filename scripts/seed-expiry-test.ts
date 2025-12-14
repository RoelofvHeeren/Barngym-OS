
import * as fs from 'fs';
import * as path from "path";
import { PrismaClient } from "@prisma/client";

// Load environment variables
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

async function main() {
    console.log("🌱 Seeding test expiry date...");

    // Find a contact, or create one if none exists
    let contact = await prisma.contact.findFirst();

    if (!contact) {
        console.log("No contacts found. Creating a test contact.");
        contact = await prisma.contact.create({
            data: {
                email: "test_expiry@example.com",
                fullName: "Test Expiry User",
                status: "client"
            }
        });
    }

    // Set expiry to 7 days from now (within the 14 day window)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            membershipType: "Test Gold Membership",
            membershipEndDate: nextWeek
        }
    });

    console.log(`✅ Updated contact ${contact.email || contact.fullName} (${contact.id})`);
    console.log(`   Membership: Test Gold Membership`);
    console.log(`   Expiry: ${nextWeek.toISOString()}`);
    console.log("   Check the Dashboard To-Do list and People page for this user.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
