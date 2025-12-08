#!/bin/bash
set -e

# Run data fix SQL
psql $DATABASE_URL << 'EOF'
UPDATE "Transaction" 
SET "confidence" = 'Needs Review' 
WHERE "confidence" IS NULL;

UPDATE "Transaction" 
SET "status" = 'Needs Review' 
WHERE "status" IS NULL;
EOF

echo "Data fix completed successfully"
