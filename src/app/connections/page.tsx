"use client";

import { useState } from "react";

const syncLogs = [
  { date: "09 Sep · 07:30", source: "Stripe", records: "142 charges", errors: "0" },
  { date: "09 Sep · 07:02", source: "Glofox", records: "88 memberships", errors: "0" },
  { date: "09 Sep · 06:50", source: "Starling", records: "24 feed items", errors: "2 needs review" },
];

export default function ConnectionsPage() {
  const [stripeSecret, setStripeSecret] = useState("");
  const [stripeWebhook, setStripeWebhook] = useState("");
  const [stripeStatus, setStripeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [stripeMessage, setStripeMessage] = useState("");

  const [glofoxKey, setGlofoxKey] = useState("");
  const [glofoxToken, setGlofoxToken] = useState("");
  const [glofoxStudio, setGlofoxStudio] = useState("");
  const [glofoxSalt, setGlofoxSalt] = useState("");
  const [glofoxStatus, setGlofoxStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [glofoxMessage, setGlofoxMessage] = useState<string>("");

  const [starlingToken, setStarlingToken] = useState("");
  const [starlingWebhookUrl, setStarlingWebhookUrl] = useState("");
  const [starlingStatus, setStarlingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [starlingMessage, setStarlingMessage] = useState("");

  const testStripeConnection = async () => {
    if (!stripeSecret.trim()) {
      setStripeStatus("error");
      setStripeMessage("Stripe secret key is required.");
      return;
    }
    setStripeStatus("loading");
    setStripeMessage("");
    try {
      const response = await fetch("/api/integrations/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey: stripeSecret,
          webhookSecret: stripeWebhook,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to verify Stripe.");
      }
      setStripeStatus("success");
      setStripeMessage(result.message || "Stripe connection verified.");
    } catch (error) {
      setStripeStatus("error");
      setStripeMessage(error instanceof Error ? error.message : "Connection failed.");
    }
  };

  const testGlofoxConnection = async () => {
    if (!glofoxKey.trim() || !glofoxToken.trim()) {
      setGlofoxStatus("error");
      setGlofoxMessage("API key and token are required.");
      return;
    }
    setGlofoxStatus("loading");
    setGlofoxMessage("");
    try {
      const response = await fetch("/api/integrations/glofox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: glofoxKey,
          apiToken: glofoxToken,
          studioId: glofoxStudio,
          webhookSalt: glofoxSalt,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Connection failed");
      }
      setGlofoxStatus("success");
      setGlofoxMessage(result.message || "Connection succeeded.");
    } catch (error) {
      setGlofoxStatus("error");
      setGlofoxMessage(
        error instanceof Error ? error.message : "Connection failed."
      );
    }
  };

  const testStarlingConnection = async () => {
    if (!starlingToken.trim()) {
      setStarlingStatus("error");
      setStarlingMessage("Personal access token is required.");
      return;
    }
    setStarlingStatus("loading");
    setStarlingMessage("");
    try {
      const response = await fetch("/api/integrations/starling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: starlingToken,
          webhookUrl: starlingWebhookUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to verify Starling.");
      }
      setStarlingStatus("success");
      setStarlingMessage(result.message || "Starling connection verified.");
    } catch (error) {
      setStarlingStatus("error");
      setStarlingMessage(error instanceof Error ? error.message : "Connection failed.");
    }
  };

  return (
    <div className="flex flex-col gap-8 text-primary">
      <section className="glass-panel flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.35em] text-muted">
          Connections
        </p>
        <h1 className="text-3xl font-semibold">Integrations Control Room</h1>
        <p className="text-sm text-muted">
          Paste keys, click test, see confidence immediately. Onboarding should take a minute.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Stripe</p>
            <h3 className="mt-2 text-2xl font-semibold">Payment Core</h3>
            <p className="text-sm text-muted">
              Secret keys stay encrypted. Webhook signature verified on ingest.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Stripe Secret Key"
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
              value={stripeSecret}
              onChange={(event) => setStripeSecret(event.target.value)}
            />
            <input
              type="password"
              placeholder="Webhook Signing Secret"
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
              value={stripeWebhook}
              onChange={(event) => setStripeWebhook(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={testStripeConnection}
              disabled={stripeStatus === "loading"}
            >
              {stripeStatus === "loading" ? "Testing..." : "Test Connection"}
            </button>
            <span
              className={`chip text-xs ${
                stripeStatus === "success"
                  ? "text-emerald-200"
                  : stripeStatus === "error"
                  ? "text-amber-200"
                  : "text-muted"
              }`}
            >
              Status ·{" "}
              {stripeStatus === "success"
                ? "Connected"
                : stripeStatus === "error"
                ? "Error"
                : "Not tested"}
            </span>
          </div>
          {stripeStatus !== "idle" && stripeMessage && (
            <p
              className={`text-sm ${
                stripeStatus === "success" ? "text-emerald-700" : "text-amber-600"
              }`}
            >
              {stripeMessage}
            </p>
          )}
        </div>

        <div className="glass-panel flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Glofox</p>
            <h3 className="mt-2 text-2xl font-semibold">Studio Ops</h3>
            <p className="text-sm text-muted">
              API or CSV fallback. Choose the access model that fits your contract.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="API Key"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
              value={glofoxKey}
              onChange={(event) => setGlofoxKey(event.target.value)}
            />
            <input
              type="text"
              placeholder="API Token"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
              value={glofoxToken}
              onChange={(event) => setGlofoxToken(event.target.value)}
            />
          </div>
          <input
            type="text"
            placeholder="Studio ID (optional)"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
            value={glofoxStudio}
            onChange={(event) => setGlofoxStudio(event.target.value)}
          />
          <input
            type="text"
            placeholder="Webhook Signature Salt (optional)"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
            value={glofoxSalt}
            onChange={(event) => setGlofoxSalt(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={testGlofoxConnection}
              disabled={glofoxStatus === "loading"}
            >
              {glofoxStatus === "loading" ? "Testing..." : "Test Connection"}
            </button>
            <button className="chip text-xs">Upload CSV Export</button>
            <button className="chip text-xs">Schedule daily import</button>
          </div>
          {glofoxStatus !== "idle" && (
            <p
              className={`text-sm ${
                glofoxStatus === "success" ? "text-emerald-700" : "text-amber-600"
              }`}
            >
              {glofoxMessage ||
                (glofoxStatus === "success"
                  ? "Connection succeeded."
                  : "Unable to verify connection.")}
            </p>
          )}
        </div>

        <div className="glass-panel flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">
              Starling Bank
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Bank Feed</h3>
            <p className="text-sm text-muted">
              Personal Access Token or OAuth as a TPP. Webhooks keep reconciliations fresh.
            </p>
          </div>
          <select className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-primary">
            <option className="bg-[#031018] text-primary">Personal Access Token</option>
            <option className="bg-[#031018] text-primary">OAuth / Marketplace</option>
          </select>
          <input
            type="password"
            placeholder="Starling Personal Access Token"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
            value={starlingToken}
            onChange={(event) => setStarlingToken(event.target.value)}
          />
          <input
            type="text"
            placeholder="Webhook URL (optional)"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
            value={starlingWebhookUrl}
            onChange={(event) => setStarlingWebhookUrl(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-emerald-300" defaultChecked />
            Enable Webhooks
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={testStarlingConnection}
              disabled={starlingStatus === "loading"}
            >
              {starlingStatus === "loading" ? "Testing..." : "Validate & Save"}
            </button>
            <span className="chip text-xs text-amber-200">
              Status · Token expiring in 6 days
            </span>
          </div>
          {starlingStatus !== "idle" && starlingMessage && (
            <p
              className={`text-sm ${
                starlingStatus === "success" ? "text-emerald-700" : "text-amber-600"
              }`}
            >
              {starlingMessage}
            </p>
          )}
        </div>

        <div className="glass-panel flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">
              Matching Rules
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Confidence Engine</h3>
            <p className="text-sm text-muted">
              Define reference priority + auto-link thresholds.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Auto-link threshold</span>
              <span className="font-semibold text-emerald-200">0.85</span>
            </div>
            <input type="range" min="0.5" max="1" step="0.01" defaultValue="0.85" className="mt-3 w-full" />
            <p className="mt-2 text-xs text-muted">
              Anything below remains in review queue.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">
              Reference priority
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-primary">
              <li>Invoice number</li>
              <li>Member ID</li>
              <li>Email stem</li>
              <li>Fuzzy name + amount</li>
            </ol>
          </div>
          <button className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white">
            Backfill now (90 days Starling / 30 days Stripe + Glofox)
          </button>
        </div>
      </section>

      <section className="glass-panel">
        <div className="flex flex-col gap-1">
          <h3 className="text-2xl font-semibold">Sync Logs</h3>
          <p className="text-sm text-muted">
            Every job recorded. Filter by source when needed.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                {["Date", "Source", "Records Synced", "Errors"].map((header) => (
                  <th key={header} className="pb-3 pr-4 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {syncLogs.map((log) => (
                <tr key={log.date}>
                  <td className="py-4 pr-4 text-muted">{log.date}</td>
                  <td className="pr-4 font-semibold">{log.source}</td>
                  <td className="pr-4">{log.records}</td>
                  <td className="pr-4 text-amber-200">{log.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
