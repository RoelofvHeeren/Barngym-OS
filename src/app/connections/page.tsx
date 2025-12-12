"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlofoxSyncButton } from "@/components/GlofoxSyncButton";

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

  const [ghlKey, setGhlKey] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlStatus, setGhlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [ghlMessage, setGhlMessage] = useState("");

  const [metaToken, setMetaToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaStatus, setMetaStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [metaMessage, setMetaMessage] = useState("");

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

      const ghl = data.ghl;
      if (ghl) {
        if (ghl.status === "connected") {
          setGhlStatus("success");
          setGhlMessage(
            ghl.accountId
              ? `Location ${ghl.accountId} linked.`
              : "GHL API key stored."
          );
        }
      }

      const meta = data.meta;
      if (meta) {
        if (meta.status === "connected") {
          setMetaStatus("success");
          setMetaMessage(
            meta.accountId ? `Ad account ${meta.accountId} connected.` : "Meta access token stored."
          );
          if (meta.accountId) {
            setMetaAdAccountId(meta.accountId);
          }
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

  const statusBadge = (status: "idle" | "loading" | "success" | "error") => {
    if (status === "loading") return <span className="text-amber-200 text-xs">Testing…</span>;
    if (status === "success") return <span className="text-emerald-200 text-xs">Connected</span>;
    if (status === "error") return <span className="text-rose-200 text-xs">Failed</span>;
    return <span className="text-muted text-xs">Not connected</span>;
  };

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
          branchId: glofoxStudio,
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
      if (result.branchId) {
        setGlofoxStudio(result.branchId);
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

  const testGhlConnection = async () => {
    setGhlStatus("loading");
    setGhlMessage("");
    try {
      const response = await fetch("/api/connections/ghl/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: ghlKey,
          locationId: ghlLocationId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to verify GoHighLevel.");
      }
      setGhlStatus("success");
      setGhlMessage(result.message || "GoHighLevel connected.");
      if (result.locationId) {
        setGhlLocationId(result.locationId);
      }
      setGhlKey("");
      await refreshConnectionState();
      await refreshLogs();
    } catch (error) {
      setGhlStatus("error");
      setGhlMessage(error instanceof Error ? error.message : "Connection failed.");
      await refreshLogs();
    }
  };

  const saveGhlConnection = async () => {
    setGhlStatus("loading");
    setGhlMessage("");
    try {
      const response = await fetch("/api/connections/ghl/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: ghlKey,
          locationId: ghlLocationId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to save GoHighLevel connection.");
      }
      setGhlStatus("success");
      setGhlMessage(result.message || "GoHighLevel credentials saved.");
      setGhlKey("");
      await refreshConnectionState();
      await refreshLogs();
    } catch (error) {
      setGhlStatus("error");
      setGhlMessage(error instanceof Error ? error.message : "Save failed.");
      await refreshLogs();
    }
  };

  const testMetaConnection = async () => {
    setMetaStatus("loading");
    setMetaMessage("");
    try {
      const response = await fetch("/api/connections/meta/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: metaToken,
          adAccountId: metaAdAccountId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to verify Meta Ads.");
      }
      setMetaStatus("success");
      setMetaMessage(result.message || "Meta Ads connected.");
      if (result.adAccountId) {
        setMetaAdAccountId(result.adAccountId);
      }
      setMetaToken("");
      await refreshConnectionState();
      await refreshLogs();
    } catch (error) {
      setMetaStatus("error");
      setMetaMessage(error instanceof Error ? error.message : "Connection failed.");
      await refreshLogs();
    }
  };

  const saveMetaConnection = async () => {
    setMetaStatus("loading");
    setMetaMessage("");
    try {
      const response = await fetch("/api/connections/meta/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: metaToken,
          adAccountId: metaAdAccountId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to save Meta Ads connection.");
      }
      setMetaStatus("success");
      setMetaMessage(result.message || "Meta Ads credentials saved.");
      setMetaToken("");
      await refreshConnectionState();
      await refreshLogs();
    } catch (error) {
      setMetaStatus("error");
      setMetaMessage(error instanceof Error ? error.message : "Save failed.");
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
    <div className="flex flex-col gap-8 text-primary w-full max-w-full min-w-0 overflow-x-hidden">
      <section className="glass-panel flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.35em] text-muted">Connections</p>
        <h1 className="text-3xl font-semibold">Integrations Control Room</h1>
        <p className="text-sm text-muted">
          Paste keys, click test, see confidence immediately. Onboarding should take a minute.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Stripe</p>
              <h3 className="mt-2 text-2xl font-semibold">Payment Core</h3>
              <p className="text-sm text-muted">Secret keys stay encrypted. Webhook signature verified on ingest.</p>
            </div>
            {statusBadge(stripeStatus)}
          </div>
          <div className="space-y-3">
            <input type="password" placeholder="Stripe Secret Key" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={stripeSecret} onChange={(event) => setStripeSecret(event.target.value)} />
            <input type="password" placeholder="Webhook Signing Secret" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={stripeWebhook} onChange={(event) => setStripeWebhook(event.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={testStripeConnection} disabled={stripeStatus === "loading"}>
              {stripeStatus === "loading" ? "Testing..." : "Test Connection"}
            </button>
          </div>
          {stripeStatus !== "idle" && stripeMessage && (
            <p className={`flex flex-wrap items-center gap-2 text-sm ${stripeStatus === "success" ? "text-emerald-700" : "text-amber-600"}`}>
              <span>{stripeMessage}</span>
              {stripeAccount && <span className="rounded-full border border-emerald-900/20 px-2 py-0.5 text-xs text-muted">{stripeAccount}</span>}
            </p>
          )}
          {connectionState.stripe?.hasSecret && stripeStatus !== "error" && <p className="text-xs text-muted">Secret stored securely on the server.</p>}
        </div>

        <div className="glass-panel flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Glofox</p>
              <h3 className="mt-2 text-2xl font-semibold">Studio Ops</h3>
              <p className="text-sm text-muted">API + Token ingests all membership and payment data from Glofox.</p>
            </div>
            {statusBadge(glofoxStatus)}
          </div>
          <div className="space-y-3">
            <input type="password" placeholder="API Key" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={glofoxKey} onChange={(event) => setGlofoxKey(event.target.value)} />
            <input type="password" placeholder="API Token" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={glofoxToken} onChange={(event) => setGlofoxToken(event.target.value)} />
            <input type="text" placeholder="Studio / Branch ID (optional)" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={glofoxStudio} onChange={(event) => setGlofoxStudio(event.target.value)} />
            <input type="password" placeholder="Webhook Salt (for signatures)" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={glofoxSalt} onChange={(event) => setGlofoxSalt(event.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={testGlofoxConnection} disabled={glofoxStatus === "loading"}>
              {glofoxStatus === "loading" ? "Testing..." : "Test Connection"}
            </button>
            <GlofoxSyncButton />
          </div>
          {glofoxStatus !== "idle" && glofoxMessage && (
            <p className={`flex flex-wrap items-center gap-2 text-sm ${glofoxStatus === "success" ? "text-emerald-700" : "text-amber-600"}`}>
              <span>{glofoxMessage}</span>
              {glofoxStudio && <span className="rounded-full border border-emerald-900/20 px-2 py-0.5 text-xs text-muted">{glofoxStudio}</span>}
            </p>
          )}
          {connectionState.glofox?.hasSecret && glofoxStatus !== "error" && (
            <p className="text-xs text-muted">Webhook salt validates HMAC signatures on incoming events.</p>
          )}
        </div>

        <div className="glass-panel flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Starling</p>
              <h3 className="mt-2 text-2xl font-semibold">Bank Feeds</h3>
              <p className="text-sm text-muted">Token + webhook URL ingests feed items as transactions.</p>
            </div>
            {statusBadge(starlingStatus)}
          </div>
          <div className="space-y-3">
            <input type="password" placeholder="Starling Access Token" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={starlingToken} onChange={(event) => setStarlingToken(event.target.value)} />
            <input type="text" placeholder="Webhook URL" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={starlingWebhookUrl} onChange={(event) => setStarlingWebhookUrl(event.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={testStarlingConnection} disabled={starlingStatus === "loading"}>
              {starlingStatus === "loading" ? "Testing..." : "Test Connection"}
            </button>
          </div>
          {starlingStatus !== "idle" && starlingMessage && (
            <p className={`flex flex-wrap items-center gap-2 text-sm ${starlingStatus === "success" ? "text-emerald-700" : "text-amber-600"}`}>
              <span>{starlingMessage}</span>
              {starlingAccount && <span className="rounded-full border border-emerald-900/20 px-2 py-0.5 text-xs text-muted">{starlingAccount}</span>}
            </p>
          )}
          {connectionState.starling?.hasSecret && starlingStatus !== "error" && (
            <p className="text-xs text-muted">Token stored securely on the server.</p>
          )}
        </div>

        <div className="glass-panel flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Ads & CRM</p>
              <h3 className="mt-2 text-2xl font-semibold">GoHighLevel</h3>
              <p className="text-sm text-muted">Store your GHL API key and optional location ID. Keys are encrypted.</p>
            </div>
            {statusBadge(ghlStatus)}
          </div>
          <div className="space-y-3">
            <input type="password" placeholder="GoHighLevel API Key" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={ghlKey} onChange={(event) => setGhlKey(event.target.value)} />
            <input type="text" placeholder="Location ID (optional)" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={ghlLocationId} onChange={(event) => setGhlLocationId(event.target.value)} />
          </div>
          {ghlMessage && <p className="text-xs text-muted">{ghlMessage}</p>}
          <div className="flex items-center gap-3">
            <button className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={saveGhlConnection} disabled={ghlStatus === "loading" || (!ghlKey && !ghlLocationId)}>
              {ghlStatus === "loading" ? "Saving..." : "Save"}
            </button>
            <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-primary disabled:opacity-50" onClick={testGhlConnection} disabled={ghlStatus === "loading"}>
              {ghlStatus === "loading" ? "Testing..." : "Test"}
            </button>
          </div>
        </div>

        <div className="glass-panel flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Ads</p>
              <h3 className="mt-2 text-2xl font-semibold">Meta Ads</h3>
              <p className="text-sm text-muted">Add your Meta access token and ad account ID. Stored encrypted for insights.</p>
            </div>
            {statusBadge(metaStatus)}
          </div>
          <div className="space-y-3">
            <input type="password" placeholder="Meta Access Token" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={metaToken} onChange={(event) => setMetaToken(event.target.value)} />
            <input type="text" placeholder="Ad Account ID (e.g. act_123456789)" className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm" value={metaAdAccountId} onChange={(event) => setMetaAdAccountId(event.target.value)} />
          </div>
          {metaMessage && <p className="text-xs text-muted">{metaMessage}</p>}
          <div className="flex items-center gap-3">
            <button className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={saveMetaConnection} disabled={metaStatus === "loading" || (!metaToken && !metaAdAccountId)}>
              {metaStatus === "loading" ? "Saving..." : "Save"}
            </button>
            <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-primary disabled:opacity-50" onClick={testMetaConnection} disabled={metaStatus === "loading"}>
              {metaStatus === "loading" ? "Testing..." : "Test"}
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Backfill</p>
            <h3 className="mt-2 text-2xl font-semibold">Historical Ingest</h3>
            <p className="text-sm text-muted">Optional: fetch historical transactions from Stripe/Starling using short-lived keys.</p>
          </div>
          <button className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-primary disabled:opacity-50" onClick={handleBackfill} disabled={backfillStatus === "loading"}>
            {backfillStatus === "loading" ? "Running..." : "Run Backfill"}
          </button>
        </div>
        {backfillMessage && (
          <p className={`text-sm ${backfillStatus === "success" ? "text-emerald-200" : "text-amber-200"}`}>
            {backfillMessage}
          </p>
        )}
      </section>

      <section className="glass-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Sync Activity</h3>
            <span className="text-xs text-muted">Recent connection tests and ingests</span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {formattedLogs.length === 0 && <p className="text-sm text-muted">No recent sync events.</p>}
          {formattedLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-primary">{log.source}</span>
                <span className="text-muted">{log.detail}</span>
              </div>
              <div className="flex flex-col items-end text-xs text-muted">
                <span>{log.formattedDate}</span>
                {log.records ? <span>Records: {log.records}</span> : null}
                {log.errors ? <span className="text-amber-300">Error: {log.errors}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
