#!/usr/bin/env python3
"""
Fetch Starling transactions and ensure ALL have direction field properly set
Uses: raw.direction OR metadata.direction OR infer from amount
"""

import sys
import json
from urllib.request import urlopen
from datetime import datetime
import csv

def main():
    base_url = "https://barngym-os.up.railway.app"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_with_direction_{timestamp}.csv"
    
    print("=" * 70)
    print("Starling Transactions with DIRECTION FIXED")
    print("=" * 70)
    print()
    
    # Fetch all transactions
    url = f"{base_url}/api/transactions?provider=Starling&limit=10000"
    print(f"Fetching transactions from: {url}")
    print()
    
    with urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode())
    
    transactions = data.get("data", [])
    
    # Filter to ONLY actual Starling transactions (not Stripe mislabeled)
    starling_txs = []
    for tx in transactions:
        # Must have provider=Starling AND have Starling-specific data
        if tx.get("provider") == "Starling":
            raw = tx.get("raw") or {}
            # Check if it has Starling-specific fields
            if raw.get("feedItemUid") or raw.get("source"):
                starling_txs.append(tx)
    
    print(f"Found {len(starling_txs)} TRUE Starling transactions")
    print()
    
    # Process and add direction
    fixed_count = 0
    inferred_count = 0
    has_direction = 0
    
    for tx in starling_txs:
        raw = tx.get("raw") or {}
        metadata = tx.get("metadata") or {}
        
        # Get direction from raw or metadata
        direction = raw.get("direction") or metadata.get("direction", "").strip()
        
        if direction:
            has_direction += 1
        else:
            # Infer from amount - positive = IN (we received money)
            amount = tx.get("amountMinor", 0)
            if amount >= 0:
                direction = "IN"
                inferred_count += 1
            else:
                direction = "OUT"
                inferred_count += 1
            fixed_count += 1
        
        # Store the determined direction
        tx['determined_direction'] = direction
    
    print(f"Direction Status:")
    print(f"  - Already had direction: {has_direction}")
    print(f"  - Needed to infer:       {fixed_count}")
    print(f"  - Total fixed:           {len(starling_txs)}")
    print()
    
    # Define comprehensive columns with direction prominently placed
    fields = [
        # DIRECTION FIRST - Most Important!
        "direction",
        
        # Transaction identifiers
        "feedItemUid",
        "externalId",
        "id",
        
        # Times
        "transactionTime",
        "settlementTime",
        "occurredAt",
        "updatedAt",
        
        # Amount
        "amountGBP",
        "amountMinor",
        "currency",
        
        # Status & Category
        "status",
        "spendingCategory",
        "source",
        
        # Parties
        "counterPartyName",
        "counterPartyType",
        "personName",
        
        # Description
        "reference",
        "description",
        
        # Additional
        "country",
        "counterPartySubEntityName",
        "counterPartySubEntityIdentifier",
        "counterPartySubEntitySubIdentifier",
        "hasReceipt",
        "hasAttachment",
        
        # System
        "leadId",
        "confidence",
        "createdAt",
    ]
    
    print(f"Creating CSV with {len(fields)} columns...")
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fields)
        writer.writeheader()
        
        for tx in starling_txs:
            raw = tx.get("raw") or {}
            metadata = tx.get("metadata") or {}
            
            # Build clean row
            row = {
                "direction": tx['determined_direction'],  # MOST IMPORTANT!
                "feedItemUid": raw.get("feedItemUid", ""),
                "externalId": tx.get("externalId", ""),
                "id": tx.get("id", ""),
                "transactionTime": raw.get("transactionTime", ""),
                "settlementTime": raw.get("settlementTime", ""),
                "occurredAt": tx.get("occurredAt", ""),
                "updatedAt": raw.get("updatedAt", ""),
                "amountGBP": round(tx.get("amountMinor", 0) / 100, 2),
                "amountMinor": tx.get("amountMinor", 0),
                "currency": tx.get("currency", ""),
                "status": raw.get("status", ""),
                "spendingCategory": raw.get("spendingCategory") or metadata.get("spendingCategory", ""),
                "source": raw.get("source", ""),
                "counterPartyName": raw.get("counterPartyName", ""),
                "counterPartyType": raw.get("counterPartyType", ""),
                "personName": tx.get("personName", ""),
                "reference": raw.get("reference", ""),
                "description": tx.get("description", ""),
                "country": raw.get("country", ""),
                "counterPartySubEntityName": raw.get("counterPartySubEntityName", ""),
                "counterPartySubEntityIdentifier": raw.get("counterPartySubEntityIdentifier", ""),
                "counterPartySubEntitySubIdentifier": raw.get("counterPartySubEntitySubIdentifier", ""),
                "hasReceipt": raw.get("hasReceipt", ""),
                "hasAttachment": raw.get("hasAttachment", ""),
                "leadId": tx.get("leadId", ""),
                "confidence": tx.get("confidence", ""),
                "createdAt": tx.get("createdAt", ""),
            }
            
            writer.writerow(row)
    
    # Get file size
    import os
    file_size = os.path.getsize(output_file)
    file_size_kb = file_size / 1024
    
    # Count by direction
    direction_counts = {}
    for tx in starling_txs:
        d = tx['determined_direction']
        direction_counts[d] = direction_counts.get(d, 0) + 1
    
    print()
    print("✓ SUCCESS!")
    print()
    print(f"File saved:         {output_file}")
    print(f"File size:          {file_size_kb:.2f} KB")
    print(f"Total transactions: {len(starling_txs)}")
    print()
    print("Direction Breakdown:")
    for direction, count in sorted(direction_counts.items()):
        pct = count / len(starling_txs) * 100
        print(f"  {direction:3s}: {count:4d} transactions ({pct:.1f}%)")
    
    print()
    print("Sample transactions:")
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 3:
                break
            print(f"\n  {i+1}. [{row['direction']}] £{row['amountGBP']} - {row['counterPartyName']} - {row['reference']}")
    
    print()
    print(f"✓ All {len(starling_txs)} transactions have direction assigned!")
    print()
    
    return output_file

if __name__ == "__main__":
    output_file = main()
    print(f"Output file: {output_file}")
