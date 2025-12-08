-- Add LeadStatus enum and status column to Lead
DO $$ BEGIN
    CREATE TYPE "LeadStatus" AS ENUM ('LEAD', 'CLIENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "status" "LeadStatus" DEFAULT 'LEAD';

-- Set NOT NULL only if column was just added
DO $$ BEGIN
    ALTER TABLE "Lead" ALTER COLUMN "status" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;
