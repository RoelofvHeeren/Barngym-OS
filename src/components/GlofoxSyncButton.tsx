
"use client";

import { useState } from "react";

export function GlofoxSyncButton() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleSync = async () => {
        if (!confirm("This will fetch recent transactions (last 30 days) from Glofox. Continue?")) return;

        setLoading(true);
        setMessage("Syncing...");

        try {
            const res = await fetch("/api/sync/glofox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ days: 30 })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Sync failed");

            setMessage(`Success: Added ${json.added} new transactions.`);
            setTimeout(() => setMessage(""), 5000);
        } catch (err) {
            console.error(err);
            setMessage(`Error: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-4">
            <button
                onClick={handleSync}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
                {loading ? "Syncing..." : "Sync Glofox Data"}
            </button>
            {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
    );
}
