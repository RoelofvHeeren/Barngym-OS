
import { prisma } from "@/lib/prisma";

async function main() {
    console.log("🚀 Testing GHL Connection...");

    // 1. Get Credentials
    const record = await prisma.connectionSecret.findUnique({
        where: { provider: "ghl" }
    });
    const secret = record?.secret as any;

    if (!secret?.apiKey) {
        console.error("❌ No GHL API Key found in DB.");
        return;
    }

    console.log(`🔑 Using API Key: ${secret.apiKey.slice(0, 5)}...`);
    console.log(`📍 Location ID: ${secret.locationId || "None"}`);

    // 2. Try to Upsert a Test Contact
    const payload = {
        email: "ghl.test." + Date.now() + "@example.com",
        phone: "+447999999999",
        firstName: "GHL",
        lastName: "ConnectionTest",
        tags: ["API Test"]
    };

    try {
        const url = "https://services.leadconnectorhq.com/contacts/upsert";
        console.log(`📡 Sending request to: ${url}`);

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${secret.apiKey}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const txt = await res.text();
        console.log(`📥 Status: ${res.status}`);

        if (res.ok) {
            console.log("✅ GHL Connection Successful!");
            console.log("Response:", txt.slice(0, 500));
        } else {
            console.error("❌ GHL Request Failed.");
            console.error("Response:", txt);
        }

    } catch (e) {
        console.error("❌ Network Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
