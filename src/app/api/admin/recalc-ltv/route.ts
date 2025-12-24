import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdsLead } from "@/utils/ltv";
import { calculateLtvFromTransactions } from "@/utils/calculateLTV";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecalcResult {
    id: string; // Contact ID
    leadId: string | null;
    email: string | null;
    oldLtvAll: number;
    newLtvAll: number;
    txCount: number;
}

/**
 * Admin endpoint to recalculate all LTV values from Transaction records.
 * 
 * POST /api/admin/recalc-ltv
 * Body: { dryRun?: boolean, contactId?: string }
 * 
 * Updates Contact.ltvAllCents based on sum of transactions.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun ?? false;
        const specificContactId = body.contactId as string | undefined;

        console.log(`[RecalcLTV] Starting ${dryRun ? 'DRY RUN' : 'RECALCULATION'}...`);

        // Fetch contacts with transactions
        const whereClause = specificContactId ? { id: specificContactId } : {};

        const contacts = await prisma.contact.findMany({
            where: whereClause,
            select: {
                id: true,
                email: true,
                ltvAllCents: true,
                transactions: {
                    select: {
                        amountMinor: true,
                        status: true,
                        productType: true,
                    }
                },
            }
        });

        console.log(`[RecalcLTV] Processing ${contacts.length} contacts...`);

        const updates: RecalcResult[] = [];
        let totalFixed = 0;
        let totalSkipped = 0;

        for (const contact of contacts) {
            // Calculate LTV from transactions
            const newLtvAll = calculateLtvFromTransactions(contact.transactions);
            const oldLtvAll = contact.ltvAllCents;

            // Check if values changed
            if (newLtvAll !== oldLtvAll) {
                updates.push({
                    id: contact.id,
                    leadId: null, // We focus on Contact ID now
                    email: contact.email,
                    oldLtvAll,
                    newLtvAll,
                    txCount: contact.transactions.length
                });

                if (!dryRun) {
                    await prisma.contact.update({
                        where: { id: contact.id },
                        data: {
                            ltvAllCents: newLtvAll,
                            // We could also update specific segment LTVs here if we add them to Contact schema
                            // e.g. ltvAdsCents, ltvPTCents etc.
                            // For now, ltvAllCents is the critical one.
                        }
                    });
                }

                totalFixed++;
            } else {
                totalSkipped++;
            }
        }

        console.log(`[RecalcLTV] Complete. Fixed: ${totalFixed}, Skipped: ${totalSkipped}`);

        const totalOldLtv = updates.reduce((sum, u) => sum + u.oldLtvAll, 0);
        const totalNewLtv = updates.reduce((sum, u) => sum + u.newLtvAll, 0);

        return NextResponse.json({
            ok: true,
            message: dryRun
                ? `Dry run completed - ${totalFixed} contacts would be updated.`
                : `Recalculation completed - ${totalFixed} contacts updated.`,
            dryRun,
            summary: {
                totalContacts: contacts.length,
                contactsFixed: totalFixed,
                contactsSkipped: totalSkipped,
                totalLtvDiff: totalNewLtv - totalOldLtv,
            },
            updates: updates.slice(0, 50).map(u => ({
                ...u,
                oldLtvPounds: (u.oldLtvAll / 100).toFixed(2),
                newLtvPounds: (u.newLtvAll / 100).toFixed(2),
            })),
            totalUpdates: updates.length,
        });

    } catch (error) {
        console.error("Admin recalc-ltv error:", error);
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Recalculation failed." },
            { status: 500 }
        );
    }
}

/**
 * GET to see current LTV discrepancies without making changes
 */
export async function GET() {
    try {
        const contacts = await prisma.contact.findMany({
            include: {
                transactions: true
            }
        });

        const discrepancies: any[] = [];
        let totalStored = 0;
        let totalActual = 0;

        for (const contact of contacts) {
            const actual = calculateLtvFromTransactions(contact.transactions);
            const stored = contact.ltvAllCents;

            totalStored += stored;
            totalActual += actual;

            if (actual !== stored) {
                discrepancies.push({
                    email: contact.email,
                    stored: stored / 100,
                    actual: actual / 100,
                    diff: (actual - stored) / 100
                });
            }
        }

        return NextResponse.json({
            ok: true,
            summary: {
                totalContacts: contacts.length,
                discrepancies: discrepancies.length,
                totalDiff: (totalActual - totalStored) / 100
            },
            discrepancies: discrepancies.slice(0, 100)
        });

    } catch (error) {
        return NextResponse.json({ ok: false, message: "Check failed" }, { status: 500 });
    }
}
