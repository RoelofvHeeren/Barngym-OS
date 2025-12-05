#!/usr/bin/env python3
"""
Export ALL Starling transactions from database via API to CSV
Usage: python3 scripts/export_starling.py [BASE_URL]
"""

import sys
import json
import csv
from datetime import datetime
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "https://barngym-os.up.railway.app"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_all_transactions_{timestamp}.csv"
    
    print("=" * 60)
    print("Starling Database Transaction Exporter")
    print("=" * 60)
    print(f"Base URL:   {base_url}")
    print(f"Output:     {output_file}")
    print("=" * 60)
    print()
    
    # Fetch transactions
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    print(f"Fetching all Starling transactions from database...")
    print(f"URL: {url}")
    print()
    
    try:
        with urlopen(url) as response:
            data = json.loads(response.read().decode())
        
        transactions = data.get("data", [])
        total = len(transactions)
        
        if total == 0:
            print("✗ No Starling transactions found")
            return 1
        
        print(f"Found {total} Starling transactions")
        print()
        print("Converting to CSV...")
        
        # Define CSV fields
        fields = [
            "id", "provider", "externalId", "feedItemUid", 
            "amountMinor", "amountGBP", "currency", "occurredAt",
            "personName", "counterPartyName", "productType", "status",
            "confidence", "description", "reference", "direction",
            "spendingCategory", "source", "settlementTime", "transactionTime",
            "createdAt", "updatedAt", "leadId"
        ]
        
        # Write CSV
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fields)
            writer.writeheader()
            
            for tx in transactions:
                raw = tx.get("raw") or {}
                metadata = tx.get("metadata") or {}
                
                row = {
                    "id": tx.get("id", ""),
                    "provider": tx.get("provider", ""),
                    "externalId": tx.get("externalId", ""),
                    "feedItemUid": raw.get("feedItemUid", ""),
                    "amountMinor": tx.get("amountMinor", 0),
                    "amountGBP": round(tx.get("amountMinor", 0) / 100, 2),
                    "currency": tx.get("currency", ""),
                    "occurredAt": tx.get("occurredAt", ""),
                    "personName": tx.get("personName", ""),
                    "counterPartyName": raw.get("counterPartyName") or tx.get("personName", ""),
                    "productType": tx.get("productType", ""),
                    "status": tx.get("status", ""),
                    "confidence": tx.get("confidence", ""),
                    "description": tx.get("description", ""),
                    "reference": tx.get("reference", ""),
                    "direction": raw.get("direction") or metadata.get("direction", ""),
                    "spendingCategory": raw.get("spendingCategory") or metadata.get("spendingCategory", ""),
                    "source": raw.get("source", ""),
                    "settlementTime": raw.get("settlementTime", ""),
                    "transactionTime": raw.get("transactionTime", ""),
                    "createdAt": tx.get("createdAt", ""),
                    "updatedAt": tx.get("updatedAt", ""),
                    "leadId": tx.get("leadId", ""),
                }
                writer.writerow(row)
        
        # Get file size
        import os
        file_size = os.path.getsize(output_file)
        file_size_mb = file_size / (1024 * 1024)
        
        print()
        print("✓ SUCCESS!")
        print()
        print(f"File saved:         {output_file}")
        print(f"File size:          {file_size_mb:.2f} MB ({file_size:,} bytes)")
        print(f"Total transactions: {total}")
        print()
        print("Preview (first 5 transactions):")
        
        # Show preview
        with open(output_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i < 6:  # Header + 5 rows
                    print(f"  {line.rstrip()[:120]}...")
                else:
                    break
        
        print()
        print("To view the full CSV:")
        print(f"  cat {output_file} | less")
        print(f"  cat {output_file} | column -t -s, | less -S")
        print()
        
        return 0
        
    except HTTPError as e:
        print(f"✗ HTTP ERROR: {e.code}")
        print(f"Response: {e.read().decode()}")
        return 1
    except URLError as e:
        print(f"✗ URL ERROR: {e.reason}")
        return 1
    except Exception as e:
        print(f"✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
