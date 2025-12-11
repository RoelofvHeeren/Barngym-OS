"use client";

import { MoreHorizontal, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

import CreateCorporateClientDialog from "./CreateCorporateClientDialog";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CorporateClients({ clients }: { clients: any[] }) {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const router = useRouter();

    return (
        <div className="glass-panel min-h-[400px]">
            <CreateCorporateClientDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Corporate Clients</h2>
                    <p className="text-sm text-muted">Active clients, renewals, and account insights.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="btn-primary text-sm shadow-md hover:shadow-lg"
                    >
                        New Client
                    </button>
                    <button className="rounded-xl border border-emerald-900/10 bg-white/40 px-4 py-2 text-sm font-medium text-primary hover:bg-white/60 shadow-sm transition-all">
                        View All
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/5">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/10 bg-emerald-900/5 text-xs uppercase tracking-wider text-muted">
                            <th className="px-6 py-4 font-semibold">Company</th>
                            <th className="px-6 py-4 font-semibold">Activities</th>
                            <th className="px-6 py-4 font-semibold text-right">Revenue</th>
                            <th className="px-6 py-4 font-semibold text-right">Employees</th>
                            <th className="px-6 py-4 font-semibold">Duration</th>
                            <th className="px-6 py-4 font-semibold">Contact</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {clients.length > 0 ? (
                            clients.map((client) => (
                                <tr
                                    key={client.id}
                                    onClick={() => router.push(`/corporate/${client.id}`)}
                                    className="group cursor-pointer transition-colors hover:bg-white/10"
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-primary">{client.companyName || "Unknown"}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {Array.isArray(client.activities) && client.activities.length > 0 ? (
                                                client.activities.slice(0, 2).map((activity: string, idx: number) => (
                                                    <span key={idx} className="inline-flex rounded-full bg-emerald-100/50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                                        {activity}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="inline-flex rounded-full bg-emerald-100/50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                                    General
                                                </span>
                                            )}
                                            {Array.isArray(client.activities) && client.activities.length > 2 && (
                                                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
                                                    +{client.activities.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-emerald-800">
                                        €{((client.totalRevenue || 0) / 100).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-muted">{client.employeeCount || "-"}</td>
                                    <td className="px-6 py-4 text-sm text-muted">{client.contractDuration || "-"}</td>
                                    <td className="px-6 py-4 text-sm text-muted">{client.pocName || "-"}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="rounded-full p-2 text-muted hover:bg-white/20 hover:text-primary">
                                            <ArrowUpRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-muted opacity-50">
                                    No corporate clients found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
