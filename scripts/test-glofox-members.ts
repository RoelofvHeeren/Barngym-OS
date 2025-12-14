import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from "@prisma/client";

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
    console.log("Testing Glofox Members API...");

    // Read secret manually since we can't depend on app runtime here comfortably without more setup
    const secretRecord = await prisma.connectionSecret.findUnique({
        where: { provider: "glofox" },
    });

    if (!secretRecord || !secretRecord.secret) {
        console.error("No Glofox secret found.");
        return;
    }

    const secret = secretRecord.secret as any;
    const { apiKey, apiToken, branchId } = secret;

    if (!apiKey || !apiToken || !branchId) {
        console.error("Missing Glofox credentials.");
        return;
    }

    const baseUrl = `https://gf-api.aws.glofox.com/prod/2.0/branches/${branchId}`;
    const url = `${baseUrl}/members?limit=1`;

    const variations = [
        { name: "Standard", headers: { "x-api-key": apiKey, "x-glofox-api-token": apiToken, "x-glofox-branch-id": branchId } },
        { name: "x-api-token", headers: { "x-api-key": apiKey, "x-api-token": apiToken, "x-glofox-branch-id": branchId } },
        { name: "Swapped", headers: { "x-api-key": apiToken, "x-glofox-api-token": apiKey, "x-glofox-branch-id": branchId } },
    ];

    for (const v of variations) {
        console.log(`\nTesting ${v.name}...`);
        try {
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    ...v.headers
                } as any,
            });

            if (!res.ok) {
                console.error(`Error ${res.status}: ${await res.text()}`);
                continue;
            }

            const data = await res.json();
            if (data.success === false) {
                console.log("Response success: false", JSON.stringify(data));
                continue;
            }

            console.log("Success! Sample members:");
            const members = Array.isArray(data) ? data : (data.data || []);

            if (members.length > 0) {
                console.log(JSON.stringify(members[0], null, 2));
                break; // Stop after success
            } else {
                console.log("No members found or unexpected format.");
                console.log(JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error(e);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
