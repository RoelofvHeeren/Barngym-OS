#!/bin/bash
# Export Starling transactions as CSV
# Usage: ./scripts/export_starling_csv.sh [BASE_URL] [FROM_DATE] [TO_DATE]

set -e

# Default values
BASE_URL="${1:-http://localhost:3000}"
FROM_DATE="${2:-2020-01-01}"
TO_DATE="${3:-$(date +%Y-%m-%d)}"
OUTPUT_FILE="starling_transactions_${FROM_DATE}_to_${TO_DATE}_$(date +%Y%m%d_%H%M%S).csv"

echo "================================================"
echo "Starling Transaction CSV Exporter"
echo "================================================"
echo "Base URL:   $BASE_URL"
echo "From Date:  $FROM_DATE"
echo "To Date:    $TO_DATE"
echo "Output:     $OUTPUT_FILE"
echo "================================================"
echo ""

# Build URL with query parameters
URL="${BASE_URL}/api/starling/export?from=${FROM_DATE}&to=${TO_DATE}"

echo "Fetching transactions from Starling API..."
echo "URL: $URL"
echo ""

# Fetch the CSV
HTTP_CODE=$(curl -w "%{http_code}" -s -o "$OUTPUT_FILE" "$URL")

if [ "$HTTP_CODE" = "200" ]; then
    # Check if file actually contains CSV data (not HTML error)
    if head -1 "$OUTPUT_FILE" | grep -q "feedItemUid"; then
        TRANSACTION_COUNT=$(($(wc -l < "$OUTPUT_FILE") - 1))
        FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
        
        echo "✓ SUCCESS!"
        echo ""
        echo "File saved:        $OUTPUT_FILE"
        echo "File size:         $FILE_SIZE"
        echo "Total transactions: $TRANSACTION_COUNT"
        echo ""
        echo "To view the CSV:"
        echo "  cat $OUTPUT_FILE | head -5"
        echo ""
    else
        echo "✗ ERROR: Response was not a valid CSV"
        echo ""
        echo "Response content:"
        head -20 "$OUTPUT_FILE"
        rm "$OUTPUT_FILE"
        exit 1
    fi
else
    echo "✗ ERROR: HTTP $HTTP_CODE"
    echo ""
    echo "Response:"
    cat "$OUTPUT_FILE"
    rm "$OUTPUT_FILE"
    exit 1
fi
