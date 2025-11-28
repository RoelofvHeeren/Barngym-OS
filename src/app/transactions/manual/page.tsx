/* eslint-disable react/no-array-index-key */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type QueueItem = {
  id: string;
  reason: string;
  suggestedMemberIds: string[] | null;
  createdAt: string;
  transaction: {
    id: string;
    occurredAt: string;
    amountMinor: number;
    currency: string;
    provider: string;
    productType: string | null;
    personName: string | null;
    reference: string | null;
    status: string | null;
    confidence: string | null;
    metadata?: unknown;
    raw?: unknown;
  } | null;
};

function formatCurrency(minorUnits: number, currency: string) {
  const amount = minorUnits / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function formatDateTime(isoString: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function ManualMatchPage() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leadIdInput, setLeadIdInput] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/manual-match");
        const payload = await response.json();
        if (!payload.ok) {
          throw new Error(payload.message || "Failed to load queue");
        }
        setQueue(payload.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load queue");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAttach = async (queueId: string, leadId: string | undefined) => {
    if (!leadId) return;
    const response = await fetch("/api/manual-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attach", queueId, leadId }),
    });
    const payload = await response.json();
    if (!payload.ok) {
      alert(payload.message || "Failed to attach");
      return;
    }
    setQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  const handleCreate = async (queueId: string) => {
    setCreating((prev) => ({ ...prev, [queueId]: true }));
    const response = await fetch("/api/manual-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", queueId }),
    });
    const payload = await response.json();
    setCreating((prev) => ({ ...prev, [queueId]: false }));
    if (!payload.ok) {
      alert(payload.message || "Failed to create and attach");
      return;
    }
    setQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  const filteredQueue = useMemo(() => queue, [queue]);

  return (
    <div className="flex flex-col gap-6 text-primary">
      <section className="glass-panel flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Manual Matching</p>
            <h1 className="text-3xl font-semibold">Resolve Unmatched Payments</h1>
            <p className="text-sm text-muted">
              Attach payments to members. Occurred dates are shown. Suggestions are listed when available.
            </p>
          </div>
          <Link href="/transactions" className="text-emerald-200 underline">
            Back to ledger
          </Link>
        </div>
      </section>

      <section className="glass-panel">
        {loading ? (
          <div className="text-muted">Loading queue…</div>
        ) : error ? (
          <div className="text-rose-200">{error}</div>
        ) : !filteredQueue.length ? (
          <div className="text-muted">No manual matches pending.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Occurred</th>
                  <th className="pb-3 pr-4 font-medium">Amount</th>
                  <th className="pb-3 pr-4 font-medium">Source</th>
                  <th className="pb-3 pr-4 font-medium">Person / Reference</th>
                  <th className="pb-3 pr-4 font-medium">Suggested</th>
                  <th className="pb-3 pr-4 font-medium">Attach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQueue.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4 text-muted">
                      {item.transaction ? formatDateTime(item.transaction.occurredAt) : "—"}
                    </td>
                    <td className="pr-4 font-semibold text-primary">
                      {item.transaction
                        ? formatCurrency(item.transaction.amountMinor, item.transaction.currency ?? "GBP")
                        : "—"}
                    </td>
                    <td className="pr-4 text-muted">
                      {item.transaction?.provider ?? "Unknown"}
                      {item.transaction?.productType ? ` · ${item.transaction.productType}` : ""}
                    </td>
                  <td className="pr-4 text-muted">
                    {item.transaction?.personName ?? "Unassigned"}
                    <div className="text-xs text-muted">
                      Ref: {item.transaction?.reference ?? "—"} · Reason: {item.reason}
                      {item.transaction?.metadata &&
                        typeof item.transaction.metadata === "object" &&
                        (item.transaction.metadata as Record<string, unknown>).raw &&
                        (() => {
                          const raw = (item.transaction?.metadata as Record<string, unknown>)
                            .raw as Record<string, unknown>;
                          const email = raw?.["Email"] as string | undefined;
                          const phone = raw?.["Phone"] as string | undefined;
                          return (
                            <div className="text-xs text-muted">
                              {email ? ` · Email: ${email}` : ""} {phone ? ` · Phone: ${phone}` : ""}
                            </div>
                          );
                        })()}
                    </div>
                  </td>
                  <td className="pr-4 text-xs text-muted">
                    {item.suggestedMemberIds?.length
                      ? item.suggestedMemberIds.join(", ")
                        : "None"}
                    </td>
                    <td className="pr-4">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Lead ID"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-primary"
                          value={leadIdInput[item.id] ?? ""}
                          onChange={(e) =>
                            setLeadIdInput((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                          onClick={() => handleAttach(item.id, leadIdInput[item.id])}
                        >
                          Attach
                        </button>
                        <button
                          className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-primary"
                          onClick={() => handleCreate(item.id)}
                          disabled={creating[item.id]}
                        >
                          {creating[item.id] ? "Creating…" : "Create lead & attach"}
                        </button>
                        <div className="text-[11px] text-muted">
                          Tip: paste a Lead ID or pick from suggestions. After attach, this disappears.
                        </div>
                      </div>
                    </td>
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
