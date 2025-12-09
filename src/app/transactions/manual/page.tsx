/* eslint-disable react/no-array-index-key */
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

type LeadOption = {
  id: string;
  label: string;
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

function extractContactHint(metadata?: unknown) {
  if (!metadata || typeof metadata !== "object") return { email: null, phone: null };
  const meta = metadata as Record<string, unknown>;
  const raw = (meta.raw as Record<string, unknown> | undefined) ?? undefined;
  const email =
    (raw?.["Email"] as string | undefined) ||
    (meta.email as string | undefined) ||
    (meta.customerEmail as string | undefined) ||
    null;
  const phone = (raw?.["Phone"] as string | undefined) || (meta.phone as string | undefined) || null;
  return { email, phone };
}

return { email, phone };
}

const getDisplayName = (item: QueueItem) => {
  if (item.transaction?.provider?.toLowerCase() === "starling") {
    const raw = (item.transaction.raw as Record<string, unknown>) ?? {};
    const counterPartyName = (raw.counterPartyName || raw.counterpartyName) as string | undefined;
    return counterPartyName || item.transaction?.personName || "Unknown";
  }
  return item.transaction?.personName || "Unassigned";
};

export default function ManualMatchPage() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leadIdInput, setLeadIdInput] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<Record<string, boolean>>({});
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "name-asc" | "name-desc">("date-desc");
  const [createPayload, setCreatePayload] = useState<{
    queueId: string | null;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    reference: string;
  }>({
    queueId: null,
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    reference: "",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    const loadLeads = async () => {
      try {
        const response = await fetch("/api/leads/options");
        const payload = await response.json();
        if (!payload.ok) return;
        const options: LeadOption[] = (payload.data || []).map((lead: any) => {
          const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || "Unnamed";
          const contact = lead.email || lead.phone || lead.externalId || lead.id;
          return {
            id: lead.id,
            label: `${name} · ${contact}`,
          };
        });
        setLeads(options);
      } catch {
        // ignore
      }
    };
    loadLeads();
  }, []);

  useEffect(() => {
    setMounted(true);
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(queueId);
      return next;
    });
  };

  const handleBulkAttach = async (leadId: string | undefined) => {
    if (!leadId || !selectedIds.size) return;
    const response = await fetch("/api/manual-match/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, queueIds: Array.from(selectedIds) }),
    });
    const payload = await response.json();
    if (!payload.ok) {
      alert(payload.message || "Failed to bulk attach");
      return;
    }
    setQueue((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  };

  const handleCreate = async (queueId: string) => {
    const payload =
      createPayload.queueId === queueId
        ? {
          email: createPayload.email,
          phone: createPayload.phone,
          firstName: createPayload.firstName,
          lastName: createPayload.lastName,
          reference: createPayload.reference,
        }
        : undefined;
    setCreating((prev) => ({ ...prev, [queueId]: true }));
    const response = await fetch("/api/manual-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", queueId, lead: payload }),
    });
    const respPayload = await response.json();
    setCreating((prev) => ({ ...prev, [queueId]: false }));
    if (!respPayload.ok) {
      alert(respPayload.message || "Failed to create and attach");
      return;
    }
    setQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  const filteredQueue = useMemo(
    () =>
      queue
        .filter((item) => {
          if (sourceFilter === "All") return true;
          return (item.transaction?.provider || "").toLowerCase().includes(sourceFilter.toLowerCase());
        })
        .sort((a, b) => {
          if (sortBy === "date-desc") {
            return (
              new Date(b.transaction?.occurredAt ?? 0).getTime() -
              new Date(a.transaction?.occurredAt ?? 0).getTime()
            );
          }
          if (sortBy === "date-asc") {
            return (
              new Date(a.transaction?.occurredAt ?? 0).getTime() -
              new Date(b.transaction?.occurredAt ?? 0).getTime()
            );
          }
          if (sortBy === "amount-desc") {
            return (b.transaction?.amountMinor ?? 0) - (a.transaction?.amountMinor ?? 0);
          }
          if (sortBy === "amount-asc") {
            return (a.transaction?.amountMinor ?? 0) - (b.transaction?.amountMinor ?? 0);
          }
          if (sortBy === "name-asc") {
            return getDisplayName(a).localeCompare(getDisplayName(b));
          }
          if (sortBy === "name-desc") {
            return getDisplayName(b).localeCompare(getDisplayName(a));
          }
          return 0;
        }),
    [queue, sourceFilter, sortBy]
  );

  const floatingBar =
    mounted && selectedIds.size >= 2
      ? createPortal(
        <div className="fixed inset-x-0 top-auto bottom-4 z-[200] flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex w-[90%] max-w-3xl flex-wrap items-center justify-center gap-3 rounded-full border border-emerald-200/70 bg-white/95 px-4 py-3 shadow-xl shadow-emerald-900/10 backdrop-blur">
            <input
              type="text"
              placeholder="Search name/email or paste Lead ID"
              className="min-w-[220px] flex-1 rounded-full border border-emerald-200/60 bg-white px-3 py-2 text-xs text-primary"
              list="lead-options-floating"
              value={leadIdInput.__bulk ?? ""}
              onChange={(e) => setLeadIdInput((prev) => ({ ...prev, __bulk: e.target.value }))}
            />
            <datalist id="lead-options-floating">
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.label}
                </option>
              ))}
            </datalist>
            <button
              className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() => handleBulkAttach(leadIdInput.__bulk)}
              disabled={!leadIdInput.__bulk}
            >
              Attach selected ({selectedIds.size})
            </button>
            <button
              className="text-xs text-muted underline"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>,
        document.body
      )
      : null;

  return (
    <div className="flex flex-col gap-6 text-primary">
      {floatingBar}

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
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted text-xs uppercase tracking-[0.2em]">Filter by source</span>
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-primary"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Stripe">Stripe</option>
              <option value="Glofox">Glofox</option>
              <option value="Starling">Starling</option>
            </select>
            <span className="text-muted text-sm">Remaining: {filteredQueue.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted text-xs uppercase tracking-[0.2em]">Sort</span>
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-primary"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="date-desc">Recent to Oldest</option>
              <option value="date-asc">Oldest to Recent</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>
          <button
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
            onClick={async () => {
              const source = window.prompt("Retry source: all, stripe, glofox, starling", "all") || "all";
              const response = await fetch("/api/manual-match/retry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source }),
              });
              const payload = await response.json();
              if (!payload.ok) {
                alert(payload.message || "Retry failed");
                return;
              }
              alert(
                `Bulk retry complete. Matched ${payload.matched}, auto-mapped ${payload.autoMapped}, still unmatched ${payload.failed}. Refreshing…`
              );
              window.location.reload();
            }}
          >
            Retry bulk match
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search name/email or paste Lead ID"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-primary"
              list="lead-options-bulk"
              onChange={(e) => setLeadIdInput((prev) => ({ ...prev, __bulk: e.target.value }))}
            />
            <datalist id="lead-options-bulk">
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.label}
                </option>
              ))}
            </datalist>
            <button
              className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50"
              onClick={() => handleBulkAttach(leadIdInput.__bulk)}
              disabled={!selectedIds.size || !leadIdInput.__bulk}
            >
              Attach selected ({selectedIds.size})
            </button>
          </div>
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
            <table className="w-full text-left text-base border-separate border-spacing-y-3">
              <thead className="text-muted">
                <tr>
                  <th className="pb-3 pr-4 font-medium w-10"></th>
                  <th className="pb-3 pr-4 font-medium">Occurred</th>
                  <th className="pb-3 pr-4 font-medium">Amount</th>
                  <th className="pb-3 pr-4 font-medium">Source</th>
                  <th className="pb-3 pr-4 font-medium">Person / Reference</th>
                  <th className="pb-3 pr-4 font-medium">Suggested</th>
                  <th className="pb-3 pr-4 font-medium">Attach</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="rounded-2xl border border-white/20 bg-white/5 shadow-sm">
                    <td className="px-3 align-middle text-center">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-emerald-400"
                        checked={selectedIds.has(item.id)}
                        onChange={(e) => {
                          const id = item.id;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(id);
                            } else {
                              next.delete(id);
                            }
                            return next;
                          });
                        }}
                      />
                    </td>
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
                      {(() => {
                        if (item.transaction?.provider?.toLowerCase() === "starling") {
                          const raw = (item.transaction.raw as Record<string, unknown>) ?? {};
                          const counterPartyName = (raw.counterPartyName || raw.counterpartyName) as string | undefined;
                          const name = counterPartyName || item.transaction?.personName || "Unknown";
                          const ref = item.transaction?.reference || "—";

                          return (
                            <>
                              <div className="font-medium">{name}</div>
                              <div className="text-xs text-muted">Ref: {ref}</div>
                            </>
                          );
                        }

                        return (
                          <>
                            {item.transaction?.personName ?? "Unassigned"}
                            <div className="text-xs text-muted">
                              Ref: {item.transaction?.reference ?? "—"} · Reason: {item.reason}
                              {(() => {
                                const { email, phone } = extractContactHint(item.transaction?.metadata);
                                if (!email && !phone) return null;
                                return (
                                  <div className="text-xs text-muted">
                                    {email ? ` · Email: ${email}` : ""} {phone ? ` · Phone: ${phone}` : ""}
                                  </div>
                                );
                              })()}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="pr-4 text-xs text-muted">
                      {item.suggestedMemberIds?.length ? item.suggestedMemberIds.join(", ") : "None"}
                    </td>
                    <td className="pr-4">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Search name/email or paste Lead ID"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-primary"
                          value={leadIdInput[item.id] ?? ""}
                          list={`lead-options-${item.id}`}
                          onChange={(e) =>
                            setLeadIdInput((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                        <datalist id={`lead-options-${item.id}`}>
                          {leads.map((lead) => (
                            <option key={lead.id} value={lead.id}>
                              {lead.label}
                            </option>
                          ))}
                        </datalist>
                        <button
                          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                          onClick={() => handleAttach(item.id, leadIdInput[item.id])}
                        >
                          Attach
                        </button>
                        <button
                          className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-primary"
                          onClick={() => {
                            const { email, phone } = extractContactHint(item.transaction?.metadata);
                            const raw = (item.transaction?.raw as Record<string, unknown>) ?? {};
                            const rawName = (raw.counterPartyName || raw.counterpartyName) as string | undefined;
                            const starlingRef =
                              item.transaction?.provider?.toLowerCase() === "starling" &&
                                typeof rawName === "string"
                                ? rawName
                                : undefined;
                            setCreatePayload({
                              queueId: item.id,
                              email: email ?? "",
                              phone: phone ?? "",
                              firstName: "",
                              lastName: "",
                              reference: starlingRef ?? item.transaction?.reference ?? "",
                            });
                          }}
                        >
                          {creating[item.id] ? "Creating…" : "Create lead & attach"}
                        </button>
                        {createPayload.queueId === item.id ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-primary flex flex-col gap-2">
                            <div className="font-semibold">New lead details</div>
                            <input
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              placeholder="First name"
                              value={createPayload.firstName}
                              onChange={(e) =>
                                setCreatePayload((prev) => ({
                                  ...prev,
                                  firstName: e.target.value,
                                }))
                              }
                            />
                            <input
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              placeholder="Last name"
                              value={createPayload.lastName}
                              onChange={(e) =>
                                setCreatePayload((prev) => ({
                                  ...prev,
                                  lastName: e.target.value,
                                }))
                              }
                            />
                            <input
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              placeholder="Email"
                              value={createPayload.email}
                              onChange={(e) =>
                                setCreatePayload((prev) => ({
                                  ...prev,
                                  email: e.target.value,
                                }))
                              }
                            />
                            <input
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              placeholder="Phone"
                              value={createPayload.phone}
                              onChange={(e) =>
                                setCreatePayload((prev) => ({
                                  ...prev,
                                  phone: e.target.value,
                                }))
                              }
                            />
                            <input
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              placeholder="Reference (for Starling auto-match)"
                              value={createPayload.reference}
                              onChange={(e) =>
                                setCreatePayload((prev) => ({
                                  ...prev,
                                  reference: e.target.value,
                                }))
                              }
                            />
                            <div className="flex gap-2">
                              <button
                                className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                                onClick={() => {
                                  handleCreate(item.id);
                                  setCreatePayload({
                                    queueId: null,
                                    email: "",
                                    phone: "",
                                    firstName: "",
                                    lastName: "",
                                    reference: "",
                                  });
                                }}
                              >
                                Save & attach
                              </button>
                              <button
                                className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-primary"
                                onClick={() =>
                                  setCreatePayload({
                                    queueId: null,
                                    email: "",
                                    phone: "",
                                    firstName: "",
                                    lastName: "",
                                    reference: "",
                                  })
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className="text-[11px] text-muted">
                          Tip: search by name/email or paste a Lead ID. After attach, this disappears.
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
