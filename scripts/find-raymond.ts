
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.local") });

const prisma = new PrismaClient();

async function main() {
    const query = "Raymond Miles";
    console.log(`Searching for: ${query}`);

    const contacts = await prisma.contact.findMany({
        where: {
            OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: "rmiles", mode: "insensitive" } }
            ]
        },
        include: {
            transactions: true
        }
    });

    console.log(`Found ${contacts.length} contacts.`);
    for (const c of contacts) {
        console.log("------------------------------------------------");
        console.log(`ID: ${c.id}`);
        console.log(`Name: ${c.fullName}`);
        console.log(`Email: ${c.email}`);
        console.log(`Source Tags:`, c.sourceTags);
        console.log(`Created At: ${c.createdAt.toISOString()}`);
        console.log(`First Seen: ${c.firstSeenAt?.toISOString()}`);
        console.log(`Segment Tags:`, c.segmentTags);
        console.log(`Status: ${c.status}`);
        console.log(`LTV: ${c.ltvAllCents}`);
        console.log(`Has Transactions: ${c.transactions.length}`);
    }

    console.log("\n--- Checking Lead Table ---");
    const leads = await prisma.lead.findMany({
        where: {
            OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: "rmiles", mode: "insensitive" } }
            ]
        }
    });
    console.log(`Found ${leads.length} leads.`);
    for (const l of leads) {
        console.log(`ID: ${l.id}`);
        console.log(`Name: ${l.fullName}`);
        console.log(`Email: ${l.email}`);
        console.log(`Tags:`, l.tags); // Check if this field exists on Lead
        console.log(`Source:`, l.source);
        console.log(`Created At: ${l.createdAt.toISOString()}`);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
