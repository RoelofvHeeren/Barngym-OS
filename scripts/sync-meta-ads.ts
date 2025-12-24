
import { config } from 'dotenv';
config({ path: '.env.local' });
import { prisma } from '@/lib/prisma';
import { fetchMetaCampaigns, fetchMetaInsights, getMetaConnection } from '@/lib/meta';

async function sync() {
    console.log("Starting Meta Ads Sync...");

    try {
        const { adAccountId } = await getMetaConnection();

        // 1. Sync Campaigns
        console.log("Fetching Campaigns...");
        const campaigns = await fetchMetaCampaigns();
        console.log(`Found ${campaigns.length} campaigns.`);

        await prisma.metaAdAccount.upsert({
            where: { id: adAccountId },
            update: { name: "Barn Gym Ad Account" },
            create: { id: adAccountId, name: "Barn Gym Ad Account" }
        });

        for (const cmp of campaigns) {
            await prisma.metaCampaign.upsert({
                where: { id: cmp.id },
                update: {
                    name: cmp.name,
                    status: cmp.status,
                    objective: cmp.objective,
                    accountId: adAccountId
                },
                create: {
                    id: cmp.id,
                    name: cmp.name,
                    status: cmp.status,
                    objective: cmp.objective,
                    accountId: adAccountId
                }
            });
        }

        // 2. Sync Insights (Daily Spend) in Chunks
        console.log("Fetching Daily Insights (Chunked)...");

        // Start from Sept 25 2024 as per "Meta Source of Truth" requirement
        let cursor = new Date("2024-09-25");
        const now = new Date();

        let validCount = 0;

        while (cursor < now) {
            const next = new Date(cursor);
            next.setDate(next.getDate() + 30); // 30 day chunks

            const since = cursor.toISOString().split('T')[0];
            const until = (next > now ? now : next).toISOString().split('T')[0];

            console.log(`Fetching range: ${since} to ${until}...`);

            try {
                const chunk = await fetchMetaInsights(since, until);
                console.log(`  Got ${chunk.length} records.`);

                for (const row of chunk) {
                    if (row.adset_id) {
                        await prisma.metaAdSet.upsert({
                            where: { id: row.adset_id },
                            update: { name: row.adset_name, accountId: adAccountId, campaignId: row.campaign_id },
                            create: { id: row.adset_id, name: row.adset_name || "Unknown Adset", accountId: adAccountId, campaignId: row.campaign_id }
                        });
                    }

                    if (row.ad_id) {
                        await prisma.metaAd.upsert({
                            where: { id: row.ad_id },
                            update: { name: row.ad_name, accountId: adAccountId, campaignId: row.campaign_id, adsetId: row.adset_id },
                            create: { id: row.ad_id, name: row.ad_name || "Unknown Ad", accountId: adAccountId, campaignId: row.campaign_id, adsetId: row.adset_id }
                        });
                    }

                    const date = new Date(row.date_start);

                    await prisma.metaDailyInsight.upsert({
                        where: {
                            accountId_campaignId_adsetId_adId_date: {
                                accountId: adAccountId,
                                campaignId: row.campaign_id,
                                adsetId: row.adset_id,
                                adId: row.ad_id,
                                date: date
                            }
                        },
                        update: {
                            spend: parseFloat(row.spend || "0"),
                            impressions: parseInt(row.impressions || "0"),
                            clicks: parseInt(row.clicks || "0"),
                        },
                        create: {
                            accountId: adAccountId,
                            campaignId: row.campaign_id,
                            adsetId: row.adset_id,
                            adId: row.ad_id,
                            date: date,
                            spend: parseFloat(row.spend || "0"),
                            impressions: parseInt(row.impressions || "0"),
                            clicks: parseInt(row.clicks || "0"),
                        }
                    });
                    validCount++;
                }
            } catch (e) {
                console.error(`Error fetching chunk ${since}-${until}:`, e);
                // Continue to next chunk
            }

            cursor = next; // Move cursor
        }

        console.log(`Successfully synced ${validCount} daily records.`);

    } catch (error) {
        console.error("Sync Failed:", error);
    }
}

sync()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
