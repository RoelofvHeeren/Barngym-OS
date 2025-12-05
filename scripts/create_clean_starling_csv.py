#!/usr/bin/env python3
"""
Create a clean, user-friendly Starling CSV with key fields prominently displayed
"""

import csv
from datetime import datetime

input_file = "starling_from_db_full_20251205_060035.csv"
output_file = f"starling_clean_{datetime.now().strftime('%Y%m%d')}.csv"

# Define the column order - most important fields first
ordered_fields = [
    # Transaction identifiers
    "raw_feedItemUid",
    "externalId",
    "id",
    
    # Times
    "raw_transactionTime",
    "raw_settlementTime",
    "occurredAt",
    "raw_updatedAt",
    
    # Amount info
    "amountGBP",
    "amountMinor",
    "currency",
    
    # Transaction details
    "raw_direction",
    "raw_status",
    "status",
    "raw_spendingCategory",
    "productType",
    "raw_source",
    
    # Parties
    "raw_counterPartyName",
    "raw_counterPartyType",
    "raw_counterPartyUid",
    "personName",
    
    # Description
    "raw_reference",
    "reference",
    "description",
    
    # Additional details
    "raw_country",
    "raw_counterPartySubEntityName",
    "raw_counterPartySubEntityIdentifier",
    "raw_counterPartySubEntitySubIdentifier",
    "raw_counterPartySubEntityUid",
    "raw_categoryUid",
    "raw_hasReceipt",
    "raw_hasAttachment",
    "raw_batchPaymentDetails",
    
    # System fields
    "provider",
    "confidence",
    "leadId",
    "createdAt",
    "updatedAt",
    
    # Raw amounts (JSON objects)
    "raw_amount",
    "raw_sourceAmount",
]

print("Creating clean Starling CSV...")
print(f"Input:  {input_file}")
print(f"Output: {output_file}")
print()

with open(input_file, 'r', encoding='utf-8') as infile:
    reader = csv.DictReader(infile)
    
    with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=ordered_fields, extrasaction='ignore')
        writer.writeheader()
        
        count = 0
        for row in reader:
            writer.writerow(row)
            count += 1

print(f"✓ Created {output_file}")
print(f"✓ Total transactions: {count}")
print(f"✓ Total columns: {len(ordered_fields)}")
print()

# Show sample
print("Sample (first transaction):")
with open(output_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    first = next(reader)
    print(f"  Feed Item UID:    {first['raw_feedItemUid']}")
    print(f"  Transaction Time: {first['raw_transactionTime']}")
    print(f"  Amount:           £{first['amountGBP']}")
    print(f"  Counter Party:    {first['raw_counterPartyName']}")
    print(f"  Reference:        {first['raw_reference']}")
    print(f"  Direction:        {first['raw_direction']}")
    print(f"  Status:           {first['raw_status']}")

print()
print("✓ File ready!")
