
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, Check, User, Bot, X, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

interface CreationWizardProps {
    onClose: () => void;
}

type Message = {
    role: "user" | "assistant";
    content: string;
};

type GeneratedProject = {
    title: string;
    goal: string;
    platform: string;
    scriptContent: string;
    brief: any;
};

export default function CreationWizard({ onClose }: CreationWizardProps) {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    // The latest state of the project being built
    const [currentProject, setCurrentProject] = useState<GeneratedProject | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const newMessages = [...messages, { role: "user" as const, content: input }];
        setMessages(newMessages);
        setInput("");
        setLoading(true);

        try {
            // Filter out only previous messages for context, ignoring the system prompt which is handled by API
            // We pass the conversation history to the agent
            const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

            const res = await fetch("/api/content/agent", {
                method: "POST",
                body: JSON.stringify({ messages: apiMessages }),
            });
            const json = await res.json();

            if (json.ok) {
                const generated = json.data;
                setCurrentProject(generated);

                // Add agent response (we show a summary or the thought process? 
                // For now, let's just say "I've updated the draft" or similar if it's not the first one.
                // Or we can generate a conversational response separate from the JSON?
                // For simplicity V1: The agent returns JSON. We interpret that as "Here is the plan".
                setMessages(prev => [...prev, { role: "assistant", content: "I've generated a plan based on your request. Check the preview on the right." }]);
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error generating the plan." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!currentProject) return;
        try {
            const res = await fetch("/api/content/projects", {
                method: "POST",
                body: JSON.stringify({
                    title: currentProject.title,
                    goal: currentProject.goal,
                    platform: currentProject.platform,
                    status: "IDEA",
                    scriptContent: currentProject.scriptContent,
                    editingBrief: currentProject.brief,
                    tags: tags
                })
            });
            const json = await res.json();
            if (json.ok) {
                onClose();
                router.push(`/content/${json.data.id}`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput("");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="flex h-[85vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">

                {/* LEFT: Chat Interface */}
                <div className="flex w-1/3 flex-col border-r bg-gray-50/50">
                    <div className="border-b bg-white px-6 py-4">
                        <h3 className="font-bold text-emerald-900">AI Assistant</h3>
                        <p className="text-xs text-muted">Iterate on your idea here.</p>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="mt-10 text-center text-sm text-muted px-4">
                                <Sparkles className="mx-auto mb-2 h-8 w-8 text-emerald-300" />
                                <p>Describe your content idea. <br /> "Educational reel about protein for beginners"</p>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border text-muted'}`}>
                                    {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white border shadow-sm'}`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border text-muted">
                                    <Loader2 size={14} className="animate-spin" />
                                </div>
                                <div className="bg-white border shadow-sm rounded-2xl p-3 text-sm text-muted italic">
                                    Thinking...
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t bg-white p-4">
                        <div className="relative">
                            <textarea
                                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 pr-10 text-sm focus:border-emerald-500 focus:ring-emerald-500 max-h-32"
                                rows={2}
                                placeholder={messages.length === 0 ? "Start a new project..." : "Refine the draft..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="absolute bottom-2 right-2 rounded-lg bg-emerald-600 p-1.5 text-white transition-opacity disabled:opacity-0 hover:bg-emerald-700"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Preview & Edit */}
                <div className="flex flex-1 flex-col bg-white">
                    <div className="flex items-center justify-between border-b px-6 py-4">
                        <h3 className="font-bold text-gray-800">Project Draft</h3>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-gray-100">Cancel</button>
                            <button
                                onClick={handleCreate}
                                disabled={!currentProject}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
                            >
                                <Check size={16} /> Create Project
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        {!currentProject ? (
                            <div className="flex h-full flex-col items-center justify-center text-muted/50">
                                <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-current opacity-20" />
                                <p className="mt-4 font-medium">Draft will appear here</p>
                            </div>
                        ) : (
                            <div className="mx-auto max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Meta Fields */}
                                <div className="grid gap-6">
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Title</label>
                                        <input
                                            value={currentProject.title}
                                            onChange={(e) => setCurrentProject({ ...currentProject, title: e.target.value })}
                                            className="w-full border-b border-gray-200 bg-transparent py-2 text-2xl font-bold focus:border-emerald-500 focus:outline-none"
                                            placeholder="Project Title"
                                        />
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Platform</label>
                                            <select
                                                value={currentProject.platform}
                                                onChange={(e) => setCurrentProject({ ...currentProject, platform: e.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                                            >
                                                <option value="INSTAGRAM_REEL">Instagram Reel</option>
                                                <option value="TIKTOK">TikTok</option>
                                                <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                                                <option value="YOUTUBE_VIDEO">YouTube Video</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Goal</label>
                                            <input
                                                value={currentProject.goal}
                                                onChange={(e) => setCurrentProject({ ...currentProject, goal: e.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Tags Input */}
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Tags</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {tags.map(tag => (
                                                <span key={tag} className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                                    {tag}
                                                    <button onClick={() => setTags(tags.filter(t => t !== tag))} className="text-emerald-600 hover:text-emerald-900"><X size={12} /></button>
                                                </span>
                                            ))}
                                            <div className="flex items-center gap-1">
                                                <input
                                                    value={tagInput}
                                                    onChange={(e) => setTagInput(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                                    placeholder="Add tag..."
                                                    className="w-24 bg-transparent text-sm focus:outline-none"
                                                />
                                                <button onClick={addTag} disabled={!tagInput} className="text-muted hover:text-primary"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Script Editor */}
                                <div>
                                    <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-muted">Script & Concept</label>
                                    <div className="rounded-xl border border-gray-200 bg-white p-1 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20">
                                        <textarea
                                            value={currentProject.scriptContent}
                                            onChange={(e) => setCurrentProject({ ...currentProject, scriptContent: e.target.value })}
                                            className="min-h-[400px] w-full resize-none rounded-lg border-0 bg-transparent p-4 text-base leading-relaxed focus:ring-0"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
