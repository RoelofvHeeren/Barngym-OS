#!/usr/bin/env python3
"""
Create COMPLETE Starling CSV including:
- Fresh Starling API transactions (146)
- Imported CSV transactions (372)
ALL with proper direction assigned
"""

import json
from urllib.request import urlopen
from datetime import datetime
import csv

def main():
    base_url = "https://barngym-os.up.railway.app"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_complete_with_direction_{timestamp}.csv"
    
    print("=" * 80)
    print("COMPLETE Starling Transaction Export with DIRECTION")
    print("=" * 80)
    print()
    
    # Fetch all transactions
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    print(f"Fetching all Starling transactions...")
    
    with urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode())
    
    transactions = data.get("data", [])
    
    # Filter to actual Starling transactions
    starling_txs = [tx for tx in transactions if tx.get("provider") == "Starling"]
    
    print(f"Found {len(starling_txs)} total Starling transactions")
    print()
    
    # Categorize transactions
    api_txs = []
    imported_txs = []
    
    for tx in starling_txs:
        raw = tx.get("raw") or {}
        if raw.get("feedItemUid") or raw.get("source"):
            api_txs.append(tx)
        else:
            imported_txs.append(tx)
    
    print(f"Breakdown:")
    print(f"  - From Starling API:  {len(api_txs)} (have full Starling data)")
    print(f"  - From CSV import:    {len(imported_txs)} (from starling_incoming_transactions.csv)")
    print()
    
    # Assign direction to all transactions
    direction_stats = {"IN": 0, "OUT": 0, "INFERRED_IN": 0, "INFERRED_OUT": 0}
    
    for tx in starling_txs:
        raw = tx.get("raw") or {}
        metadata = tx.get("metadata") or {}
        
        # Try to get explicit direction
        direction = raw.get("direction") or metadata.get("direction", "").strip()
        
        if direction:
            tx['determined_direction'] = direction
            direction_stats[direction] = direction_stats.get(direction, 0) + 1
        else:
            # Infer from amount
            # Positive = money came IN (good!)
            # Negative = money went OUT (don't care)
            amount = tx.get("amountMinor", 0)
            if amount >= 0:
                tx['determined_direction'] = "IN"
                direction_stats["INFERRED_IN"] += 1
            else:
                tx['determined_direction'] = "OUT"
                direction_stats["INFERRED_OUT"] += 1
    
    print("Direction assignment:")
    print(f"  - Explicit IN:    {direction_stats.get('IN', 0)}")
    print(f"  - Explicit OUT:   {direction_stats.get('OUT', 0)}")
    print(f"  - Inferred IN:    {direction_stats['INFERRED_IN']} (from positive amounts)")
    print(f"  - Inferred OUT:   {direction_stats['INFERRED_OUT']} (from negative amounts)")
    
    total_in = direction_stats.get('IN', 0) + direction_stats['INFERRED_IN']
    total_out = direction_stats.get('OUT', 0) + direction_stats['INFERRED_OUT']
    
    print()
    print(f"SUMMARY:")
    print(f"  ✓ INCOMING (IN):  {total_in} transactions - TRACK THESE")
    print(f"  ✗ OUTGOING (OUT): {total_out} transactions - IGNORE THESE")
    print()
    
    # Define CSV columns
    fields = [
        # DIRECTION FIRST!
        "direction",
        "direction_source",  # 'api' or 'inferred'
        
        # Identifiers
        "feedItemUid",
        "externalId",
        "id",
        
        # Times
        "transactionTime",
        "settlementTime",
        "occurredAt",
        
        # Amount
        "amountGBP",
        "amountMinor",
        "currency",
        
        # Transaction details
        "status",
        "spendingCategory",
        "source",
        "productType",
        
        # Parties
        "counterPartyName",
        "counterPartyType",
        "personName",
        
        # Description
        "reference",
        "description",
        
        # Origin
        "data_source",  # 'starling_api' or 'csv_import'
        "sourceFile",
        
        # Additional
        "country",
        "counterPartySubEntityIdentifier",  # Sort code
        "counterPartySubEntitySubIdentifier",  # Account number
        
        # System
        "leadId",
        "confidence",
        "createdAt",
        "updatedAt",
    ]
    
    print(f"Creating comprehensive CSV...")
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fields)
        writer.writeheader()
        
        for tx in starling_txs:
            raw = tx.get("raw") or {}
            metadata = tx.get("metadata") or {}
            
            # Determine data source
            if raw.get("feedItemUid") or raw.get("source"):
                data_source = "starling_api"
            else:
                data_source = "csv_import"
            
            # Determine if direction was explicit or inferred
            explicit_direction = raw.get("direction") or metadata.get("direction", "").strip()
            direction_source = "api" if explicit_direction else "inferred"
            
            row = {
                "direction": tx['determined_direction'],
                "direction_source": direction_source,
                "feedItemUid": raw.get("feedItemUid", ""),
                "externalId": tx.get("externalId", ""),
                "id": tx.get("id", ""),
                "transactionTime": raw.get("transactionTime", ""),
                "settlementTime": raw.get("settlementTime", ""),
                "occurredAt": tx.get("occurredAt", ""),
                "amountGBP": round(tx.get("amountMinor", 0) / 100, 2),
                "amountMinor": tx.get("amountMinor", 0),
                "currency": tx.get("currency", ""),
                "status": raw.get("status", tx.get("status", "")),
                "spendingCategory": raw.get("spendingCategory") or metadata.get("spendingCategory", ""),
                "source": raw.get("source", ""),
                "productType": tx.get("productType", ""),
                "counterPartyName": raw.get("counterPartyName", ""),
                "counterPartyType": raw.get("counterPartyType", ""),
                "personName": tx.get("personName", ""),
                "reference": raw.get("reference") or tx.get("reference", ""),
                "description": tx.get("description", ""),
                "data_source": data_source,
                "sourceFile": tx.get("sourceFile", ""),
                "country": raw.get("country", ""),
                "counterPartySubEntityIdentifier": raw.get("counterPartySubEntityIdentifier", ""),
                "counterPartySubEntitySubIdentifier": raw.get("counterPartySubEntitySubIdentifier", ""),
                "leadId": tx.get("leadId", ""),
                "confidence": tx.get("confidence", ""),
                "createdAt": tx.get("createdAt", ""),
                "updatedAt": tx.get("updatedAt", ""),
            }
            
            writer.writerow(row)
    
    # File stats
    import os
    file_size = os.path.getsize(output_file)
    file_size_kb = file_size / 1024
    
    print()
    print("✓ SUCCESS!")
    print()
    print(f"File saved:         {output_file}")
    print(f"File size:          {file_size_kb:.2f} KB")
    print(f"Total transactions: {len(starling_txs)}")
    print(f"Total columns:      {len(fields)}")
    print()
    
    # Show samples
    print("Sample transactions:")
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        in_samples = []
        out_samples = []
        
        for row in reader:
            if row['direction'] == 'IN' and len(in_samples) < 3:
                in_samples.append(row)
            elif row['direction'] == 'OUT' and len(out_samples) < 3:
                out_samples.append(row)
            
            if len(in_samples) >= 3 and len(out_samples) >= 3:
                break
        
        print("\n  INCOMING (✓ Track these):")
        for i, row in enumerate(in_samples, 1):
            source = row['data_source']
            print(f"    {i}. [IN] £{row['amountGBP']:>8s} from {row['counterPartyName'] or row['personName']:30s} ({source})")
        
        if out_samples:
            print("\n  OUTGOING (✗ Ignore these):")
            for i, row in enumerate(out_samples, 1):
                source = row['data_source']
                print(f"    {i}. [OUT] £{row['amountGBP']:>8s} to {row['counterPartyName'] or row['personName']:30s} ({source})")
    
    print()
    print("=" * 80)
    print(f"✓ ALL {len(starling_txs)} Starling transactions have direction assigned!")
    print(f"✓ Filter by direction='IN' to get the {total_in} incoming transactions you want to track")
    print("=" * 80)
    print()
    
    return output_file

if __name__ == "__main__":
    output_file = main()
    print(f"Output: {output_file}")
