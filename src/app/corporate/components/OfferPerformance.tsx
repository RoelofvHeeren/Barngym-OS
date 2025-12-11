
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type CorporateOverview = {
    activeContracts: number;
    totalRevenue: number;
    recentRetreats: {
        id: string;
        date: Date;
        location: string;
        revenue: number | null;
    }[];
    recentWorkshops: {
        id: string;
        name: string;
        date: Date;
        revenue: number | null;
        attendees: number;
    }[];
    atRisk: any[];
};

export default function OfferPerformance({ overview }: { overview: CorporateOverview }) {
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Card 1: Corporate Coaching */}
            <div className="glass-panel flex flex-col justify-between">
                <div>
                    <h3 className="mb-4 text-lg font-semibold">Corporate Coaching</h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between border-b border-emerald-900/5 pb-2">
                            <span className="text-sm text-muted">Active Contracts</span>
                            <span className="font-semibold">{overview.activeContracts}</span>
                        </div>
                        {/* 
                        <div className="flex justify-between border-b border-emerald-900/5 pb-2">
                            <span className="text-sm text-muted">Employees Enrolled</span>
                            <span className="font-semibold">-</span>
                        </div>
                        <div className="flex justify-between border-b border-emerald-900/5 pb-2">
                            <span className="text-sm text-muted">Engagement Score</span>
                            <span className="font-semibold text-emerald-600">-</span>
                        </div>
                        */}
                        <div className="flex justify-between border-b border-emerald-900/5 pb-2">
                            <span className="text-sm text-muted">Total Corporate Revenue</span>
                            <span className="font-semibold text-emerald-700">€{Math.round((overview.totalRevenue || 0) / 100).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {overview.atRisk.length > 0 && (
                    <div className="mt-6 rounded-xl bg-red-50/50 p-4 border border-red-100">
                        <div className="mb-2 flex items-center gap-2 text-red-800">
                            <AlertCircle size={16} />
                            <p className="text-xs font-bold uppercase tracking-wide">At-Risk Accounts</p>
                        </div>
                        <ul className="space-y-1">
                            {/* Map atRisk items here if any */}
                        </ul>
                    </div>
                )}
            </div>

            {/* Card 2: Retreat Tracking */}
            <div className="glass-panel flex flex-col">
                <h3 className="mb-4 text-lg font-semibold">Retreat Tracking</h3>

                <div className="mb-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/40 p-3 text-center">
                        <p className="text-xs text-muted">Recent</p>
                        <p className="text-xl font-bold">{overview.recentRetreats.length}</p>
                    </div>
                    {/* 
                    <div className="rounded-xl bg-white/40 p-3 text-center">
                        <p className="text-xs text-muted">12m Rev</p>
                        <p className="text-xl font-bold">€-</p>
                    </div>
                    */}
                </div>

                <div className="flex-1 overflow-hidden">
                    {overview.recentRetreats.length > 0 ? (
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-emerald-900/10 text-xs text-muted">
                                    <th className="pb-2 font-medium">Date/Loc</th>
                                    <th className="pb-2 font-medium text-right">Rev</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-900/5">
                                {overview.recentRetreats.map((retreat) => (
                                    <tr key={retreat.id}>
                                        <td className="py-3">
                                            <div className="font-medium">{format(new Date(retreat.date), "MMM d")}</div>
                                            <div className="text-xs text-muted">{retreat.location}</div>
                                        </td>
                                        <td className="py-3 text-right">€{Math.round((retreat.revenue || 0) / 100).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center text-sm text-muted py-8">No recent retreats</div>
                    )}
                </div>
            </div>

            {/* Card 3: Workshop Tracking */}
            <div className="glass-panel flex flex-col">
                <h3 className="mb-4 text-lg font-semibold">Workshop Tracking</h3>
                <div className="flex-1 overflow-hidden">
                    {overview.recentWorkshops.length > 0 ? (
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-emerald-900/10 text-xs text-muted">
                                    <th className="pb-2 font-medium">Workshop</th>
                                    <th className="pb-2 font-medium text-right">Rev</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-900/5">
                                {overview.recentWorkshops.map((ws) => (
                                    <tr key={ws.id}>
                                        <td className="py-3">
                                            <div className="font-medium">{ws.name}</div>
                                            <div className="text-xs text-muted">{format(new Date(ws.date), "MMM d")}</div>
                                        </td>
                                        <td className="py-3 text-right">
                                            <div className="font-medium">€{Math.round((ws.revenue || 0) / 100).toLocaleString()}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center text-sm text-muted py-8">No recent workshops</div>
                    )}
                </div>
            </div>
        </div>
    );
}
