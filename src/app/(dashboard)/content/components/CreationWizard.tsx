
"use client";

import { useState } from "react";
import { Send, Sparkles, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface CreationWizardProps {
    onClose: () => void;
}

export default function CreationWizard({ onClose }: CreationWizardProps) {
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        try {
            const res = await fetch("/api/content/agent", {
                method: "POST",
                body: JSON.stringify({ prompt }),
            });
            const json = await res.json();
            if (json.ok) {
                setResult(json.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!result) return;
        try {
            const res = await fetch("/api/content/projects", {
                method: "POST",
                body: JSON.stringify({
                    title: result.title,
                    goal: result.goal,
                    platform: result.platform,
                    status: "IDEA",
                    // We would ideally save the script content too, but the POST endpoint in step 93 
                    // only took title/goal/platform. I should update it or just save basics first.
                    // For now, let's create it then update it (or I update the API).
                    // Updating API is better. But for speed, I'll allow the API to take scriptContent?
                    // Step 93 API: const { title, goal, platform, status } = body; 
                    // It didn't extract scriptContent. I'll need to patch Step 93's file or just accept limitation.
                    // Actually, I can PATCH it immediately after CREATE.
                })
            });
            const json = await res.json();
            if (json.ok) {
                const projectId = json.data.id;
                // Patch with script
                await fetch(`/api/content/projects/${projectId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ scriptContent: result.scriptContent, editingBrief: result.brief })
                });
                onClose();
                router.push(`/content/${projectId}`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {!result ? (
                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Sparkles size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-emerald-900">AI Content Wizard</h2>
                        <p className="mt-2 text-muted max-w-md">
                            Describe your video idea, and our agent will generate a script, brief, and structure for you.
                        </p>

                        <div className="mt-8 w-full">
                            <textarea
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 focus:border-emerald-500 focus:ring-emerald-500"
                                rows={3}
                                placeholder="e.g. A 30s reel about proper deadlift form for beginners..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={loading || !prompt.trim()}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={18} /> Generate Plan</>}
                            </button>
                            <button onClick={onClose} className="mt-2 text-sm text-muted hover:text-primary">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="border-b px-6 py-4 flex justify-between items-center bg-emerald-50/50">
                            <h3 className="font-bold text-emerald-900">Generated Project</h3>
                            <button onClick={() => setResult(null)} className="text-xs text-muted underline">Start Over</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted">Title</label>
                                <div className="text-lg font-semibold">{result.title}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted">Details</label>
                                <div className="flex gap-4 text-sm mt-1">
                                    <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded">{result.platform}</span>
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{result.goal}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted">Script Preview</label>
                                <div className="mt-2 rounded-lg bg-gray-50 p-4 text-sm whitespace-pre-wrap border">
                                    {result.scriptContent}
                                </div>
                            </div>
                        </div>
                        <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-primary">Cancel</button>
                            <button onClick={handleCreate} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                                <Check size={16} /> Create Project
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
