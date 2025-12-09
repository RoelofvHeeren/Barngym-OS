"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Save, Building2, User, Mail, Users, Clock, Activity } from "lucide-react";
import { getLead, updateCorporateLead } from "../actions";

export default function CompanyProfileDialog({
    leadId,
    open,
    onOpenChange,
}: {
    leadId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        if (open && leadId) {
            setIsFetching(true);
            getLead(leadId).then((data) => {
                if (data) {
                    setFormData({
                        companyName: data.companyName || "",
                        pocName: data.pocName || "",
                        pocEmail: data.pocEmail || "",
                        activities: Array.isArray(data.activities) ? (data.activities as string[]).join(", ") : "",
                        employeeCount: data.employeeCount || 0,
                        contractDuration: data.contractDuration || "",
                        valueMinor: data.valueMinor ? data.valueMinor / 100 : 0,
                    });
                }
                setIsFetching(false);
            });
        }
    }, [leadId, open]);

    async function handleSave() {
        setLoading(true);
        try {
            await updateCorporateLead(leadId, {
                companyName: formData.companyName,
                pocName: formData.pocName,
                pocEmail: formData.pocEmail,
                activities: formData.activities.split(",").map((s: string) => s.trim()),
                employeeCount: parseInt(formData.employeeCount),
                contractDuration: formData.contractDuration,
                valueMinor: parseFloat(formData.valueMinor) * 100
            });
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            alert("Failed to save");
        } finally {
            setLoading(false);
        }
    }

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-2xl p-6 shadow-2xl relative">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-primary">Company Profile</h2>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="rounded-full p-2 text-muted hover:bg-emerald-900/5 hover:text-primary transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {isFetching ? (
                    <div className="flex h-64 items-center justify-center text-muted">
                        Loading...
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Header / Main Info */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="group rounded-xl border border-emerald-900/10 bg-white/40 p-4 transition-colors focus-within:border-emerald-500/50">
                                <div className="mb-2 flex items-center gap-2 text-sm text-emerald-600">
                                    <Building2 size={16} />
                                    <span>Company Name</span>
                                </div>
                                <input
                                    className="w-full bg-transparent text-lg font-semibold text-primary outline-none placeholder:text-muted/50"
                                    value={formData.companyName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, companyName: e.target.value })
                                    }
                                    placeholder="Company Name"
                                />
                            </div>

                            <div className="group rounded-xl border border-emerald-900/10 bg-white/40 p-4 transition-colors focus-within:border-emerald-500/50">
                                <div className="mb-2 flex items-center gap-2 text-sm text-emerald-600">
                                    <Activity size={16} />
                                    <span>Activities (comma separated)</span>
                                </div>
                                <input
                                    className="w-full bg-transparent text-lg font-semibold text-primary outline-none placeholder:text-muted/50"
                                    value={formData.activities}
                                    onChange={(e) =>
                                        setFormData({ ...formData, activities: e.target.value })
                                    }
                                    placeholder="Coaching, Retreat"
                                />
                            </div>
                        </div>

                        {/* POC Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium uppercase tracking-wider text-muted">Point of Contact</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex items-center gap-3 rounded-lg border border-emerald-900/10 bg-white/40 p-3">
                                    <User size={18} className="text-emerald-600" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted">Name</p>
                                        <input
                                            className="w-full bg-transparent text-sm text-primary outline-none"
                                            value={formData.pocName}
                                            onChange={(e) => setFormData({ ...formData, pocName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-emerald-900/10 bg-white/40 p-3">
                                    <Mail size={18} className="text-emerald-600" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted">Email</p>
                                        <input
                                            className="w-full bg-transparent text-sm text-primary outline-none"
                                            value={formData.pocEmail}
                                            onChange={(e) => setFormData({ ...formData, pocEmail: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Details Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium uppercase tracking-wider text-muted">Engagement Details</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="flex items-center gap-3 rounded-lg border border-emerald-900/10 bg-white/40 p-3">
                                    <Users size={18} className="text-emerald-600" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted">Employees</p>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent text-sm text-primary outline-none"
                                            value={formData.employeeCount}
                                            onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-emerald-900/10 bg-white/40 p-3">
                                    <Clock size={18} className="text-emerald-600" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted">Duration</p>
                                        <input
                                            className="w-full bg-transparent text-sm text-primary outline-none"
                                            value={formData.contractDuration}
                                            onChange={(e) => setFormData({ ...formData, contractDuration: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-emerald-900/10 bg-white/40 p-3">
                                    <span className="text-emerald-600 font-bold">€</span>
                                    <div className="flex-1">
                                        <p className="text-xs text-muted">Value</p>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent text-sm text-primary outline-none"
                                            value={formData.valueMinor}
                                            onChange={(e) => setFormData({ ...formData, valueMinor: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="btn-primary flex items-center gap-2 rounded-lg px-6 py-2 shadow-lg"
                            >
                                <Save size={18} />
                                <span>{loading ? "Saving..." : "Save Changes"}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
