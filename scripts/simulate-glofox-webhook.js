
// Removed node-fetch import, using native fetch
async function main() {
    const url = "https://barngym-os.up.railway.app/api/webhooks/glofox";
    console.log("🧪 Simulating Glofox Webhook Event...");
    console.log(`📡 Sending to: ${url}`);

    const payload = {
        Type: "INVOICE_UPDATED",
        id: "SIMULATED_TEST_" + Date.now(),
        user: { first_name: "Simulated", last_name: "Tester" },
        line_items: [
            { name: "Simulated Item", unit_price: 100, quantity: 1 }
        ],
        total: 100,
        currency: "GBP"
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
