import { prisma } from "@/lib/prisma";
import { classifyProduct } from "@/utils/productClassifier";

export const isAdsLead = (lead: { source: string | null; tags: unknown }) => {
    const src = (lead.source ?? "").toLowerCase();
    if (
        src.includes("ads") ||
        src.includes("facebook") ||
        src.includes("instagram") ||
        src.includes("meta") ||
        src.includes("tiktok") ||
        src === "ghl_ads"
    )
        return true;

    const tags = lead.tags;
    if (!tags) return false;

    if (Array.isArray(tags)) {
        return tags.some(
            (tag) => typeof tag === "string" && tag.toLowerCase().includes("ads")
        );
    }

    if (typeof tags === "object") {
        // legacy JSON structure support
        return Object.values(tags as Record<string, unknown>).some(
            (value) => typeof value === "string" && value.toLowerCase().includes("ads")
        );
    }

    return false;
};

/**
 * Recalculates LTV fields for a given Lead and updates the database.
 */
export async function recalculateLeadLtv(leadId: string) {
    try {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                payments: true,
            },
        });

        if (!lead) return; // Should potentially throw?

        // 1. Calculate All LTV
        // We base it on the Payments table which is the source of truth for revenue.
        const ltvAllCents = lead.payments.reduce(
            (sum, p) => sum + (p.amountCents ?? 0),
            0
        );

        // 2. Calculate Ads LTV
        // Logic: If they are an Ads Lead, is ALL their revenue Ads Revenue?
        // Or only revenue attributed with specific UTMs?
        // Based on `recalc-lead-ltv.ts` analysis and user conversation,
        // if a client is sourced from Ads, we count their *Entire* LTV towards Ads LTV (Cohort LTV).
        const adsLead = isAdsLead(lead);
        const ltvAdsCents = adsLead ? ltvAllCents : 0;

        // 3. Category Breakdowns (Optional for display, but good to have)
        // We can also update these if the schema supports it, but the main issue is `ltvAdsCents` and `ltvAllCents`.
        // The `api/ltv/categories` route calculates these on fly.
        // If we want to store them, we'd need fields like `ltvPtCents` etc.
        // Let's check schema via what we saw in `recalc-lead-ltv.ts` -> it didn't use them.
        // `api/ltv/route.ts` used `ltvPTCents`, `ltvClassesCents` etc.
        // So they DO exist on the model. Let's calculate them too.

        let ltvPTCents = 0;
        let ltvClassesCents = 0;
        let ltvOnlineCoachingCents = 0;
        let ltvCorporateCents = 0;
        let ltvCommunityCents = 0;
        let ltvSixWeekCents = 0; // Legacy?

        for (const payment of lead.payments) {
            const amount = payment.amountCents ?? 0;
            const type = payment.productType || "";
            const category = classifyProduct(type);

            if (category === "pt") ltvPTCents += amount;
            else if (category === "classes") ltvClassesCents += amount;
            else if (category === "online_coaching") ltvOnlineCoachingCents += amount;
            else if (category === "corporate") ltvCorporateCents += amount;
            // else...
        }

        // 4. Update Lead
        const isClient = ltvAllCents > 0 || lead.isClient;
        const status = ltvAllCents > 0 && lead.status !== "CLIENT" ? "CLIENT" : lead.status;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                ltvAllCents,
                ltvAdsCents,
                ltvPTCents,
                ltvClassesCents,
                ltvOnlineCoachingCents,
                ltvCorporateCents,
                isClient,
                status,
            },
        });

        // If this lead is linked to a contact, we should probably trigger contact recalc too?
        // Or vice versa? The Contact -> Lead link is usually 1:1 or N:1.
        // `api/manual-match` updates Contact.ltvAllCents separate from Lead.
        // We should probably sync them if possible.
        // But for now, let's stick to fixing the reported Lead LTV issue.

    } catch (error) {
        console.error(`Failed to recalculate LTV for lead ${leadId}:`, error);
    }
}

/**
 * Recalculates LTV for a Contact.
 * Contacts are often the parent of Leads or linked via email.
 */
export async function recalculateContactLtv(contactId: string) {
    try {
        // Sum transactions linked to this contact
        const aggregate = await prisma.transaction.aggregate({
            where: {
                contactId,
                status: { in: ["Completed", "succeeded", "SETTLED", "paid", "success"] },
            },
            _sum: {
                amountMinor: true,
            },
        });

        const total = aggregate._sum.amountMinor || 0;

        await prisma.contact.update({
            where: { id: contactId },
            data: { ltvAllCents: total },
        });
    } catch (error) {
        console.error(`Failed to recalculate LTV for contact ${contactId}:`, error);
    }
}
