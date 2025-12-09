"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PipelineCardItem } from "./PipelineCardItem";

export function PipelineStageColumn({
    id,
    title,
    items,
    onCardClick
}: {
    id: string;
    title: string;
    items: any[];
    onCardClick: (id: string) => void;
}) {
    const { setNodeRef } = useDroppable({
        id,
    });

    return (
        <div className="flex h-full min-w-[300px] flex-col rounded-xl bg-white/5 p-3">
            <div className="mb-3 flex items-center justify-between px-2">
                <h3 className="font-medium text-primary">{title}</h3>
                <span className="rounded-full bg-emerald-900/5 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    {items.length}
                </span>
            </div>

            <div ref={setNodeRef} className="flex flex-1 flex-col gap-3 overflow-y-auto">
                <SortableContext
                    id={id}
                    items={items.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {items.map((card) => (
                        <PipelineCardItem key={card.id} lead={card} onClick={() => onCardClick(card.id)} />
                    ))}
                </SortableContext>

                {items.length === 0 && (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-emerald-900/10 bg-black/[0.02]">
                        <p className="text-xs text-muted opacity-50">Drop here</p>
                    </div>
                )}
            </div>
        </div>
    );
}
