"use client";

import { useEffect, useState, useMemo } from "react";

type LeadOption = {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
};

export default function AddTransactionModal({ isOpen, onClose, onSuccess }: Props) {
    const [mode, setMode] = useState<"existing" | "new">("existing");
    const [amount, setAmount] = useState("");
    const [productType, setProductType] = useState("Personal Training");
    const [isCash, setIsCash] = useState(false);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Existing client search
    const [leads, setLeads] = useState<LeadOption[]>([]);
    const [search, setSearch] = useState("");
    const [selectedLeadId, setSelectedLeadId] = useState<string>("");

    // New client details
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");

    useEffect(() => {
        if (isOpen && leads.length === 0) {
            setLoading(true);
            fetch("/api/leads")
                .then((res) => res.json())
                .then((payload) => {
                    if (payload.ok && Array.isArray(payload.data)) {
                        setLeads(payload.data);
                    }
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, leads.length]);

    const filteredLeads = useMemo(() => {
        if (!search.trim()) return leads.slice(0, 50);
        const term = search.toLowerCase();
        return leads.filter(
            (l) =>
                (l.fullName || "").toLowerCase().includes(term) ||
                (l.email || "").toLowerCase().includes(term)
        ).slice(0, 50);
    }, [leads, search]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const payload = {
                amount: parseFloat(amount),
                productType,
                isCash,
                notes,
                mode,
                selectedLeadId: mode === "existing" ? selectedLeadId : undefined,
                newClient:
                    mode === "new"
                        ? {
                            name: newName,
                            email: newEmail,
                        }
                        : undefined,
            };

            const res = await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!data.ok) throw new Error(data.message || "Failed to create transaction");

            onSuccess();
            handleClose();
        } catch (error) {
            alert(error instanceof Error ? error.message : "An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setAmount("");
        setNotes("");
        setIsCash(false);
        setSearch("");
        setSelectedLeadId("");
        setNewName("");
        setNewEmail("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-white">Add Transaction</h2>
                    <p className="text-sm text-neutral-400">Manually record a payment or transaction.</p>

                    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-neutral-400">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-neutral-400">€</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-7 pr-3 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-neutral-400">Product</label>
                                <select
                                    value={productType}
                                    onChange={(e) => setProductType(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option>Personal Training</option>
                                    <option>Class Membership</option>
                                    <option>6 Week Transformation</option>
                                    <option>Online Coaching</option>
                                    <option>Community</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-1">
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setMode("existing")}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === "existing"
                                            ? "bg-white/10 text-white shadow-sm"
                                            : "text-neutral-400 hover:text-white"
                                        }`}
                                >
                                    Existing Client
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("new")}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === "new"
                                            ? "bg-white/10 text-white shadow-sm"
                                            : "text-neutral-400 hover:text-white"
                                        }`}
                                >
                                    New Client
                                </button>
                            </div>
                        </div>

                        {mode === "existing" ? (
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    placeholder="Search client name or email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                                />
                                <div className="max-h-32 overflow-y-auto rounded-xl border border-white/5 bg-white/5">
                                    {loading ? (
                                        <div className="p-3 text-center text-xs text-neutral-500">Loading clients...</div>
                                    ) : filteredLeads.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-neutral-500">No clients found</div>
                                    ) : (
                                        filteredLeads.map((lead) => (
                                            <button
                                                key={lead.id}
                                                type="button"
                                                onClick={() => setSelectedLeadId(lead.id)}
                                                className={`w-full px-3 py-2 text-left text-sm transition hover:bg-white/5 ${selectedLeadId === lead.id
                                                        ? "bg-emerald-500/20 text-emerald-200"
                                                        : "text-neutral-300"
                                                    }`}
                                            >
                                                <div className="font-medium">{lead.fullName || "Unnamed"}</div>
                                                <div className="text-xs text-neutral-500">{lead.email}</div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    required={mode === "new"}
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                                />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    required={mode === "new"}
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-neutral-400">Notes / Reference</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                                placeholder="Optional notes..."
                            />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isCash}
                                onChange={(e) => setIsCash(e.target.checked)}
                                className="rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-neutral-300">This is a cash payment</span>
                        </label>

                        <div className="mt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || (mode === "existing" && !selectedLeadId)}
                                className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? "Saving..." : "Save Transaction"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
