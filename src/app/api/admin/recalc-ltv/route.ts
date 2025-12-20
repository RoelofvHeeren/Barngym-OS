import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdsLead } from "@/utils/ltv";
import { classifyProduct } from "@/utils/productClassifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecalcResult {
    id: string;
    name: string | null;
    email: string | null;
    oldLtvAll: number;
    newLtvAll: number;
    oldLtvAds: number;
    newLtvAds: number;
    isAdsLead: boolean;
    paymentCount: number;
}

/**
 * Admin endpoint to recalculate all LTV values from Payment records.
 * 
 * POST /api/admin/recalc-ltv
 * Body: { dryRun?: boolean, leadId?: string }
 * 
 * If leadId is provided, only recalculates for that lead.
 * If dryRun is true, reports what would change without making changes.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun ?? false;
        const specificLeadId = body.leadId as string | undefined;

        console.log(`[RecalcLTV] Starting ${dryRun ? 'DRY RUN' : 'RECALCULATION'}...`);

        // Fetch all leads with their payments
        const whereClause = specificLeadId ? { id: specificLeadId } : {};

        const leads = await prisma.lead.findMany({
            where: whereClause,
            select: {
                id: true,
                fullName: true,
                email: true,
                source: true,
                tags: true,
                isClient: true,
                ltvAllCents: true,
                ltvAdsCents: true,
                ltvPTCents: true,
                ltvClassesCents: true,
                ltvOnlineCoachingCents: true,
                ltvCorporateCents: true,
                payments: {
                    select: {
                        id: true,
                        amountCents: true,
                        productType: true,
                    }
                }
            }
        });

        console.log(`[RecalcLTV] Processing ${leads.length} leads...`);

        const updates: RecalcResult[] = [];
        let totalFixed = 0;
        let totalSkipped = 0;

        for (const lead of leads) {
            // Calculate LTV from payments
            let ltvAllCents = 0;
            let ltvPTCents = 0;
            let ltvClassesCents = 0;
            let ltvOnlineCoachingCents = 0;
            let ltvCorporateCents = 0;

            for (const payment of lead.payments) {
                const amount = payment.amountCents ?? 0;
                ltvAllCents += amount;

                const category = classifyProduct(payment.productType || "");
                if (category === "pt") ltvPTCents += amount;
                else if (category === "classes") ltvClassesCents += amount;
                else if (category === "online_coaching") ltvOnlineCoachingCents += amount;
                else if (category === "corporate") ltvCorporateCents += amount;
            }

            // Determine if this is an ads lead
            const leadIsAds = isAdsLead(lead as any);
            const ltvAdsCents = leadIsAds ? ltvAllCents : 0;

            // Check if any values changed
            const hasChanges =
                lead.ltvAllCents !== ltvAllCents ||
                lead.ltvAdsCents !== ltvAdsCents ||
                lead.ltvPTCents !== ltvPTCents ||
                lead.ltvClassesCents !== ltvClassesCents ||
                lead.ltvOnlineCoachingCents !== ltvOnlineCoachingCents ||
                lead.ltvCorporateCents !== ltvCorporateCents;

            if (hasChanges) {
                updates.push({
                    id: lead.id,
                    name: lead.fullName,
                    email: lead.email,
                    oldLtvAll: lead.ltvAllCents,
                    newLtvAll: ltvAllCents,
                    oldLtvAds: lead.ltvAdsCents,
                    newLtvAds: ltvAdsCents,
                    isAdsLead: leadIsAds,
                    paymentCount: lead.payments.length,
                });

                if (!dryRun) {
                    // Update the lead
                    const isClient = ltvAllCents > 0 || lead.isClient;

                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            ltvAllCents,
                            ltvAdsCents,
                            ltvPTCents,
                            ltvClassesCents,
                            ltvOnlineCoachingCents,
                            ltvCorporateCents,
                            isClient,
                        }
                    });
                }

                totalFixed++;
            } else {
                totalSkipped++;
            }
        }

        console.log(`[RecalcLTV] Complete. Fixed: ${totalFixed}, Skipped: ${totalSkipped}`);

        // Calculate summary stats
        const totalOldAdsLtv = updates.reduce((sum, u) => sum + u.oldLtvAds, 0);
        const totalNewAdsLtv = updates.reduce((sum, u) => sum + u.newLtvAds, 0);
        const totalOldAllLtv = updates.reduce((sum, u) => sum + u.oldLtvAll, 0);
        const totalNewAllLtv = updates.reduce((sum, u) => sum + u.newLtvAll, 0);

        return NextResponse.json({
            ok: true,
            message: dryRun
                ? `Dry run completed - ${totalFixed} leads would be updated.`
                : `Recalculation completed - ${totalFixed} leads updated.`,
            dryRun,
            summary: {
                totalLeads: leads.length,
                leadsFixed: totalFixed,
                leadsSkipped: totalSkipped,
                oldAdsLtvTotal: totalOldAdsLtv,
                newAdsLtvTotal: totalNewAdsLtv,
                adsLtvDiff: totalNewAdsLtv - totalOldAdsLtv,
                oldAllLtvTotal: totalOldAllLtv,
                newAllLtvTotal: totalNewAllLtv,
                allLtvDiff: totalNewAllLtv - totalOldAllLtv,
            },
            // Only include first 50 updates in response to avoid huge payloads
            updates: updates.slice(0, 50).map(u => ({
                ...u,
                oldLtvAllPounds: (u.oldLtvAll / 100).toFixed(2),
                newLtvAllPounds: (u.newLtvAll / 100).toFixed(2),
                oldLtvAdsPounds: (u.oldLtvAds / 100).toFixed(2),
                newLtvAdsPounds: (u.newLtvAds / 100).toFixed(2),
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
        // Get ads leads and check for discrepancies
        const adsLeadFilter = {
            OR: [
                { tags: { array_contains: "ads" } },
                { source: { contains: "ads", mode: "insensitive" as const } },
                { source: { contains: "facebook", mode: "insensitive" as const } },
                { source: { contains: "instagram", mode: "insensitive" as const } },
                { source: { contains: "meta", mode: "insensitive" as const } },
                { source: { contains: "tiktok", mode: "insensitive" as const } },
                { source: { equals: "ghl_ads", mode: "insensitive" as const } },
            ],
        };

        const adsClients = await prisma.lead.findMany({
            where: {
                ...adsLeadFilter,
                isClient: true,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                source: true,
                ltvAllCents: true,
                ltvAdsCents: true,
                payments: { select: { amountCents: true } },
            }
        });

        let storedAdsLtvTotal = 0;
        let actualAdsLtvTotal = 0;
        const discrepancies: Array<{
            name: string | null;
            email: string | null;
            stored: number;
            actual: number;
            diff: number;
        }> = [];

        for (const lead of adsClients) {
            const stored = lead.ltvAdsCents || 0;
            const actual = lead.payments.reduce((sum, p) => sum + (p.amountCents || 0), 0);

            storedAdsLtvTotal += stored;
            actualAdsLtvTotal += actual;

            if (stored !== actual) {
                discrepancies.push({
                    name: lead.fullName,
                    email: lead.email,
                    stored: stored / 100,
                    actual: actual / 100,
                    diff: (actual - stored) / 100,
                });
            }
        }

        return NextResponse.json({
            ok: true,
            summary: {
                totalAdsClients: adsClients.length,
                storedAdsLtvTotal: storedAdsLtvTotal / 100,
                actualAdsLtvTotal: actualAdsLtvTotal / 100,
                difference: (actualAdsLtvTotal - storedAdsLtvTotal) / 100,
                discrepancyCount: discrepancies.length,
            },
            discrepancies,
        });

    } catch (error) {
        console.error("Admin recalc-ltv check error:", error);
        return NextResponse.json(
            { ok: false, message: error instanceof Error ? error.message : "Check failed." },
            { status: 500 }
        );
    }
}
