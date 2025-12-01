"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Goal = {
  id: string;
  category: string;
  period: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  notes?: string | null;
};

type RevenueTotals = {
  total: number;
  pt: number;
  classes: number;
  online: number;
  corporate: number;
  retreats: number;
  yearToDate: number;
  quarterTotals: Record<number, number>;
};

type ApiPayload = { ok: boolean; goals: Goal[]; revenue: RevenueTotals };

function progressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-400";
  return "bg-rose-500";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function ProgressBox({ name, target, actual }: { name: string; target: number; actual: number }) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-primary">{name}</h3>
      <p className="text-sm text-muted">Goal: {formatCurrency(target)}</p>
      <p className="text-sm text-primary">Achieved: {formatCurrency(actual)}</p>
      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${progressColor(pct)}`}
          style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">Progress: {pct.toFixed(1)}%</p>
    </div>
  );
}

export default function GoalsPage() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "Total Revenue",
    period: "Yearly",
    targetAmount: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/goals", { cache: "no-store" });
      const json = (await resp.json()) as ApiPayload;
      if (!json.ok) throw new Error(json as any);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitGoal = async () => {
    try {
      const resp = await fetch("/api/goals/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          period: form.period,
          targetAmount: Number(form.targetAmount),
          notes: form.notes || undefined,
        }),
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.message || "Failed to add goal.");
      setForm((p) => ({ ...p, targetAmount: "", notes: "" }));
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add goal.");
    }
  };

  const goals = data?.goals ?? [];
  const revenue: RevenueTotals =
    data?.revenue ?? {
      total: 0,
      pt: 0,
      classes: 0,
      online: 0,
      corporate: 0,
      retreats: 0,
      yearToDate: 0,
      quarterTotals: { 1: 0, 2: 0, 3: 0, 4: 0 },
    };

  const yearlyGoal = goals
    .filter((g) => g.category.toLowerCase() === "total revenue" && g.period.toLowerCase() === "yearly")
    .reduce((sum, g) => sum + g.targetAmount, 0);
  const yearlyActual = revenue.total;

  const pctYear = yearlyGoal > 0 ? (yearlyActual / yearlyGoal) * 100 : 0;
  const remaining = Math.max(yearlyGoal - yearlyActual, 0);
  const daysPassed =
    (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) /
      (1000 * 60 * 60 * 24) +
    1;
  const velocity = daysPassed > 0 ? yearlyActual / daysPassed : 0;
  const projected = velocity * 365;
  const pace = projected >= yearlyGoal ? "Above pace — keep pressure!" : "Below projection — adjust!";

  const quarterlyGoals = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
    const goal = goals
      .filter((g) => g.category.toLowerCase() === q.toLowerCase() && g.period.toLowerCase() === "quarterly")
      .reduce((sum, g) => sum + g.targetAmount, 0);
    const actual = revenue.quarterTotals[Number(q.replace("Q", ""))] ?? 0;
    const pct = goal > 0 ? (actual / goal) * 100 : 0;
    return { q, goal, actual, pct };
  });

  const streamCards = [
    { key: "PT", actual: revenue.pt },
    { key: "Classes", actual: revenue.classes },
    { key: "Online Coaching", actual: revenue.online },
    { key: "Corporate Wellness", actual: revenue.corporate },
    { key: "Retreats", actual: revenue.retreats },
  ].map((s) => {
    const goalVal = goals
      .filter(
        (g) =>
          g.category.toLowerCase() === s.key.toLowerCase() &&
          g.period.toLowerCase() === "yearly"
      )
      .reduce((sum, g) => sum + g.targetAmount, 0);
    return { ...s, goal: goalVal };
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Business Goals</p>
          <h1 className="text-3xl font-semibold text-primary">Goals & Performance</h1>
          <p className="text-sm text-muted">Targets vs real performance. Live from unified transactions.</p>
        </div>
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-primary"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-rose-100">
          {error}
        </div>
      )}
      {loading && <div className="text-muted">Loading…</div>}

      {!loading && (
        <>
          {/* Summary */}
          <section className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Annual Target</p>
              <h2 className="text-2xl font-semibold text-primary">{formatCurrency(yearlyGoal)}</h2>
              <p className="text-sm text-muted">
                Revenue to date: {formatCurrency(yearlyActual)} ({pctYear.toFixed(1)}%)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">Remaining: {formatCurrency(remaining)}</p>
              <p className="text-sm text-muted">
                Pace: {formatCurrency(velocity)}/day · Projected: {formatCurrency(projected)}
              </p>
              <p className={`text-sm font-semibold ${pace.includes("Above") ? "text-emerald-400" : "text-rose-300"}`}>
                {pace}
              </p>
            </div>
            <div className="h-3 w-full rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${progressColor(pctYear)}`}
                style={{ width: `${Math.min(pctYear, 100)}%` }}
              />
            </div>
          </section>

          {/* Yearly goal card */}
          <section className="glass-panel p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Yearly Goal</p>
            <ProgressBox name="Total Revenue" target={yearlyGoal} actual={yearlyActual} />
          </section>

          {/* Quarterly grid */}
          <section className="glass-panel p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Quarterly Breakdown</p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {quarterlyGoals.map((q) => (
                <div key={q.q} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-primary">{q.q}</p>
                  <p className="text-xs text-muted">Goal: {formatCurrency(q.goal)}</p>
                  <p className="text-xs text-primary">Actual: {formatCurrency(q.actual)}</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${progressColor(q.pct)}`}
                      style={{ width: `${Math.min(q.pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">{q.pct.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </section>

          {/* Stream performance */}
          <section className="glass-panel p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Revenue Streams</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {streamCards.map((s) => (
                <ProgressBox key={s.key} name={s.key} target={s.goal} actual={s.actual} />
              ))}
            </div>
          </section>

          {/* Admin */}
          <section className="glass-panel p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Admin · Goals</p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder="Category (e.g. PT, Q1)"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
              <select
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                value={form.period}
                onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}
              >
                <option>Yearly</option>
                <option>Quarterly</option>
                <option>Monthly</option>
              </select>
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                type="number"
                placeholder="Target amount"
                value={form.targetAmount}
                onChange={(e) => setForm((p) => ({ ...p, targetAmount: e.target.value }))}
              />
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                onClick={submitGoal}
              >
                Add Goal
              </button>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Existing Goals</p>
              <div className="mt-2 space-y-2 text-sm">
                {goals.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <span>
                      {g.category} · {g.period} · {formatCurrency(g.targetAmount)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">{g.notes}</span>
                      <button
                        className="text-xs text-rose-300 underline"
                        onClick={async () => {
                          if (!confirm("Delete goal?")) return;
                          const resp = await fetch("/api/goals/new", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: g.id }),
                          });
                          const json = await resp.json();
                          if (!json.ok) {
                            alert(json.message || "Delete failed");
                            return;
                          }
                          load();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
