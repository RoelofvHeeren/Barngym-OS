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

type ConnectionState = {
  status: string | null;
  accountId: string | null;
  lastVerifiedAt: string | null;
  hasSecret: boolean;
};

type SyncLogResponse = {
  id: string;
  source: string;
  detail: string;
  records: string | null;
  errors: string | null;
  createdAt: string;
};

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
  const [connectionState, setConnectionState] = useState<Record<string, ConnectionState>>({});

  const refreshConnectionState = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/state");
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Unable to load connection state.");
      }
      const data = (payload.data ?? {}) as Record<string, ConnectionState>;
      setConnectionState(data);

      const stripe = data.stripe;
      if (stripe) {
        setStripeAccount(stripe.accountId ?? null);
        if (stripe.status === "connected") {
          setStripeStatus("success");
          setStripeMessage(
            `Stored securely${stripe.accountId ? ` · ${stripe.accountId}` : ""}`
          );
        }
      }

      const glofox = data.glofox;
      if (glofox) {
        if (glofox.status === "connected") {
          setGlofoxStatus("success");
          setGlofoxMessage(
            glofox.accountId
              ? `Studio ${glofox.accountId} linked.`
              : "Credentials stored securely."
          );
        }
      }

      const starling = data.starling;
      if (starling) {
        setStarlingAccount(starling.accountId ?? null);
        if (starling.status === "connected") {
          setStarlingStatus("success");
          setStarlingMessage(
            starling.accountId
              ? `Bank feed ready (${starling.accountId}).`
              : "Bank feed ready."
          );
        }
      }
    } catch (error) {
      console.error("Failed to refresh connection state", error);
    }
  }, []);

  const refreshLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/sync-logs");
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Unable to load sync logs.");
      }
      const logs: SyncLogResponse[] = Array.isArray(payload.data)
        ? payload.data
        : [];
      setSyncLogs(
        logs.map((log) => ({
          id: log.id,
          timestamp: new Date(log.createdAt).toISOString(),
          source: log.source,
          detail: log.detail,
          records: log.records ?? undefined,
          errors: log.errors ?? undefined,
        }))
      );
    } catch (error) {
      console.error("Failed to load sync logs", error);
    }
  }, []);

  useEffect(() => {
    refreshConnectionState();
  }, [refreshConnectionState]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

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
      setStripeSecret("");
      setStripeWebhook("");
      await refreshConnectionState();
      await refreshLogs();
    } catch (error) {
      setStripeStatus("error");
      setStripeMessage(error instanceof Error ? error.message : "Connection failed.");
      await refreshLogs();
    }
  };

  const testGlofoxConnection = async () => {
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
      setGlofoxKey("");
      setGlofoxToken("");
      if (result.studioId) {
        setGlofoxStudio(result.studioId);
      }
      setGlofoxSalt("");
      await refreshConnectionState();
      await refreshLogs();
    } catch (error) {
      setGlofoxStatus("error");
      setGlofoxMessage(
        error instanceof Error ? error.message : "Connection failed."
      );
      await refreshLogs();
    }
  };

  const testStarlingConnection = async () => {
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
      setStarlingToken("");
      setStarlingWebhookUrl("");
      await refreshConnectionState();
      await refreshLogs();
    } catch (error) {
      setStarlingStatus("error");
      setStarlingMessage(error instanceof Error ? error.message : "Connection failed.");
      await refreshLogs();
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
      await refreshLogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run backfill.";
      setBackfillStatus("error");
      setBackfillMessage(message);
      await refreshLogs();
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
          {connectionState.stripe?.hasSecret && stripeStatus !== "error" && (
            <p className="text-xs text-muted">Secret stored securely on the server.</p>
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
          {connectionState.glofox?.hasSecret && glofoxStatus !== "error" && (
            <p className="text-xs text-muted">Credentials stored securely.</p>
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
          {connectionState.starling?.hasSecret && starlingStatus !== "error" && (
            <p className="text-xs text-muted">Token stored securely.</p>
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
