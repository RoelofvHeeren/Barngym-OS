import { Plus } from "lucide-react";

type PipelineStage = {
    id: string;
    title: string;
    cards: PipelineCard[];
};

type PipelineCard = {
    id: string;
    companyName: string;
    contactName: string;
    offerType: "Coaching" | "Retreat" | "Workshop";
    value: string;
    nextAction: string;
    lastUpdated: string;
};

const stages: PipelineStage[] = [
    {
        id: "new",
        title: "New Inquiry",
        cards: [
            {
                id: "1",
                companyName: "TechFlow Systems",
                contactName: "Sarah Jenkins",
                offerType: "Retreat",
                value: "£12,000",
                nextAction: "Initial call scheduled",
                lastUpdated: "2h ago",
            },
            {
                id: "2",
                companyName: "Bright Path",
                contactName: "Mike Ross",
                offerType: "Workshop",
                value: "£3,500",
                nextAction: "Review inquiry form",
                lastUpdated: "5h ago",
            },
        ],
    },
    {
        id: "qualified",
        title: "Qualified",
        cards: [
            {
                id: "3",
                companyName: "Apex Legal",
                contactName: "Jessica Pearson",
                offerType: "Coaching",
                value: "£4,200/mo",
                nextAction: "Send brochure",
                lastUpdated: "1d ago",
            },
        ],
    },
    {
        id: "discovery",
        title: "Discovery Call",
        cards: [],
    },
    {
        id: "proposal",
        title: "Proposal Sent",
        cards: [
            {
                id: "4",
                companyName: "Global Corp",
                contactName: "Harvey Specter",
                offerType: "Retreat",
                value: "£25,000",
                nextAction: "Follow up on proposal",
                lastUpdated: "3d ago",
            },
        ],
    },
    {
        id: "negotiation",
        title: "Negotiation",
        cards: [],
    },
    {
        id: "won",
        title: "Closed Won",
        cards: [
            {
                id: "5",
                companyName: "Pearson Hardman",
                contactName: "Louis Litt",
                offerType: "Coaching",
                value: "£15,000",
                nextAction: "Onboarding scheduled",
                lastUpdated: "1w ago",
            },
        ],
    },
    {
        id: "lost",
        title: "Closed Lost",
        cards: [],
    },
];

export default function CorporatePipeline() {
    return (
        <div className="glass-panel w-full overflow-hidden">
            <div className="mb-6 flex items-center justify-between px-1">
                <div>
                    <h2 className="text-xl font-semibold">Corporate Pipeline</h2>
                    <p className="text-sm text-muted">Track leads across the full corporate sales cycle.</p>
                </div>
                <button className="btn-primary flex items-center gap-2 text-sm shadow-lg hover:shadow-xl">
                    <Plus size={16} />
                    <span>New Lead</span>
                </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.map((stage) => (
                    <div key={stage.id} className="min-w-[280px] flex-shrink-0">
                        <div className="mb-3 flex items-center justify-between px-2">
                            <h3 className="font-medium text-primary">{stage.title}</h3>
                            <span className="rounded-full bg-emerald-900/5 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                {stage.cards.length}
                            </span>
                        </div>

                        <div className="flex flex-col gap-3">
                            {stage.cards.map((card) => (
                                <div
                                    key={card.id}
                                    className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-white/40 bg-white/40 p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-white/60 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between">
                                        <p className="font-bold text-primary">{card.companyName}</p>
                                        <span className="rounded-md bg-emerald-100/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                                            {card.offerType}
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-sm text-muted">{card.contactName}</p>
                                        <p className="text-sm font-semibold text-emerald-700">{card.value}</p>
                                    </div>

                                    <div className="border-t border-emerald-900/5 pt-2">
                                        <p className="text-xs text-muted">Let's {card.nextAction.toLowerCase()}</p>
                                        <p className="mt-1 text-[10px] text-muted opacity-60">Updated {card.lastUpdated}</p>
                                    </div>
                                </div>
                            ))}

                            {stage.cards.length === 0 && (
                                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-emerald-900/10 bg-black/[0.02]">
                                    <p className="text-xs text-muted opacity-50">No leads</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
