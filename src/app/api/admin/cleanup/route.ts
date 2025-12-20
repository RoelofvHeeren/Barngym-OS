import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin endpoint to delete test leads and clean up related data.
 * 
 * POST /api/admin/cleanup
 * Body: { names?: string[], dryRun?: boolean }
 * 
 * If names is not provided, defaults to: Mark Zuckerberg, Elon Musk, Teste van Heeren
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun ?? false;
        const namesToDelete = body.names ?? [
            "Mark Zuckerberg",
            "Elon Musk",
            "Teste van Heeren"
        ];

        const results: Array<{
            name: string;
            id: string;
            email: string | null;
            paymentsDeleted: number;
            transactionsDeleted: number;
            leadDeleted: boolean;
        }> = [];

        // Find leads matching the names
        const leads = await prisma.lead.findMany({
            where: {
                OR: namesToDelete.map((name: string) => ({
                    fullName: { contains: name, mode: "insensitive" as const }
                }))
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                _count: { select: { payments: true } }
            }
        });

        if (leads.length === 0) {
            return NextResponse.json({
                ok: true,
                message: "No matching leads found to delete.",
                dryRun,
                deleted: [],
            });
        }

        for (const lead of leads) {
            let paymentsDeleted = 0;
            let transactionsDeleted = 0;
            let leadDeleted = false;

            if (!dryRun) {
                // 1. Delete all payments for this lead
                const paymentResult = await prisma.payment.deleteMany({
                    where: { leadId: lead.id }
                });
                paymentsDeleted = paymentResult.count;

                // 2. Delete all transactions linked to this lead
                const transactionResult = await prisma.transaction.deleteMany({
                    where: { leadId: lead.id }
                });
                transactionsDeleted = transactionResult.count;

                // 3. Delete lead events and tracking
                await prisma.leadEvent.deleteMany({ where: { leadId: lead.id } });
                await prisma.leadTracking.deleteMany({ where: { leadId: lead.id } });
                await prisma.adsRevenue.deleteMany({ where: { leadId: lead.id } });
                await prisma.counterpartyMapping.deleteMany({ where: { leadId: lead.id } });

                // 4. Delete the lead itself
                await prisma.lead.delete({
                    where: { id: lead.id }
                });
                leadDeleted = true;
            } else {
                // Dry run - just count what would be deleted
                paymentsDeleted = lead._count.payments;
                // Count transactions separately
                const txCount = await prisma.transaction.count({
                    where: { leadId: lead.id }
                });
                transactionsDeleted = txCount;
                leadDeleted = true; // Would be deleted
            }

            results.push({
                name: lead.fullName ?? "Unknown",
                id: lead.id,
                email: lead.email,
                paymentsDeleted,
                transactionsDeleted,
                leadDeleted,
            });
        }

        return NextResponse.json({
            ok: true,
            message: dryRun ? "Dry run completed - no changes made." : "Cleanup completed successfully.",
            dryRun,
            deleted: results,
            summary: {
                leadsDeleted: results.filter(r => r.leadDeleted).length,
                totalPaymentsDeleted: results.reduce((sum, r) => sum + r.paymentsDeleted, 0),
                totalTransactionsDeleted: results.reduce((sum, r) => sum + r.transactionsDeleted, 0),
            }
        });

    } catch (error) {
        console.error("Admin cleanup error:", error);
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Cleanup failed." },
            { status: 500 }
        );
    }
}

/**
 * GET to check what would be deleted (equivalent to dry run)
 */
export async function GET() {
    try {
        const namesToDelete = [
            "Mark Zuckerberg",
            "Elon Musk",
            "Teste van Heeren"
        ];

        const leads = await prisma.lead.findMany({
            where: {
                OR: namesToDelete.map((name: string) => ({
                    fullName: { contains: name, mode: "insensitive" as const }
                }))
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                source: true,
                ltvAllCents: true,
                ltvAdsCents: true,
                _count: { select: { payments: true, transactions: true } }
            }
        });

        return NextResponse.json({
            ok: true,
            message: `Found ${leads.length} test leads that can be deleted.`,
            leads: leads.map(l => ({
                id: l.id,
                name: l.fullName,
                email: l.email,
                source: l.source,
                ltvAllCents: l.ltvAllCents,
                ltvAdsCents: l.ltvAdsCents,
                paymentCount: l._count.payments,
                transactionCount: l._count.transactions,
            })),
        });

    } catch (error) {
        console.error("Admin cleanup check error:", error);
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Check failed." },
            { status: 500 }
        );
    }
}
