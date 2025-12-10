'use client';

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type RangeKey = "today" | "7d" | "30d" | "month" | "all";

type Overview = {
  range: string;
  spendCents: number;
  leadsCount: number;
  conversionsCount: number;
  revenueFromAdsCents: number;
  avgLtvAdsCents: number;
  cplCents: number;
  cpaCents: number;
  roas: number;
};

type LeadRow = {
  id: string;
  linkedContactId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  status: "LEAD" | "CLIENT";
  createdAt: string;
  firstPaymentAt: string | null;
  ltvCents: number;
  ltvAdsCents: number;
  productCategories: string[];
  tracking: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    adId: string | null;
    adsetId: string | null;
    campaignId: string | null;
  };
};

type FunnelData = {
  stages: {
    leads: number;
    booked: number;
    showed: number;
    joined: number;
    clients: number;
  };
};

const rangeOptions: { label: string; value: RangeKey }[] = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This month", value: "month" },
  { label: "All time", value: "all" },
];

const formatCurrency = (cents: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format((cents ?? 0) / 100);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function AdsDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialRange = (searchParams.get("range") as RangeKey) ?? "30d";
  const [range, setRange] = useState<RangeKey | "custom">(initialRange as RangeKey | "custom");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadStatusFilter, setLeadStatusFilter] = useState<"all" | "lead" | "client">("lead");
  const [leadSearch, setLeadSearch] = useState("");

  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  const [spendForm, setSpendForm] = useState({
    periodStart: "",
    periodEnd: "",
    amount: "",
    source: "manual",
  });
  const [spendSaving, setSpendSaving] = useState(false);
  const [spendMessage, setSpendMessage] = useState<string | null>(null);

  const updateRange = (next: RangeKey | "custom") => {
    setRange(next);
    if (next !== "custom") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", next);
      params.delete("start");
      params.delete("end");
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  const applyCustomRange = () => {
    if (!customRange.start || !customRange.end) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("start", customRange.start);
    params.set("end", customRange.end);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadOverview = async () => {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const params = new URLSearchParams();
        params.set("range", range);
        if (range === "custom") {
          const start = searchParams.get("start");
          const end = searchParams.get("end");
          if (start) params.set("start", start);
          if (end) params.set("end", end);
        }
        const response = await fetch(`/api/ads/overview?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || "Failed to load overview");
        setOverview(payload.data as Overview);
      } catch (error) {
        if (controller.signal.aborted) return;
        setOverviewError(error instanceof Error ? error.message : "Failed to load overview");
      } finally {
        if (!controller.signal.aborted) setOverviewLoading(false);
      }
    };

    loadOverview();
    return () => controller.abort();
  }, [range, router, pathname, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const loadLeads = async () => {
      setLeadsLoading(true);
      setLeadsError(null);
      try {
        const params = new URLSearchParams();
        params.set("range", range);
        params.set("status", leadStatusFilter);
        if (range === "custom") {
          const start = searchParams.get("start");
          const end = searchParams.get("end");
          if (start) params.set("start", start);
          if (end) params.set("end", end);
        }
        const response = await fetch(
          `/api/ads/leads?${params.toString()}`,
          { signal: controller.signal }
        );
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || "Failed to load leads");
        setLeads((payload.data?.leads ?? []) as LeadRow[]);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLeadsError(error instanceof Error ? error.message : "Failed to load leads");
      } finally {
        if (!controller.signal.aborted) setLeadsLoading(false);
      }
    };
    loadLeads();
    return () => controller.abort();
  }, [range, leadStatusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const loadFunnel = async () => {
      setFunnelError(null);
      try {
        const params = new URLSearchParams();
        params.set("range", range);
        if (range === "custom") {
          const start = searchParams.get("start");
          const end = searchParams.get("end");
          if (start) params.set("start", start);
          if (end) params.set("end", end);
        }
        const response = await fetch(`/api/ads/funnel?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || "Failed to load funnel");
        setFunnel(payload.data as FunnelData);
      } catch (error) {
        if (controller.signal.aborted) return;
        setFunnelError(error instanceof Error ? error.message : "Failed to load funnel");
      }
    };
    loadFunnel();
    return () => controller.abort();
  }, [range]);

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads;
    const term = leadSearch.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.fullName.toLowerCase().includes(term) ||
        (lead.email ?? "").toLowerCase().includes(term)
    );
  }, [leadSearch, leads]);

  const handleSpendSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSpendSaving(true);
    setSpendMessage(null);
    try {
      const body = {
        periodStart: spendForm.periodStart,
        periodEnd: spendForm.periodEnd,
        amountCents: Math.round(Number(spendForm.amount) * 100),
        source: spendForm.source || "manual",
      };
      const response = await fetch("/api/ads/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || "Failed to save spend");
      setSpendMessage("Spend entry saved.");
      setSpendForm({ periodStart: "", periodEnd: "", amount: "", source: "manual" });
      // refresh overview
      const refreshed = await fetch(`/api/ads/overview?range=${range}`);
      const overviewPayload = await refreshed.json();
      if (refreshed.ok && overviewPayload.ok) setOverview(overviewPayload.data as Overview);
    } catch (error) {
      setSpendMessage(error instanceof Error ? error.message : "Failed to save spend");
    } finally {
      setSpendSaving(false);
    }
  };

  const totalLeads = funnel?.stages.leads ?? 0;
  const clientConversions = funnel?.stages.clients ?? 0;
  const conversionRate =
    totalLeads > 0 ? `${((clientConversions / totalLeads) * 100).toFixed(1)}%` : "—";

  return (
    <div className="space-y-6">
      <div className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Ads Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold">Ads Dashboard</h1>
            <p className="text-sm text-muted">
              Track leads, revenue, and ROAS from ad sourced clients.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                className={`chip text-xs ${range === option.value ? "!bg-emerald-600 !text-white" : ""
                  }`}
                onClick={() => updateRange(option.value)}
              >
                {option.label}
              </button>
            ))}
            <button
              className={`chip text-xs ${range === "custom" ? "!bg-emerald-600 !text-white" : ""}`}
              onClick={() => updateRange("custom")}
            >
              Custom
            </button>

            {range === "custom" && (
              <div className="flex items-center gap-2 bg-white/50 p-1 rounded-lg border border-emerald-900/10">
                <input
                  type="date"
                  className="text-xs bg-transparent border-none focus:ring-0 p-0 px-1"
                  value={customRange.start}
                  onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                />
                <span className="text-muted text-xs">-</span>
                <input
                  type="date"
                  className="text-xs bg-transparent border-none focus:ring-0 p-0 px-1"
                  value={customRange.end}
                  onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                />
                <button
                  onClick={applyCustomRange}
                  className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider hover:bg-emerald-700"
                >
                  Go
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Spend", value: formatCurrency(overview?.spendCents ?? 0) },
          {
            label: "Leads",
            value: overview?.leadsCount ?? "—",
            sub: "from ads in this period",
          },
          { label: "Conversions", value: overview?.conversionsCount ?? "—" },
          { label: "ROAS", value: `${overview?.roas?.toFixed(2) ?? "0.00"} x` },
          { label: "Revenue from ads", value: formatCurrency(overview?.revenueFromAdsCents ?? 0) },
          { label: "Average LTV per ads client", value: formatCurrency(overview?.avgLtvAdsCents ?? 0) },
        ].map((card) => (
          <div key={card.label} className="glass-panel">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-primary">
              {overviewLoading ? "Loading..." : card.value}
            </p>
            {card.sub && <p className="text-xs text-muted">{card.sub}</p>}
            {overviewError && <p className="text-xs text-amber-700">{overviewError}</p>}
          </div>
        ))}
      </div>

      <div className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Ads CRM</h3>
            <p className="text-sm text-muted">Manage your ads leads and clients.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-emerald-900/5 rounded-lg p-1">
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${leadStatusFilter === "lead"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-muted hover:text-primary"
                  }`}
                onClick={() => setLeadStatusFilter("lead")}
              >
                Active Leads
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${leadStatusFilter === "client"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-muted hover:text-primary"
                  }`}
                onClick={() => setLeadStatusFilter("client")}
              >
                Acquired Clients
              </button>
            </div>
            <input
              type="search"
              placeholder="Search..."
              value={leadSearch}
              onChange={(event) => setLeadSearch(event.target.value)}
              className="rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm w-64"
            />
          </div>
        </div>
        {leadsError && <p className="mt-2 text-sm text-amber-700">{leadsError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-muted border-b border-emerald-900/10">
              <tr>
                <th className="pb-3 pr-4 font-medium pl-2">Name & Contact</th>
                {leadStatusFilter === "client" ? (
                  <>
                    <th className="pb-3 pr-4 font-medium">Ads LTV</th>
                    <th className="pb-3 pr-4 font-medium">Total LTV</th>
                    <th className="pb-3 pr-4 font-medium">First Payment</th>
                    <th className="pb-3 pr-4 font-medium">Categories</th>
                  </>
                ) : (
                  <>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Campaign</th>
                    <th className="pb-3 pr-4 font-medium">Source / Medium</th>
                    <th className="pb-3 pr-4 font-medium">Created</th>
                  </>
                )}
                <th className="pb-3 pr-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/10">
              {leadsLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    Loading data...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No {leadStatusFilter}s found for this period.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`group hover:bg-emerald-50/50 transition-colors ${lead.linkedContactId ? "cursor-pointer" : ""
                      }`}
                    onClick={() => {
                      // Only navigate if clicking row, buttons can override
                      if (lead.linkedContactId) {
                        router.push(`/people?id=${lead.linkedContactId}`);
                      }
                    }}
                  >
                    <td className="py-3 pr-4 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">
                          {lead.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-primary">{lead.fullName}</p>
                          <p className="text-xs text-muted font-normal">{lead.email}</p>
                        </div>
                      </div>
                    </td>

                    {leadStatusFilter === "client" ? (
                      <>
                        <td className="pr-4 font-mono font-medium text-emerald-700">
                          {formatCurrency(lead.ltvAdsCents)}
                        </td>
                        <td className="pr-4 font-mono text-muted">
                          {formatCurrency(lead.ltvCents)}
                        </td>
                        <td className="pr-4 text-muted">{formatDate(lead.firstPaymentAt)}</td>
                        <td className="pr-4">
                          <div className="flex gap-1 flex-wrap">
                            {lead.productCategories.slice(0, 2).map(cat => (
                              <span key={cat} className="text-[10px] uppercase px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
                                {cat}
                              </span>
                            ))}
                            {lead.productCategories.length > 2 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">+{(lead.productCategories.length - 2)}</span>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="pr-4">
                          <span className="chip text-[11px] !bg-amber-100 !text-amber-800 uppercase tracking-wider">
                            {lead.status}
                          </span>
                        </td>
                        <td className="pr-4 text-muted max-w-[120px] truncate" title={lead.tracking.utm_campaign ?? ""}>
                          {lead.tracking.utm_campaign ?? "—"}
                        </td>
                        <td className="pr-4 text-muted">
                          <div className="flex flex-col text-xs">
                            <span>{lead.tracking.utm_source ?? "—"}</span>
                            <span className="opacity-60">{lead.tracking.utm_medium}</span>
                          </div>
                        </td>
                        <td className="pr-4 text-muted">{formatDate(lead.createdAt)}</td>
                      </>
                    )}

                    <td className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {lead.linkedContactId && (
                          <button
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/people?id=${lead.linkedContactId}`);
                            }}
                          >
                            View
                          </button>
                        )}
                        <button
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm("Are you sure you want to delete this contact? This will remove all their data permanently.")) return;

                            try {
                              // If linked contact exists, delete that. Otherwise delete lead? 
                              // Our API expects Contact ID.
                              const targetId = lead.linkedContactId;
                              if (!targetId) {
                                alert("Cannot delete lead without linked contact (yet).");
                                return;
                              }

                              const res = await fetch(`/api/people/${targetId}`, { method: "DELETE" });
                              const json = await res.json();
                              if (!res.ok) throw new Error(json.message);

                              // Optimistic remove or reload
                              setLeads(prev => prev.filter(l => l.id !== lead.id));
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "Failed to delete");
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Funnel</h3>
              <p className="text-sm text-muted">Ads lead journey for this range.</p>
            </div>
            <p className="text-sm text-muted">Leads → Clients: {conversionRate}</p>
          </div>
          {funnelError && <p className="mt-2 text-sm text-amber-700">{funnelError}</p>}
          <div className="mt-4 space-y-3">
            {["leads", "booked", "showed", "joined", "clients"].map((stage) => {
              const count = funnel?.stages[stage as keyof FunnelData["stages"]] ?? 0;
              const width =
                totalLeads > 0
                  ? Math.max(8, Math.min(100, Math.round((count / Math.max(totalLeads, 1)) * 100)))
                  : 8;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span className="capitalize">{stage}</span>
                    <span className="text-primary font-semibold">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-emerald-900/10">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="glass-panel">
          <h3 className="text-lg font-semibold">Manual Spend</h3>
          <p className="text-sm text-muted">Add spend entries to keep CPL/ROAS accurate.</p>
          <form className="mt-3 space-y-3" onSubmit={handleSpendSubmit}>
            <div>
              <label className="text-sm text-muted">Period start</label>
              <input
                type="date"
                className="mt-1 w-full rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm"
                value={spendForm.periodStart}
                onChange={(e) => setSpendForm((prev) => ({ ...prev, periodStart: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-muted">Period end</label>
              <input
                type="date"
                className="mt-1 w-full rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm"
                value={spendForm.periodEnd}
                onChange={(e) => setSpendForm((prev) => ({ ...prev, periodEnd: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-muted">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm"
                value={spendForm.amount}
                onChange={(e) => setSpendForm((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-muted">Source</label>
              <input
                type="text"
                className="mt-1 w-full rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm"
                value={spendForm.source}
                onChange={(e) => setSpendForm((prev) => ({ ...prev, source: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full text-sm"
              disabled={spendSaving}
            >
              {spendSaving ? "Saving..." : "Add spend entry"}
            </button>
            {spendMessage && <p className="text-xs text-muted">{spendMessage}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdsDashboardPage() {
  return (
    <Suspense fallback={<div className="glass-panel">Loading ads dashboard...</div>}>
      <AdsDashboardContent />
    </Suspense>
  );
}
