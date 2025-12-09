"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function PipelineCardItem({ lead, onClick }: { lead: any; onClick?: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: lead.id,
        data: {
            type: "Card",
            lead,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const offerType = lead.activities && lead.activities.length > 0 ? lead.activities[0] : "General";

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-white/40 bg-white/40 p-4 shadow-sm transition-all hover:bg-white/60 hover:shadow-md ${isDragging ? "ring-2 ring-emerald-500 ring-offset-2" : ""
                }`}
        >
            <div className="flex items-start justify-between">
                <p className="font-bold text-primary truncate max-w-[150px]">{lead.companyName || "Unknown Company"}</p>
                <span className="rounded-md bg-emerald-100/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    {offerType}
                </span>
            </div>

            <div>
                <p className="text-sm text-muted">{lead.pocName || "No Contact"}</p>
                {lead.valueMinor ? (
                    <p className="text-sm font-semibold text-emerald-700">
                        €{(lead.valueMinor / 100).toLocaleString()}
                    </p>
                ) : null}
            </div>

            <div className="border-t border-emerald-900/5 pt-2 flex justify-between items-end">
                <p className="text-xs text-muted truncate max-w-[180px]">
                    {lead.contractDuration ? `${lead.contractDuration}` : 'No duration'}
                </p>
                <p className="text-[10px] text-muted opacity-60">
                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                </p>
            </div>
        </div>
    );
}
