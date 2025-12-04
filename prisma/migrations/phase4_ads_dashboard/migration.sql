-- Phase 4: Ads dashboard spend tracking

CREATE TABLE IF NOT EXISTS "AdsSpend" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdsSpend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdsSpend_periodStart_periodEnd_idx" ON "AdsSpend"("periodStart", "periodEnd");
