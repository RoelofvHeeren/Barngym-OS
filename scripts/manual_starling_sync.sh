#!/bin/bash
# Manually trigger a Starling sync by calling the export with a fix
# This downloads transactions directly from your database that came via webhooks

echo "==========================================================================="
echo "Starling Transaction Export - Manual Sync"
echo "==========================================================================="
echo ""

OUTPUT_FILE="API transactions Starling.csv"

echo "Fetching all Starling transactions from database..."
echo "URL: https://barngym-os.up.railway.app/api/transactions?provider=Starling&limit=10000"
echo ""

curl -s "https://barngym-os.up.railway.app/api/transactions?provider=Starling&limit=10000" | python3 - << 'PYTHON_SCRIPT'
import sys, json, csv

try:
    data = json.load(sys.stdin)
    transactions = data.get('data', [])
    
    # Filter to only API transactions (from webhooks, not CSV imports)
    api_txs = [tx for tx in transactions 
               if tx.get('provider') == 'Starling' 
               and (tx.get('raw', {}).get('feedItemUid') or tx.get('raw', {}).get('source'))]
    
    if not api_txs:
        print("❌ No API transactions found!")
        print("   The webhook might not be receiving data.")
        sys.exit(1)
    
    # Sort by date (most recent first)
    api_txs.sort(key=lambda x: x.get('occurredAt', ''), reverse=True)
    
    # Get date range
    dates = [tx.get('occurredAt', '')[:10] for tx in api_txs if tx.get('occurredAt')]
    
    # Write CSV
    with open('API transactions Starling.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'direction', 'feedItemUid', 'transactionTime', 'settlementTime', 
            'occurredAt', 'amountGBP', 'amountMinor', 'currency', 'status', 
            'spendingCategory', 'source', 'counterPartyName', 'counterPartyType', 
            'counterPartyUid', 'reference', 'description', 'country', 
            'hasReceipt', 'hasAttachment', 'id', 'leadId', 'createdAt', 'updatedAt'
        ])
        
        for tx in api_txs:
            raw = tx.get('raw', {})
            metadata = tx.get('metadata', {})
            direction = raw.get('direction') or metadata.get('direction', '') or ('IN' if tx.get('amountMinor', 0) >= 0 else 'OUT')
            
            writer.writerow([
                direction,
                raw.get('feedItemUid', ''),
                raw.get('transactionTime', ''),
                raw.get('settlementTime', ''),
                tx.get('occurredAt', ''),
                round(tx.get('amountMinor', 0) / 100, 2),
                tx.get('amountMinor', 0),
                tx.get('currency', ''),
                raw.get('status', ''),
                raw.get('spendingCategory', '') or metadata.get('spendingCategory', ''),
                raw.get('source', ''),
                raw.get('counterPartyName', ''),
                raw.get('counterPartyType', ''),
                raw.get('counterPartyUid', ''),
                raw.get('reference', ''),
                tx.get('description', ''),
                raw.get('country', ''),
                raw.get('hasReceipt', ''),
                raw.get('hasAttachment', ''),
                tx.get('id', ''),
                tx.get('leadId', ''),
                tx.get('createdAt', ''),
                tx.get('updatedAt', '')
            ])
    
    print("")
    print("===========================================================================")
    print("✅ SUCCESS!")
    print("===========================================================================")
    print("")
    print(f"File created:       API transactions Starling.csv")
    print(f"Total transactions: {len(api_txs)}")
    if dates:
        print(f"Date range:         {min(dates)} to {max(dates)}")
    print("")
    print("Transaction breakdown:")
    
    # Count by direction
    direction_counts = {}
    for tx in api_txs:
        raw = tx.get('raw', {})
        direction = raw.get('direction') or 'IN'
        direction_counts[direction] = direction_counts.get(direction, 0) + 1
    
    for direction, count in sorted(direction_counts.items()):
        pct = count / len(api_txs) * 100
        print(f"  {direction}: {count} ({pct:.1f}%)")
    
    print("")
    print("Sample (5 most recent):")
    for i, tx in enumerate(api_txs[:5], 1):
        raw = tx.get('raw', {})
        occurred = tx.get('occurredAt', '')[:10]
        amount = tx.get('amountMinor', 0) / 100
        party = raw.get('counterPartyName') or tx.get('personName', '')
        direction = raw.get('direction') or 'IN'
        print(f"  {i}. [{direction}] {occurred} £{amount:>8.2f} - {party[:40]}")
    
    print("")
    print("===========================================================================")
    print("ℹ️  NOTE: These are transactions received via Starling webhook")
    print("ℹ️  The webhook is ACTIVE and syncing new transactions automatically")
    print("ℹ️  Date range shows when webhook started syncing (not all history)")
    print("===========================================================================")
    print("")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYTHON_SCRIPT
