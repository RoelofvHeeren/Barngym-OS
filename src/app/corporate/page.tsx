const corporateClients = [
  { name: "Riverside Legal", headcount: 82, revenue: "€182k", lastActivity: "Townhall · 08 Sep" },
  { name: "Nova Printworks", headcount: 54, revenue: "€126k", lastActivity: "Retreat Planning · 07 Sep" },
  { name: "Northshore Legal", headcount: 44, revenue: "€98k", lastActivity: "Wellness Report · 06 Sep" },
];

import CorporatePipeline from "./components/CorporatePipeline";
import OfferPerformance from "./components/OfferPerformance";
import CorporateClients from "./components/CorporateClients";
import DocumentLibrary from "./components/DocumentLibrary";

export default function CorporatePage() {
  const kpiCards = [
    { label: "Total Corporate Revenue", value: "€842k", sub: "YTD Revenue" },
    { label: "MRR from Corporate Coaching", value: "€32k", sub: "+8% vs last month" },
    { label: "Retreat Revenue", value: "€210k", sub: "12 retreats delivered" },
    { label: "Workshop Revenue", value: "€45k", sub: "18 workshops delivered" },
    { label: "Forecasted Revenue", value: "€1.2m", sub: "Weighted pipeline" },
  ];

  return (
    <div className="flex flex-col gap-10 text-primary pb-10">
      {/* Tier 1 - Header (Already in Layout, but we can add specific page context if needed) */}
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Corporate Dashboard</h1>
        <p className="text-sm text-muted">
          Overview of corporate engagement, pipeline, and revenue performance.
        </p>
      </section>

      {/* Tier 2 - KPI Row */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <div key={card.label} className="glass-panel flex flex-col gap-2 p-6">
            <p className="text-xs uppercase tracking-wider text-muted">{card.label}</p>
            <p className="text-3xl font-semibold">{card.value}</p>
            <p className="text-xs text-muted opacity-80">{card.sub}</p>
          </div>
        ))}
      </section>

      {/* Tier 3 - Main Content Grid */}
      <div className="flex flex-col gap-10">

        {/* Tier 3.1 - Corporate Pipeline */}
        <CorporatePipeline />

        {/* Tier 3.2 - Offer Performance */}
        <OfferPerformance />

        {/* Tier 3.3 - Corporate Clients */}
        <CorporateClients />

        {/* Tier 3.4 - Document Library */}
        <DocumentLibrary />

      </div>
    </div>
  );
}
