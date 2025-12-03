-- Phase 2: Lead intake pipeline

-- Lead columns for GoHighLevel + tracking
ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "ghlContactId" TEXT,
ADD COLUMN IF NOT EXISTS "goal" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Unique index for GHL contact id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Lead_ghlContactId_key'
  ) THEN
    CREATE UNIQUE INDEX "Lead_ghlContactId_key" ON "Lead"("ghlContactId");
  END IF;
END $$;

-- LeadTracking table
CREATE TABLE IF NOT EXISTS "LeadTracking" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "formId" TEXT,
    "adId" TEXT,
    "campaignId" TEXT,
    "adsetId" TEXT,
    "platform" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadTracking_pkey" PRIMARY KEY ("id")
);

-- LeadEvent table
CREATE TABLE IF NOT EXISTS "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- Foreign keys and indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadTracking_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadTracking"
    ADD CONSTRAINT "LeadTracking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadEvent_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadEvent"
    ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LeadTracking_leadId_idx" ON "LeadTracking"("leadId");
CREATE INDEX IF NOT EXISTS "LeadEvent_leadId_idx" ON "LeadEvent"("leadId");
CREATE INDEX IF NOT EXISTS "LeadEvent_eventType_idx" ON "LeadEvent"("eventType");
