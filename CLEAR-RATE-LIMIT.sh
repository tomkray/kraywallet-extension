#!/bin/bash

# 🔧 SCRIPT PARA LIMPAR RATE LIMITING COMPLETAMENTE
# Execute este script para remover bloqueio de rate limiting

echo "🔧 =========================================="
echo "🔧 CLEARING RATE LIMITING CACHE"
echo "🔧 =========================================="
echo ""

echo "🛑 Step 1: Stopping all Node processes..."
pkill -9 node 2>/dev/null
sleep 2
echo "✅ All Node processes stopped"
echo ""

echo "🗑️  Step 2: Cleaning Node cache..."
rm -rf node_modules/.cache 2>/dev/null
echo "✅ Node cache cleaned"
echo ""

echo "⏰ Step 3: Waiting 60 seconds for rate limit to expire..."
echo "   (Rate limit cache expires after 15 minutes, but we'll wait 1 minute)"
for i in {60..1}; do
    echo -ne "   Waiting: $i seconds remaining...\r"
    sleep 1
done
echo ""
echo "✅ Wait complete"
echo ""

echo "🚀 Step 4: Starting server..."
cd "/Volumes/D2/KRAY WALLET"
npm start > server.log 2>&1 &
sleep 5
echo "✅ Server started"
echo ""

echo "🧪 Step 5: Testing API (should work now)..."
RESPONSE=$(curl -s http://localhost:3000/api/offers 2>&1 | head -1)
echo "Response: $RESPONSE"
echo ""

if [[ "$RESPONSE" == *"Too many requests"* ]]; then
    echo "❌ STILL BLOCKED: Rate limit still active"
    echo "⚠️  SOLUTION: Wait 15 minutes from the FIRST request that hit the limit"
    echo "⚠️  OR: Change your IP address / use a different machine"
else
    echo "✅ SUCCESS: API is working!"
fi

echo ""
echo "🔧 =========================================="
echo "🔧 DONE!"
echo "🔧 =========================================="

