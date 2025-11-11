"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SyncLog = {
  id: string;
  timestamp: string;
  source: string;
  detail: string;
  records?: string;
  errors?: string | null;
};

const SYNC_LOG_STORAGE_KEY = "barnGymSyncLogs";

export default function ConnectionsPage() {
  const [stripeSecret, setStripeSecret] = useState("");
  const [stripeWebhook, setStripeWebhook] = useState("");
  const [stripeStatus, setStripeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [stripeMessage, setStripeMessage] = useState("");
  const [stripeAccount, setStripeAccount] = useState<string | null>(null);

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
  const [starlingAccount, setStarlingAccount] = useState<string | null>(null);

  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [backfillStatus, setBackfillStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [backfillMessage, setBackfillMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SYNC_LOG_STORAGE_KEY);
      if (stored) {
        const parsed: SyncLog[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSyncLogs(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to hydrate sync logs", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SYNC_LOG_STORAGE_KEY, JSON.stringify(syncLogs));
    } catch (error) {
      console.error("Failed to persist sync logs", error);
    }
  }, [syncLogs]);

  const appendSyncLog = useCallback((entry: Omit<SyncLog, "id" | "timestamp">) => {
    setSyncLogs((prev) => [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ]);
  }, []);

  const formattedLogs = useMemo(
    () =>
      syncLogs.map((log) => ({
        ...log,
        formattedDate: new Date(log.timestamp).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      })),
    [syncLogs]
  );

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
      setStripeAccount(result.accountId ?? null);
      appendSyncLog({
        source: "Stripe",
        detail: `Connection verified${result.accountId ? ` for ${result.accountId}` : ""}.`,
        records: "Credential test",
      });
    } catch (error) {
      setStripeStatus("error");
      setStripeMessage(error instanceof Error ? error.message : "Connection failed.");
      appendSyncLog({
        source: "Stripe",
        detail: "Connection test failed.",
        errors: error instanceof Error ? error.message : "Unknown error",
      });
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
      appendSyncLog({
        source: "Glofox",
        detail: "Credentials verified.",
        records: result.studioId ? `Studio ${result.studioId}` : undefined,
      });
    } catch (error) {
      setGlofoxStatus("error");
      setGlofoxMessage(
        error instanceof Error ? error.message : "Connection failed."
      );
      appendSyncLog({
        source: "Glofox",
        detail: "Connection test failed.",
        errors: error instanceof Error ? error.message : "Unknown error",
      });
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
      setStarlingAccount(result.accountUid ?? null);
      appendSyncLog({
        source: "Starling",
        detail: `Connection verified${result.accountUid ? ` for ${result.accountUid}` : ""}.`,
        records: "Credential test",
      });
    } catch (error) {
      setStarlingStatus("error");
      setStarlingMessage(error instanceof Error ? error.message : "Connection failed.");
      appendSyncLog({
        source: "Starling",
        detail: "Connection test failed.",
        errors: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleBackfill = async () => {
    setBackfillStatus("loading");
    setBackfillMessage("");
    try {
      const response = await fetch("/api/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripe: stripeSecret ? { secretKey: stripeSecret, days: 30 } : undefined,
          starling: starlingToken ? { accessToken: starlingToken, days: 90 } : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Backfill failed.");
      }
      setBackfillStatus("success");
      setBackfillMessage(result.message || "Backfill complete.");
      if (Array.isArray(result.summaries)) {
        result.summaries.forEach((summary: any) => {
          appendSyncLog({
            source: summary.source ?? "Backfill",
            detail: summary.message ?? "Backfill result",
            records:
              typeof summary.records === "number"
                ? `${summary.records} records`
                : summary.records,
            errors: summary.status === "error" ? summary.message : null,
          });
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run backfill.";
      setBackfillStatus("error");
      setBackfillMessage(message);
      appendSyncLog({
        source: "Backfill",
        detail: "Backfill run failed.",
        errors: message,
      });
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
              className={`flex flex-wrap items-center gap-2 text-sm ${
                stripeStatus === "success" ? "text-emerald-700" : "text-amber-600"
              }`}
            >
              <span>{stripeMessage}</span>
              {stripeAccount && (
                <span className="rounded-full border border-emerald-900/20 px-2 py-0.5 text-xs text-muted">
                  {stripeAccount}
                </span>
              )}
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
            <span
              className={`chip text-xs ${
                starlingStatus === "success"
                  ? "text-emerald-200"
                  : starlingStatus === "error"
                  ? "text-amber-200"
                  : "text-muted"
              }`}
            >
              Status ·{" "}
              {starlingStatus === "success"
                ? "Connected"
                : starlingStatus === "error"
                ? "Error"
                : "Not tested"}
            </span>
          </div>
          {starlingStatus !== "idle" && starlingMessage && (
            <p
              className={`flex flex-wrap items-center gap-2 text-sm ${
                starlingStatus === "success" ? "text-emerald-700" : "text-amber-600"
              }`}
            >
              <span>{starlingMessage}</span>
              {starlingAccount && (
                <span className="rounded-full border border-emerald-900/20 px-2 py-0.5 text-xs text-muted">
                  {starlingAccount}
                </span>
              )}
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
          <div className="flex flex-col gap-2">
            <button
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={handleBackfill}
              disabled={backfillStatus === "loading"}
            >
              {backfillStatus === "loading"
                ? "Backfill running..."
                : "Backfill now (90d Starling / 30d Stripe)"}
            </button>
            {backfillStatus !== "idle" && backfillMessage && (
              <p
                className={`text-sm ${
                  backfillStatus === "success" ? "text-emerald-700" : "text-amber-600"
                }`}
              >
                {backfillMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted">
            Sync Logs
          </p>
          <h3 className="text-2xl font-semibold">Sync Logs</h3>
          <p className="text-sm text-muted">
            Every job recorded. Logs persist locally until cleared.
          </p>
        </div>
        {formattedLogs.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-muted">
            No sync activity yet. Run a connection test or backfill to generate entries.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  {["Date", "Source", "Detail", "Records", "Errors"].map((header) => (
                    <th key={header} className="pb-3 pr-4 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {formattedLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 pr-4 text-muted">{log.formattedDate}</td>
                    <td className="pr-4 font-semibold text-primary">{log.source}</td>
                    <td className="pr-4 text-muted">{log.detail}</td>
                    <td className="pr-4">{log.records ?? "—"}</td>
                    <td className="pr-4 text-amber-600">{log.errors ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
