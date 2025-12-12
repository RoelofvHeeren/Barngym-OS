
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PROD_URL = "https://barngym-os.up.railway.app";
const WEBHOOK_PATH = "/api/webhooks/starling";

async function main() {
    console.log("🚀 Setting up Starling Webhook...");

    const record = await prisma.connectionSecret.findUnique({ where: { provider: "starling" } });
    const secret = (record?.secret as any);

    if (!secret?.accessToken) {
        console.error("❌ No Starling Access Token found in database.");
        return;
    }

    // 1. Get Account UID (Needed for webhook?)
    // Actually, Starling webhooks are often set PER ACCESS TOKEN or PER ACCOUNT.
    // Let's try to list webhooks first.
    // Endpoint: GET /api/v2/webhooks (if available) or check docs.
    // Standard Starling: PUT /api/v2/webhook (singular?)

    // Let's try hitting the basic account info first to verify token.
    const accountRes = await fetch("https://api.starlingbank.com/api/v2/accounts", {
        headers: { "Authorization": `Bearer ${secret.accessToken}` }
    });

    if (!accountRes.ok) {
        console.error("❌ Failed to fetch accounts:", await accountRes.text());
        return;
    }

    const accountData = await accountRes.json();
    const accounts = accountData.accounts;
    if (!accounts || accounts.length === 0) {
        console.error("❌ No accounts found.");
        return;
    }

    console.log(`✅ Found ${accounts.length} account(s).`);

    // 2. Register Webhook
    // According to docs, we add a webhook for the specific account or client?
    // Usually it's `PUT /api/v2/webhook` with the URL.

    // Let's try generating a webhook secret? Or just setting the URL?
    // Starling 'Personal Access Token' webhooks might need manual setup in the portal?
    // But let's try the API.

    const targetUrl = `${PROD_URL}${WEBHOOK_PATH}`;
    console.log(`📡 Registering webhook URL: ${targetUrl}`);

    const webhookPayload = {
        "url": targetUrl,
    };

    const webhookRes = await fetch("https://api.starlingbank.com/api/v2/webhook", {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${secret.accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(webhookPayload)
    });

    if (webhookRes.ok) {
        console.log("✅ Webhook registered successfully!");
    } else {
        console.log("⚠️ Could not register webhook via API (This is common for Personal Tokens).");
        console.log("👉 Response:", await webhookRes.text());
        console.log("\n📋 INSTRUCTIONS:");
        console.log("1. Go to Starling Developer Portal.");
        console.log("2. Edit your Personal Access Token.");
        console.log(`3. specific 'Webhook URL' to: ${targetUrl}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
