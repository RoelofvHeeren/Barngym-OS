-- Make lead status optional and only mark ads-sourced leads as LEAD
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" DROP NOT NULL;

-- Keep ads leads marked as LEAD
UPDATE "Lead" SET "status" = 'LEAD' WHERE "source" = 'ads';

-- Clear status for non-ads leads
UPDATE "Lead" SET "status" = NULL WHERE "source" IS NULL OR "source" <> 'ads';
