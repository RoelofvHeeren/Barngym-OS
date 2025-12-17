
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Initializing Glofox Member Creation (JS Mode)...");

    // 1. Get Credentials
    let secret = null;
    try {
        const record = await prisma.connectionSecret.findUnique({
            where: { provider: "glofox" },
        });
        secret = record ? record.secret : null;
    } catch (e) {
        console.error("DB Error:", e);
        return;
    }

    if (!secret || !secret.apiKey || !secret.branchId) {
        console.error("❌ Missing Glofox API Key or Branch ID in DB.");
        return;
    }

    const { apiKey, apiToken, branchId } = secret;
    const baseUrl = `https://gf-api.aws.glofox.com/prod/2.0/branches/${branchId}`;

    // 2. Prepare Payload
    const timestamp = Date.now();
    const testEmail = `test.auto.${timestamp}@example.com`;
    const payload = {
        first_name: "TestAuto",
        last_name: `Member_${timestamp}`,
        email: testEmail,
        phone: "+44700000000",
        gender: "Male",
        dob: "1990-01-01"
    };

    console.log(`📝 Creating Member: ${payload.first_name} ${payload.last_name} (${payload.email})`);

    // 3. Send Request
    try {
        const url = `${baseUrl}/users`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "x-glofox-api-token": apiToken,
                "x-glofox-branch-id": branchId
            },
            body: JSON.stringify(payload)
        });

        const txt = await res.text();
        console.log(`📥 Status: ${res.status}`);

        if (res.ok) {
            console.log("✅ Member Created Successfully!");
            // console.log("Response Preview:", txt.slice(0, 200));
            console.log("ID:", JSON.parse(txt).id || JSON.parse(txt)._id);
            console.log("\n⚠️  Wait ~10-30 seconds for the Webhook to arrive and Sync to GHL.");
        } else {
            console.error("❌ Failed to create member.");
            console.error("Response:", txt);
        }

    } catch (e) {
        console.error("❌ Network Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
