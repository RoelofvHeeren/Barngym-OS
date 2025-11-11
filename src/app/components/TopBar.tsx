"use client";

import { Bell, CalendarCheck2, RefreshCw } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex flex-col gap-4 border-b border-emerald-900/10 px-8 pb-5 pt-6 text-primary md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-muted">Barn Gym OS</p>
        <h2 className="mt-2 text-3xl font-semibold">Operations Console</h2>
        <p className="text-sm text-muted">
          Premium, calm, confident. Everything modular and one click away.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="chip text-sm">
          <CalendarCheck2 size={16} />
          Daily Brief Ready
        </button>
        <button className="chip text-sm">
          <Bell size={16} />
          4 alerts
        </button>
        <button className="flex items-center gap-2 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
          <RefreshCw size={16} />
          Backfill 90 days
        </button>
      </div>
    </header>
  );
}

export default TopBar;
