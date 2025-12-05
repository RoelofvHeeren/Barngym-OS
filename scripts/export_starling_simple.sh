#!/bin/bash
# Export ALL Starling transactions from database via API - Simple version
# Usage: ./scripts/export_starling_simple.sh [BASE_URL]

set -e

BASE_URL="${1:-https://barngym-os.up.railway.app}"
OUTPUT_FILE="starling_all_transactions_$(date +%Y%m%d_%H%M%S).csv"

echo "================================================"
echo "Starling Database Transaction Exporter"
echo "================================================"
echo "Base URL:   $BASE_URL"
echo "Output:     $OUTPUT_FILE"
echo "================================================"
echo ""

echo "Fetching all Starling transactions from database..."

# Fetch all transactions with Starling provider
URL="${BASE_URL}/api/transactions?provider=Starling&limit=10000"

echo "URL: $URL"
echo ""

# Fetch transactions as JSON
RESPONSE=$(curl -s "$URL")

# Check if response is valid JSON
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    # Extract transaction count
    TOTAL=$(echo "$RESPONSE" | jq '.data | length')
    
    if [ "$TOTAL" -eq 0 ]; then
        echo "✗ No Starling transactions found"
        exit 1
    fi
    
    echo "Found $TOTAL Starling transactions"
    echo ""
    echo "Converting to CSV..."
    
    # Create CSV header
    echo "id,provider,externalId,feedItemUid,amountMinor,amountGBP,currency,occurredAt,personName,counterPartyName,productType,status,confidence,description,reference,direction,spendingCategory,source,settlementTime,transactionTime,createdAt,updatedAt,leadId" > "$OUTPUT_FILE"
    
    # Extract and format each transaction - handle all values as strings to avoid type errors
    echo "$RESPONSE" | jq -r '.data[] | 
        [
            (.id // ""),
            (.provider // ""),
            (.externalId // ""),
            (if .raw and .raw.feedItemUid then .raw.feedItemUid else "" end),
            (.amountMinor // 0 | tostring),
            ((.amountMinor // 0) / 100 | tostring),
            (.currency // ""),
            (.occurredAt // ""),
            (.personName // ""),
            (if .raw and .raw.counterPartyName then .raw.counterPartyName else (.personName // "") end),
            (.productType // ""),
            (.status // ""),
            (.confidence // ""),
            (.description // ""),
            (.reference // ""),
            (if .raw and .raw.direction then .raw.direction else (if .metadata and .metadata.direction then .metadata.direction else "" end) end),
            (if .raw and .raw.spendingCategory then .raw.spendingCategory else (if .metadata and .metadata.spendingCategory then .metadata.spendingCategory else "" end) end),
            (if .raw and .raw.source then .raw.source else "" end),
            (if .raw and .raw.settlementTime then .raw.settlementTime else "" end),
            (if .raw and .raw.transactionTime then .raw.transactionTime else "" end),
            (.createdAt // ""),
            (.updatedAt // ""),
            (.leadId // "")
        ] | @csv' >> "$OUTPUT_FILE"
    
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    
    echo ""
    echo "✓ SUCCESS!"
    echo ""
    echo "File saved:         $OUTPUT_FILE"
    echo "File size:          $FILE_SIZE"
    echo "Total transactions: $TOTAL"
    echo ""
    echo "Preview (first 5 rows):"
    head -6 "$OUTPUT_FILE" | column -t -s, 2>/dev/null || head -6 "$OUTPUT_FILE"
    echo ""
    echo "To view the full CSV:"
    echo "  cat $OUTPUT_FILE | less"
    echo "  cat $OUTPUT_FILE | column -t -s, | less -S"
    echo ""
else
    echo "✗ ERROR: Invalid JSON response"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | head -50
    exit 1
fi
