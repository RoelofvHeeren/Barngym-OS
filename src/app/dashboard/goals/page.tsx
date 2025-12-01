 "use client";

import { useEffect, useMemo, useState } from "react";

type Stream = "total" | "classes" | "pt" | "online_coaching" | "corporate" | "retreats";

type Goal = {
  id: string;
  year: number;
  quarter: number | null;
  revenueStream: Stream;
  targetAmount: string;
};

type AchievedEntry = {
  stream: Stream;
  ytd: number;
  qtd: number;
  month: number;
};

type ApiPayload = {
  ok: boolean;
  goals: Goal[];
  achieved: AchievedEntry[];
};

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
    year: new Date().getFullYear(),
    quarter: "",
    revenueStream: "total" as Stream,
    targetAmount: "",
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
          year: Number(form.year),
          quarter: form.quarter ? Number(form.quarter) : null,
          revenueStream: form.revenueStream,
          targetAmount: Number(form.targetAmount),
        }),
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.message || "Failed to add goal.");
      setForm((prev) => ({ ...prev, targetAmount: "" }));
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add goal.");
    }
  };

  const achieved = data?.achieved ?? [];
  const goals = data?.goals ?? [];
  const streams: Stream[] = ["total", "classes", "pt", "online_coaching", "corporate", "retreats"];

  const byStream = useMemo(() => {
    const map = new Map<Stream, { goal: number; actual: number }>();
    streams.forEach((s) => {
      const goal = goals
        .filter((g) => g.revenueStream === s && g.quarter == null)
        .reduce((sum, g) => sum + Number(g.targetAmount), 0);
      const actual = achieved.find((a) => a.stream === s)?.ytd ?? 0;
      map.set(s, { goal, actual });
    });
    return map;
  }, [goals, achieved]);

  const currentYear = new Date().getFullYear();
  const yearlyGoal = goals
    .filter((g) => g.revenueStream === "total" && g.year === currentYear && g.quarter == null)
    .reduce((sum, g) => sum + Number(g.targetAmount), 0);
  const yearlyActual = achieved.find((a) => a.stream === "total")?.ytd ?? 0;

  const pctYear = yearlyGoal > 0 ? (yearlyActual / yearlyGoal) * 100 : 0;
  const remaining = Math.max(yearlyGoal - yearlyActual, 0);
  const daysPassed =
    (Date.now() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24) + 1;
  const velocity = daysPassed > 0 ? yearlyActual / daysPassed : 0;
  const projected = velocity * 365;
  const pace = projected >= yearlyGoal ? "On pace" : "Behind";

  const quarter = Math.floor(new Date().getMonth() / 3) + 1;
  const quarterGoal = goals
    .filter((g) => g.revenueStream === "total" && g.year === currentYear && g.quarter === quarter)
    .reduce((sum, g) => sum + Number(g.targetAmount), 0);
  const quarterActual = achieved.find((a) => a.stream === "total")?.qtd ?? 0;
  const pctQuarter = quarterGoal > 0 ? (quarterActual / quarterGoal) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Dashboard</p>
          <h1 className="text-3xl font-semibold text-primary">Revenue Goals</h1>
          <p className="text-sm text-muted">Targets vs real performance. Live data.</p>
        </div>
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-primary"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-rose-100">{error}</div>}
      {loading && <div className="text-muted">Loading…</div>}

      {!loading && (
        <>
          {/* Yearly overview */}
          <section className="glass-panel grid gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted">Yearly Overview</p>
                <h2 className="text-2xl font-semibold text-primary">{currentYear}</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted">Goal: {formatCurrency(yearlyGoal)}</p>
                <p className="text-sm text-primary">Achieved: {formatCurrency(yearlyActual)}</p>
                <p className="text-sm text-muted">
                  Remaining: {formatCurrency(remaining)} · {pace} · Pace: {formatCurrency(velocity)}/day
                </p>
                <p className="text-sm text-muted">
                  Projected: {formatCurrency(projected)} ({pctYear.toFixed(1)}%)
                </p>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${progressColor(pctYear)}`}
                style={{ width: `${Math.min(pctYear, 100)}%` }}
              />
            </div>
          </section>

          {/* Quarterly breakdown */}
          <section className="glass-panel p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Quarterly</p>
            <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
              {[1, 2, 3, 4].map((q) => {
                const goalQ = goals
                  .filter((g) => g.revenueStream === "total" && g.year === currentYear && g.quarter === q)
                  .reduce((sum, g) => sum + Number(g.targetAmount), 0);
                const actualQ = achieved.find((a) => a.stream === "total")?.qtd ?? 0;
                const pctQ = goalQ > 0 ? (actualQ / goalQ) * 100 : 0;
                return (
                  <div key={q} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-primary">Q{q}</p>
                    <p className="text-xs text-muted">Goal: {formatCurrency(goalQ)}</p>
                    <p className="text-xs text-primary">Actual: {formatCurrency(actualQ)}</p>
                    <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${progressColor(pctQ)}`}
                        style={{ width: `${Math.min(pctQ, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1">{pctQ.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Streams */}
          <section className="glass-panel p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Streams</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {streams.map((s) => {
                const entry = byStream.get(s)!;
                return (
                  <ProgressBox
                    key={s}
                    name={s.replace("_", " ").toUpperCase()}
                    target={entry.goal}
                    actual={entry.actual}
                  />
                );
              })}
            </div>
          </section>

          {/* Admin */}
          <section className="glass-panel p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Admin · Goals</p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                type="number"
                placeholder="Year"
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))}
              />
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                type="number"
                placeholder="Quarter (1-4 optional)"
                value={form.quarter}
                onChange={(e) => setForm((p) => ({ ...p, quarter: e.target.value }))}
              />
              <select
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                value={form.revenueStream}
                onChange={(e) => setForm((p) => ({ ...p, revenueStream: e.target.value as Stream }))}
              >
                {streams.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                type="number"
                placeholder="Target amount"
                value={form.targetAmount}
                onChange={(e) => setForm((p) => ({ ...p, targetAmount: e.target.value }))}
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
                      {g.year} {g.quarter ? `Q${g.quarter}` : "Year"} · {g.revenueStream} ·{" "}
                      {formatCurrency(Number(g.targetAmount))}
                    </span>
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
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
