"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, Sparkles } from "lucide-react";

type Message = {
    role: "user" | "assistant";
    content: string;
    data?: any[]; // For CSV export
    fileName?: string;
};

export default function AssistantPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hello! I'm the Barn Gym Assistant. I can help you query the database for member insights, transaction history, and more. How can I help you today?" },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const downloadCsv = (data: any[], fileName: string) => {
        if (!data || !data.length) return;

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(","),
            ...data.map(row => headers.map(header => JSON.stringify(row[header] ?? "")).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName || "export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: "user", content: input };
        setMessages((p) => [...p, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const resp = await fetch("/api/assistant/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
            });

            if (!resp.ok) throw new Error("Failed to fetch response");

            const data = await resp.json();
            const assistantMsg: Message = {
                role: "assistant",
                content: data.content,
                data: data.tableData,
                fileName: data.fileName
            };
            setMessages((p) => [...p, assistantMsg]);
        } catch (err) {
            console.error(err);
            setMessages((p) => [...p, { role: "assistant", content: "Sorry, I encountered an error answering that request." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-2rem)] flex-col p-6">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <Bot size={24} />
                </div>
                <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted">Internal Tools</p>
                    <h1 className="text-2xl font-semibold text-primary">Barn Assistant</h1>
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth" ref={scrollRef}>
                    <div className="flex flex-col gap-6">
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`flex gap-4 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                                <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-white/10 text-white" : "bg-emerald-500/10 text-emerald-500"
                                        }`}
                                >
                                    {m.role === "user" ? <User size={18} /> : <Sparkles size={18} />}
                                </div>
                                <div className={`max-w-[80%] flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                                    <div
                                        className={`rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${m.role === "user"
                                            ? "bg-emerald-600 text-white"
                                            : "bg-[#f3f4f6] text-gray-800"
                                            }`}
                                    >
                                        {m.content.split("\n").map((line, idx) => (
                                            <p key={idx} className={idx > 0 ? "mt-2" : ""}>
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                    {m.data && (
                                        <button
                                            onClick={() => downloadCsv(m.data!, m.fileName || "data.csv")}
                                            className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50 text-xs font-medium text-emerald-600 hover:bg-emerald-100"
                                        >
                                            <Bot size={14} />
                                            Download Result CSV ({m.data.length} rows)
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                                    <Sparkles size={18} />
                                </div>
                                <div className="flex items-center gap-1 rounded-2xl bg-[#f3f4f6] px-5 py-4">
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/50" style={{ animationDelay: "0ms" }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/50" style={{ animationDelay: "150ms" }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/50" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="border-t border-white/5 bg-white p-4">
                    <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                        <input
                            autoFocus
                            className="flex-1 rounded-2xl border border-emerald-500 bg-white px-4 py-3 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="Ask about revenue, recent payments, or member stats..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                            <Send size={18} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </button>
                    </form>
                    <p className="mt-3 text-center text-[10px] text-gray-400">
                        Powered by OpenAI. Results may vary. Always verify important financial data.
                    </p>
                </div>
            </div>
        </div>
    );
}
