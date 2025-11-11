const productSections = [
  {
    title: "Barn Gym Membership",
    description: "Class-based memberships that set the default access level.",
    items: [
      { name: "Barn Gym Membership · 8 Classes", price: "€210 / month", frequency: "Recurring", code: "BG-MEM-8" },
      { name: "Barn Gym Membership · Unlimited", price: "€260 / month", frequency: "Recurring", code: "BG-MEM-UNL" },
    ],
  },
  {
    title: "6 Week Transformation",
    description: "Focused programme that combines training, nutrition, and accountability.",
    items: [
      { name: "6 Week Transformation · Core", price: "€780", frequency: "One-time", code: "BG-6W-CORE" },
      { name: "6 Week Transformation · Executive", price: "€1,250", frequency: "One-time", code: "BG-6W-EXEC" },
    ],
  },
  {
    title: "Personal Training",
    description: "Session-based packs with coach assignment and commission logic.",
    items: [
      { name: "Personal Training · 5 Sessions", price: "€650", frequency: "Pack", code: "PT-5" },
      { name: "Personal Training · 10 Sessions", price: "€1,280", frequency: "Pack", code: "PT-10" },
    ],
  },
  {
    title: "Pay As You Go Classes",
    description: "Drop-ins + small groups, perfect for class-only revenue.",
    items: [
      { name: "Pay As You Go · Small Group", price: "€65 / session", frequency: "Per session", code: "PAYG-SMALL" },
      { name: "Pay As You Go · Solo Class", price: "€45 / class", frequency: "Per class", code: "PAYG-CLASS" },
    ],
  },
  {
    title: "Online & Corporate Coaching",
    description: "Remote-only programmes plus online coaching for distributed teams.",
    items: [
      { name: "Online Coaching", price: "€320 / month", frequency: "Recurring", code: "OC-BASE" },
      { name: "Corporate Online Coaching", price: "€520 / month", frequency: "Recurring", code: "OC-CORP" },
    ],
  },
];

export default function ProductsPage() {
  const currentOffers = [
    { name: "6 Week Challenge", plans: 1 },
    { name: "Barn Gym Membership", plans: 4 },
    { name: "Pay As You Go Small Group Training", plans: 2 },
    { name: "Personal Training", plans: 2 },
    { name: "Corporate Online Coaching", plans: 3 },
  ];

  return (
    <div className="flex flex-col gap-8 text-primary">
      <section className="glass-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">
              Current Offerings
            </p>
            <h2 className="text-3xl font-semibold">Plan Inventory</h2>
            <p className="text-sm text-muted">
              Mirrors Glofox exports with plan counts per SKU.
            </p>
          </div>
          <button className="chip text-sm">Export CSV</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Number of plans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/10">
              {currentOffers.map((offer) => (
                <tr key={offer.name}>
                  <td className="py-3 pr-4 font-semibold text-primary">{offer.name}</td>
                  <td className="pr-4 text-lg font-semibold text-emerald-700">{offer.plans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.35em] text-muted">
          Products & Services
        </p>
        <h1 className="text-3xl font-semibold">Offer Catalog</h1>
        <p className="text-sm text-muted">
          Define once, attribute everywhere. Reference codes flow into manual reconciliation.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(0,0,0,0.35)]">
            New Product
          </button>
          <button className="chip text-sm">Reference Rules</button>
          <button className="chip text-sm">Matching Thresholds</button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {productSections.map((section) => (
          <div key={section.title} className="glass-panel flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">
                {section.title}
              </p>
              <h3 className="mt-2 text-2xl font-semibold">{section.description}</h3>
            </div>
            <div className="flex flex-col gap-3">
              {section.items.map((item) => (
                <div
                  key={item.name}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{item.name}</p>
                    <p className="text-sm text-muted">{item.frequency}</p>
                  </div>
                    <p className="text-lg font-semibold text-emerald-700">{item.price}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="chip">{item.code}</span>
                    <button className="chip !bg-white !text-black !border-white">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="text-sm text-emerald-700">Map external SKUs →</button>
          </div>
        ))}
      </section>
    </div>
  );
}
