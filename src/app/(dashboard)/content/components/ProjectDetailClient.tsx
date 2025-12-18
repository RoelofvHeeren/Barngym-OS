
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Calendar, User, Save, Target, Layout, CheckCircle } from "lucide-react";
import ScriptEditor from "./ScriptEditor";
import AssetPanel from "./AssetPanel";
import { VideoProject, VideoAsset } from "@prisma/client";
import { useRouter } from "next/navigation";

interface ProjectDetailClientProps {
    project: VideoProject & { assets: VideoAsset[] };
}

export default function ProjectDetailClient({ project: initialProject }: ProjectDetailClientProps) {
    const router = useRouter();
    const [project, setProject] = useState(initialProject);
    const [scriptContent, setScriptContent] = useState(initialProject.scriptContent || "");
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/content/projects/${project.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    scriptContent,
                }),
            });
            if (res.ok) {
                setLastSaved(new Date());
                router.refresh();
            }
        } catch (error) {
            console.error("Save failed", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Debounce save or manual save? Manual for now defined in requirements "Approve and lock toggle/Saved"
    // User asked for "Editable rich text document... Version history... Approve and lock toggle".
    // For V1, "Save" button is safer.

    const refreshProject = useCallback(() => {
        router.refresh();
    }, [router]);

    return (
        <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 text-primary">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-900/10 pb-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/content"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-900/10 hover:bg-emerald-50"
                    >
                        <ChevronLeft size={16} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${getStatusColor(project.status)}`} />
                            <h1 className="text-xl font-bold">{project.title}</h1>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-muted">
                            <span className="flex items-center gap-1">
                                <Target size={12} /> {project.goal || "No Goal"}
                            </span>
                            <span className="flex items-center gap-1">
                                <Layout size={12} /> {project.platform.replace('_', ' ')}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar size={12} /> Updated {new Date(project.updatedAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {lastSaved && <span className="text-xs text-muted">Saved {lastSaved.toLocaleTimeString()}</span>}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : <><Save size={14} /> Save Script</>}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Main Content (Script) */}
                <div className="flex flex-1 flex-col rounded-2xl border border-emerald-900/10 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-emerald-900/10 bg-emerald-50/30 px-6 py-3 flex justify-between items-center">
                        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">Script & Concept</h2>
                        <div className="flex gap-2">
                            {/* Toggle switch placeholder for 'Approve/Lock' */}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <ScriptEditor content={scriptContent} onChange={setScriptContent} />
                    </div>
                </div>

                {/* Sidebar (Brief & Assets) */}
                <div className="flex w-80 flex-col gap-4">
                    {/* Brief Mini Panel */}
                    <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
                        <h3 className="font-semibold text-sm mb-3">Project Details</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-xs text-muted">Priority</p>
                                <p className="font-medium">{project.priority}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted">Assigned Coach</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs">JD</div>
                                    <span>{project.assignedCoach || "Unassigned"}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-muted">Assigned Editor</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-xs">ED</div>
                                    <span>{project.assignedEditor || "Unassigned"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Assets */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <AssetPanel projectId={project.id} assets={project.assets} onUpload={refreshProject} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case "IDEA": return "bg-gray-400";
        case "SCRIPTING": return "bg-blue-400";
        case "READY_TO_FILM": return "bg-amber-400";
        case "FILMED": return "bg-purple-400";
        case "EDITING": return "bg-pink-400";
        case "FINAL_PRODUCT": return "bg-emerald-400";
        default: return "bg-gray-400";
    }
}
