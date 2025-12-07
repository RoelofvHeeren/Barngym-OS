
import { MoreHorizontal, ArrowUpRight } from "lucide-react";

type Client = {
    id: string;
    name: string;
    contractType: string;
    revenue: string;
    employees: number;
    renewalDate: string;
    engagement: "High" | "Medium" | "Low";
};

const clients: Client[] = [
    {
        id: "1",
        name: "Riverside Legal",
        contractType: "Full Suite",
        revenue: "€182k",
        employees: 82,
        renewalDate: "Oct 2025",
        engagement: "High",
    },
    {
        id: "2",
        name: "Nova Printworks",
        contractType: "Retreats Only",
        revenue: "€126k",
        employees: 54,
        renewalDate: "Dec 2024",
        engagement: "Medium",
    },
    {
        id: "3",
        name: "Northshore Legal",
        contractType: "Coaching",
        revenue: "€98k",
        employees: 44,
        renewalDate: "Feb 2025",
        engagement: "Low",
    },
    {
        id: "4",
        name: "TechFlow Systems",
        contractType: "Ad-hoc",
        revenue: "€45k",
        employees: 25,
        renewalDate: "Rolling",
        engagement: "Medium",
    },
];

export default function CorporateClients() {
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
                            <th className="px-6 py-4 font-semibold">Contract</th>
                            <th className="px-6 py-4 font-semibold text-right">Revenue</th>
                            <th className="px-6 py-4 font-semibold text-right">Employees</th>
                            <th className="px-6 py-4 font-semibold">Renewal</th>
                            <th className="px-6 py-4 font-semibold">Engagement</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {clients.map((client) => (
                            <tr
                                key={client.id}
                                className="group cursor-pointer transition-colors hover:bg-white/10"
                            >
                                <td className="px-6 py-4">
                                    <p className="font-semibold text-primary">{client.name}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex rounded-full bg-emerald-100/50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                        {client.contractType}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-emerald-800">
                                    {client.revenue}
                                </td>
                                <td className="px-6 py-4 text-right text-muted">{client.employees}</td>
                                <td className="px-6 py-4 text-sm text-muted">{client.renewalDate}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`h-2.5 w-2.5 rounded-full ${client.engagement === "High"
                                                    ? "bg-emerald-500"
                                                    : client.engagement === "Medium"
                                                        ? "bg-yellow-500"
                                                        : "bg-red-500"
                                                }`}
                                        />
                                        <span className="text-sm font-medium text-muted">
                                            {client.engagement}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="rounded-full p-2 text-muted hover:bg-white/20 hover:text-primary">
                                        <ArrowUpRight size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
