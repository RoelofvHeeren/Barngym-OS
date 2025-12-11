import CorporatePipeline from "./components/CorporatePipeline";
import OfferPerformance from "./components/OfferPerformance";
import CorporateClients from "./components/CorporateClients";
import DocumentLibrary from "./components/DocumentLibrary";
import { getCorporatePipeline, getCorporateClients, getCorporateOverview } from "./actions";

export default async function CorporatePage() {
  const pipelineData = await getCorporatePipeline();
  const clientData = await getCorporateClients();
  const overviewData = await getCorporateOverview();

  const kpiCards = [
    {
      label: "Total Corporate Revenue",
      value: `€${Math.round((overviewData.totalRevenue || 0) / 100).toLocaleString()}`,
      sub: "YTD Revenue"
    },
    {
      label: "Active Corporate Clients",
      value: overviewData.activeContracts.toString(),
      sub: "Current active contracts"
    },
    // { label: "Retreat Revenue", value: "€210k", sub: "12 retreats delivered" },
    // { label: "Workshop Revenue", value: "€45k", sub: "18 workshops delivered" },
    // { label: "Forecasted Revenue", value: "€1.2m", sub: "Weighted pipeline" },
  ];

  return (
    <div className="flex flex-col gap-10 text-primary pb-10 w-full max-w-full overflow-x-hidden">
      {/* Tier 1 - Header */}
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Corporate Dashboard</h1>
        <p className="text-sm text-muted">
          Overview of corporate engagement, pipeline, and revenue performance.
        </p>
      </section>

      {/* Tier 2 - KPI Row */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        <CorporatePipeline initialData={pipelineData} />

        {/* Tier 3.2 - Offer Performance */}
        <OfferPerformance overview={overviewData} />

        {/* Tier 3.3 - Corporate Clients */}
        <CorporateClients clients={clientData} />

        {/* Tier 3.4 - Document Library */}
        <DocumentLibrary />

      </div>
    </div>
  );
}
