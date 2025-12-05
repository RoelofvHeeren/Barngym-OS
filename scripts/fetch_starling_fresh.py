#!/usr/bin/env python3
"""
Fetch ALL Starling transactions directly from Starling API via Railway production endpoint
This will get fresh data with ALL fields from the Starling Bank API
Usage: python3 scripts/fetch_starling_fresh.py
"""

import sys
import json
import csv
from datetime import datetime, timedelta
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

def main():
    base_url = "https://barngym-os.up.railway.app"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_fresh_all_transactions_{timestamp}.csv"
    
    print("=" * 70)
    print("Starling FRESH API Transaction Exporter")
    print("=" * 70)
    print(f"Production URL: {base_url}")
    print(f"Output File:    {output_file}")
    print("=" * 70)
    print()
    
    # Calculate date range - get last 5 years of data
    to_date = datetime.now()
    from_date = datetime.now() - timedelta(days=365*5)  # 5 years back
    
    from_str = from_date.strftime("%Y-%m-%d")
    to_str = to_date.strftime("%Y-%m-%d")
    
    print(f"Date Range: {from_str} to {to_str}")
    print()
    
    # Try to fetch from Starling API export endpoint
    url = f"{base_url}/api/starling/export?from={from_str}&to={to_str}"
    
    print("Fetching fresh data from Starling Bank API...")
    print(f"URL: {url}")
    print()
    
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=60) as response:
            content_type = response.headers.get('Content-Type', '')
            
            if 'text/csv' in content_type or 'text/plain' in content_type:
                # Successfully got CSV
                csv_content = response.read().decode('utf-8')
                
                # Save to file
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(csv_content)
                
                # Count rows
                row_count = len(csv_content.strip().split('\n')) - 1  # Exclude header
                
                # Get file size
                import os
                file_size = os.path.getsize(output_file)
                file_size_kb = file_size / 1024
                
                print()
                print("✓ SUCCESS!")
                print()
                print(f"File saved:         {output_file}")
                print(f"File size:          {file_size_kb:.2f} KB ({file_size:,} bytes)")
                print(f"Total transactions: {row_count}")
                print()
                
                # Show preview
                print("Preview (first 3 rows):")
                with open(output_file, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f):
                        if i < 3:
                            print(f"  {line.rstrip()[:150]}...")
                        else:
                            break
                
                print()
                print(f"✓ CSV file is ready to download!")
                print()
                
                return 0
                
            elif 'application/json' in content_type:
                # Got JSON error response
                error_data = json.loads(response.read().decode('utf-8'))
                print(f"✗ API ERROR: {error_data.get('message', 'Unknown error')}")
                print()
                print("This might mean:")
                print("  1. Starling connection needs to be refreshed in the admin panel")
                print("  2. Access token has expired")
                print("  3. Account configuration has changed")
                print()
                return 1
            else:
                print(f"✗ Unexpected content type: {content_type}")
                return 1
                
    except HTTPError as e:
        print(f"✗ HTTP ERROR: {e.code}")
        try:
            error_body = e.read().decode('utf-8')
            if error_body.startswith('{'):
                error_data = json.loads(error_body)
                print(f"Error message: {error_data.get('message', error_body)}")
            else:
                print(f"Response: {error_body[:500]}")
        except:
            print(f"Could not parse error response")
        print()
        print("=" * 70)
        print("FALLBACK: Let me try fetching from the database instead...")
        print("=" * 70)
        return fetch_from_database(base_url, timestamp)
        
    except URLError as e:
        print(f"✗ URL ERROR: {e.reason}")
        return 1
    except Exception as e:
        print(f"✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

def fetch_from_database(base_url, timestamp):
    """Fallback: Fetch from database and get full raw data"""
    output_file = f"starling_from_db_full_{timestamp}.csv"
    
    print()
    print("Fetching from database with full raw data...")
    
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    print(f"URL: {url}")
    print()
    
    try:
        with urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode())
        
        transactions = data.get("data", [])
        
        # Filter only actual Starling transactions
        starling_txs = [tx for tx in transactions if tx.get("provider") == "Starling"]
        total = len(starling_txs)
        
        if total == 0:
            print("✗ No Starling transactions found")
            return 1
        
        print(f"Found {total} Starling transactions")
        print()
        print("Creating comprehensive CSV with all raw fields...")
        
        # Get all possible fields from raw data
        all_raw_fields = set()
        for tx in starling_txs:
            if tx.get("raw"):
                all_raw_fields.update(tx["raw"].keys())
        
        # Define comprehensive CSV fields
        base_fields = [
            "id", "provider", "externalId", "amountMinor", "amountGBP",
            "currency", "occurredAt", "personName", "productType",
            "status", "confidence", "description", "reference",
            "createdAt", "updatedAt", "leadId"
        ]
        
        # Add all raw fields with prefix
        raw_fields = sorted([f"raw_{field}" for field in all_raw_fields])
        
        all_fields = base_fields + raw_fields
        
        # Write CSV
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=all_fields)
            writer.writeheader()
            
            for tx in starling_txs:
                raw = tx.get("raw") or {}
                
                row = {
                    "id": tx.get("id", ""),
                    "provider": tx.get("provider", ""),
                    "externalId": tx.get("externalId", ""),
                    "amountMinor": tx.get("amountMinor", 0),
                    "amountGBP": round(tx.get("amountMinor", 0) / 100, 2),
                    "currency": tx.get("currency", ""),
                    "occurredAt": tx.get("occurredAt", ""),
                    "personName": tx.get("personName", ""),
                    "productType": tx.get("productType", ""),
                    "status": tx.get("status", ""),
                    "confidence": tx.get("confidence", ""),
                    "description": tx.get("description", ""),
                    "reference": tx.get("reference", ""),
                    "createdAt": tx.get("createdAt", ""),
                    "updatedAt": tx.get("updatedAt", ""),
                    "leadId": tx.get("leadId", ""),
                }
                
                # Add all raw fields
                for field in all_raw_fields:
                    key = f"raw_{field}"
                    value = raw.get(field, "")
                    # Convert nested objects to JSON strings
                    if isinstance(value, (dict, list)):
                        value = json.dumps(value)
                    row[key] = value
                
                writer.writerow(row)
        
        # Get file size
        import os
        file_size = os.path.getsize(output_file)
        file_size_kb = file_size / 1024
        
        print()
        print("✓ SUCCESS!")
        print()
        print(f"File saved:         {output_file}")
        print(f"File size:          {file_size_kb:.2f} KB ({file_size:,} bytes)")
        print(f"Total transactions: {total}")
        print(f"Total columns:      {len(all_fields)}")
        print()
        
        # Show preview
        print("Preview (first 3 rows, truncated):")
        with open(output_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i < 3:
                    print(f"  {line.rstrip()[:150]}...")
                else:
                    break
        
        print()
        print(f"✓ Comprehensive CSV file is ready!")
        print()
        
        return 0
        
    except Exception as e:
        print(f"✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
