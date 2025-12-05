#!/bin/bash
# Export ALL Starling transactions from database via API
# Usage: ./scripts/export_starling_from_db.sh [BASE_URL]

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
# Using a large limit to get all transactions
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
    
    # Convert JSON to CSV using jq
    # Create CSV header
    echo "id,provider,externalId,feedItemUid,amountMinor,amountGBP,currency,occurredAt,personName,counterPartyName,productType,status,confidence,description,reference,direction,spendingCategory,source,createdAt,updatedAt,leadId" > "$OUTPUT_FILE"
    
    # Extract and format each transaction
    echo "$RESPONSE" | jq -r '.data[] | 
        {
            id: .id,
            provider: .provider,
            externalId: .externalId,
            feedItemUid: (if .raw then .raw.feedItemUid else "" end),
            amountMinor: .amountMinor,
            amountGBP: (.amountMinor / 100),
            currency: .currency,
            occurredAt: .occurredAt,
            personName: .personName,
            counterPartyName: (if .raw then (.raw.counterPartyName // .personName) else .personName end),
            productType: .productType,
            status: .status,
            confidence: .confidence,
            description: (.description // ""),
            reference: (.reference // ""),
            direction: (if .metadata then .metadata.direction else (if .raw then .raw.direction else "" end) end),
            spendingCategory: (if .metadata then .metadata.spendingCategory else (if .raw then .raw.spendingCategory else "" end) end),
            source: (if .raw then .raw.source else "" end),
            createdAt: .createdAt,
            updatedAt: .updatedAt,
            leadId: (.leadId // "")
        } | [
            .id,
            .provider,
            .externalId,
            .feedItemUid,
            .amountMinor,
            .amountGBP,
            .currency,
            .occurredAt,
            .personName,
            .counterPartyName,
            .productType,
            .status,
            .confidence,
            .description,
            .reference,
            .direction,
            .spendingCategory,
            .source,
            .createdAt,
            .updatedAt,
            .leadId
        ] | @csv' >> "$OUTPUT_FILE"
    
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    
    echo ""
    echo "✓ SUCCESS!"
    echo ""
    echo "File saved:         $OUTPUT_FILE"
    echo "File size:          $FILE_SIZE"
    echo "Total transactions: $TOTAL"
    echo ""
    echo "To view the CSV:"
    echo "  cat $OUTPUT_FILE | head -10"
    echo "  cat $OUTPUT_FILE | column -t -s, | less -S"
    echo ""
else
    echo "✗ ERROR: Invalid JSON response"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | head -50
    exit 1
fi
