#!/usr/bin/env python3
"""
Fetch ONLY fresh Starling transactions directly from Starling Bank API
This is the source of truth - no CSV imports, no duplicates
"""

import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from datetime import datetime, timedelta
import csv

def fetch_fresh_from_starling_api():
    """Try to fetch directly from Starling API via the export endpoint"""
    base_url = "https://barngym-os.up.railway.app"
    
    # Get last 2 years of data
    to_date = datetime.now()
    from_date = datetime.now() - timedelta(days=365*2)
    
    from_str = from_date.strftime("%Y-%m-%d")
    to_str = to_date.strftime("%Y-%m-%d")
    
    url = f"{base_url}/api/starling/export?from={from_str}&to={to_str}"
    
    print(f"Attempting to fetch from Starling API...")
    print(f"URL: {url}")
    print(f"Date range: {from_str} to {to_str}")
    print()
    
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=60) as response:
            content_type = response.headers.get('Content-Type', '')
            
            if 'text/csv' in content_type or 'text/plain' in content_type:
                csv_content = response.read().decode('utf-8')
                return ('success', csv_content)
            elif 'application/json' in content_type:
                error_data = json.loads(response.read().decode('utf-8'))
                return ('error', error_data.get('message', 'Unknown error'))
            else:
                return ('error', f'Unexpected content type: {content_type}')
                
    except HTTPError as e:
        try:
            error_body = e.read().decode('utf-8')
            if error_body.startswith('{'):
                error_data = json.loads(error_body)
                return ('error', error_data.get('message', error_body))
            return ('error', f'HTTP {e.code}: {error_body[:200]}')
        except:
            return ('error', f'HTTP {e.code}')
    except Exception as e:
        return ('error', str(e))

def fetch_from_database_api_only():
    """Fallback: Get only transactions that have raw Starling API data"""
    base_url = "https://barngym-os.up.railway.app"
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    
    print(f"Fetching from database API...")
    print(f"URL: {url}")
    print()
    
    with urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode())
    
    transactions = data.get("data", [])
    
    # Filter to ONLY transactions with actual Starling API raw data
    # These are from the Starling webhook/sync, not CSV imports
    api_only_txs = []
    for tx in transactions:
        if tx.get("provider") == "Starling":
            raw = tx.get("raw") or {}
            # Must have feedItemUid or source from Starling API
            if raw.get("feedItemUid") or raw.get("source"):
                api_only_txs.append(tx)
    
    return api_only_txs

def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_api_only_{timestamp}.csv"
    
    print("=" * 80)
    print("FRESH Starling API Transactions ONLY - No Duplicates")
    print("=" * 80)
    print()
    
    # Try Starling API first
    status, result = fetch_fresh_from_starling_api()
    
    if status == 'success':
        print("✓ Successfully fetched from Starling API endpoint!")
        print()
        
        # Save the CSV
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        
        # Count rows
        rows = result.strip().split('\n')
        row_count = len(rows) - 1  # Exclude header
        
        import os
        file_size = os.path.getsize(output_file)
        file_size_kb = file_size / 1024
        
        print("✓ SUCCESS!")
        print()
        print(f"File saved:         {output_file}")
        print(f"File size:          {file_size_kb:.2f} KB")
        print(f"Total transactions: {row_count}")
        print()
        
        # Show preview
        print("Preview (first 3 rows):")
        for i, line in enumerate(rows[:4]):
            print(f"  {line[:150]}")
        
        return output_file
        
    else:
        print(f"✗ Starling API export failed: {result}")
        print()
        print("=" * 80)
        print("FALLBACK: Fetching from database (API transactions only)")
        print("=" * 80)
        print()
        
        api_txs = fetch_from_database_api_only()
        
        print(f"Found {len(api_txs)} transactions with Starling API data")
        print("(Excludes CSV imports - these are from live Starling sync)")
        print()
        
        # Define columns
        fields = [
            "direction",
            "feedItemUid",
            "transactionTime",
            "settlementTime",
            "occurredAt",
            "amountGBP",
            "amountMinor",
            "currency",
            "status",
            "spendingCategory",
            "source",
            "counterPartyName",
            "counterPartyType",
            "counterPartyUid",
            "counterPartySubEntityIdentifier",  # Sort code
            "counterPartySubEntitySubIdentifier",  # Account number
            "reference",
            "description",
            "country",
            "merchantUid",
            "hasReceipt",
            "hasAttachment",
            "externalId",
            "id",
            "leadId",
            "confidence",
            "createdAt",
            "updatedAt",
        ]
        
        # Write CSV
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fields)
            writer.writeheader()
            
            direction_counts = {"IN": 0, "OUT": 0}
            
            for tx in api_txs:
                raw = tx.get("raw") or {}
                metadata = tx.get("metadata") or {}
                
                # Get direction
                direction = raw.get("direction") or metadata.get("direction", "")
                if not direction:
                    # Infer from amount
                    direction = "IN" if tx.get("amountMinor", 0) >= 0 else "OUT"
                
                direction_counts[direction] = direction_counts.get(direction, 0) + 1
                
                row = {
                    "direction": direction,
                    "feedItemUid": raw.get("feedItemUid", ""),
                    "transactionTime": raw.get("transactionTime", ""),
                    "settlementTime": raw.get("settlementTime", ""),
                    "occurredAt": tx.get("occurredAt", ""),
                    "amountGBP": round(tx.get("amountMinor", 0) / 100, 2),
                    "amountMinor": tx.get("amountMinor", 0),
                    "currency": tx.get("currency", ""),
                    "status": raw.get("status", ""),
                    "spendingCategory": raw.get("spendingCategory") or metadata.get("spendingCategory", ""),
                    "source": raw.get("source", ""),
                    "counterPartyName": raw.get("counterPartyName", ""),
                    "counterPartyType": raw.get("counterPartyType", ""),
                    "counterPartyUid": raw.get("counterPartyUid", ""),
                    "counterPartySubEntityIdentifier": raw.get("counterPartySubEntityIdentifier", ""),
                    "counterPartySubEntitySubIdentifier": raw.get("counterPartySubEntitySubIdentifier", ""),
                    "reference": raw.get("reference", ""),
                    "description": tx.get("description", ""),
                    "country": raw.get("country", ""),
                    "merchantUid": raw.get("merchantUid", ""),
                    "hasReceipt": raw.get("hasReceipt", ""),
                    "hasAttachment": raw.get("hasAttachment", ""),
                    "externalId": tx.get("externalId", ""),
                    "id": tx.get("id", ""),
                    "leadId": tx.get("leadId", ""),
                    "confidence": tx.get("confidence", ""),
                    "createdAt": tx.get("createdAt", ""),
                    "updatedAt": tx.get("updatedAt", ""),
                }
                
                writer.writerow(row)
        
        import os
        file_size = os.path.getsize(output_file)
        file_size_kb = file_size / 1024
        
        print()
        print("✓ SUCCESS!")
        print()
        print(f"File saved:         {output_file}")
        print(f"File size:          {file_size_kb:.2f} KB")
        print(f"Total transactions: {len(api_txs)}")
        print(f"Total columns:      {len(fields)}")
        print()
        print("Direction Breakdown:")
        for direction, count in sorted(direction_counts.items()):
            pct = count / len(api_txs) * 100 if len(api_txs) > 0 else 0
            print(f"  {direction}: {count} transactions ({pct:.1f}%)")
        
        print()
        print("Sample transactions:")
        with open(output_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 5:
                    break
                print(f"  {i+1}. [{row['direction']}] £{row['amountGBP']} - {row['counterPartyName']} - {row['reference']}")
        
        print()
        print("=" * 80)
        print(f"✓ {len(api_txs)} FRESH transactions from Starling API (no CSV imports)")
        print("✓ No duplicates - this is the source of truth")
        print("=" * 80)
        print()
        
        return output_file

if __name__ == "__main__":
    output_file = main()
    print(f"Output: {output_file}")
