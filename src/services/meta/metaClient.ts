import { prisma } from "@/lib/prisma";

type MetaCredentials = {
  accessToken: string;
  adAccountId: string;
  apiVersion: string;
};

const DEFAULT_VERSION = "v19.0";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getMetaCredentials(): Promise<MetaCredentials> {
  const secret = await prisma.connectionSecret.findUnique({ where: { provider: "meta" } });
  const payload = (secret?.secret as { accessToken?: string; adAccountId?: string; apiVersion?: string } | null) ?? {};
  const accessToken = payload.accessToken?.trim();
  const adAccountIdRaw = payload.adAccountId?.trim();
  const apiVersion = payload.apiVersion?.trim() || DEFAULT_VERSION;

  if (!accessToken || !adAccountIdRaw) {
    throw new Error("Meta credentials are not configured. Add access token and ad account ID.");
  }

  const adAccountId = adAccountIdRaw.replace(/^act_/, "");

  return { accessToken, adAccountId, apiVersion };
}

export async function fetchInsightsRange(from: Date, to: Date): Promise<any[]> {
  const { accessToken, adAccountId, apiVersion } = await getMetaCredentials();

  const timeRange = {
    since: formatDate(from),
    until: formatDate(to),
  };

  const params = new URLSearchParams({
    time_range: JSON.stringify(timeRange),
    time_increment: "1",
    level: "adset",
    fields: [
      "date_start",
      "date_stop",
      "spend",
      "impressions",
      "clicks",
      "campaign_id",
      "campaign_name",
      "adset_id",
      "adset_name",
      "ad_id",
      "ad_name",
      "objective",
      "actions",
    ].join(","),
    access_token: accessToken,
  });

  const url = `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/insights?${params.toString()}`;

  const allRows: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Meta insights error: ${res.status} ${text}`);
    }
    const json = await res.json();
    if (json.data && Array.isArray(json.data)) {
      allRows.push(...json.data);
    }
    nextUrl = json.paging?.next ?? null;
  }

  return allRows;
}

export async function fetchRecentInsights(days: number): Promise<any[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return fetchInsightsRange(from, to);
}
