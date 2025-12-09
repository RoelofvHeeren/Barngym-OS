"use client";

import { useState, useEffect } from "react";
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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-stone-900/95 p-6 shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Company Profile</h2>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {isFetching ? (
                    <div className="flex h-64 items-center justify-center text-white/50">
                        Loading...
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Header / Main Info */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-colors focus-within:border-emerald-500/50">
                                <div className="mb-2 flex items-center gap-2 text-sm text-emerald-400">
                                    <Building2 size={16} />
                                    <span>Company Name</span>
                                </div>
                                <input
                                    className="w-full bg-transparent text-lg font-semibold text-white outline-none placeholder:text-white/20"
                                    value={formData.companyName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, companyName: e.target.value })
                                    }
                                    placeholder="Company Name"
                                />
                            </div>

                            <div className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-colors focus-within:border-emerald-500/50">
                                <div className="mb-2 flex items-center gap-2 text-sm text-emerald-400">
                                    <Activity size={16} />
                                    <span>Activities (comma separated)</span>
                                </div>
                                <input
                                    className="w-full bg-transparent text-lg font-semibold text-white outline-none placeholder:text-white/20"
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
                            <h3 className="text-sm font-medium uppercase tracking-wider text-white/50">Point of Contact</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <User size={18} className="text-emerald-500" />
                                    <div className="flex-1">
                                        <p className="text-xs text-white/40">Name</p>
                                        <input
                                            className="w-full bg-transparent text-sm text-white outline-none"
                                            value={formData.pocName}
                                            onChange={(e) => setFormData({ ...formData, pocName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <Mail size={18} className="text-emerald-500" />
                                    <div className="flex-1">
                                        <p className="text-xs text-white/40">Email</p>
                                        <input
                                            className="w-full bg-transparent text-sm text-white outline-none"
                                            value={formData.pocEmail}
                                            onChange={(e) => setFormData({ ...formData, pocEmail: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Details Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium uppercase tracking-wider text-white/50">Engagement Details</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <Users size={18} className="text-emerald-500" />
                                    <div className="flex-1">
                                        <p className="text-xs text-white/40">Employees</p>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent text-sm text-white outline-none"
                                            value={formData.employeeCount}
                                            onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <Clock size={18} className="text-emerald-500" />
                                    <div className="flex-1">
                                        <p className="text-xs text-white/40">Duration</p>
                                        <input
                                            className="w-full bg-transparent text-sm text-white outline-none"
                                            value={formData.contractDuration}
                                            onChange={(e) => setFormData({ ...formData, contractDuration: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <span className="text-emerald-500 font-bold">€</span>
                                    <div className="flex-1">
                                        <p className="text-xs text-white/40">Value</p>
                                        <input
                                            type="number"
                                            className="w-full bg-transparent text-sm text-white outline-none"
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
        </div>
    );
}
