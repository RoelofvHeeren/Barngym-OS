'use client';

import { useState } from "react";
import { ArrowLeft, Building, Users, Calendar, Mail, FileText } from "lucide-react";
import Link from "next/link";

export default function ClientProfilePage({ params }: { params: { id: string } }) {
    const [activeTab, setActiveTab] = useState<"coaching" | "retreats" | "workshops">("coaching");

    // Mock Data
    const client = {
        name: "Riverside Legal",
        status: "Active",
        accountManager: "James Wilson",
        industry: "Legal Services",
        hq: "London, UK",
        totalRevenue: "€182k",
        lifetimeValue: "€450k",
        contractStart: "Sep 2023",
        contractEnd: "Sep 2025",
        employees: 82,
        engagementScore: 9.2,
    };

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
                            <h1 className="text-3xl font-bold">{client.name}</h1>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                                {client.status}
                            </span>
                        </div>
                        <p className="mt-1 text-muted">Managed by {client.accountManager}</p>
                    </div>
                    <button className="btn-primary text-sm shadow-md">
                        Edit Profile
                    </button>
                </div>
            </div>

            {/* Section 1 - Company Overview */}
            <section className="glass-panel grid gap-6 md:grid-cols-4">
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Building size={16} />
                        <span>Industry</span>
                    </div>
                    <p className="font-semibold">{client.industry}</p>
                </div>
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Calendar size={16} />
                        <span>Contract Period</span>
                    </div>
                    <p className="font-semibold">{client.contractStart} - {client.contractEnd}</p>
                </div>
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <FileText size={16} />
                        <span>Total Revenue (YTD)</span>
                    </div>
                    <p className="font-semibold text-emerald-700">{client.totalRevenue}</p>
                </div>
                <div className="md:col-span-1">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Users size={16} />
                        <span>Employees Enrolled</span>
                    </div>
                    <p className="font-semibold">{client.employees}</p>
                </div>
            </section>

            {/* Section 2 - Offer Engagement Tabs */}
            <section className="flex flex-col gap-6">
                <div className="flex gap-2 border-b border-emerald-900/10">
                    {(["coaching", "retreats", "workshops"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`border-b-2 px-6 py-3 text-sm font-medium capitalize transition-colors ${activeTab === tab
                                    ? "border-emerald-600 text-emerald-800"
                                    : "border-transparent text-muted hover:text-primary"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="glass-panel min-h-[300px]">
                    {activeTab === "coaching" && (
                        <div className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="rounded-xl bg-white/40 p-4">
                                    <p className="text-xs uppercase text-muted">Engagement Score</p>
                                    <p className="text-2xl font-bold">{client.engagementScore}/10</p>
                                </div>
                                <div className="rounded-xl bg-white/40 p-4">
                                    <p className="text-xs uppercase text-muted">Attendance Rate</p>
                                    <p className="text-2xl font-bold">88%</p>
                                </div>
                                <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
                                    <p className="text-xs uppercase text-red-800 font-bold">At-Risk Employees</p>
                                    <p className="text-2xl font-bold text-red-900">4</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "retreats" && (
                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="border-b border-emerald-900/5 text-xs text-muted uppercase">
                                    <tr>
                                        <th className="pb-3 font-semibold">Date</th>
                                        <th className="pb-3 font-semibold">Location</th>
                                        <th className="pb-3 font-semibold text-right">Attendees</th>
                                        <th className="pb-3 font-semibold text-right">Revenue</th>
                                        <th className="pb-3 font-semibold">Activities</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-900/5 text-sm">
                                    <tr>
                                        <td className="py-4 font-medium">Sep 15, 2025</td>
                                        <td className="py-4 text-muted">Bell Farm</td>
                                        <td className="py-4 text-right">12</td>
                                        <td className="py-4 text-right font-medium text-emerald-700">€12.5k</td>
                                        <td className="py-4">
                                            <div className="flex gap-1">
                                                <span className="bg-emerald-100/50 text-emerald-800 px-2 py-0.5 rounded text-[10px]">Yoga</span>
                                                <span className="bg-emerald-100/50 text-emerald-800 px-2 py-0.5 rounded text-[10px]">Ice Bath</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 font-medium">Jun 10, 2025</td>
                                        <td className="py-4 text-muted">Oastbrook</td>
                                        <td className="py-4 text-right">18</td>
                                        <td className="py-4 text-right font-medium text-emerald-700">€18k</td>
                                        <td className="py-4">
                                            <div className="flex gap-1">
                                                <span className="bg-emerald-100/50 text-emerald-800 px-2 py-0.5 rounded text-[10px]">Archery</span>
                                                <span className="bg-emerald-100/50 text-emerald-800 px-2 py-0.5 rounded text-[10px]">Foraging</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === "workshops" && (
                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="border-b border-emerald-900/5 text-xs text-muted uppercase">
                                    <tr>
                                        <th className="pb-3 font-semibold">Workshop Type</th>
                                        <th className="pb-3 font-semibold">Date</th>
                                        <th className="pb-3 font-semibold text-right">Participants</th>
                                        <th className="pb-3 font-semibold text-right">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-900/5 text-sm">
                                    <tr>
                                        <td className="py-4 font-medium">Breathwork Masterclass</td>
                                        <td className="py-4 text-muted">Aug 05, 2025</td>
                                        <td className="py-4 text-right">24</td>
                                        <td className="py-4 text-right font-medium text-emerald-700">€2.4k</td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 font-medium">Leadership Circle</td>
                                        <td className="py-4 text-muted">Jul 20, 2025</td>
                                        <td className="py-4 text-right">8</td>
                                        <td className="py-4 text-right font-medium text-emerald-700">€4k</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
