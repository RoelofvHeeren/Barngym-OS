
import { prisma } from "@/lib/prisma";

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_URL = "https://graph.facebook.com";

export async function getMetaConnection() {
    const connection = await prisma.connectionSecret.findUnique({
        where: { provider: "meta" },
    });

    if (!connection || !connection.secret) {
        throw new Error("Meta Ads connection not found");
    }

    const secret = connection.secret as { accessToken: string; adAccountId: string };
    return secret;
}

export async function fetchMetaCampaigns() {
    const { accessToken, adAccountId } = await getMetaConnection();
    // Ensure account ID starts with "act_"
    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    const fields = "id,name,status,objective,start_time,stop_time";
    const url = `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${actId}/campaigns?fields=${fields}&limit=100&access_token=${accessToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    return data.data || [];
}

export async function fetchMetaInsights(since?: string, until?: string) {
    const { accessToken, adAccountId } = await getMetaConnection();
    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    // time_increment=1 for daily breakdown
    // level=ad to map to specific ads/adsets if needed, or campaign if simple
    // Dashboard uses granular data, so level=ad is safer, but campaign level is enough for "Spend" tile unless we need ad breakdown
    // DB schema has MetaDailyInsight linked to adId, adsetId, campaignId.
    // So we should fetch at level=ad to fill all RELATIONS, or level=campaign if we only care about campaign spend.
    // Schema `MetaDailyInsight` has `adId` optional.

    // Let's fetch level=campaign for simpler syncing unless we need ad-level ROAS
    // Actually, to attribute to specific creative, ad-level is better. 
    // Let's start with level=campaign for robustness, or 'ad' if possible.
    // Given we want "Barn Gym" campaign spend, campaign level is sufficient.

    const fields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,date_start,date_stop";

    let rangeParams = '&date_preset=maximum';
    if (since && until) {
        rangeParams = `&time_range={'since':'${since}','until':'${until}'}`;
    }

    // Use time_increment=1 to ensure we get daily data for the DB (which expects unique constraints on date)
    const url = `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${actId}/insights?level=ad&time_increment=1&fields=${fields}${rangeParams}&limit=500&access_token=${accessToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    return data.data || [];
}

export async function verifyMetaToken() {
    try {
        const { accessToken } = await getMetaConnection();
        const url = `${GRAPH_API_URL}/${GRAPH_API_VERSION}/me?access_token=${accessToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) return false;
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
