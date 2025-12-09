"use client";

import { MoreHorizontal, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export default function CorporateClients({ clients }: { clients: any[] }) {

    return (
        <div className="glass-panel min-h-[400px]">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Corporate Clients</h2>
                    <p className="text-sm text-muted">Active clients, renewals, and account insights.</p>
                </div>
                <button className="btn-primary text-sm shadow-md hover:shadow-lg">
                    View All Clients
                </button>
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
                                    className="group cursor-pointer transition-colors hover:bg-white/10"
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-primary">{client.companyName || "Unknown"}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex rounded-full bg-emerald-100/50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                            {Array.isArray(client.activities) ? client.activities[0] : "General"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-emerald-800">
                                        €{((client.valueMinor || 0) / 100).toLocaleString()}
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
