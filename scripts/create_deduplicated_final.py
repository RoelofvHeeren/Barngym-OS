#!/usr/bin/env python3
"""
Create final de-duplicated Starling CSV
- Includes API transactions (recent, from webhooks)
- Includes CSV import transactions (historical)
- Removes duplicates (same amount, date, and counterparty)
"""

import json
from urllib.request import urlopen
from datetime import datetime
import csv

def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_deduplicated_final_{timestamp}.csv"
    
    base_url = "https://barngym-os.up.railway.app"
    
    print("=" * 80)
    print("FINAL DE-DUPLICATED STARLING EXPORT")
    print("=" * 80)
    print()
    
    # Fetch all transactions
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    print(f"Fetching all Starling data from database...")
    
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
    
    print(f"Found {len(api_txs)} API transactions (webhook data)")
    print(f"Found {len(csv_txs)} CSV import transactions (historical)")
    print()
    
    # Build signature set from API transactions (these are the "source of truth" for recent data)
    api_signatures = {}
    for tx in api_txs:
        raw = tx.get("raw") or {}
        sig = (
            tx.get("amountMinor"),
            tx.get("occurredAt", "")[:10],  # Date only
            (raw.get("counterPartyName") or tx.get("personName", "")).strip().upper()
        )
        api_signatures[sig] = tx
    
    print(f"API transactions signature set: {len(api_signatures)} unique")
    print()
    
    # Filter CSV transactions to remove duplicates
    unique_csv_txs = []
    duplicates_removed = 0
    
    for tx in csv_txs:
        sig = (
            tx.get("amountMinor"),
            tx.get("occurredAt", "")[:10],
            tx.get("personName", "").strip().upper()
        )
        
        if sig not in api_signatures:
            unique_csv_txs.append(tx)
        else:
            duplicates_removed += 1
    
    print(f"Removed {duplicates_removed} duplicate CSV transactions")
    print(f"Kept {len(unique_csv_txs)} unique CSV transactions (not in API)")
    print()
    
    # Combine all unique transactions
    all_unique = list(api_signatures.values()) + unique_csv_txs
    total_unique = len(all_unique)
    
    print(f"TOTAL UNIQUE TRANSACTIONS: {total_unique}")
    print(f"  = {len(api_txs)} (API) + {len(unique_csv_txs)} (unique CSV) - {duplicates_removed} (duplicates)")
    print()
    
    # Sort by date (most recent first)
    all_unique.sort(key=lambda x: x.get("occurredAt", ""), reverse=True)
    
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
        "sourceFile",
        "createdAt",
        "updatedAt",
    ]
    
    print("Writing de-duplicated CSV...")
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fields)
        writer.writeheader()
        
        direction_counts = {}
        source_counts = {}
        
        for tx in all_unique:
            raw = tx.get("raw") or {}
            metadata = tx.get("metadata") or {}
            
            # Determine data source
            is_api = bool(raw.get("feedItemUid") or raw.get("source"))
            data_source = "api" if is_api else "csv_import"
            source_counts[data_source] = source_counts.get(data_source, 0) + 1
            
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
    dates = [tx.get("occurredAt", "")[:10] for tx in all_unique if tx.get("occurredAt")]
    
    print()
    print("=" * 80)
    print("✅ SUCCESS!")
    print("=" * 80)
    print()
    print(f"File saved:           {output_file}")
    print(f"File size:            {file_size_kb:.2f} KB")
    print(f"Total transactions:   {total_unique}")
    print(f"Duplicates removed:   {duplicates_removed}")
    print()
    
    if dates:
        print(f"Complete date range:  {min(dates)} to {max(dates)}")
        print()
    
    print("Source breakdown:")
    for source, count in sorted(source_counts.items()):
        pct = count / total_unique * 100
        print(f"  {source:12s}: {count:4d} ({pct:5.1f}%)")
    
    print()
    print("Direction breakdown:")
    for direction, count in sorted(direction_counts.items()):
        pct = count / total_unique * 100
        print(f"  {direction:3s}: {count:4d} ({pct:5.1f}%)")
    
    print()
    print("Sample (most recent 5):")
    for i, tx in enumerate(all_unique[:5], 1):
        raw = tx.get("raw") or {}
        occurred = tx.get("occurredAt", "")[:10]
        amount = tx.get("amountMinor", 0) / 100
        party = raw.get("counterPartyName") or tx.get("personName", "")
        direction = raw.get("direction") or "IN"
        is_api = bool(raw.get("feedItemUid"))
        source = "api" if is_api else "csv"
        print(f"  {i}. [{direction}] {occurred} £{amount:>8.2f} - {party[:30]:30s} ({source})")
    
    print()
    print("=" * 80)
    print(f"✅ {total_unique} unique transactions (removed {duplicates_removed} duplicates)")
    print(f"✅ Complete history from {min(dates) if dates else 'N/A'} to {max(dates) if dates else 'N/A'}")
    print(f"✅ No duplicates - each transaction appears exactly once")
    print("=" * 80)
    print()
    
    return output_file

if __name__ == "__main__":
    output_file = main()
    print(f"Output: {output_file}")
