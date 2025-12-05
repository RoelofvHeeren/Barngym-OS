-- Meta Ads integration tables

CREATE TABLE IF NOT EXISTS "MetaAdAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaAdAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaCampaign" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT,
    "objective" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaAdSet" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT,
    "status" TEXT,
    "optimizationGoal" TEXT,
    "billingEvent" TEXT,
    "dailyBudget" INTEGER,
    "lifetimeBudget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaAdSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaAd" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "adsetId" TEXT,
    "name" TEXT,
    "status" TEXT,
    "creativeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaDailyInsight" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "adsetId" TEXT,
    "adId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cpm" DOUBLE PRECISION,
    "cpc" DOUBLE PRECISION,
    "results" INTEGER NOT NULL DEFAULT 0,
    "resultType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaDailyInsight_pkey" PRIMARY KEY ("id")
);

-- Relationships
ALTER TABLE "MetaCampaign"
ADD CONSTRAINT "MetaCampaign_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetaAdSet"
ADD CONSTRAINT "MetaAdSet_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetaAdSet"
ADD CONSTRAINT "MetaAdSet_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetaAd"
ADD CONSTRAINT "MetaAd_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetaAd"
ADD CONSTRAINT "MetaAd_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetaAd"
ADD CONSTRAINT "MetaAd_adsetId_fkey"
FOREIGN KEY ("adsetId") REFERENCES "MetaAdSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetaDailyInsight"
ADD CONSTRAINT "MetaDailyInsight_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetaDailyInsight"
ADD CONSTRAINT "MetaDailyInsight_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetaDailyInsight"
ADD CONSTRAINT "MetaDailyInsight_adsetId_fkey"
FOREIGN KEY ("adsetId") REFERENCES "MetaAdSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetaDailyInsight"
ADD CONSTRAINT "MetaDailyInsight_adId_fkey"
FOREIGN KEY ("adId") REFERENCES "MetaAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "MetaCampaign_accountId_idx" ON "MetaCampaign"("accountId");
CREATE INDEX IF NOT EXISTS "MetaAdSet_accountId_idx" ON "MetaAdSet"("accountId");
CREATE INDEX IF NOT EXISTS "MetaAdSet_campaignId_idx" ON "MetaAdSet"("campaignId");
CREATE INDEX IF NOT EXISTS "MetaAd_campaignId_idx" ON "MetaAd"("campaignId");
CREATE INDEX IF NOT EXISTS "MetaAd_adsetId_idx" ON "MetaAd"("adsetId");
CREATE INDEX IF NOT EXISTS "MetaDailyInsight_accountId_date_idx" ON "MetaDailyInsight"("accountId", "date");
CREATE INDEX IF NOT EXISTS "MetaDailyInsight_campaignId_date_idx" ON "MetaDailyInsight"("campaignId", "date");
CREATE INDEX IF NOT EXISTS "MetaDailyInsight_adsetId_date_idx" ON "MetaDailyInsight"("adsetId", "date");
CREATE INDEX IF NOT EXISTS "MetaDailyInsight_adId_date_idx" ON "MetaDailyInsight"("adId", "date");

-- Unique constraint to prevent duplicate daily rows per entity combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MetaDailyInsight_accountId_campaignId_adsetId_adId_date_key'
  ) THEN
    ALTER TABLE "MetaDailyInsight"
    ADD CONSTRAINT "MetaDailyInsight_accountId_campaignId_adsetId_adId_date_key"
    UNIQUE ("accountId", "campaignId", "adsetId", "adId", "date");
  END IF;
END $$;
