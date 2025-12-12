
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Starting Glofox Debug...");

    const record = await prisma.connectionSecret.findUnique({
        where: { provider: "glofox" },
    });
    const secret = (record?.secret as any);
    const { apiKey, apiToken } = secret;

    console.log(`\n🔐 Credentials Check:`);
    console.log(`   API Key: '${apiKey}' (Length: ${apiKey.length})`);
    console.log(`   API Token: '${apiToken}' (Length: ${apiToken.length})`);
    if (apiToken.trim() !== apiToken) console.warn("   ⚠️ WARNING: API Token has leading/trailing whitespace!");

    const branchIdVariations = [
        "6387329792aa3afe480951f7",
        "Barn-Gym - LIVE"
    ];

    const daysToSync = 365; // Widen to 1 year
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - daysToSync);

    const endpoints = [
        "transactions",
        "payments",
        "invoices",
        "charges",
        "sales",
        "memberships",
        "subscriptions"
    ];

    // Query variations
    const variations = [
        { name: "No Params", params: {} },
        { name: "Standard (from/to)", params: { from: fromDate.toISOString().split("T")[0], to: toDate.toISOString().split("T")[0] } },
        { name: "Start/End Date", params: { start_date: fromDate.toISOString().split("T")[0], end_date: toDate.toISOString().split("T")[0] } },
        { name: "Date From/To", params: { date_from: fromDate.toISOString().split("T")[0], date_to: toDate.toISOString().split("T")[0] } },
        { name: "Created From", params: { created_from: fromDate.toISOString().split("T")[0] } },
        { name: "Since", params: { since: fromDate.toISOString().split("T")[0] } },
        { name: "Min Date", params: { min_date: fromDate.toISOString().split("T")[0] } },
    ];

    const authHeaderVariations = [
        { name: "x-glofox-api-token", headers: { "x-api-key": apiKey, "x-glofox-api-token": apiToken } },
        { name: "x-api-token", headers: { "x-api-key": apiKey, "x-api-token": apiToken } },
        { name: "Basic Auth", headers: { "Authorization": "Basic " + Buffer.from(apiKey + ":" + apiToken).toString("base64") } },
        { name: "With Integrator Header", headers: { "x-api-key": apiKey, "x-glofox-api-token": apiToken, "x-glofox-integrator": "Barn-Gym - LIVE" } },
        { name: "SWAPPED Credentials", headers: { "x-api-key": apiToken, "x-glofox-api-token": apiKey } }
    ];

    for (const bId of branchIdVariations) {
        console.log(`\n🧪 Testing Branch ID: '${bId}'`);
        // We know /transactions fails without ID, so if we pass ID in header/url and get 200, we win.
        const baseUrl = `https://gf-api.aws.glofox.com/prod/2.0/branches/${bId}`;
        // const baseUrl = `https://app.glofox.com/api/2.0/branches/${bId}`;

        for (const auth of authHeaderVariations) {
            console.log(`   🔑 Auth Style: ${auth.name}`);

            // Test simpler endpoint first
            const url = `${baseUrl}/transactions?limit=1`;
            try {
                const res = await fetch(url, {
                    headers: {
                        "Content-Type": "application/json",
                        "x-glofox-branch-id": bId, // Some endpoints need this header
                        ...(auth.headers as any) // Explicit cast to avoid HeadersInit mismatch
                    },
                    agent: agent
                } as any);
                const json = await res.json();
                if (json.success === false) {
                    console.log(`      ❌ Error: ${json.message}`);
                } else if (res.ok) {
                    console.log(`      ✅ SUCCESS! Status: ${res.status}`);
                    const raw = Array.isArray(json) ? json : (json.data || json.transactions || []);
                    console.log(`      📦 Records: ${raw.length}`);
                } else {
                    console.log(`      ❌ Http Error: ${res.status}`);
                }
            } catch (e: any) {
                console.log(`      ❌ Exception: ${e.message}`);
            }
        }

        const specificMemberId = "63c91be78b199df76d01892a";
        console.log(`\n🧪 Testing Specific Member Fetch: ${specificMemberId}`);
        try {
            const url = `${baseUrl}/members/${specificMemberId}`;
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "x-glofox-api-token": apiToken,
                    "x-glofox-branch-id": bId,
                },
            });
            const txt = await res.text();
            console.log(`   Status: ${res.status}`);
            console.log(`   Body: ${txt.slice(0, 500)}`);
        } catch (e) { console.error(e); }

        for (const endpoint of endpoints) {
            console.log(`\n--- Endpoint: /${endpoint} ---`);
            for (const v of variations) {
                // console.log(`   Variations: ${v.name}`);
                const queryParams = new URLSearchParams({
                    limit: "5",
                    sort: "desc",
                    ...v.params,
                });
                const url = `${baseUrl}/${endpoint}?${queryParams.toString()}`;

                try {
                    const res = await fetch(url, {
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": apiKey,
                            "x-glofox-api-token": apiToken,
                            "x-glofox-branch-id": bId,
                        },
                    });

                    const json = await res.json();

                    // Explicitly check for Glofox "soft" errors
                    if (json.success === false) {
                        console.log(`   ❌ API Error (200 OK): ${json.message}`);
                        // If token is invalid, no point trying other variations for this endpoint
                        break;
                    }

                    if (res.ok) {
                        const rawData = Array.isArray(json) ? json : (json.data || json.results || json.transactions || json.payments || json.sales || json.bookings || []);

                        if (rawData.length > 0) {
                            console.log(`   ✅ SUCCESS! Found ${rawData.length} items in /${endpoint} using '${v.name}'`);
                            console.log(JSON.stringify(rawData[0], null, 2).slice(0, 500));
                        } else {
                            // console.log(`   (Empty) /${endpoint} with ${v.name}`);
                        }
                    } else {
                        // console.log(`   ❌ Failed: ${res.status}`);
                    }
                } catch (e) {
                    // console.error(e);
                }
            }
        }
    }

    // Test Analytics/Report Endpoint (User suggestion)
    console.log("\n🧪 Testing POST /Analytics/report ...");
    const reportUrl = "https://gf-api.aws.glofox.com/prod/2.0";

    // Only test report if we have at least one branch ID and dates
    if (typeof branchIdVariations !== 'undefined' && branchIdVariations.length > 0 && typeof fromDate !== 'undefined') {
        try {
            const body = {
                branch_id: branchIdVariations[0],
                namespace: "barngym", // specific to this gym/webhook
                start: fromDate.toISOString().split("T")[0],
                end: toDate.toISOString().split("T")[0],
                filter: {
                    ReportByMembers: true
                }
            };
            console.log("Posting to Report:", `${reportUrl}/Analytics/report`, JSON.stringify(body));

            const res = await fetch(`${reportUrl}/Analytics/report`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "x-glofox-api-token": apiToken,
                    "x-glofox-branch-id": branchIdVariations[0],
                },
                body: JSON.stringify(body)
            });

            const txt = await res.text();
            console.log(`   Report Status: ${res.status}`);
            console.log(`   Report Body: ${txt.slice(0, 500)}`);

        } catch (e) { console.error("Report Error", e); }
    }
}

main().catch(console.error);
