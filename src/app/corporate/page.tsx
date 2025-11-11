const corporateClients = [
  { name: "Riverside Legal", headcount: 82, revenue: "€182k", lastActivity: "Townhall · 08 Sep" },
  { name: "Nova Printworks", headcount: 54, revenue: "€126k", lastActivity: "Retreat Planning · 07 Sep" },
  { name: "Northshore Legal", headcount: 44, revenue: "€98k", lastActivity: "Wellness Report · 06 Sep" },
];

export default function CorporatePage() {
  return (
    <div className="flex flex-col gap-8 text-primary">
      <section className="glass-panel flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.35em] text-muted">
          Corporate Dashboard (Placeholder)
        </p>
        <h1 className="text-3xl font-semibold">Phase 2 · Corporate Engagement</h1>
        <p className="text-sm text-muted">
          Track ROI per client, adoption, and renewal health. Designed now so dev work later is painless.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {["Active contracts", "Employees enrolled", "Renewals due"].map((label, index) => (
          <div key={label} className="glass-panel">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">{label}</p>
            <p className="mt-3 text-4xl font-semibold">
              {index === 0 ? "14" : index === 1 ? "612" : "3 this quarter"}
            </p>
            <p className="text-sm text-muted">
              Placeholder metric to show space allocation + style.
            </p>
          </div>
        ))}
      </section>

      <section className="glass-panel">
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-semibold">Corporate Clients</h3>
          <p className="text-sm text-muted">Future view: ROI, engagement, headcount, notes.</p>
        </div>
        <div className="mt-4 space-y-3">
          {corporateClients.map((client) => (
            <div
              key={client.name}
              className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{client.name}</p>
                  <p className="text-sm text-muted">{client.lastActivity}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">{client.headcount} enrolled</p>
                  <p className="text-lg font-semibold text-emerald-200">{client.revenue}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Phase 2 dev note: include corporate scorecards + shareable PDF exports.
        </p>
      </section>
    </div>
  );
}
