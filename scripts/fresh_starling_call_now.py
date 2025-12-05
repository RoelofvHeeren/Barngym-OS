#!/usr/bin/env python3
"""
Make a FRESH Starling API call RIGHT NOW to get ALL available data
No database, no old data - just what Starling gives us today
"""

import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from datetime import datetime, timedelta
import csv
import sys

def call_starling_api_now():
    """Make fresh API call to Starling Bank right now"""
    base_url = "https://barngym-os.up.railway.app"
    
    # Try to get maximum data - go back 5 years
    to_date = datetime.now()
    from_date = datetime.now() - timedelta(days=365*5)
    
    from_str = from_date.strftime("%Y-%m-%d")
    to_str = to_date.strftime("%Y-%m-%d")
    
    url = f"{base_url}/api/starling/export?from={from_str}&to={to_str}"
    
    print("=" * 80)
    print("FRESH STARLING API CALL - RIGHT NOW")
    print("=" * 80)
    print()
    print(f"Calling Starling Bank API via: {base_url}")
    print(f"Requesting ALL data from: {from_str} to {to_str}")
    print()
    print("Making API call...")
    
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=120) as response:
            content_type = response.headers.get('Content-Type', '')
            
            print(f"Response received! Content-Type: {content_type}")
            print()
            
            if 'text/csv' in content_type or 'text/plain' in content_type:
                csv_content = response.read().decode('utf-8')
                
                # Verify it's actually CSV
                lines = csv_content.strip().split('\n')
                if len(lines) > 0 and 'feedItemUid' in lines[0]:
                    print("✓ Received CSV data from Starling API!")
                    return ('success', csv_content, len(lines) - 1)
                else:
                    return ('error', 'Invalid CSV format', 0)
                    
            elif 'application/json' in content_type:
                error_data = json.loads(response.read().decode('utf-8'))
                error_msg = error_data.get('message', 'Unknown error')
                return ('error', error_msg, 0)
            else:
                content = response.read().decode('utf-8')[:500]
                return ('error', f'Unexpected response: {content}', 0)
                
    except HTTPError as e:
        try:
            error_body = e.read().decode('utf-8')
            if error_body.startswith('{'):
                error_data = json.loads(error_body)
                return ('error', f"HTTP {e.code}: {error_data.get('message', error_body)}", 0)
            return ('error', f'HTTP {e.code}: {error_body[:200]}', 0)
        except:
            return ('error', f'HTTP {e.code}', 0)
    except Exception as e:
        return ('error', str(e), 0)

def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"starling_fresh_api_call_{timestamp}.csv"
    
    # Make the fresh API call
    status, result, count = call_starling_api_now()
    
    if status == 'success':
        print(f"Received {count} transactions from Starling API")
        print()
        
        # Save to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        
        import os
        file_size = os.path.getsize(output_file)
        file_size_kb = file_size / 1024
        
        print("=" * 80)
        print("✓ SUCCESS!")
        print("=" * 80)
        print()
        print(f"File saved:         {output_file}")
        print(f"File size:          {file_size_kb:.2f} KB")
        print(f"Total transactions: {count}")
        print()
        
        # Parse and show details
        lines = result.strip().split('\n')
        header = lines[0]
        
        print("CSV Columns:")
        cols = header.split(',')
        for i, col in enumerate(cols[:15], 1):
            print(f"  {i:2d}. {col}")
        if len(cols) > 15:
            print(f"  ... and {len(cols) - 15} more columns")
        
        print()
        print("Sample transactions (first 5):")
        for i, line in enumerate(lines[1:6], 1):
            parts = line.split(',')
            if len(parts) >= 10:
                # feedItemUid, transactionTime, direction, status, amount, currency, counterPartyName
                print(f"  {i}. {parts[1][:10]} | {parts[3]:3s} | £{float(parts[5])/100:>8.2f} | {parts[9][:30]}")
        
        print()
        
        # Count by direction
        direction_counts = {}
        for line in lines[1:]:
            parts = line.split(',')
            if len(parts) > 3:
                direction = parts[3]
                direction_counts[direction] = direction_counts.get(direction, 0) + 1
        
        print("Direction breakdown:")
        for direction, cnt in sorted(direction_counts.items()):
            pct = cnt / count * 100 if count > 0 else 0
            print(f"  {direction:3s}: {cnt:4d} transactions ({pct:.1f}%)")
        
        print()
        print("=" * 80)
        print("✓ This is FRESH data from Starling Bank API called RIGHT NOW")
        print("✓ This is the complete set of transactions Starling returns")
        print("=" * 80)
        print()
        
        return output_file
        
    else:
        print()
        print("=" * 80)
        print("✗ FAILED to get data from Starling API")
        print("=" * 80)
        print()
        print(f"Error: {result}")
        print()
        print("Possible reasons:")
        print("  1. Starling connection needs to be reconnected in your app")
        print("  2. Access token has expired")
        print("  3. Starling API is having issues")
        print("  4. The webhook/sync is not set up")
        print()
        
        return None

if __name__ == "__main__":
    output_file = main()
    if output_file:
        print(f"✓ Output file: {output_file}")
        sys.exit(0)
    else:
        print("✗ Failed to get data")
        sys.exit(1)
