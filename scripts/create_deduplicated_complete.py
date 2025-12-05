#!/usr/bin/env python3
"""
Create complete Starling CSV with:
- All 146 API transactions (recent, full data)
- All 321 unique CSV transactions (older, basic data)
- Remove 51 duplicates
= 467 total unique transactions
"""

import json
from urllib.request import urlopen
from datetime import datetime
import csv

def main():
    base_url = "https://barngym-os.up.railway.app"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_deduplicated_complete_{timestamp}.csv"
    
    print("=" * 80)
    print("Complete De-duplicated Starling Transactions")
    print("=" * 80)
    print()
    
    # Fetch all transactions
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    print(f"Fetching all Starling data...")
    
    with urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode())
    
    transactions = data.get("data", [])
    
    # Separate API vs CSV
    api_txs = []
    csv_txs = []
    
    for tx in transactions:
        if tx.get("provider") == "Starling":
            raw = tx.get("raw") or {}
            if raw.get("feedItemUid") or raw.get("source"):
                api_txs.append(tx)
            else:
                csv_txs.append(tx)
    
    print(f"Found {len(api_txs)} API transactions")
    print(f"Found {len(csv_txs)} CSV transactions")
    print()
    
    # Build signature set from API transactions
    api_signatures = set()
    for tx in api_txs:
        raw = tx.get("raw") or {}
        sig = (
            tx.get("amountMinor"),
            tx.get("occurredAt", "")[:10],
            (raw.get("counterPartyName") or tx.get("personName", "")).strip()
        )
        api_signatures.add(sig)
    
    # Filter CSV transactions to remove duplicates
    unique_csv_txs = []
    duplicates = 0
    
    for tx in csv_txs:
        sig = (
            tx.get("amountMinor"),
            tx.get("occurredAt", "")[:10],
            tx.get("personName", "").strip()
        )
        
        if sig not in api_signatures:
            unique_csv_txs.append(tx)
        else:
            duplicates += 1
    
    print(f"Removed {duplicates} duplicate CSV transactions")
    print(f"Keeping {len(unique_csv_txs)} unique CSV transactions")
    print()
    
    total_unique = len(api_txs) + len(unique_csv_txs)
    print(f"TOTAL UNIQUE TRANSACTIONS: {total_unique}")
    print(f"  = {len(api_txs)} (API) + {len(unique_csv_txs)} (unique CSV)")
    print()
    
    # Combine all unique transactions
    all_unique_txs = api_txs + unique_csv_txs
    
    # Sort by date (most recent first)
    all_unique_txs.sort(key=lambda x: x.get("occurredAt", ""), reverse=True)
    
    # Define columns
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
        "personName",
        "reference",
        "description",
        "country",
        "counterPartySubEntityIdentifier",
        "counterPartySubEntitySubIdentifier",
        "hasReceipt",
        "hasAttachment",
        "externalId",
        "id",
        "leadId",
        "confidence",
        "createdAt",
        "updatedAt",
    ]
    
    print("Writing CSV...")
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fields)
        writer.writeheader()
        
        direction_counts = {"IN": 0, "OUT": 0}
        source_counts = {"api": 0, "csv_import": 0}
        
        for tx in all_unique_txs:
            raw = tx.get("raw") or {}
            metadata = tx.get("metadata") or {}
            
            # Determine data source
            is_api = bool(raw.get("feedItemUid") or raw.get("source"))
            data_source = "api" if is_api else "csv_import"
            source_counts[data_source] += 1
            
            # Get direction
            direction = raw.get("direction") or metadata.get("direction", "")
            if not direction:
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
                "personName": tx.get("personName", ""),
                "reference": raw.get("reference") or tx.get("reference", ""),
                "description": tx.get("description", ""),
                "country": raw.get("country", ""),
                "counterPartySubEntityIdentifier": raw.get("counterPartySubEntityIdentifier", ""),
                "counterPartySubEntitySubIdentifier": raw.get("counterPartySubEntitySubIdentifier", ""),
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
    
    # Stats
    import os
    file_size = os.path.getsize(output_file)
    file_size_kb = file_size / 1024
    
    print()
    print("✓ SUCCESS!")
    print()
    print(f"File saved:         {output_file}")
    print(f"File size:          {file_size_kb:.2f} KB")
    print(f"Total transactions: {total_unique}")
    print()
    print("Breakdown by source:")
    for source, count in sorted(source_counts.items()):
        pct = count / total_unique * 100
        print(f"  {source:12s}: {count:3d} transactions ({pct:.1f}%)")
    
    print()
    print("Direction breakdown:")
    for direction, count in sorted(direction_counts.items()):
        pct = count / total_unique * 100
        print(f"  {direction:3s}: {count:3d} transactions ({pct:.1f}%)")
    
    # Show date range
    dates = [tx.get("occurredAt", "")[:10] for tx in all_unique_txs if tx.get("occurredAt")]
    if dates:
        print()
        print(f"Date range: {min(dates)} to {max(dates)}")
    
    print()
    print("Sample transactions (most recent):")
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 5:
                break
            print(f"  {i+1}. [{row['direction']}] {row['occurredAt'][:10]} £{row['amountGBP']:>8s} - {row['counterPartyName'] or row['personName']:30s} ({row['data_source']})")
    
    print()
    print("=" * 80)
    print(f"✓ {total_unique} unique transactions (removed {duplicates} duplicates)")
    print(f"✓ Complete history from {min(dates) if dates else 'N/A'} to {max(dates) if dates else 'N/A'}")
    print("=" * 80)
    print()
    
    return output_file

if __name__ == "__main__":
    output_file = main()
    print(f"Output: {output_file}")
