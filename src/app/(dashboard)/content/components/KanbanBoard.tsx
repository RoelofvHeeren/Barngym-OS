
"use client";

import { useEffect, useState } from "react";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Types
import { VideoProject, VideoProjectStatus, VideoProjectPriority } from "@prisma/client";

type Project = {
    id: string;
    title: string;
    status: VideoProjectStatus;
    priority: VideoProjectPriority;
    updatedAt: string;
};

const COLUMNS: VideoProjectStatus[] = [
    "IDEA",
    "SCRIPTING",
    "READY_TO_FILM",
    "FILMED",
    "EDITING",
    "FINAL_PRODUCT",
];

const COLUMN_LABELS: Record<VideoProjectStatus, string> = {
    IDEA: "Idea",
    SCRIPTING: "Scripting",
    READY_TO_FILM: "To Film",
    FILMED: "Filmed",
    EDITING: "Editing",
    FINAL_PRODUCT: "Done",
};

export default function KanbanBoard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Fetch projects on mount
    useEffect(() => {
        async function fetchProjects() {
            try {
                const res = await fetch("/api/content/projects");
                const json = await res.json();
                if (json.ok) {
                    setProjects(json.data);
                }
            } catch (e) {
                console.error("Failed to load projects", e);
            } finally {
                setLoading(false);
            }
        }
        fetchProjects();
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function findContainer(id: string) {
        if (projects.find(p => p.id === id)) {
            return projects.find(p => p.id === id)?.status;
        }
        return null;
    }

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string);
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find the containers
        const activeProject = projects.find(p => p.id === activeId);
        const overProject = projects.find(p => p.id === overId);

        // Dropping over a column (if overId is a status)
        const overStatus = COLUMNS.includes(overId as VideoProjectStatus)
            ? (overId as VideoProjectStatus)
            : overProject?.status;

        if (!activeProject || !overStatus || activeProject.status === overStatus) {
            return;
        }

        // Optimistic update for drag over
        setProjects(prev => {
            return prev.map(p => {
                if (p.id === activeId) {
                    return { ...p, status: overStatus };
                }
                return p;
            });
        });
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeProject = projects.find(p => p.id === activeId);
        // If dropped on a column, use that status. If dropped on an item, use that item's status.
        const overStatus = COLUMNS.includes(overId as VideoProjectStatus)
            ? (overId as VideoProjectStatus)
            : projects.find(p => p.id === overId)?.status;

        if (activeProject && overStatus && activeProject.status !== overStatus) {
            // Persist change
            updateProjectStatus(activeId, overStatus);
        }
    }

    async function updateProjectStatus(id: string, status: VideoProjectStatus) {
        try {
            await fetch(`/api/content/projects/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
        } catch (e) {
            console.error("Failed to update status", e);
        }
    }

    if (loading) {
        return <div className="p-8 text-muted">Loading board...</div>;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-4 overflow-x-auto pb-4">
                {COLUMNS.map((col) => (
                    <div key={col} className="flex h-full min-w-[280px] flex-col rounded-2xl bg-emerald-50/50 p-3">
                        <div className="mb-3 flex items-center justify-between px-2">
                            <span className="text-sm font-bold text-emerald-900/70">{COLUMN_LABELS[col]}</span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {projects.filter(p => p.status === col).length}
                            </span>
                        </div>

                        <SortableContext
                            id={col} // The column itself acts as a container ID
                            items={projects.filter(p => p.status === col).map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                                {projects.filter(p => p.status === col).map((project) => (
                                    <SortableItem key={project.id} project={project} />
                                ))}
                            </div>
                        </SortableContext>
                    </div>
                ))}
            </div>
            <DragOverlay>
                {activeId ? (
                    <ItemCard project={projects.find(p => p.id === activeId)!} />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function SortableItem({ project }: { project: Project }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: project.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <ItemCard project={project} />
        </div>
    );
}

function ItemCard({ project }: { project: Project }) {
    return (
        <div className="cursor-grab active:cursor-grabbing rounded-xl border border-emerald-900/5 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex gap-2 mb-1">
                {project.priority === "HIGH" && <div className="h-1.5 w-8 rounded-full bg-rose-400" />}
                {project.priority === "MEDIUM" && <div className="h-1.5 w-8 rounded-full bg-amber-400" />}
                {project.priority === "LOW" && <div className="h-1.5 w-8 rounded-full bg-emerald-400" />}
            </div>
            <p className="line-clamp-2 text-sm font-medium leading-tight text-primary">
                {project.title}
            </p>
            <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted">{new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
        </div>
    )
}
