
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import KanbanBoard from "./components/KanbanBoard";
import CreationWizard from "./components/CreationWizard";

type Tab = "board" | "backlog" | "calendar";

export default function ContentPage() {
    const [activeTab, setActiveTab] = useState<Tab>("board");
    const [isCreating, setIsCreating] = useState(false);

    return (
        <div className="flex h-[calc(100vh-8rem)] flex-col gap-6 text-primary">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Content Studio</h1>
                    <p className="text-sm text-muted">Manage video production from idea to export.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
                >
                    <Plus className="h-4 w-4" />
                    New Project
                </button>
            </div>

            <div className="flex items-center gap-1 border-b border-emerald-900/10 pb-1">
                {(["board", "backlog", "calendar"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab
                            ? "bg-emerald-100/50 text-emerald-900"
                            : "text-muted hover:bg-emerald-50/50 hover:text-emerald-800"
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === "board" && <KanbanBoard />}
                {activeTab === "backlog" && (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-emerald-900/10 bg-emerald-50/30">
                        <p className="text-muted">Backlog View Coming Soon</p>
                    </div>
                )}
                {activeTab === "calendar" && (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-emerald-900/10 bg-emerald-50/30">
                        <p className="text-muted">Calendar View Coming Soon</p>
                    </div>
                )}
            </div>

            {/* Creation Wizard */}
            {isCreating && <CreationWizard onClose={() => setIsCreating(false)} />}
        </div>
    );
}
