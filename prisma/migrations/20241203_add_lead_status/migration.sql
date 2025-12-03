-- Add LeadStatus enum and status column to Lead
CREATE TYPE "LeadStatus" AS ENUM ('LEAD', 'CLIENT');

ALTER TABLE "Lead"
ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'LEAD';
