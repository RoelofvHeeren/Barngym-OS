'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

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

type DashboardTransaction = {
  id: string;
  provider: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  status: string;
  confidence: string;
  productType?: string | null;
  description?: string | null;
  reference?: string | null;
  personName?: string | null;
  leadId?: string | null;
  lead?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    membershipName: string | null;
    channel: string | null;
    stage: string | null;
  } | null;
};

type DashboardSnapshot = {
  generatedAt: string;
  windowStart: string;
  transactions: DashboardTransaction[];
  stats: {
    members: {
      active: number;
      trial: number;
      corporate: number;
    };
    alerts: {
      failedPayments: number;
      needsReview: number;
      expiringMemberships: number;
      followUps: number;
    };
  };
};

type PreparedTransaction = DashboardTransaction & {
  occurredAtMs: number;
  category: RevenueCategory;
};

type DashboardResponse = {
  ok: boolean;
  data?: DashboardSnapshot;
  message?: string;
};

type UnmatchedPayment = {
  id: string;
  reference: string;
  amountMinor: number;
  currency: string;
  source: string;
  occurredAtMs: number;
  suggestions: string[];
};

type KpiCard = {
  key: string;
  label: string;
  value: string;
  delta: string;
  sparkline: number[];
};

type GraphPoint = {
  label: string;
  value: number;
};

type AdsOverview = {
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

type LtvCategorySnapshot = {
  avgAllCents: number;
  avgAdsCents: number;
  avgPtCents: number;
  avgOnlineCoachingCents: number;
  avgClassesCents: number;
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

const PRODUCT_CATEGORY_MATCHERS: Array<{ category: RevenueCategory; matchers: RegExp[] }> = [
  { category: "Personal Training", matchers: [/personal training/i, /pt /i, /pt$/i] },
  { category: "Classes", matchers: [/class/i, /session/i] },
  { category: "Memberships", matchers: [/member/i, /subscription/i] },
  { category: "Online Coaching", matchers: [/online/i, /remote/i] },
  { category: "Corporate Retreats", matchers: [/corporate/i, /retreat/i, /offsite/i] },
];

const DEFAULT_CURRENCY = "GBP";

const formatCurrency = (minorUnits: number, currency = DEFAULT_CURRENCY) => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(minorUnits / 100);
};

const providerMatches = (provider: string, filter: SourceFilter) => {
  if (filter === "All Sources") return true;
  const normalized = provider.toLowerCase();
  if (filter === "Stripe") return normalized.includes("stripe");
  if (filter === "Glofox") return normalized.includes("glofox");
  if (filter === "Starling") return normalized.includes("starling");
  return false;
};

const mapProductCategory = (productType?: string | null): RevenueCategory => {
  if (!productType) return "All";
  for (const entry of PRODUCT_CATEGORY_MATCHERS) {
    if (entry.matchers.some((matcher) => matcher.test(productType))) {
      return entry.category;
    }
  }
  return "All";
};

const sumRange = (transactions: PreparedTransaction[], fromMs: number, toMs: number) => {
  return transactions.reduce((total, transaction) => {
    if (transaction.status === "Failed") return total;
    if (transaction.occurredAtMs < fromMs || transaction.occurredAtMs > toMs) return total;
    return total + transaction.amountMinor;
  }, 0);
};

const percentDelta = (current: number, previous: number) => {
  if (!previous) {
    return current ? "+∞%" : "0%";
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
};

const buildSparkline = (
  transactions: PreparedTransaction[],
  startMs: number,
  endMs: number,
  buckets = 7
) => {
  if (!transactions.length || endMs <= startMs) {
    return Array.from({ length: buckets }, () => 0);
  }
  const sliceSize = (endMs - startMs) / buckets;
  return Array.from({ length: buckets }, (_, index) => {
    const bucketStart = startMs + index * sliceSize;
    const bucketEnd = index === buckets - 1 ? endMs : bucketStart + sliceSize;
    return sumRange(transactions, bucketStart, bucketEnd);
  });
};

const buildGraphSeries = (
  transactions: PreparedTransaction[],
  frame: TimeframeFilter
): GraphPoint[] => {
  const now = new Date();
  if (!transactions.length) {
    const fallbackLabels: Record<TimeframeFilter, string[]> = {
      Day: ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"],
      Week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      Month: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
      Year: ["Jan", "Mar", "May", "Jul", "Sep", "Nov"],
    };
    return fallbackLabels[frame].map((label) => ({ label, value: 0 }));
  }

  if (frame === "Day") {
    const start = startOfDay(now);
    const bucketCount = 6;
    const rangeMs = 24 * 60 * 60 * 1000;
    const slice = rangeMs / bucketCount;
    return Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = start.getTime() + index * slice;
      const bucketEnd = bucketStart + slice;
      const label = format(new Date(bucketStart), "HH:mm");
      return {
        label,
        value: sumRange(transactions, bucketStart, bucketEnd),
      };
    });
  }

  if (frame === "Week") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      const bucketStart = startOfDay(day).getTime();
      const bucketEnd = bucketStart + 24 * 60 * 60 * 1000;
      return {
        label: format(day, "EEE"),
        value: sumRange(transactions, bucketStart, bucketEnd),
      };
    });
  }

  if (frame === "Month") {
    const start = startOfMonth(now);
    const daysElapsed = differenceInCalendarDays(now, start) + 1;
    const bucketCount = Math.min(6, Math.max(3, Math.ceil(daysElapsed / 5)));
    return Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = start.getTime() + index * (5 * 24 * 60 * 60 * 1000);
      const bucketEnd = index === bucketCount - 1 ? now.getTime() : bucketStart + 5 * 24 * 60 * 60 * 1000;
      return {
        label: `W${index + 1}`,
        value: sumRange(transactions, bucketStart, bucketEnd),
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = subMonths(startOfMonth(now), 5 - index);
    const bucketStart = monthDate.getTime();
    const bucketEnd = startOfMonth(addDays(monthDate, 32)).getTime();
    return {
      label: format(monthDate, "MMM"),
      value: sumRange(transactions, bucketStart, bucketEnd),
    };
  });
};

const formatPerson = (transaction: PreparedTransaction) => {
  if (transaction.personName) return transaction.personName;
  if (transaction.lead) {
    const parts = [transaction.lead.firstName ?? "", transaction.lead.lastName ?? ""]
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length) {
      return parts.join(" ");
    }
  }
  return "Unassigned";
};

const formatRelativeAge = (value: number) => {
  const diffMs = Date.now() - value;
  const diffHours = diffMs / (60 * 60 * 1000);
  if (diffHours < 1) {
    return `${Math.max(1, Math.round(diffHours * 60))}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.round(diffHours)}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

function Sparkline({ points }: { points: number[] }) {
  if (!points.length) {
    return (
      <svg width={160} height={48} className="text-emerald-400/80">
        <line x1="0" y1="24" x2="160" y2="24" stroke="rgba(13,126,98,0.4)" strokeWidth={2} />
      </svg>
    );
  }

  const width = 160;
  const height = 48;
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
      <path d={path} fill="none" stroke="url(#spark)" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState<TimeBucket>("Today");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All Sources");
  const [graphFrame, setGraphFrame] = useState<TimeframeFilter>("Week");
  const [categoryFilter, setCategoryFilter] = useState<RevenueCategory>("All");
  const [selectedAlertKey, setSelectedAlertKey] = useState("failed");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [unmatchedPayments, setUnmatchedPayments] = useState<UnmatchedPayment[]>([]);
  const [adsOverview, setAdsOverview] = useState<AdsOverview | null>(null);
  const [adsOverviewError, setAdsOverviewError] = useState<string | null>(null);
  const [adsOverviewAll, setAdsOverviewAll] = useState<AdsOverview | null>(null);
  const [adsOverviewAllError, setAdsOverviewAllError] = useState<string | null>(null);
  const [ltvCategories, setLtvCategories] = useState<LtvCategorySnapshot | null>(null);
  const [ltvError, setLtvError] = useState<string | null>(null);
  const [ltvView, setLtvView] = useState<"all" | "ads" | "pt" | "online" | "classes">("all");

  useEffect(() => {
    let cancelled = false;
    async function fetchSnapshot() {
      try {
        setLoadingSnapshot(true);
        const response = await fetch("/api/dashboard");
        const payload = (await response.json()) as DashboardResponse;
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.message || "Unable to load dashboard data.");
        }
        if (!cancelled) {
          setSnapshot(payload.data);
          setSnapshotError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSnapshotError(error instanceof Error ? error.message : "Failed to load dashboard snapshot.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSnapshot(false);
        }
      }
    }
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchAdsOverview() {
      try {
        const response = await fetch("/api/ads/overview?range=30d");
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Unable to load ads overview.");
        }
        if (!cancelled) {
          setAdsOverview(payload.data as AdsOverview);
          setAdsOverviewError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAdsOverviewError(
            error instanceof Error ? error.message : "Failed to load ads overview."
          );
        }
      }
    }
    fetchAdsOverview();
    const interval = setInterval(fetchAdsOverview, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchAdsOverviewAll() {
      try {
        const response = await fetch("/api/ads/overview?range=all");
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Unable to load ads overview.");
        }
        if (!cancelled) {
          setAdsOverviewAll(payload.data as AdsOverview);
          setAdsOverviewAllError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAdsOverviewAllError(
            error instanceof Error ? error.message : "Failed to load ads overview."
          );
        }
      }
    }
    fetchAdsOverviewAll();
    const interval = setInterval(fetchAdsOverviewAll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchLtvCategories() {
      try {
        const response = await fetch("/api/ltv/categories");
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Unable to load LTV categories.");
        }
        if (!cancelled) {
          setLtvCategories(payload.data as LtvCategorySnapshot);
          setLtvError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLtvError(error instanceof Error ? error.message : "Failed to load LTV data.");
        }
      }
    }
    fetchLtvCategories();
    const interval = setInterval(fetchLtvCategories, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const preparedTransactions = useMemo<PreparedTransaction[]>(() => {
    if (!snapshot) return [];
    return snapshot.transactions.map((transaction) => ({
      ...transaction,
      occurredAtMs: new Date(transaction.occurredAt).getTime(),
      category: mapProductCategory(transaction.productType ?? undefined),
    }));
  }, [snapshot]);

  const filteredTransactions = useMemo(() => {
    return preparedTransactions.filter((transaction) => {
      const matchesSourceFilter = providerMatches(transaction.provider, sourceFilter);
      const matchesCategory = categoryFilter === "All" ? true : transaction.category === categoryFilter;
      return matchesSourceFilter && matchesCategory;
    });
  }, [preparedTransactions, sourceFilter, categoryFilter]);

  const activeCurrency = filteredTransactions[0]?.currency ?? DEFAULT_CURRENCY;
  const now = new Date();
  const startToday = startOfDay(now);
  const startWeek = startOfWeek(now, { weekStartsOn: 1 });
  const startMonth = startOfMonth(now);
  const startYesterday = subDays(startToday, 1);
  const startPrevWeek = subDays(startWeek, 7);
  const startPrevMonth = subMonths(startMonth, 1);
  const daysIntoMonth = differenceInCalendarDays(now, startMonth) + 1;
  const prevMonthComparisonEnd = addDays(startPrevMonth, daysIntoMonth - 1);

  const revenueTodayMinor = sumRange(filteredTransactions, startToday.getTime(), now.getTime());
  const revenueYesterdayMinor = sumRange(
    filteredTransactions,
    startYesterday.getTime(),
    startToday.getTime() - 1
  );
  const revenueWeekMinor = sumRange(filteredTransactions, startWeek.getTime(), now.getTime());
  const revenuePrevWeekMinor = sumRange(
    filteredTransactions,
    startPrevWeek.getTime(),
    startWeek.getTime() - 1
  );
  const revenueMonthMinor = sumRange(filteredTransactions, startMonth.getTime(), now.getTime());
  const revenuePrevMonthMinor = sumRange(
    filteredTransactions,
    startPrevMonth.getTime(),
    prevMonthComparisonEnd.getTime()
  );

  const periodStart = useMemo(() => {
    if (dateFilter === "Today") return startToday.getTime();
    if (dateFilter === "This Week") return startWeek.getTime();
    if (dateFilter === "This Month") return startMonth.getTime();
    return startToday.getTime();
  }, [dateFilter, startToday, startWeek, startMonth]);

  const periodSum = (category?: RevenueCategory) => {
    return filteredTransactions.reduce((total, transaction) => {
      if (transaction.status === "Failed") return total;
      if (transaction.occurredAtMs < periodStart) return total;
      if (!category || category === "All") return total + transaction.amountMinor;
      return transaction.category === category ? total + transaction.amountMinor : total;
    }, 0);
  };

  const categorySums = {
    total: periodSum("All"),
    pt: periodSum("Personal Training"),
    classes: periodSum("Classes"),
    online: periodSum("Online Coaching"),
    corporate: periodSum("Corporate Retreats"),
  };

  const activeMembers = useMemo(() => {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const ids = new Set(
      filteredTransactions
        .filter((tx) => tx.leadId && tx.occurredAtMs >= cutoff)
        .map((tx) => tx.leadId as string)
    );
    return ids.size;
  }, [filteredTransactions]);

  const newMembers = useMemo(() => {
    const ids = new Set(
      filteredTransactions
        .filter((tx) => tx.leadId && tx.occurredAtMs >= periodStart)
        .map((tx) => tx.leadId as string)
    );
    return ids.size;
  }, [filteredTransactions, periodStart]);

  const kpiCards: KpiCard[] = [
    {
      key: "revTotal",
      label: "Total Revenue",
      value: formatCurrency(categorySums.total, activeCurrency),
      delta: `${percentDelta(categorySums.total, revenuePrevMonthMinor)} vs last period`,
      sparkline: buildSparkline(filteredTransactions, periodStart, now.getTime()),
    },
    {
      key: "revPt",
      label: "PT Revenue",
      value: formatCurrency(categorySums.pt, activeCurrency),
      delta: "Personal Training",
      sparkline: buildSparkline(
        filteredTransactions.filter((tx) => tx.category === "Personal Training"),
        periodStart,
        now.getTime()
      ),
    },
    {
      key: "revClasses",
      label: "Classes",
      value: formatCurrency(categorySums.classes, activeCurrency),
      delta: "Pay-as-you-go",
      sparkline: buildSparkline(
        filteredTransactions.filter((tx) => tx.category === "Classes"),
        periodStart,
        now.getTime()
      ),
    },
    {
      key: "revOnline",
      label: "Online Coaching",
      value: formatCurrency(categorySums.online, activeCurrency),
      delta: "Remote programs",
      sparkline: buildSparkline(
        filteredTransactions.filter((tx) => tx.category === "Online Coaching"),
        periodStart,
        now.getTime()
      ),
    },
    {
      key: "revCorporate",
      label: "Corporate",
      value: formatCurrency(categorySums.corporate, activeCurrency),
      delta: "Corporate programs",
      sparkline: buildSparkline(
        filteredTransactions.filter((tx) => tx.category === "Corporate Retreats"),
        periodStart,
        now.getTime()
      ),
    },
    {
      key: "activeMembers",
      label: "Active Members",
      value: activeMembers.toLocaleString(),
      delta: `${newMembers} new in period`,
      sparkline: Array(7).fill(activeMembers),
    },
  ];

  const recentPayments = useMemo(() => {
    const limit =
      dateFilter === "Today" ? 4 : dateFilter === "This Week" ? 5 : dateFilter === "Custom" ? 6 : 8;
    return filteredTransactions
      .slice(0, limit)
      .map((transaction) => ({
        id: transaction.id,
        name: formatPerson(transaction),
        product: transaction.productType ?? "Uncategorized",
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        source: transaction.provider,
        status: transaction.status,
      }));
  }, [filteredTransactions, dateFilter]);

  const derivedUnmatched = useMemo<UnmatchedPayment[]>(() => {
    return filteredTransactions
      .filter((transaction) => transaction.status === "Needs Review" || !transaction.leadId)
      .slice(0, 6)
      .map((transaction) => ({
        id: transaction.id,
        reference: transaction.reference ?? transaction.provider,
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        source: transaction.provider,
        occurredAtMs: transaction.occurredAtMs,
        suggestions: transaction.personName ? [transaction.personName] : ["Assign in CRM"],
      }));
  }, [filteredTransactions]);

  const ltvViewMap = {
    all: {
      label: "All Clients",
      description: "Average LTV across all clients with at least one payment.",
      value: ltvCategories?.avgAllCents ?? 0,
    },
    ads: {
      label: "Ads Sourced",
      description: "Average LTV for clients tagged as Ads sourced.",
      value: ltvCategories?.avgAdsCents ?? 0,
    },
    pt: {
      label: "Personal Training",
      description: "Clients with at least one PT payment.",
      value: ltvCategories?.avgPtCents ?? 0,
    },
    online: {
      label: "Online Coaching",
      description: "Clients with at least one Online Coaching payment.",
      value: ltvCategories?.avgOnlineCoachingCents ?? 0,
    },
    classes: {
      label: "Pay As You Go",
      description: "Clients with at least one Classes/Pay As You Go payment.",
      value: ltvCategories?.avgClassesCents ?? 0,
    },
  } as const;

  useEffect(() => {
    setUnmatchedPayments(derivedUnmatched);
  }, [derivedUnmatched]);

  const visibleUnmatched = useMemo(() => {
    if (sourceFilter === "All Sources") return unmatchedPayments;
    return unmatchedPayments.filter((payment) => providerMatches(payment.source, sourceFilter));
  }, [sourceFilter, unmatchedPayments]);

  const handleMatch = (id: string, person: string) => {
    setUnmatchedPayments((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              suggestions: [person],
            }
          : item
      )
    );
  };

  const failedPaymentsCount = filteredTransactions.filter((transaction) => transaction.status === "Failed").length;
  const needsReviewCount = filteredTransactions.filter(
    (transaction) => transaction.status === "Needs Review" || !transaction.leadId
  ).length;

  const alerts = [
    {
      key: "failed",
      title: "Failed payments needing follow up",
      detail: `${failedPaymentsCount} in retry queue`,
      value: failedPaymentsCount,
      unit: "payments",
      source: "Stripe",
      action: "Open retry queue",
      href: "/transactions?status=failed",
    },
    {
      key: "bank",
      title: "Bank transfers requiring manual attribution",
      detail: `${needsReviewCount} waiting to match`,
      value: needsReviewCount,
      unit: "transfers",
      source: "Starling",
      action: "Match in ledger",
      href: "/transactions?status=needs-review",
    },
    {
      key: "expiring",
      title: "Expiring memberships soon",
      detail: `${snapshot?.stats.alerts.expiringMemberships ?? 0} need renewal`,
      value: snapshot?.stats.alerts.expiringMemberships ?? 0,
      unit: "members",
      source: "Stripe",
      action: "Open renewal queue",
      href: "/people?filter=expiring",
    },
    {
      key: "leads",
      title: "Leads needing follow up today",
      detail: `${snapshot?.stats.alerts.followUps ?? 0} high intent`,
      value: snapshot?.stats.alerts.followUps ?? 0,
      unit: "leads",
      source: "Glofox",
      action: "View CRM",
      href: "/people",
    },
  ];

  const activeAlert = alerts.find((alert) => alert.key === selectedAlertKey) ?? alerts[0];
  const graphSeries = useMemo(() => buildGraphSeries(filteredTransactions, graphFrame), [filteredTransactions, graphFrame]);

  return (
    <div className="flex flex-col gap-6 text-primary">
      {snapshotError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-800">
          {snapshotError}
        </div>
      )}

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
        {kpiCards.map((card) => (
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

      <section className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Lifetime Value</p>
            <h3 className="text-xl font-semibold text-primary">LTV by Segment</h3>
            <p className="text-sm text-muted">View LTV and ROAS across key segments.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ltvViewMap).map(([key, entry]) => (
              <button
                key={key}
                className={`chip text-xs ${ltvView === key ? "!bg-emerald-600 !text-white" : ""}`}
                onClick={() => setLtvView(key as typeof ltvView)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-muted">
              {ltvViewMap[ltvView].label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-primary">
              {ltvCategories ? formatCurrency(ltvViewMap[ltvView].value ?? 0, activeCurrency) : "—"}
            </p>
            <p className="mt-1 text-sm text-muted">{ltvViewMap[ltvView].description}</p>
            {ltvError && <p className="mt-2 text-xs text-amber-700">{ltvError}</p>}
          </div>
          {ltvView === "ads" && (
            <>
              <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.25em] text-muted">ROAS (30d)</p>
                <p className="mt-2 text-2xl font-semibold text-primary">
                  {adsOverview ? `${(adsOverview.roas ?? 0).toFixed(2)}x` : "—"}
                </p>
                <p className="mt-1 text-xs text-muted">Revenue from ads vs spend over the last 30 days.</p>
                {adsOverviewError && <p className="mt-2 text-xs text-amber-700">{adsOverviewError}</p>}
              </div>
              <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.25em] text-muted">ROAS (All Time)</p>
                <p className="mt-2 text-2xl font-semibold text-primary">
                  {adsOverviewAll ? `${(adsOverviewAll.roas ?? 0).toFixed(2)}x` : "—"}
                </p>
                <p className="mt-1 text-xs text-muted">All-time revenue from ads vs spend.</p>
                {adsOverviewAllError && <p className="mt-2 text-xs text-amber-700">{adsOverviewAllError}</p>}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <div className="glass-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Recent Payments</p>
              <h3 className="mt-2 text-2xl font-semibold">Latest Activity</h3>
              <p className="text-sm text-muted">
                {loadingSnapshot ? "Loading live data..." : `${recentPayments.length} showing · filtered by ${sourceFilter}.`}
              </p>
            </div>
            <button type="button" className="text-sm text-emerald-700" onClick={() => router.push("/transactions")}>
              View ledger →
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {recentPayments.length === 0 && (
              <p className="rounded-2xl border border-dashed border-emerald-900/20 bg-white px-4 py-3 text-sm text-muted">
                {loadingSnapshot ? "Awaiting data from webhooks..." : `No recent payments for ${sourceFilter}.`}
              </p>
            )}
            {recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-2xl border border-emerald-900/10 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-primary">{payment.name}</p>
                  <p className="text-xs text-muted">{payment.product}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatCurrency(payment.amountMinor, payment.currency)}
                  </p>
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
              <p className="text-sm text-muted">{visibleUnmatched.length} items waiting for attribution.</p>
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
              <div key={payment.id} className="rounded-2xl border border-emerald-900/15 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">{payment.reference}</p>
                    <p className="text-xs text-muted">
                      {formatCurrency(payment.amountMinor, payment.currency)} · {payment.source} · {formatRelativeAge(payment.occurredAtMs)}
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
                  <button type="button" className="chip text-xs" onClick={() => router.push(`/people?prefill=${payment.reference}`)}>
                    Assign manually
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

      </section>
    </div>
  );
}
