import { readTransactions, TransactionRecord } from "@/lib/transactionStore";

const DEFAULT_EMPTY_OPTION = "No data yet";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DATE_RANGE = (() => {
  const now = new Date();
  return {
    end: now,
    start: new Date(now.getTime() - ONE_WEEK_MS),
  };
})();

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

function toInputDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Completed: "text-emerald-200 bg-emerald-400/10",
    Failed: "text-rose-200 bg-rose-400/10",
    "Needs Review": "text-amber-200 bg-amber-400/10",
    High: "text-emerald-200 bg-emerald-400/10",
    Medium: "text-sky-200 bg-sky-400/10",
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

function buildLedgerRows(transactions: TransactionRecord[]) {
  return transactions.map((transaction) => ({
    id: transaction.id,
    person: transaction.personName ?? "Unassigned",
    amount: formatCurrency(transaction.amountMinor ?? 0, transaction.currency ?? "EUR"),
    source: transaction.source ?? "Unknown",
    product: transaction.productType ?? "Uncategorized",
    status: transaction.status ?? "Needs Review",
    confidence: transaction.confidence ?? "Needs Review",
    date: formatDateTime(transaction.occurredAt),
    needsReview:
      (transaction.confidence ?? "").toLowerCase().includes("review") ||
      transaction.status === "Needs Review",
    reference: transaction.reference,
  }));
}

export default async function TransactionsPage() {
  const transactions = await readTransactions();
  const hasData = transactions.length > 0;
  const ledgerRows = buildLedgerRows(transactions);

  const uniqueSources = Array.from(
    new Set(transactions.map((transaction) => transaction.source).filter(Boolean))
  ).sort();
  const uniqueStatuses = Array.from(
    new Set(transactions.map((transaction) => transaction.status).filter(Boolean))
  ).sort();
  const uniqueProducts = Array.from(
    new Set(
      transactions.map((transaction) => transaction.productType ?? "Uncategorized").filter(Boolean)
    )
  ).sort();

  const endDate = hasData ? new Date(transactions[0].occurredAt) : DEFAULT_DATE_RANGE.end;
  const startDate = hasData
    ? new Date(transactions[transactions.length - 1].occurredAt)
    : DEFAULT_DATE_RANGE.start;

  return (
    <div className="flex flex-col gap-8 text-primary">
      <section className="glass-panel flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Payments & Transactions</p>
          <h1 className="text-3xl font-semibold">Unified Ledger</h1>
          <p className="text-sm text-muted">
            Every source normalized. Confidence scoring built in.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            type="date"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted"
            defaultValue={toInputDateValue(startDate)}
            disabled={!hasData}
          />
          <input
            type="date"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted"
            defaultValue={toInputDateValue(endDate)}
            disabled={!hasData}
          />
          {uniqueSources.length ? (
            <select className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary">
              {uniqueSources.map((type) => (
                <option key={type} className="bg-[#031018] text-primary">
                  {type}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
              {DEFAULT_EMPTY_OPTION}
            </div>
          )}
          {uniqueStatuses.length ? (
            <select className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary">
              {uniqueStatuses.map((status) => (
                <option key={status} className="bg-[#031018] text-primary">
                  {status}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
              {DEFAULT_EMPTY_OPTION}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(uniqueProducts.length ? uniqueProducts : [DEFAULT_EMPTY_OPTION]).map((product, index) => (
            <button
              key={product}
              className={`chip ${
                index === 0 && product !== DEFAULT_EMPTY_OPTION ? "!bg-white !text-black !border-white" : ""
              } ${product === DEFAULT_EMPTY_OPTION ? "!cursor-default opacity-60" : ""}`}
              disabled={product === DEFAULT_EMPTY_OPTION}
            >
              {product}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-panel">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Financial Truth Table</h2>
          <p className="text-sm text-muted">
            Click any name to jump to their profile. Actions are one click away.
          </p>
        </div>
        {!ledgerRows.length ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-muted">
            No transactions yet. Run a backfill from the Connections page or wait for the next webhook
            to populate this ledger.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  {[
                    "Date",
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
                {ledgerRows.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="py-4 pr-4 text-muted">{transaction.date}</td>
                    <td className="pr-4 font-semibold text-primary">{transaction.person}</td>
                    <td className="pr-4 font-semibold text-primary">{transaction.amount}</td>
                    <td className="pr-4 text-muted">{transaction.source}</td>
                    <td className="pr-4 text-muted">{transaction.product}</td>
                    <td className="pr-4">
                      <StatusBadge status={transaction.status} />
                    </td>
                    <td className="pr-4">
                      <StatusBadge status={transaction.confidence} />
                    </td>
                    <td>
                      {transaction.needsReview ? (
                        <button className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">
                          Match to Person
                        </button>
                      ) : (
                        <button className="text-xs text-emerald-200">View</button>
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
