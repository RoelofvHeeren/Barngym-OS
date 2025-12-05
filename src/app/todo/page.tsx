'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardResponse = {
  ok: boolean;
  data?: {
    stats: {
      alerts: {
        failedPayments: number;
        needsReview: number;
        expiringMemberships: number;
        followUps: number;
      };
    };
  };
  message?: string;
};

export default function TodoPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<DashboardResponse["data"]["stats"]["alerts"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/dashboard");
        const payload = (await response.json()) as DashboardResponse;
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.message || "Unable to load to-dos.");
        }
        if (!cancelled) {
          setAlerts(payload.data.stats.alerts);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load to-dos.");
        }
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const items = useMemo(() => {
    if (!alerts) return [];
    return [
      {
        title: "Failed payments needing follow up",
        value: alerts.failedPayments,
        detail: `${alerts.failedPayments} in retry queue`,
        action: "Open retry queue",
        href: "/transactions?status=failed",
      },
      {
        title: "Bank transfers requiring manual attribution",
        value: alerts.needsReview,
        detail: `${alerts.needsReview} waiting to match`,
        action: "Match in ledger",
        href: "/transactions?status=needs-review",
      },
      {
        title: "Expiring memberships soon",
        value: alerts.expiringMemberships,
        detail: `${alerts.expiringMemberships} need renewal`,
        action: "Open renewal queue",
        href: "/people?filter=expiring",
      },
      {
        title: "Leads needing follow up today",
        value: alerts.followUps,
        detail: `${alerts.followUps} high intent`,
        action: "View CRM",
        href: "/people",
      },
    ];
  }, [alerts]);

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel">
        <p className="text-xs uppercase tracking-[0.35em] text-muted">To Do</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary">Attention Needed</h1>
        <p className="text-sm text-muted">
          Actionable tasks based on payments, members, and leads.
        </p>
        {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
      </div>

      <div className="glass-panel">
        <div className="flex flex-col gap-4">
          {items.length === 0 && <p className="text-sm text-muted">Loading tasks...</p>}
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4"
            >
              <p className="text-sm text-muted">{item.title}</p>
              <p className="mt-1 text-xl font-semibold text-primary">{item.value}</p>
              <p className="text-sm text-amber-700">{item.detail}</p>
              <button
                type="button"
                className="btn-primary mt-3 text-sm"
                onClick={() => router.push(item.href)}
              >
                {item.action}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
