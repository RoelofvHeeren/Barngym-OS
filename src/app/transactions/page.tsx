const paymentTypes = ["All Types", "Stripe", "Glofox", "Bank Transfer"];
const productTypes = [
  "Personal Training",
  "Membership",
  "Pay-As-You-Go",
  "Online Coaching",
  "Corporate Retreat",
];
const statuses = ["Completed", "Failed", "Needs Review"];

const transactions = [
  {
    date: "09 Sep · 08:42",
    person: "Riverside Legal",
    amount: "€9,950",
    source: "Bank",
    product: "Corporate Membership",
    status: "Needs Review",
    confidence: "Needs Review",
  },
  {
    date: "09 Sep · 07:55",
    person: "Maya Flores",
    amount: "€420",
    source: "Stripe",
    product: "Membership",
    status: "Completed",
    confidence: "High",
  },
  {
    date: "08 Sep · 19:14",
    person: "Ronan Boyd",
    amount: "€220",
    source: "Glofox",
    product: "Pay-As-You-Go",
    status: "Completed",
    confidence: "High",
  },
  {
    date: "08 Sep · 16:01",
    person: "Nova Printworks",
    amount: "€12,600",
    source: "Bank",
    product: "Corporate Retreat",
    status: "Completed",
    confidence: "Medium",
  },
  {
    date: "08 Sep · 13:22",
    person: "Sasha Bright",
    amount: "€640",
    source: "Stripe",
    product: "Personal Training",
    status: "Failed",
    confidence: "Needs Review",
  },
];

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
      className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status] ?? "bg-white/10 text-primary"}`}
    >
      {status}
    </span>
  );
}

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-8 text-primary">
      <section className="glass-panel flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.35em] text-muted">
            Payments & Transactions
          </p>
          <h1 className="text-3xl font-semibold">Unified Ledger</h1>
          <p className="text-sm text-muted">
            Every source normalized. Confidence scoring built in.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            type="date"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted"
            defaultValue="2024-09-03"
          />
          <input
            type="date"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted"
            defaultValue="2024-09-09"
          />
          <select className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary">
            {paymentTypes.map((type) => (
              <option key={type} className="bg-[#031018] text-primary">
                {type}
              </option>
            ))}
          </select>
          <select className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary">
            {statuses.map((status) => (
              <option key={status} className="bg-[#031018] text-primary">
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {productTypes.map((product, index) => (
            <button
              key={product}
              className={`chip ${
                index === 0 ? "!bg-white !text-black !border-white" : ""
              }`}
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
              {transactions.map((transaction) => (
                <tr key={`${transaction.person}-${transaction.date}`}>
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
                    {transaction.status === "Needs Review" ? (
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
      </section>
    </div>
  );
}
