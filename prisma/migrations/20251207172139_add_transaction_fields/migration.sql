-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "transactionUid" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "raw" JSONB;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "feeAmount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "netAmount" DOUBLE PRECISION;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "membershipPlan" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "glofoxSaleId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "starlingFeedItemId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "memberUid" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "externalAliases" JSONB;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "sourceFile" TEXT;

-- Update existing rows to have source = provider where source is null
UPDATE "Transaction" SET "source" = "provider" WHERE "source" IS NULL;

-- AlterTable - Make source NOT NULL after populating it
ALTER TABLE "Transaction" ALTER COLUMN "source" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_transactionUid_key" ON "Transaction"("transactionUid");
CREATE INDEX IF NOT EXISTS "Transaction_contactId_idx" ON "Transaction"("contactId");
CREATE INDEX IF NOT EXISTS "Transaction_reference_idx" ON "Transaction"("reference");
CREATE INDEX IF NOT EXISTS "Transaction_occurredAt_idx" ON "Transaction"("occurredAt");

-- Drop old unique constraint on externalId
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_externalId_key";

-- Create new unique constraint on externalId + source
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_externalId_source_key" ON "Transaction"("externalId", "source");

-- AddForeignKey (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Transaction_contactId_fkey'
    ) THEN
        ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_contactId_fkey" 
        FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Fix null confidence and status values in existing Transaction records
UPDATE "Transaction" 
SET "confidence" = 'Needs Review' 
WHERE "confidence" IS NULL;

UPDATE "Transaction" 
SET "status" = 'Needs Review' 
WHERE "status" IS NULL;
