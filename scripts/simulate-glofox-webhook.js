
// Removed node-fetch import, using native fetch
async function main() {
    const url = "https://barngym-os.up.railway.app/api/webhooks/glofox";
    console.log("🧪 Simulating Glofox Webhook Event...");
    console.log(`📡 Sending to: ${url}`);

    const payload = {
        Type: "MEMBER_CREATED",
        id: "VALID_TEST_" + Date.now(),
        member_id: "VALID_TEST_" + Date.now(),
        first_name: "Valid",
        last_name: "TestUser",
        email: "valid.test." + Date.now() + "@example.com",
        phone: "+447700900000",
        created: new Date().toISOString()
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // "x-glofox-signature": "invalid_sig_for_test" // Should be logged but accepted now
            },
            body: JSON.stringify(payload)
        });

        const txt = await res.text();
        console.log(`📥 Status: ${res.status}`);
        console.log(`📝 Response: ${txt}`);

        if (res.ok) {
            console.log("✅ Simulation SUCCESS! The endpoint is listening and accepted the data.");
        } else {
            console.log("❌ Simulation FAILED! Server rejected the request.");
        }
    } catch (e) {
        console.error("❌ Network Error:", e.message);
    }
}

main();
