"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type CorporateLead = {
    id: string;
    companyName: string | null;
    pocName: string | null;
    pocEmail: string | null;
    stage: string | null;
    valueMinor: number | null;
    updatedAt: Date;
    activities: any;
};

export async function getCorporatePipeline() {
    const leads = await prisma.lead.findMany({
        where: {
            isCorporate: true,
            status: "LEAD",
        },
        orderBy: {
            updatedAt: "desc",
        },
    });

    // Group by stage
    const pipeline = {
        new: leads.filter((l) => l.stage === "New"),
        qualified: leads.filter((l) => l.stage === "Qualified"),
        discovery: leads.filter((l) => l.stage === "Discovery Call"),
        proposal: leads.filter((l) => l.stage === "Proposal Sent"),
        negotiation: leads.filter((l) => l.stage === "Negotiation"),
        won: leads.filter((l) => l.stage === "Closed Won"),
        lost: leads.filter((l) => l.stage === "Closed Lost"),
    };

    return pipeline;
}

export async function updateLeadStage(leadId: string, stage: string) {
    await prisma.lead.update({
        where: { id: leadId },
        data: { stage },
    });
    revalidatePath("/corporate");
}

export async function createCorporateLead(data: {
    companyName: string;
    pocName: string;
    pocEmail: string;
    activities: string[];
    employeeCount: number;
    contractDuration: string;
    valueMinor: number;
}) {
    await prisma.lead.create({
        data: {
            isCorporate: true,
            status: "LEAD",
            stage: "New",
            companyName: data.companyName,
            pocName: data.pocName,
            pocEmail: data.pocEmail,
            activities: data.activities,
            employeeCount: data.employeeCount,
            contractDuration: data.contractDuration,
            valueMinor: data.valueMinor,
            // Default fields
            email: data.pocEmail, // Use POC email as primary for now
            firstName: data.pocName.split(" ")[0],
            lastName: data.pocName.split(" ").slice(1).join(" "),
            fullName: data.pocName,
        },
    });
    revalidatePath("/corporate");
}

export async function createCorporateClient(data: {
    companyName: string;
    pocName: string;
    pocEmail: string;
    activities: string[];
    employeeCount: number;
    contractDuration: string;
    valueMinor: number;
}) {
    await prisma.lead.create({
        data: {
            isCorporate: true,
            status: "CLIENT",
            stage: "Closed Won",
            companyName: data.companyName,
            pocName: data.pocName,
            pocEmail: data.pocEmail,
            activities: data.activities,
            employeeCount: data.employeeCount,
            contractDuration: data.contractDuration,
            valueMinor: data.valueMinor,
            // Default fields
            email: data.pocEmail,
            firstName: data.pocName.split(" ")[0],
            lastName: data.pocName.split(" ").slice(1).join(" "),
            fullName: data.pocName,
        },
    });
    revalidatePath("/corporate");
}

export async function updateCorporateLead(
    id: string,
    data: {
        companyName?: string;
        pocName?: string;
        pocEmail?: string;
        activities?: string[];
        employeeCount?: number;
        contractDuration?: string;
        valueMinor?: number;
    }
) {
    await prisma.lead.update({
        where: { id },
        data: {
            ...data,
            // Update derived fields if relevant
            ...(data.pocName && {
                firstName: data.pocName.split(" ")[0],
                lastName: data.pocName.split(" ").slice(1).join(" "),
                fullName: data.pocName,
            }),
            ...(data.pocEmail && { email: data.pocEmail }),
        },
    });
    revalidatePath("/corporate");
}

export async function getCorporateClients() {
    // Logic: Leads that have become clients (status=CLIENT or stage=Closed Won) and are corporate
    // Adjust based on how 'Client' status is strictly defined in system, for now assuming isCorporate=true and status='CLIENT' or stage='Closed Won'
    const clients = await prisma.lead.findMany({
        where: {
            isCorporate: true,
            OR: [
                { status: "CLIENT" },
                { stage: "Closed Won" }
            ],
            // Filter out Test Corp and other placeholders
            NOT: {
                companyName: { in: ["Test Corp", "Decathlon", "Unity Care", "Infinity Group"] }
            }
        },
        include: {
            payments: true,
            transactions: {
                where: {
                    status: { in: ["success", "completed", "paid"] }
                }
            }
        },
        orderBy: {
            updatedAt: "desc",
        },
    });

    // Calculate revenue and activities for each client
    return clients.map(client => {
        // Calculate revenue from transactions (primary source for corporate)
        const transactionRevenue = client.transactions.reduce((sum, tx) => sum + (tx.amountMinor || 0), 0);

        // Calculate revenue from direct payments if any (fallback/additive depending on logic, here treating as additive but usually one or other)
        const paymentRevenue = client.payments.reduce((sum, payment) => sum + payment.amountCents, 0);

        // Use transaction revenue as primary if available, otherwise paymenmts
        const totalRevenue = transactionRevenue > 0 ? transactionRevenue : paymentRevenue;

        // Derive activities from distinct product types in transactions
        const distinctActivities = Array.from(new Set(
            client.transactions
                .map(t => t.productType)
                .filter(Boolean)
        ));

        return {
            ...client,
            totalRevenue,
            activities: distinctActivities.length > 0 ? distinctActivities : (client.activities || ["General"])
        };
    });
}

export async function getCorporateClientDetails(id: string) {
    const client = await prisma.lead.findUnique({
        where: { id },
        include: {
            payments: true,
            transactions: {
                where: {
                    status: { in: ["success", "completed", "paid"] }
                },
                orderBy: {
                    occurredAt: 'desc'
                }
            }
        }
    });

    if (!client) return null;

    // Calculate details
    const transactionRevenue = client.transactions.reduce((sum, tx) => sum + (tx.amountMinor || 0), 0);
    const paymentRevenue = client.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const totalRevenue = transactionRevenue > 0 ? transactionRevenue : paymentRevenue;

    const distinctActivities = Array.from(new Set(
        client.transactions
            .map(t => t.productType)
            .filter(Boolean)
    ));

    return {
        ...client,
        totalRevenue,
        derivedActivities: distinctActivities
    };
}

export async function getLead(id: string) {
    return await prisma.lead.findUnique({
        where: { id },
    });
}

export async function handleFileUpload(formData: FormData) {
    // Placeholder for file upload logic
    console.log("File uploaded:", formData.get("file"));
    revalidatePath("/corporate");
}
