#!/usr/bin/env python3
"""
Get ALL Starling transactions available RIGHT NOW
This includes everything that's been synced from Starling
"""

import json
from urllib.request import urlopen
from datetime import datetime
import csv

def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_all_data_now_{timestamp}.csv"
    
    base_url = "https://barngym-os.up.railway.app"
    
    print("=" * 80)
    print("GET ALL STARLING DATA - RIGHT NOW")
    print("=" * 80)
    print()
    print(f"Fetching ALL Starling transactions from: {base_url}")
    print()
    
    # Get ALL transactions marked as Starling
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    
    print("Making API call to get all data...")
    
    with urlopen(url, timeout=60) as response:
        data = json.loads(response.read().decode())
    
    all_txs = data.get("data", [])
    
    # Filter to only Starling
    starling_txs = [tx for tx in all_txs if tx.get("provider") == "Starling"]
    
    print(f"Received {len(starling_txs)} Starling transactions")
    print()
    
    # Analyze data sources
    with_api_data = []
    without_api_data = []
    
    for tx in starling_txs:
        raw = tx.get("raw") or {}
        if raw.get("feedItemUid") or raw.get("source"):
            with_api_data.append(tx)
        else:
            without_api_data.append(tx)
    
    print("Data source breakdown:")
    print(f"  Transactions with Starling API data: {len(with_api_data)}")
    print(f"  Transactions from CSV imports:       {len(without_api_data)}")
    print(f"  TOTAL:                               {len(starling_txs)}")
    print()
    
    # Define comprehensive columns
    fields = [
        "direction",
        "data_source",
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
        "counterPartySubEntityIdentifier",
        "counterPartySubEntitySubIdentifier",
        "personName",
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
        "sourceFile",
        "createdAt",
        "updatedAt",
    ]
    
    print("Creating CSV with all transactions...")
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fields)
        writer.writeheader()
        
        direction_counts = {}
        source_counts = {"api": 0, "csv_import": 0}
        
        for tx in starling_txs:
            raw = tx.get("raw") or {}
            metadata = tx.get("metadata") or {}
            
            # Determine data source
            has_api_data = bool(raw.get("feedItemUid") or raw.get("source"))
            data_source = "api" if has_api_data else "csv_import"
            source_counts[data_source] += 1
            
            # Get direction
            direction = raw.get("direction") or metadata.get("direction", "")
            if not direction:
                # Infer from amount
                direction = "IN" if tx.get("amountMinor", 0) >= 0 else "OUT"
            
            direction_counts[direction] = direction_counts.get(direction, 0) + 1
            
            row = {
                "direction": direction,
                "data_source": data_source,
                "feedItemUid": raw.get("feedItemUid", ""),
                "transactionTime": raw.get("transactionTime", ""),
                "settlementTime": raw.get("settlementTime", ""),
                "occurredAt": tx.get("occurredAt", ""),
                "amountGBP": round(tx.get("amountMinor", 0) / 100, 2),
                "amountMinor": tx.get("amountMinor", 0),
                "currency": tx.get("currency", ""),
                "status": raw.get("status", tx.get("status", "")),
                "spendingCategory": raw.get("spendingCategory") or metadata.get("spendingCategory", ""),
                "source": raw.get("source", ""),
                "counterPartyName": raw.get("counterPartyName", ""),
                "counterPartyType": raw.get("counterPartyType", ""),
                "counterPartyUid": raw.get("counterPartyUid", ""),
                "counterPartySubEntityIdentifier": raw.get("counterPartySubEntityIdentifier", ""),
                "counterPartySubEntitySubIdentifier": raw.get("counterPartySubEntitySubIdentifier", ""),
                "personName": tx.get("personName", ""),
                "reference": raw.get("reference") or tx.get("reference", ""),
                "description": tx.get("description", ""),
                "country": raw.get("country", ""),
                "merchantUid": raw.get("merchantUid", ""),
                "hasReceipt": raw.get("hasReceipt", ""),
                "hasAttachment": raw.get("hasAttachment", ""),
                "externalId": tx.get("externalId", ""),
                "id": tx.get("id", ""),
                "leadId": tx.get("leadId", ""),
                "confidence": tx.get("confidence", ""),
                "sourceFile": tx.get("sourceFile", ""),
                "createdAt": tx.get("createdAt", ""),
                "updatedAt": tx.get("updatedAt", ""),
            }
            
            writer.writerow(row)
    
    # Stats
    import os
    file_size = os.path.getsize(output_file)
    file_size_kb = file_size / 1024
    
    # Get date range
    dates = [tx.get("occurredAt", "")[:10] for tx in starling_txs if tx.get("occurredAt")]
    
    print()
    print("=" * 80)
    print("✓ SUCCESS!")
    print("=" * 80)
    print()
    print(f"File saved:         {output_file}")
    print(f"File size:          {file_size_kb:.2f} KB")
    print(f"Total transactions: {len(starling_txs)}")
    print(f"Total columns:      {len(fields)}")
    print()
    
    if dates:
        print(f"Date range: {min(dates)} to {max(dates)}")
        print()
    
    print("Source breakdown:")
    for source, count in sorted(source_counts.items()):
        pct = count / len(starling_txs) * 100
        print(f"  {source:12s}: {count:4d} ({pct:5.1f}%)")
    
    print()
    print("Direction breakdown:")
    for direction, count in sorted(direction_counts.items()):
        pct = count / len(starling_txs) * 100
        print(f"  {direction:3s}: {count:4d} ({pct:5.1f}%)")
    
    print()
    print("Sample (most recent 5):")
    recent_txs = sorted(starling_txs, key=lambda x: x.get("occurredAt", ""), reverse=True)[:5]
    for i, tx in enumerate(recent_txs, 1):
        raw = tx.get("raw") or {}
        occurred = tx.get("occurredAt", "")[:10]
        amount = tx.get("amountMinor", 0) / 100
        party = raw.get("counterPartyName") or tx.get("personName", "")
        direction = raw.get("direction") or "IN"
        print(f"  {i}. [{direction}] {occurred} £{amount:>8.2f} - {party[:30]}")
    
    print()
    print("=" * 80)
    print(f"✓ ALL {len(starling_txs)} Starling transactions included")
    print(f"✓ This is everything currently in your system")
    print("=" * 80)
    print()
    
    return output_file

if __name__ == "__main__":
    output_file = main()
    print(f"Output: {output_file}")
