'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TimeBucket = "Today" | "This Week" | "This Month" | "Custom";
type SourceFilter = "All Sources" | "Stripe" | "Glofox" | "Starling";
type TimeframeFilter = "Day" | "Week" | "Month" | "Year";
type RevenueCategory =
  | "All"
  | "Personal Training"
  | "Classes"
  | "Memberships"
  | "Online Coaching"
  | "Corporate Retreats";

type KpiDefinition = {
  key: string;
  label: string;
  base: number;
  format: "currency" | "count";
  scopeAware?: boolean;
  delta?: {
    base: number;
    type: "percent" | "count";
    template?: (value: string) => string;
    suffix?: string;
  };
  sparkline: number[];
};

const timeBuckets: TimeBucket[] = ["Today", "This Week", "This Month", "Custom"];
const sourceFilters: SourceFilter[] = ["All Sources", "Stripe", "Glofox", "Starling"];
const timeframeFilters: TimeframeFilter[] = ["Day", "Week", "Month", "Year"];
const revenueCategories: RevenueCategory[] = [
  "All",
  "Personal Training",
  "Classes",
  "Memberships",
  "Online Coaching",
  "Corporate Retreats",
];

const scopeMultipliers: Record<TimeBucket, number> = {
  Today: 1,
  "This Week": 4.6,
  "This Month": 18.8,
  Custom: 2.8,
};

const sourceMultipliers: Record<SourceFilter, number> = {
  "All Sources": 1,
  Stripe: 0.64,
  Glofox: 0.24,
  Starling: 0.18,
};

const categoryMultipliers: Record<RevenueCategory, number> = {
  All: 1,
  "Personal Training": 0.32,
  Classes: 0.18,
  Memberships: 0.38,
  "Online Coaching": 0.12,
  "Corporate Retreats": 0.44,
};

const kpiDefinitions: KpiDefinition[] = [
  {
    key: "revToday",
    label: "Revenue Today",
    base: 24980,
    format: "currency",
    scopeAware: true,
    delta: {
      base: 0.082,
      type: "percent",
      template: (value) => `+${value}% vs yesterday`,
    },
    sparkline: [42, 48, 44, 50, 65, 62, 70],
  },
  {
    key: "revWeek",
    label: "Revenue This Week",
    base: 132440,
    format: "currency",
    scopeAware: true,
    delta: {
      base: 0.056,
      type: "percent",
      template: (value) => `+${value}% vs last week`,
    },
    sparkline: [120, 135, 141, 139, 150, 160, 166],
  },
  {
    key: "revMonth",
    label: "Revenue This Month",
    base: 529870,
    format: "currency",
    scopeAware: true,
    delta: {
      base: 0.124,
      type: "percent",
      template: (value) => `+${value}% vs last month`,
    },
    sparkline: [420, 450, 460, 480, 515, 530, 560],
  },
  {
    key: "activeMembers",
    label: "Active Members",
    base: 612,
    format: "count",
    delta: {
      base: 18,
      type: "count",
      template: (value) => `+${value} net new`,
    },
    sparkline: [580, 584, 590, 600, 602, 608, 612],
  },
  {
    key: "trialMembers",
    label: "Trial Members Right Now",
    base: 38,
    format: "count",
    delta: {
      base: 9,
      type: "count",
      template: (value) => `${value} expiring in 3 days`,
    },
    sparkline: [22, 33, 27, 36, 41, 40, 38],
  },
  {
    key: "corporateClients",
    label: "Corporate Clients Enrolled",
    base: 14,
    format: "count",
    delta: {
      base: 3,
      type: "count",
      template: (value) => `${value} in onboarding`,
    },
    sparkline: [9, 10, 10, 12, 12, 13, 14],
  },
];

const baseAlerts = [
  {
    key: "failed",
    title: "Failed payments needing follow up",
    detail: "€3,120 sitting in retry queue",
    baseValue: 6,
    unit: "members",
    source: "Stripe",
    action: "Open retry queue",
    href: "/transactions?status=failed",
  },
  {
    key: "bank",
    title: "Bank transfers requiring manual attribution",
    detail: "Reference missing or duplicated",
    baseValue: 4,
    unit: "transfers",
    source: "Starling",
    action: "Match in ledger",
    href: "/transactions?status=needs-review",
  },
  {
    key: "expiring",
    title: "Expiring memberships soon",
    detail: "Send renewal message within 24h",
    baseValue: 11,
    unit: "this week",
    source: "Stripe",
    action: "Open renewal queue",
    href: "/people?filter=expiring",
  },
  {
    key: "leads",
    title: "Leads needing follow up today",
    detail: "High intent from PT + Corporate",
    baseValue: 9,
    unit: "leads",
    source: "Glofox",
    action: "View CRM",
    href: "/people?filter=leads",
  },
];

const revenueTrend = [
  { label: "Mon", value: 18200 },
  { label: "Tue", value: 20120 },
  { label: "Wed", value: 19480 },
  { label: "Thu", value: 21040 },
  { label: "Fri", value: 23810 },
  { label: "Sat", value: 22540 },
  { label: "Sun", value: 24980 },
];

const graphLabels: Record<TimeframeFilter, string[]> = {
  Day: ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "00:00"],
  Week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  Month: ["Wk1", "Wk2", "Wk3", "Wk4", "Wk5", "Wk6", "Wk7"],
  Year: ["Jan", "Mar", "May", "Jul", "Sep", "Nov", "Dec"],
};

const graphFrameMultipliers: Record<TimeframeFilter, number> = {
  Day: 0.22,
  Week: 1,
  Month: 4.2,
  Year: 16,
};

const recentPayments = [
  {
    name: "Avery Kline",
    product: "Corporate Retreat",
    amount: 8400,
    source: "Stripe",
    status: "Completed",
  },
  {
    name: "Marcus Silva",
    product: "Personal Training Pack",
    amount: 1280,
    source: "Glofox",
    status: "Completed",
  },
  {
    name: "Riverside Legal",
    product: "Corporate Membership",
    amount: 9950,
    source: "Starling",
    status: "Needs Review",
  },
  {
    name: "Harlow Tse",
    product: "Online Coaching",
    amount: 480,
    source: "Stripe",
    status: "Completed",
  },
  {
    name: "Nova Printworks",
    product: "Corporate Retreat Deposit",
    amount: 12600,
    source: "Starling",
    status: "Completed",
  },
  {
    name: "Noor Patel",
    product: "Membership Renewal",
    amount: 220,
    source: "Glofox",
    status: "Completed",
  },
];

type UnmatchedPayment = {
  id: string;
  reference: string;
  amount: number;
  source: SourceFilter;
  age: string;
  suggestions: string[];
  status: "needs_match" | "matched";
};

const initialUnmatchedPayments: UnmatchedPayment[] = [
  {
    id: "UNM-9821",
    reference: "BG-RETREAT-9821",
    amount: 4500,
    source: "Starling",
    age: "2h ago",
    suggestions: ["Riverside Legal", "Northshore Legal"],
    status: "needs_match",
  },
  {
    id: "UNM-1882",
    reference: "BG-PTA-1882",
    amount: 1200,
    source: "Starling",
    age: "5h ago",
    suggestions: ["Olivia Northshore", "Marcus Silva"],
    status: "needs_match",
  },
  {
    id: "UNM-4210",
    reference: "BG-CLASS-4210",
    amount: 220,
    source: "Stripe",
    age: "Today",
    suggestions: ["Noor Patel"],
    status: "needs_match",
  },
];

const currency = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatValue(value: number, format: "currency" | "count") {
  if (format === "currency") {
    return currency.format(value);
  }
  return Math.max(0, Math.round(value)).toLocaleString();
}

function Sparkline({ points }: { points: number[] }) {
  const width = 160;
  const height = 60;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);

  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="text-emerald-400/80">
      <defs>
        <linearGradient id="spark" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(13,126,98,0.85)" />
          <stop offset="100%" stopColor="rgba(13,126,98,0)" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="url(#spark)"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState<TimeBucket>("Today");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All Sources");
  const [graphFrame, setGraphFrame] = useState<TimeframeFilter>("Week");
  const [categoryFilter, setCategoryFilter] = useState<RevenueCategory>("All");
  const [selectedAlertKey, setSelectedAlertKey] = useState<string>(baseAlerts[0].key);
  const [unmatchedPayments, setUnmatchedPayments] = useState(initialUnmatchedPayments);

  const derivedKpis = useMemo(() => {
    const scopeFactor = scopeMultipliers[dateFilter];
    const sourceFactor = sourceMultipliers[sourceFilter];

    return kpiDefinitions.map((kpi) => {
      const baseFactor = kpi.scopeAware ? scopeFactor : 1;
      const categoryFactor =
        kpi.key === "revToday" || kpi.key === "revWeek" || kpi.key === "revMonth"
          ? categoryMultipliers[categoryFilter]
          : 1;

      const valueNumber = kpi.base * baseFactor * sourceFactor * categoryFactor;
      const sparkline = kpi.sparkline.map(
        (point) => point * sourceFactor * (kpi.scopeAware ? scopeFactor : 1)
      );

      const deltaValue = kpi.delta
        ? kpi.delta.type === "percent"
          ? (kpi.delta.base * sourceFactor * 100).toFixed(1)
          : Math.max(1, Math.round(kpi.delta.base * sourceFactor)).toString()
        : "";

      return {
        key: kpi.key,
        label: kpi.label,
        value: formatValue(valueNumber, kpi.format),
        delta: kpi.delta?.template
          ? kpi.delta.template(deltaValue)
          : kpi.delta
          ? `${deltaValue} ${kpi.delta.suffix ?? ""}`.trim()
          : "",
        sparkline,
      };
    });
  }, [categoryFilter, dateFilter, sourceFilter]);

  const alerts = useMemo(() => {
    const scopeFactor = scopeMultipliers[dateFilter];
    return baseAlerts.map((alert) => {
      const sourceFactor =
        sourceFilter === "All Sources"
          ? 1
          : alert.source === "Stripe" && sourceFilter === "Stripe"
            ? 1.25
            : alert.source === "Glofox" && sourceFilter === "Glofox"
              ? 1.3
              : alert.source === "Starling" && sourceFilter === "Starling"
                ? 1.35
                : 0.55;
      const value = Math.max(1, Math.round(alert.baseValue * scopeFactor * sourceFactor));
      return { ...alert, value };
    });
  }, [dateFilter, sourceFilter]);

  const activeAlert = useMemo(() => {
    return alerts.find((alert) => alert.key === selectedAlertKey) ?? alerts[0];
  }, [alerts, selectedAlertKey]);
  const activeAlertKey = activeAlert?.key ?? selectedAlertKey;

  const graphSeries = useMemo(() => {
    const labels = graphLabels[graphFrame];
    const frameFactor = graphFrameMultipliers[graphFrame];
    const categoryFactor = categoryMultipliers[categoryFilter];
    const sourceFactor = sourceMultipliers[sourceFilter];

    return labels.map((label, index) => {
      const basePoint = revenueTrend[index % revenueTrend.length].value;
      const value = Math.round(basePoint * frameFactor * categoryFactor * sourceFactor);
      return { label, value };
    });
  }, [categoryFilter, graphFrame, sourceFilter]);

  const filteredPayments = useMemo(() => {
    const limit =
      dateFilter === "Today" ? 4 : dateFilter === "This Week" ? 5 : dateFilter === "Custom" ? 6 : 8;
    return recentPayments
      .filter((payment) => sourceFilter === "All Sources" || payment.source === sourceFilter)
      .slice(0, limit);
  }, [dateFilter, sourceFilter]);

  const visibleUnmatched = useMemo(() => {
    return unmatchedPayments.filter(
      (payment) =>
        payment.status === "needs_match" &&
        (sourceFilter === "All Sources" || payment.source === sourceFilter)
    );
  }, [sourceFilter, unmatchedPayments]);

  const handleMatch = (id: string, person: string) => {
    setUnmatchedPayments((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, status: "matched", suggestions: [person] }
          : item
      )
    );
  };

  return (
    <div className="flex flex-col gap-6 text-primary">
      <section className="glass-panel flex flex-wrap items-center gap-3">
        {timeBuckets.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={dateFilter === filter}
            onClick={() => setDateFilter(filter)}
            className={`chip text-sm ${dateFilter === filter ? "!bg-emerald-600 !text-white !border-emerald-600" : ""}`}
          >
            {filter}
          </button>
        ))}
        <div className="flex flex-wrap gap-2">
          {sourceFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={sourceFilter === filter}
              onClick={() => setSourceFilter(filter)}
              className={`chip text-xs ${sourceFilter === filter ? "!bg-emerald-200/60 !border-emerald-600" : ""}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {derivedKpis.map((card) => (
          <div key={card.key} className="glass-panel flex flex-col gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-muted">{card.label}</p>
              <p className="mt-3 text-4xl font-semibold">{card.value}</p>
              <p className="mt-2 text-sm text-emerald-700">{card.delta}</p>
            </div>
            <Sparkline points={card.sparkline} />
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <div className="glass-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Recent Payments</p>
              <h3 className="mt-2 text-2xl font-semibold">Latest Activity</h3>
              <p className="text-sm text-muted">
                Filtered by {sourceFilter}. {filteredPayments.length} showing.
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-emerald-700"
              onClick={() => router.push("/transactions")}
            >
              View ledger →
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {filteredPayments.length === 0 && (
              <p className="rounded-2xl border border-dashed border-emerald-900/20 bg-white px-4 py-3 text-sm text-muted">
                No recent payments for {sourceFilter}. Try another source.
              </p>
            )}
            {filteredPayments.map((payment) => (
              <div
                key={`${payment.name}-${payment.amount}`}
                className="flex items-center justify-between rounded-2xl border border-emerald-900/10 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-primary">{payment.name}</p>
                  <p className="text-xs text-muted">{payment.product}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{currency.format(payment.amount)}</p>
                  <p className="text-xs text-muted">
                    {payment.source} · {payment.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Manual Match</p>
              <h3 className="mt-2 text-2xl font-semibold">Unmatched Payments</h3>
              <p className="text-sm text-muted">
                {visibleUnmatched.length} items waiting for attribution.
              </p>
            </div>
            <button
              type="button"
              className="chip text-xs"
              onClick={() => router.push("/transactions?status=needs-review")}
            >
              Open queue
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {visibleUnmatched.length === 0 && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-primary">
                Queue clear. Everything is attributed 🎯
              </p>
            )}
            {visibleUnmatched.map((payment) => (
              <div
                key={payment.id}
                className="rounded-2xl border border-emerald-900/15 bg-white/90 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">{payment.reference}</p>
                    <p className="text-xs text-muted">
                      {currency.format(payment.amount)} · {payment.source} · {payment.age}
                    </p>
                  </div>
                  <span className="chip text-xs">{payment.id}</span>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-muted">Suggest</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {payment.suggestions.map((person) => (
                    <button
                      key={person}
                      type="button"
                      className="chip text-xs !border-emerald-700/40 !bg-emerald-600/10"
                      onClick={() => handleMatch(payment.id, person)}
                    >
                      Match to {person}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chip text-xs"
                    onClick={() => router.push(`/people?prefill=${payment.reference}`)}
                  >
                    Assign manually
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="glass-panel col-span-2 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Revenue Graph</p>
              <h3 className="mt-2 text-2xl font-semibold">Unified Revenue View</h3>
              <p className="text-sm text-muted">
                Filters currently showing: {dateFilter} · {sourceFilter} · {categoryFilter}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {timeframeFilters.map((frame) => (
                <button
                  key={frame}
                  type="button"
                  onClick={() => setGraphFrame(frame)}
                  className={`chip text-xs ${graphFrame === frame ? "!bg-emerald-600 !text-white !border-emerald-600" : ""}`}
                >
                  {frame}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-900/10 bg-white p-6">
            <div className="flex flex-wrap gap-2">
              {revenueCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`chip text-xs ${categoryFilter === category ? "!bg-black !text-white !border-black" : ""}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-1 gap-4 text-sm text-muted lg:grid-cols-6">
              {graphSeries.map((point) => (
                <div key={point.label}>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{point.label}</p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    €{(point.value / 1000).toFixed(1)}k
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 h-48 rounded-2xl border border-emerald-900/10 bg-gradient-to-b from-emerald-50 to-transparent p-4">
              <svg width="100%" height="100%" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="rgba(13,126,98,0.85)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  points={graphSeries
                    .map((point, index) => {
                      const x = (index / (graphSeries.length - 1 || 1)) * 100;
                      const min = Math.min(...graphSeries.map((p) => p.value));
                      const max = Math.max(...graphSeries.map((p) => p.value));
                      const range = max - min || 1;
                      const y = 100 - ((point.value - min) / range) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="glass-panel">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Quick Alerts</p>
            <h3 className="mt-2 text-2xl font-semibold">Attention Needed</h3>
            <div className="mt-4 flex flex-col gap-4">
              {alerts.map((alert) => (
                <button
                  key={alert.key}
                  type="button"
                  onClick={() => setSelectedAlertKey(alert.key)}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    activeAlertKey === alert.key
                      ? "border-amber-500/70 bg-gradient-to-br from-amber-50 via-white to-amber-50/40"
                      : "border-amber-200/40 bg-amber-50/40 hover:border-amber-300"
                  }`}
                >
                  <p className="text-sm text-muted">{alert.title}</p>
                  <p className="mt-1 text-xl font-semibold text-primary">
                    {alert.value} {alert.unit}
                  </p>
                  <p className="text-sm text-amber-700">{alert.detail}</p>
                </button>
              ))}
            </div>
            {activeAlert && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Next Step</p>
                <p className="mt-2 text-sm text-muted">
                  {activeAlert.action} to resolve {activeAlert.title.toLowerCase()}.
                </p>
                <button
                  type="button"
                  className="btn-primary mt-3 text-sm"
                  onClick={() => router.push(activeAlert.href)}
                >
                  Go to {activeAlert.action}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
