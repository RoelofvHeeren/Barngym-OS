-- Phase 3: Payments, LTV, Ads attribution

-- Lead enhancements
ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "fullName" TEXT,
ADD COLUMN IF NOT EXISTS "isClient" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "ltvAllCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ltvAdsCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ltvPTCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ltvClassesCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ltvSixWeekCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ltvOnlineCoachingCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ltvCommunityCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ltvCorporateCents" INTEGER NOT NULL DEFAULT 0;

-- Payment table
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "externalPaymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "productName" TEXT,
    "productType" TEXT,
    "sourceSystem" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Payment_externalPaymentId_sourceSystem_idx" ON "Payment"("externalPaymentId", "sourceSystem");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_leadId_fkey'
  ) THEN
    ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Ads revenue table
CREATE TABLE IF NOT EXISTS "AdsRevenue" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdsRevenue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdsRevenue_leadId_idx" ON "AdsRevenue"("leadId");
CREATE INDEX IF NOT EXISTS "AdsRevenue_paymentId_idx" ON "AdsRevenue"("paymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdsRevenue_leadId_fkey'
  ) THEN
    ALTER TABLE "AdsRevenue"
    ADD CONSTRAINT "AdsRevenue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdsRevenue_paymentId_fkey'
  ) THEN
    ALTER TABLE "AdsRevenue"
    ADD CONSTRAINT "AdsRevenue_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Unmatched payment table
CREATE TABLE IF NOT EXISTS "UnmatchedPayment" (
    "id" TEXT NOT NULL,
    "externalPaymentId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "reason" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnmatchedPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UnmatchedPayment_externalPaymentId_sourceSystem_idx" ON "UnmatchedPayment"("externalPaymentId", "sourceSystem");
