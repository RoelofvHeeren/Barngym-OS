'use client';

import { useState } from "react";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Activity } from "lucide-react";
import Link from "next/link";

type ActivityItem = {
    id: string;
    name: string;
    group: "Essential" | "Premium";
    selected: boolean;
};

export default function RetreatDetailPage({ params }: { params: { id: string } }) {
    const [activities, setActivities] = useState<ActivityItem[]>([
        // Essential
        { id: "1", name: "Yoga", group: "Essential", selected: true },
        { id: "2", name: "Circuit Training", group: "Essential", selected: true },
        { id: "3", name: "Cross Country Running", group: "Essential", selected: false },
        { id: "4", name: "Breathwork", group: "Essential", selected: true },
        { id: "5", name: "Ice Bath", group: "Essential", selected: true },
        { id: "6", name: "Meditation", group: "Essential", selected: false },
        { id: "7", name: "Pilates", group: "Essential", selected: false },
        // Premium
        { id: "8", name: "Sheep Herding", group: "Premium", selected: true },
        { id: "9", name: "Orienteering", group: "Premium", selected: false },
        { id: "10", name: "Hay Bale Racing", group: "Premium", selected: false },
        { id: "11", name: "Archery & Axe Throwing", group: "Premium", selected: true },
        { id: "12", name: "Frisbee Golf & Rounders", group: "Premium", selected: false },
        { id: "13", name: "Cocktails & Mocktails", group: "Premium", selected: true },
        { id: "14", name: "Mushroom Foraging", group: "Premium", selected: false },
    ]);

    const toggleActivity = (id: string) => {
        setActivities((current) =>
            current.map((item) =>
                item.id === id ? { ...item, selected: !item.selected } : item
            )
        );
    };

    const retreat = {
        company: "Riverside Legal",
        date: "Sep 15 - Sep 17, 2025",
        location: "Bell Farm",
        revenue: "€12,500",
        attendees: 12,
    };

    const essentials = activities.filter((a) => a.group === "Essential");
    const premiums = activities.filter((a) => a.group === "Premium");

    return (
        <div className="flex flex-col gap-8 text-primary pb-10">
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-emerald-900/10 pb-6">
                <Link href="/corporate/1" className="flex items-center gap-2 text-sm text-muted hover:text-primary">
                    <ArrowLeft size={16} />
                    Back to Client Profile
                </Link>
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Retreat Details</h1>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Completed
                    </span>
                </div>
            </div>

            {/* Section A: Retreat Overview */}
            <section className="glass-panel grid grid-cols-2 gap-6 lg:grid-cols-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Calendar size={16} />
                        <span>Date</span>
                    </div>
                    <p className="font-semibold">{retreat.date}</p>
                </div>
                <div>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Users size={16} />
                        <span>Company</span>
                    </div>
                    <p className="font-semibold">{retreat.company}</p>
                </div>
                <div>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <MapPin size={16} />
                        <span>Location</span>
                    </div>
                    <p className="font-semibold">{retreat.location}</p>
                </div>
                <div>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <DollarSign size={16} />
                        <span>Total Revenue</span>
                    </div>
                    <p className="font-semibold text-emerald-700">{retreat.revenue}</p>
                </div>
            </section>

            {/* Section B: Activity Selector */}
            <section className="glass-panel">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold">Activity Mapping</h2>
                    <p className="text-sm text-muted">Select activities delivered during this retreat.</p>
                </div>

                <div className="flex flex-col gap-8">
                    {/* Essentials */}
                    <div>
                        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Essential Workshops</h3>
                        <div className="flex flex-wrap gap-2">
                            {essentials.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => toggleActivity(item.id)}
                                    className={`chip text-sm font-medium transition-all ${item.selected
                                            ? "!bg-emerald-600 !text-white !border-emerald-600 shadow-md transform scale-105"
                                            : "hover:bg-emerald-900/5 opacity-70 hover:opacity-100"
                                        }`}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Premiums */}
                    <div>
                        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Premium Adventure Experiences</h3>
                        <div className="flex flex-wrap gap-2">
                            {premiums.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => toggleActivity(item.id)}
                                    className={`chip text-sm font-medium transition-all ${item.selected
                                            ? "!bg-amber-500 !text-white !border-amber-500 shadow-md transform scale-105"
                                            : "hover:bg-amber-500/10 opacity-70 hover:opacity-100"
                                        }`}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Section C: Popularity Analytics */}
            <section className="grid gap-6 md:grid-cols-2">
                <div className="glass-panel">
                    <h3 className="mb-4 text-lg font-semibold">Most Used Activities</h3>
                    <div className="space-y-3">
                        {[
                            { name: "Ice Bath", count: 85 },
                            { name: "Breathwork", count: 72 },
                            { name: "Sheep Herding", count: 68 },
                            { name: "Yoga", count: 45 },
                        ].map((stat, i) => (
                            <div key={stat.name} className="flex items-center gap-3">
                                <span className="w-6 text-sm font-bold text-muted">{i + 1}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium">{stat.name}</span>
                                        <span className="text-muted">{stat.count} sessions</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-emerald-900/5">
                                        <div
                                            className="h-full rounded-full bg-emerald-500"
                                            style={{ width: `${(stat.count / 85) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-panel">
                    <h3 className="mb-4 text-lg font-semibold">Most Profitable</h3>
                    <div className="space-y-3">
                        {[
                            { name: "Sheep Herding", value: "€3.2k" },
                            { name: "Archery", value: "€2.1k" },
                            { name: "Cocktails", value: "€1.8k" },
                            { name: "Ice Bath", value: "€1.5k" },
                        ].map((stat, i) => (
                            <div key={stat.name} className="flex items-center justify-between border-b border-emerald-900/5 pb-3 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100/50 text-emerald-800 text-xs font-bold">
                                        {i + 1}
                                    </div>
                                    <span className="font-medium">{stat.name}</span>
                                </div>
                                <span className="font-semibold text-emerald-700">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
