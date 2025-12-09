"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
    DndContext,
    DragOverlay,
    useSensors,
    useSensor,
    PointerSensor,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    closestCorners,
} from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { updateLeadStage } from "../actions";
import { PipelineStageColumn } from "./PipelineStageColumn";
import { PipelineCardItem } from "./PipelineCardItem";
import CreateCorporateLeadDialog from "./CreateCorporateLeadDialog";
import CompanyProfileDialog from "./CompanyProfileDialog";

type PipelineStage = {
    id: string;
    title: string;
};

const STAGES: PipelineStage[] = [
    { id: "New", title: "New Inquiry" },
    { id: "Qualified", title: "Qualified" },
    { id: "Discovery Call", title: "Discovery Call" },
    { id: "Proposal Sent", title: "Proposal Sent" },
    { id: "Negotiation", title: "Negotiation" },
    { id: "Closed Won", title: "Closed Won" },
    { id: "Closed Lost", title: "Closed Lost" },
];

export default function CorporatePipeline({ initialData }: { initialData: any }) {
    const [items, setItems] = useState<any>(initialData);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    function findContainer(id: string) {
        if (items[id]) return id;
        return Object.keys(items).find((key) =>
            items[key].find((item: any) => item.id === id)
        );
    }

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string);
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setItems((prev: any) => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.findIndex((i: any) => i.id === active.id);
            const overIndex = overItems.findIndex((i: any) => i.id === overId);

            let newIndex;
            if (items[overId as string]) {
                // We're hovering over a column container (empty column case)
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top >
                    over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item: any) => item.id !== active.id),
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                ],
            };
        });
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        const activeContainer = findContainer(active.id as string);
        const overContainer = over ? findContainer(over.id as string) : null;

        if (activeContainer && overContainer) {
            // Persist change
            const stageMap: Record<string, string> = {
                new: "New",
                qualified: "Qualified",
                discovery: "Discovery Call",
                proposal: "Proposal Sent",
                negotiation: "Negotiation",
                won: "Closed Won",
                lost: "Closed Lost"
            };

            const backendStage = overContainer in stageMap ? stageMap[overContainer] : stageMap[overContainer.toLowerCase()] || overContainer;
            // Find correct standard case
            const standardStage = STAGES.find(s => s.id.toLowerCase() === backendStage.toLowerCase())?.id || backendStage;

            updateLeadStage(active.id as string, standardStage);
        }

        setActiveId(null);
    }

    const getActiveItem = () => {
        for (const key of Object.keys(items)) {
            const item = items[key].find((i: any) => i.id === activeId);
            if (item) return item;
        }
        return null;
    };

    const handleCardClick = (id: string) => {
        setSelectedLeadId(id);
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="glass-panel w-full overflow-hidden flex flex-col h-[600px]">
                <div className="mb-4 flex flex-shrink-0 items-center justify-between px-1">
                    <div>
                        <h2 className="text-xl font-semibold">Corporate Pipeline</h2>
                        <p className="text-sm text-muted">
                            Track leads across the full corporate sales cycle.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="btn-primary flex items-center gap-2 text-sm shadow-lg hover:shadow-xl"
                    >
                        <Plus size={16} />
                        <span>New Lead</span>
                    </button>
                </div>

                <div className="flex h-full gap-4 overflow-x-auto pb-4">
                    {STAGES.map((stage) => {
                        const containerId = stage.id === "New Inquiry" ? "new"
                            : stage.id.toLowerCase().replace(' ', ''); // rudimentary mapping matching 'getCorporatePipeline' keys
                        // Ensure keys match what comes from actions.ts: new, qualified, discovery, proposal, negotiation, won, lost
                        let dataKey = "new";
                        if (stage.id === "New") dataKey = "new";
                        if (stage.id === "Qualified") dataKey = "qualified";
                        if (stage.id === "Discovery Call") dataKey = "discovery";
                        if (stage.id === "Proposal Sent") dataKey = "proposal";
                        if (stage.id === "Negotiation") dataKey = "negotiation";
                        if (stage.id === "Closed Won") dataKey = "won";
                        if (stage.id === "Closed Lost") dataKey = "lost";

                        return (
                            <PipelineStageColumn
                                key={dataKey}
                                id={dataKey}
                                title={stage.title}
                                items={items[dataKey] || []}
                                onCardClick={handleCardClick}
                            />
                        )
                    })}
                </div>

                {createPortal(
                    <DragOverlay>
                        {activeId ? <PipelineCardItem lead={getActiveItem()} /> : null}
                    </DragOverlay>,
                    document.body
                )}
            </div>

            <CreateCorporateLeadDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
            />

            {selectedLeadId && (
                <CompanyProfileDialog
                    leadId={selectedLeadId}
                    open={!!selectedLeadId}
                    onOpenChange={(open) => !open && setSelectedLeadId(null)}
                />
            )}
        </DndContext>
    );
}
