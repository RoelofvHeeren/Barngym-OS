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
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadStatusFilter, setLeadStatusFilter] = useState<"all" | "lead" | "client">("all");
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

  const updateRange = (next: RangeKey) => {
    setRange(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadOverview = async () => {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const response = await fetch(`/api/ads/overview?range=${range}`, { signal: controller.signal });
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
        const response = await fetch(
          `/api/ads/leads?range=${range}&status=${leadStatusFilter}`,
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
        const response = await fetch(`/api/ads/funnel?range=${range}`, { signal: controller.signal });
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Ad Leads</h3>
            <p className="text-sm text-muted">Ads sourced leads with attribution and LTV.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm"
              value={leadStatusFilter}
              onChange={(event) =>
                setLeadStatusFilter(event.target.value as "all" | "lead" | "client")
              }
            >
              <option value="all">All</option>
              <option value="lead">Leads only</option>
              <option value="client">Clients only</option>
            </select>
            <input
              type="search"
              placeholder="Search name or email"
              value={leadSearch}
              onChange={(event) => setLeadSearch(event.target.value)}
              className="rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {leadsError && <p className="mt-2 text-sm text-amber-700">{leadsError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                {[
                  "Lead",
                  "Status",
                  "UTM Campaign",
                  "UTM Source",
                  "UTM Medium",
                  "LTV (ads)",
                  "Created",
                  "First Payment",
                ].map((column) => (
                  <th key={column} className="pb-3 pr-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/10">
              {leadsLoading ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted">
                    Loading leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted">
                    No leads found for this range.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`hover:bg-emerald-50/50 ${lead.linkedContactId ? "cursor-pointer" : ""
                      }`}
                    onClick={() => {
                      if (lead.linkedContactId) {
                        router.push(`/people?id=${lead.linkedContactId}`);
                      }
                    }}
                  >
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-primary">{lead.fullName}</p>
                      <p className="text-xs text-muted font-normal">{lead.email}</p>
                    </td>
                    <td className="pr-4">
                      <span
                        className={`chip text-[11px] ${lead.status === "CLIENT"
                            ? "!bg-emerald-100 !text-emerald-800"
                            : "!bg-amber-100 !text-amber-800"
                          }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="pr-4 text-muted">{lead.tracking.utm_campaign ?? "—"}</td>
                    <td className="pr-4 text-muted">{lead.tracking.utm_source ?? "—"}</td>
                    <td className="pr-4 text-muted">{lead.tracking.utm_medium ?? "—"}</td>
                    <td className="pr-4 font-semibold text-primary">
                      {formatCurrency(lead.ltvAdsCents)}
                    </td>
                    <td className="pr-4 text-muted">{formatDate(lead.createdAt)}</td>
                    <td className="pr-4 text-muted">{formatDate(lead.firstPaymentAt)}</td>
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
