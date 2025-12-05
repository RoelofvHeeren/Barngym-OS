#!/bin/bash

echo "🗑️  Cleaning up ALL transaction CSV files..."
echo ""

# Count files first
PUBLIC_CSVS=$(find public -name "*.csv" 2>/dev/null | wc -l)
ROOT_CSVS=$(find . -maxdepth 1 -name "*.csv" 2>/dev/null | wc -l)
TOTAL=$((PUBLIC_CSVS + ROOT_CSVS))

echo "Found:"
echo "  - $PUBLIC_CSVS CSV files in public/"
echo "  - $ROOT_CSVS CSV files in root directory"
echo "  - $TOTAL total CSV files"
echo ""

# List files to be deleted
echo "Files to be deleted:"
echo "===================="
find public -name "*.csv" 2>/dev/null | sed 's/^/  /'
find . -maxdepth 1 -name "*.csv" 2>/dev/null | sed 's/^/  /'
echo ""

# Delete from public directory
if [ $PUBLIC_CSVS -gt 0 ]; then
    echo "Deleting from public/..."
    rm -v public/*.csv
fi

# Delete from root directory
if [ $ROOT_CSVS -gt 0 ]; then
    echo "Deleting from root directory..."
    rm -v ./*.csv
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Remaining CSV files:"
REMAINING=$(find . -name "*.csv" -not -path "./node_modules/*" 2>/dev/null | wc -l)
echo "  $REMAINING CSV files remaining"

if [ $REMAINING -gt 0 ]; then
    echo ""
    echo "Remaining files:"
    find . -name "*.csv" -not -path "./node_modules/*" 2>/dev/null | sed 's/^/  /'
fi
