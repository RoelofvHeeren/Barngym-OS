import { prisma } from "@/lib/prisma";

type RawMetaRow = {
  account_id: string;
  account_name?: string;
  date_start: string;
  date_stop?: string;
  spend: string;
  impressions?: string;
  clicks?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  objective?: string;
  actions?: { action_type: string; value: string }[];
};

// IMPORTANT: Never use Meta API "actions" to create or count leads.
// GHL webhook is the only source of truth for leads & conversions.
// Meta actions are stored ONLY for optional reporting but ignored for attribution.

export async function ingestInsights(rows: RawMetaRow[]) {
  if (!rows.length) return;

  const accountId = rows[0].account_id;

  const account = await prisma.metaAdAccount.upsert({
    where: { id: accountId },
    update: {
      name: rows[0].account_name ?? undefined,
    },
    create: {
      id: accountId,
      name: rows[0].account_name ?? null,
    },
  });

  for (const row of rows) {
    const date = new Date(row.date_start);

    let campaignId: string | undefined;
    if (row.campaign_id) {
      const campaign = await prisma.metaCampaign.upsert({
        where: { id: row.campaign_id },
        update: {
          name: row.campaign_name ?? undefined,
          accountId: account.id,
          objective: row.objective ?? undefined,
        },
        create: {
          id: row.campaign_id,
          accountId: account.id,
          name: row.campaign_name ?? null,
          objective: row.objective ?? null,
        },
      });
      campaignId = campaign.id;
    }

    let adsetId: string | undefined;
    if (row.adset_id) {
      const adset = await prisma.metaAdSet.upsert({
        where: { id: row.adset_id },
        update: {
          name: row.adset_name ?? undefined,
          accountId: account.id,
          campaignId: campaignId,
        },
        create: {
          id: row.adset_id,
          accountId: account.id,
          campaignId: campaignId,
          name: row.adset_name ?? null,
        },
      });
      adsetId = adset.id;
    }

    let adId: string | undefined;
    if (row.ad_id) {
      const ad = await prisma.metaAd.upsert({
        where: { id: row.ad_id },
        update: {
          name: row.ad_name ?? undefined,
          accountId: account.id,
          campaignId: campaignId,
          adsetId: adsetId,
        },
        create: {
          id: row.ad_id,
          accountId: account.id,
          campaignId: campaignId,
          adsetId: adsetId,
          name: row.ad_name ?? null,
        },
      });
      adId = ad.id;
    }

    const spend = parseFloat(row.spend || "0");
    const impressions = row.impressions ? parseInt(row.impressions, 10) : 0;
    const clicks = row.clicks ? parseInt(row.clicks, 10) : 0;
    const cpm = impressions > 0 ? (spend * 1000) / impressions : null;
    const cpc = clicks > 0 ? spend / clicks : null;

    let results = 0;
    let resultType: string | null = null;
    if (Array.isArray(row.actions) && row.actions.length) {
      const primary = row.actions.find((a) => a.action_type === "lead") ?? row.actions[0];
      if (primary) {
        results = parseInt(primary.value || "0", 10);
        resultType = primary.action_type;
      }
    }

    await prisma.metaDailyInsight.upsert({
      where: {
        accountId_campaignId_adsetId_adId_date: {
          accountId: account.id,
          campaignId: campaignId ?? "",
          adsetId: adsetId ?? "",
          adId: adId ?? "",
          date,
        },
      },
      update: {
        spend,
        impressions,
        clicks,
        cpm,
        cpc,
        results,
        resultType: resultType ?? undefined,
      },
      create: {
        accountId: account.id,
        campaignId: campaignId ?? "",
        adsetId: adsetId ?? "",
        adId: adId ?? "",
        date,
        spend,
        impressions,
        clicks,
        cpm,
        cpc,
        results,
        resultType,
      },
    });
  }
}
