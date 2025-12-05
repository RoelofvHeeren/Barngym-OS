#!/bin/bash
# Test what the Starling accounts API actually returns

echo "Testing Starling Accounts API..."
echo ""

# Call your Railway endpoint to test the connection
curl -s "https://barngym-os.up.railway.app/api/integrations/starling" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

echo ""
echo "If the connection works, you'll see account details above."
echo "If it fails, you need to reconnect Starling in your app."
