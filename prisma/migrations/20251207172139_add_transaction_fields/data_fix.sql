-- Fix null confidence and status values in Transaction table
UPDATE "Transaction" 
SET "confidence" = 'Needs Review' 
WHERE "confidence" IS NULL;

UPDATE "Transaction" 
SET "status" = 'Needs Review' 
WHERE "status" IS NULL;
