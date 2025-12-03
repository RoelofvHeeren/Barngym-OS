/* eslint-disable react/no-array-index-key */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TransactionRecord = {
  id: string;
  provider: string | null;
  amountMinor: number;
  currency: string | null;
  occurredAt: Date | string;
  personName?: string | null;
  productType?: string | null;
  status: string | null;
  confidence: string | null;
  reference?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown> | null;
};
export type { TransactionRecord };

type Props = {
  transactions: TransactionRecord[];
};

const DEFAULT_EMPTY_OPTION = "No data yet";

type MatchFilter = "all" | "matched" | "unmatched";
type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

function formatCurrency(minorUnits: number, currency: string) {
  const amount = minorUnits / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "EUR",
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Completed: "text-emerald-200 bg-emerald-400/10",
    Failed: "text-rose-200 bg-rose-400/10",
    "Needs Review": "text-amber-200 bg-amber-400/10",
    High: "text-emerald-200 bg-emerald-400/10",
    Medium: "text-sky-200 bg-sky-400/10",
    Matched: "text-emerald-200 bg-emerald-400/10",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        colors[status] ?? "bg-white/10 text-primary"
      }`}
    >
      {status}
    </span>
  );
}

export default function TransactionsClient({ transactions }: Props) {
  const router = useRouter();
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [search, setSearch] = useState("");

  const ledgerRows = useMemo(() => {
    const normalized = transactions.map((transaction) => ({
      id: transaction.id,
      person: transaction.personName ?? "Unassigned",
      amountMinor: transaction.amountMinor ?? 0,
      currency: transaction.currency ?? "GBP",
      source: transaction.provider ?? "Unknown",
      product: transaction.productType ?? "Uncategorized",
      status: transaction.status ?? "Needs Review",
      confidence: transaction.confidence ?? "Needs Review",
      occurredAt:
        typeof transaction.occurredAt === "string"
          ? transaction.occurredAt
          : transaction.occurredAt?.toISOString() ?? new Date().toISOString(),
      needsReview:
        !transaction.leadId ||
        (transaction.confidence ?? "").toLowerCase().includes("review") ||
        transaction.status === "Needs Review",
      reference: transaction.reference,
      leadId: transaction.leadId,
      email:
        (transaction.metadata as Record<string, unknown> | undefined)?.customer_email?.toString() ??
        (transaction.metadata as Record<string, unknown> | undefined)?.email?.toString() ??
        (transaction.metadata as Record<string, unknown> | undefined)?.customerEmail?.toString() ??
        "",
    }));

    let filtered = normalized;
    if (sourceFilter !== "All") {
      filtered = filtered.filter((tx) => tx.source.toLowerCase().includes(sourceFilter.toLowerCase()));
    }
    if (matchFilter === "matched") {
      filtered = filtered.filter((tx) => Boolean(tx.leadId));
    } else if (matchFilter === "unmatched") {
      filtered = filtered.filter((tx) => !tx.leadId);
    }
    if (search.trim().length) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.person.toLowerCase().includes(term) ||
          tx.product.toLowerCase().includes(term) ||
          (tx.reference ?? "").toLowerCase().includes(term) ||
          tx.source.toLowerCase().includes(term)
      );
    }

    filtered = filtered.sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      }
      if (sortBy === "date_asc") {
        return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
      }
      if (sortBy === "amount_desc") {
        return b.amountMinor - a.amountMinor;
      }
      return a.amountMinor - b.amountMinor;
    });

    return filtered;
  }, [transactions, sourceFilter, matchFilter, sortBy, search]);

  const hasData = transactions.length > 0;
  const uniqueSources = Array.from(
    new Set(transactions.map((transaction) => transaction.provider || "Unknown").filter(Boolean))
  ).sort();

  return (
    <div className="flex flex-col gap-8 text-primary">
      <section className="glass-panel flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Payments & Transactions</p>
          <h1 className="text-3xl font-semibold">Unified Ledger</h1>
          <p className="text-sm text-muted">
            Occurred date shown below. Use filters to slice by source, match status, and sort.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            type="text"
            placeholder="Search name, reference, source"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!hasData}
          />
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            disabled={!hasData}
          >
            <option className="bg-[#031018] text-primary" value="All">
              All Sources
            </option>
            {uniqueSources.map((type) => (
              <option key={type} className="bg-[#031018] text-primary" value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary"
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value as MatchFilter)}
            disabled={!hasData}
          >
            <option className="bg-[#031018] text-primary" value="all">
              All (Matched + Unmatched)
            </option>
            <option className="bg-[#031018] text-primary" value="matched">
              Matched only
            </option>
            <option className="bg-[#031018] text-primary" value="unmatched">
              Unmatched only
            </option>
          </select>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            disabled={!hasData}
          >
            <option className="bg-[#031018] text-primary" value="date_desc">
              Newest first
            </option>
            <option className="bg-[#031018] text-primary" value="date_asc">
              Oldest first
            </option>
            <option className="bg-[#031018] text-primary" value="amount_desc">
              Amount high → low
            </option>
            <option className="bg-[#031018] text-primary" value="amount_asc">
              Amount low → high
            </option>
          </select>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-white/10 transition"
          >
            Refresh now
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/transactions/manual" className="text-emerald-200 underline">
            Manual match queue
          </Link>
          <span className="text-muted">•</span>
          <span className="text-muted">Occurred dates are shown; upload date is not used for filtering.</span>
        </div>
      </section>

      <section className="glass-panel">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Financial Truth Table</h2>
          <p className="text-sm text-muted">
            Click “Fix” on unmatched rows to open the manual queue. Showing occurred date (not upload date).
          </p>
        </div>
        {!ledgerRows.length ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-muted">
            No transactions match your filters. Adjust filters or wait for the next ingest.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  {[
                    "Occurred",
                    "Person",
                    "Amount",
                    "Source",
                    "Product Type",
                    "Status",
                    "Confidence",
                    "Actions",
                  ].map((header) => (
                    <th key={header} className="pb-3 pr-4 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ledgerRows.map((transaction, index) => (
                  <tr key={`${transaction.id}-${index}`}>
                    <td className="py-4 pr-4 text-muted">{formatDateTime(transaction.occurredAt)}</td>
                    <td
                    className={`pr-4 font-semibold ${
                      transaction.leadId ? "text-primary" : "text-amber-200"
                    }`}
                  >
                    {transaction.person}
                    {transaction.email ? (
                      <div className="text-xs text-muted">Email: {transaction.email}</div>
                    ) : null}
                    {transaction.reference ? (
                      <div className="text-xs text-muted">Ref: {transaction.reference}</div>
                    ) : null}
                  </td>
                    <td className="pr-4 font-semibold text-primary">
                      {formatCurrency(transaction.amountMinor ?? 0, transaction.currency ?? "GBP")}
                    </td>
                    <td className="pr-4 text-muted">{transaction.source ?? "Unknown"}</td>
                    <td className="pr-4 text-muted">{transaction.product}</td>
                    <td className="pr-4">
                      <StatusBadge status={transaction.status} />
                    </td>
                    <td className="pr-4">
                      <StatusBadge status={transaction.leadId ? "Matched" : transaction.confidence} />
                    </td>
                    <td>
                      {transaction.needsReview || !transaction.leadId ? (
                        <Link
                          href={`/transactions/manual?transactionId=${transaction.id}`}
                          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                        >
                          Fix
                        </Link>
                      ) : (
                        <span className="text-xs text-emerald-200">Matched</span>
                      )}
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
