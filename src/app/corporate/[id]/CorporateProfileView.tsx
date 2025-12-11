"use client";

import { useState } from "react";
import { ArrowLeft, Building, Users, Calendar, Link as LinkIcon, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function CorporateProfileView({ client }: { client: any }) {
    const [activeTab, setActiveTab] = useState<"transactions" | "details">("transactions");

    return (
        <div className="flex flex-col gap-8 text-primary pb-10">
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-emerald-900/10 pb-6">
                <Link href="/corporate" className="flex items-center gap-2 text-sm text-muted hover:text-primary">
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">{client.companyName || "Unknown Company"}</h1>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                                {client.status || "Active"}
                            </span>
                        </div>
                        <p className="mt-1 text-muted">POC: {client.pocName || "N/A"}</p>
                    </div>
                </div>
            </div>

            {/* Section 1 - Company Overview */}
            <section className="glass-panel grid gap-6 md:grid-cols-4">
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Building size={16} />
                        <span>Company</span>
                    </div>
                    <p className="font-semibold">{client.companyName}</p>
                </div>
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Calendar size={16} />
                        <span>Contract Duration</span>
                    </div>
                    <p className="font-semibold">{client.contractDuration || "-"}</p>
                </div>
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <FileText size={16} />
                        <span>Total Revenue</span>
                    </div>
                    <p className="font-semibold text-emerald-700">€{((client.totalRevenue || 0) / 100).toLocaleString()}</p>
                </div>
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Users size={16} />
                        <span>Employees</span>
                    </div>
                    <p className="font-semibold">{client.employeeCount || 0}</p>
                </div>
            </section>

            {/* Section 2 - Tabs */}
            <section className="flex flex-col gap-6">
                <div className="flex gap-2 border-b border-emerald-900/10">
                    <button
                        onClick={() => setActiveTab("transactions")}
                        className={`border-b-2 px-6 py-3 text-sm font-medium capitalize transition-colors ${activeTab === "transactions"
                            ? "border-emerald-600 text-emerald-800"
                            : "border-transparent text-muted hover:text-primary"
                            }`}
                    >
                        Transactions
                    </button>
                    {/* Placeholder for future details tab if needed */}
                </div>

                <div className="glass-panel min-h-[300px]">
                    {activeTab === "transactions" && (
                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="border-b border-emerald-900/5 text-xs text-muted uppercase">
                                    <tr>
                                        <th className="pb-3 font-semibold">Date</th>
                                        <th className="pb-3 font-semibold">Description</th>
                                        <th className="pb-3 font-semibold">Product Type</th>
                                        <th className="pb-3 font-semibold text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-900/5 text-sm">
                                    {client.transactions && client.transactions.length > 0 ? (
                                        client.transactions.map((tx: any) => (
                                            <tr key={tx.id}>
                                                <td className="py-4 font-medium">{format(new Date(tx.occurredAt), "MMM d, yyyy")}</td>
                                                <td className="py-4 text-muted">{tx.description || "-"}</td>
                                                <td className="py-4">
                                                    <span className="bg-emerald-100/50 text-emerald-800 px-2 py-0.5 rounded text-xs">
                                                        {tx.productType || "Unknown"}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-right font-medium text-emerald-700">
                                                    €{((tx.amountMinor || 0) / 100).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-muted">
                                                No transactions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
