
import { ArrowUpRight, AlertCircle, Calendar } from "lucide-react";
import Link from "next/link";

export default function OfferPerformance() {
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Card 1: Corporate Coaching */}
            <div className="glass-panel flex flex-col justify-between">
                <div>
                    <h3 className="mb-4 text-lg font-semibold">Corporate Coaching</h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between border-b border-emerald-900/5 pb-2">
                            <span className="text-sm text-muted">Active Contracts</span>
                            <span className="font-semibold">14</span>
                        </div>
                        <div className="flex justify-between border-b border-emerald-900/5 pb-2">
                            <span className="text-sm text-muted">Employees Enrolled</span>
                            <span className="font-semibold">612</span>
                        </div>
                        <div className="flex justify-between border-b border-emerald-900/5 pb-2">
                            <span className="text-sm text-muted">Engagement Score</span>
                            <span className="font-semibold text-emerald-600">8.4/10</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 rounded-xl bg-red-50/50 p-4 border border-red-100">
                    <div className="mb-2 flex items-center gap-2 text-red-800">
                        <AlertCircle size={16} />
                        <p className="text-xs font-bold uppercase tracking-wide">At-Risk Accounts</p>
                    </div>
                    <ul className="space-y-1">
                        <li className="flex justify-between text-sm">
                            <span className="text-red-900/80">Northshore Legal</span>
                            <span className="text-xs text-red-700 font-medium">Low usage</span>
                        </li>
                        <li className="flex justify-between text-sm">
                            <span className="text-red-900/80">TechStart LTD</span>
                            <span className="text-xs text-red-700 font-medium">Renewal in 30d</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Card 2: Retreat Tracking */}
            <div className="glass-panel flex flex-col">
                <h3 className="mb-4 text-lg font-semibold">Retreat Tracking</h3>

                <div className="mb-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/40 p-3 text-center">
                        <p className="text-xs text-muted">Upcoming</p>
                        <p className="text-xl font-bold">3</p>
                    </div>
                    <div className="rounded-xl bg-white/40 p-3 text-center">
                        <p className="text-xs text-muted">12m Rev</p>
                        <p className="text-xl font-bold">€210k</p>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-emerald-900/10 text-xs text-muted">
                                <th className="pb-2 font-medium">Date/Loc</th>
                                <th className="pb-2 font-medium text-right">Rev</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-900/5">
                            <tr>
                                <td className="py-3">
                                    <Link href="/corporate/retreat/1" className="group-hover:text-emerald-700">
                                        <div className="font-medium hover:underline">Sep 15</div>
                                        <div className="text-xs text-muted">Oastbrook</div>
                                    </Link>
                                </td>
                                <td className="py-3 text-right">€12k</td>
                            </tr>
                            <tr>
                                <td className="py-3">
                                    <Link href="/corporate/retreat/2" className="group-hover:text-emerald-700">
                                        <div className="font-medium hover:underline">Oct 02</div>
                                        <div className="text-xs text-muted">Bell Farm</div>
                                    </Link>
                                </td>
                                <td className="py-3 text-right">€18.5k</td>
                            </tr>
                            <tr>
                                <td className="py-3">
                                    <Link href="/corporate/retreat/3" className="group-hover:text-emerald-700">
                                        <div className="font-medium hover:underline">Nov 10</div>
                                        <div className="text-xs text-muted">East Wood</div>
                                    </Link>
                                </td>
                                <td className="py-3 text-right">€9k</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <button className="mt-3 w-full text-center text-xs font-medium text-emerald-700 hover:underline">
                    View all retreats
                </button>
            </div>

            {/* Card 3: Workshop Tracking */}
            <div className="glass-panel flex flex-col">
                <h3 className="mb-4 text-lg font-semibold">Workshop Tracking</h3>
                <div className="flex-1 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-emerald-900/10 text-xs text-muted">
                                <th className="pb-2 font-medium">Workshop</th>
                                <th className="pb-2 font-medium text-right">Rev/Pax</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-900/5">
                            {[
                                { name: "Breathwork", date: "Today", rev: "€850", pax: "12" },
                                { name: "Ice Bath", date: "Yesterday", rev: "€1.2k", pax: "18" },
                                { name: "Leadership", date: "Sep 05", rev: "€2.5k", pax: "8" },
                                { name: "Nutrition", date: "Sep 01", rev: "€600", pax: "20" },
                            ].map((ws, i) => (
                                <tr key={i}>
                                    <td className="py-3">
                                        <div className="font-medium">{ws.name}</div>
                                        <div className="text-xs text-muted">{ws.date}</div>
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="font-medium">{ws.rev}</div>
                                        <div className="text-xs text-muted">{ws.pax} pax</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button className="mt-3 w-full text-center text-xs font-medium text-emerald-700 hover:underline">
                    View all workshops
                </button>
            </div>
        </div>
    );
}
