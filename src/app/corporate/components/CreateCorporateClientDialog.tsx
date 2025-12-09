"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { createCorporateClient } from "../actions";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function CreateCorporateClientDialog({ open, onOpenChange }: Props) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: "",
        pocName: "",
        pocEmail: "",
        type: "Coaching",
        value: "",
        employees: "",
        duration: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createCorporateClient({
                companyName: formData.companyName,
                pocName: formData.pocName,
                pocEmail: formData.pocEmail,
                activities: [formData.type],
                employeeCount: parseInt(formData.employees) || 0,
                contractDuration: formData.duration,
                valueMinor: Math.round((parseFloat(formData.value) || 0) * 100),
            });
            onOpenChange(false);
            setFormData({
                companyName: "",
                pocName: "",
                pocEmail: "",
                type: "Coaching",
                value: "",
                employees: "",
                duration: "",
            });
        } catch (error) {
            console.error("Failed to create client:", error);
        } finally {
            setLoading(false);
        }
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-md p-6 shadow-2xl relative">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-primary">New Corporate Client</h2>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="rounded-full p-2 text-muted hover:bg-emerald-900/5 hover:text-primary transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-muted">
                            Company Name
                        </label>
                        <input
                            required
                            className="w-full rounded-lg border border-emerald-900/10 bg-white/40 px-4 py-2 text-primary outline-none focus:border-emerald-500/50 focus:bg-white/60 transition-colors"
                            value={formData.companyName}
                            onChange={(e) =>
                                setFormData({ ...formData, companyName: e.target.value })
                            }
                            placeholder="e.g. Acme Corp"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted">
                                POC Name
                            </label>
                            <input
                                required
                                className="w-full rounded-lg border border-emerald-900/10 bg-white/40 px-4 py-2 text-primary outline-none focus:border-emerald-500/50 focus:bg-white/60 transition-colors"
                                value={formData.pocName}
                                onChange={(e) =>
                                    setFormData({ ...formData, pocName: e.target.value })
                                }
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted">
                                POC Email
                            </label>
                            <input
                                required
                                type="email"
                                className="w-full rounded-lg border border-emerald-900/10 bg-white/40 px-4 py-2 text-primary outline-none focus:border-emerald-500/50 focus:bg-white/60 transition-colors"
                                value={formData.pocEmail}
                                onChange={(e) =>
                                    setFormData({ ...formData, pocEmail: e.target.value })
                                }
                                placeholder="john@acme.com"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted">
                                Type
                            </label>
                            <select
                                className="w-full rounded-lg border border-emerald-900/10 bg-white/40 px-4 py-2 text-primary outline-none focus:border-emerald-500/50 focus:bg-white/60 transition-colors"
                                value={formData.type}
                                onChange={(e) =>
                                    setFormData({ ...formData, type: e.target.value })
                                }
                            >
                                <option value="Coaching">Coaching</option>
                                <option value="Retreat">Retreat</option>
                                <option value="Workshop">Workshop</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted">
                                Value (EUR)
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-emerald-900/10 bg-white/40 px-4 py-2 text-primary outline-none focus:border-emerald-500/50 focus:bg-white/60 transition-colors"
                                value={formData.value}
                                onChange={(e) =>
                                    setFormData({ ...formData, value: e.target.value })
                                }
                                placeholder="10000"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted">
                                Employees
                            </label>
                            <input
                                type="number"
                                className="w-full rounded-lg border border-emerald-900/10 bg-white/40 px-4 py-2 text-primary outline-none focus:border-emerald-500/50 focus:bg-white/60 transition-colors"
                                value={formData.employees}
                                onChange={(e) =>
                                    setFormData({ ...formData, employees: e.target.value })
                                }
                                placeholder="50"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted">
                                Duration (Contract)
                            </label>
                            <input
                                className="w-full rounded-lg border border-emerald-900/10 bg-white/40 px-4 py-2 text-primary outline-none focus:border-emerald-500/50 focus:bg-white/60 transition-colors"
                                value={formData.duration}
                                onChange={(e) =>
                                    setFormData({ ...formData, duration: e.target.value })
                                }
                                placeholder="12 months"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-emerald-900/5 hover:text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary rounded-lg px-6 py-2 text-sm shadow-md"
                        >
                            {loading ? "Creating..." : "Create Client"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
