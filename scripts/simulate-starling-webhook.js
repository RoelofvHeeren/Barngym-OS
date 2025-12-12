
const PROD_URL = "https://barngym-os.up.railway.app";
const FEED_ITEM_PATH = "/api/webhooks/starling/feed-item";

async function main() {
    console.log("🧪 Simulating Starling Webhook Event...");

    // Sample "Feed Item" payload from Starling docs
    const payload = {
        "feedItem": {
            "feedItemUid": "test-uuid-" + Date.now(),
            "categoryUid": "test-cat-uid",
            "amount": { "currency": "GBP", "minorUnits": 123 },
            "sourceAmount": { "currency": "GBP", "minorUnits": 123 },
            "direction": "OUT",
            "updatedAt": new Date().toISOString(),
            "transactionTime": new Date().toISOString(),
            "settlementTime": new Date().toISOString(),
            "retryAllocationUntilTime": new Date().toISOString(),
            "source": "FASTER_PAYMENTS_IN",
            "sourceSubType": "UNKNOWN",
            "status": "SETTLED",
            "counterPartyType": "SENDER",
            "counterPartyUid": "test-counterparty",
            "counterPartyName": "Test Sender",
            "counterPartySubEntityUid": "test-sub-uid",
            "counterPartySubEntityName": "Test Sub Entity",
            "counterPartySubEntityIdentifier": "123456",
            "counterPartySubEntitySubIdentifier": "12345678",
            "reference": "Test Webhook",
            "country": "GB",
            "spendingCategory": "PAYMENTS",
            "userNote": "Test Note"
        }
    };

    const targetUrl = `${PROD_URL}${FEED_ITEM_PATH}`;
    console.log(`📡 Sending to: ${targetUrl}`);

    try {
        const res = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const txt = await res.text();
        console.log(`📥 Status: ${res.status}`);
        console.log(`📝 Response: ${txt}`);

        if (res.ok) {
            console.log("✅ Simulation SUCCESS! The endpoint is listening and accepted the data.");
        } else {
            console.log("❌ Simulation FAILED. Endpoint rejected the request.");
        }
    } catch (e) {
        console.error("❌ Simulation FAILED (Network Error):", e);
    }
}

main();
