import { prisma } from "@/lib/prisma";
import { NormalizedTransaction, upsertTransactions, mapGlofoxPayment } from "@/lib/transactions";

type GlofoxSecret = {
    apiKey?: string;
    apiToken?: string;
    branchId?: string;
};

// Based on typical Glofox API responses or webhook payloads
// We treat the API response heavily defensively since we don't have strict docs
type GlofoxApiTransaction = {
    id?: string;
    payment_id?: string;
    amount?: number;
    total?: number;
    currency?: string;
    status?: string;
    payment_status?: string;
    created_at?: string | number;
    transaction_time?: string;
    date?: string;
    member_name?: string;
    user?: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
        mobile?: string;
        id?: string;
    };
    member_email?: string;
    description?: string;
    reference?: string;
    [key: string]: unknown;
};

export async function syncGlofoxTransactions(daysToSync: number = 7) {
    const record = await prisma.connectionSecret.findUnique({
        where: { provider: "glofox" },
    });

    const secret = (record?.secret as GlofoxSecret | null);

    if (!secret?.apiKey || !secret?.apiToken || !secret?.branchId) {
        throw new Error("Glofox Request Failed: Missing credentials (API Key, Token, or Branch ID).");
    }

    const { apiKey, apiToken, branchId } = secret;
    const baseUrl = `https://gf-api.aws.glofox.com/prod/2.0/branches/${branchId}`;

    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - daysToSync);

    // We'll try to fetch transactions. We assume a `from` parameter works or filtering is needed.
    // Since we don't know exact params, we'll try standard keys: `from`, `from_date`, `created_from`
    // And we'll just fetch a reasonable batch size.
    const queryParams = new URLSearchParams({
        limit: "100",
        from: fromDate.toISOString().split("T")[0], // YYYY-MM-DD
        to: toDate.toISOString().split("T")[0],
        sort: "desc"
    });

    const url = `${baseUrl}/transactions?${queryParams.toString()}`;
    console.log(`[Glofox Sync] Fetching: ${url}`);

    const res = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "x-glofox-api-token": apiToken,
            "x-glofox-branch-id": branchId,
        },
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Glofox API Error ${res.status}: ${errorText}`);
    }

    const data = await res.json();

    // Glofox sometimes returns 200 OK with an error message in the body
    if (data.success === false || (data.message && data.message_code)) {
        throw new Error(`Glofox API Error (200): ${data.message || JSON.stringify(data)}`);
    }

    const rawTransactions = Array.isArray(data) ? data : (data.data || data.transactions || []);

    // Normalize and Upsert

    if (!Array.isArray(rawTransactions)) {
        console.warn("[Glofox Sync] Unexpected response format:", JSON.stringify(data).slice(0, 200));
        return { added: 0, total: 0, message: "Unexpected API response format." };
    }

    console.log(`[Glofox Sync] Received ${rawTransactions.length} records.`);

    const records = rawTransactions
        .map((item: any) => {
            try {
                const payload: any = {
                    ...item,
                    member_name: item.member_name || (item.user ? `${item.user.first_name} ${item.user.last_name}`.trim() : undefined),
                    member_email: item.member_email || item.user?.email,
                    member_phone: item.member_phone || item.user?.phone || item.user?.mobile,
                    member_id: item.member_id || item.user?.id,
                };
                return mapGlofoxPayment(payload);
            } catch (e) {
                console.error("Failed to map glofox item", item, e);
                return null;
            }
        })
        .filter((r): r is NormalizedTransaction => r !== null);

    const { added, total } = await upsertTransactions(records);

    await prisma.syncLog.create({
        data: {
            source: "Glofox",
            detail: `Manual Sync: Fetched ${rawTransactions.length} items, Added ${added} new.`,
            records: String(added),
        }
    });

    return { added, totalFetched: rawTransactions.length };
}
