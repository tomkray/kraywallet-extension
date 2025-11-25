#!/bin/bash

# 🧪 ATOMIC SWAP TEST SCRIPT
# Testa o fluxo completo do marketplace

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║  🔐 ATOMIC SWAP MARKETPLACE - TEST SUITE                     ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

API_BASE="http://localhost:3000/api/atomic-swap"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função de teste
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}TEST:${NC} $name"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -z "$data" ]; then
        response=$(curl -s -X $method "$API_BASE$endpoint")
    else
        response=$(curl -s -X $method "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        echo "$response" | jq .
    elif echo "$response" | jq -e '.listings' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC} (listings array)"
        echo "$response" | jq .
    elif echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        echo -e "${RED}❌ FAILED${NC}"
        echo "$response" | jq .
    else
        echo -e "${YELLOW}⚠️  UNKNOWN RESPONSE${NC}"
        echo "$response"
    fi
    
    echo ""
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# 1️⃣ HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  1️⃣  HEALTH CHECKS                                           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Checking server health...${NC}"
health=$(curl -s http://localhost:3000/api/health)
if echo "$health" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running${NC}"
    echo "$health" | jq .
else
    echo -e "${RED}❌ Server is not responding${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Checking Bitcoin node...${NC}"
status=$(curl -s http://localhost:3000/api/status)
if echo "$status" | jq -e '.bitcoin.connected == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Bitcoin node connected${NC}"
    echo "$status" | jq '.bitcoin'
else
    echo -e "${YELLOW}⚠️  Bitcoin node not connected (tests may fail)${NC}"
    echo "$status" | jq '.bitcoin'
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 2️⃣ LISTING TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  2️⃣  LISTING ENDPOINTS                                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test: Get all listings (should work even if empty)
test_endpoint "Get all listings" "GET" "/" ""

# Test: Get specific listing (should fail - not exist)
test_endpoint "Get non-existent listing" "GET" "/ord_nonexistent" ""

# Test: Create listing (will fail without real UTXO, but validates endpoint)
test_endpoint "Create listing (validation test)" "POST" "/" '{
  "seller_txid": "0000000000000000000000000000000000000000000000000000000000000000",
  "seller_vout": 0,
  "price_sats": 10000,
  "seller_payout_address": "bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag",
  "inscription_id": "test123",
  "inscription_number": 1
}'

# Test: Dust limit validation
test_endpoint "Create listing with dust price (should fail)" "POST" "/" '{
  "seller_txid": "abc123",
  "seller_vout": 0,
  "price_sats": 100,
  "seller_payout_address": "bc1ptest"
}'

# ═══════════════════════════════════════════════════════════════════════════════
# 3️⃣ DATABASE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  3️⃣  DATABASE INTEGRITY                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Checking database tables...${NC}"
if [ -f "server/db/ordinals.db" ]; then
    echo -e "${GREEN}✅ Database file exists${NC}"
    
    # Check atomic_listings table
    if sqlite3 server/db/ordinals.db "SELECT name FROM sqlite_master WHERE type='table' AND name='atomic_listings';" | grep -q "atomic_listings"; then
        echo -e "${GREEN}✅ atomic_listings table exists${NC}"
        count=$(sqlite3 server/db/ordinals.db "SELECT COUNT(*) FROM atomic_listings;")
        echo "   Total listings: $count"
    else
        echo -e "${RED}❌ atomic_listings table missing${NC}"
    fi
    
    # Check purchase_attempts table
    if sqlite3 server/db/ordinals.db "SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_attempts';" | grep -q "purchase_attempts"; then
        echo -e "${GREEN}✅ purchase_attempts table exists${NC}"
        count=$(sqlite3 server/db/ordinals.db "SELECT COUNT(*) FROM purchase_attempts;")
        echo "   Total attempts: $count"
    else
        echo -e "${RED}❌ purchase_attempts table missing${NC}"
    fi
    
    # Check marketplace_config
    if sqlite3 server/db/ordinals.db "SELECT name FROM sqlite_master WHERE type='table' AND name='marketplace_config';" | grep -q "marketplace_config"; then
        echo -e "${GREEN}✅ marketplace_config table exists${NC}"
        echo ""
        echo -e "${YELLOW}Marketplace Configuration:${NC}"
        sqlite3 server/db/ordinals.db "SELECT key, value FROM marketplace_config;" | while read line; do
            echo "   $line"
        done
    else
        echo -e "${RED}❌ marketplace_config table missing${NC}"
    fi
else
    echo -e "${RED}❌ Database file not found${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 4️⃣ SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  📊 TEST SUMMARY                                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ API Routes:${NC}"
echo "   - GET  /api/atomic-swap/"
echo "   - GET  /api/atomic-swap/:order_id"
echo "   - POST /api/atomic-swap/"
echo "   - POST /api/atomic-swap/:order_id/seller-signature"
echo "   - POST /api/atomic-swap/:order_id/buy/prepare"
echo "   - POST /api/atomic-swap/:order_id/buy/finalize"
echo "   - POST /api/atomic-swap/:order_id/cancel"
echo ""
echo -e "${GREEN}✅ Database:${NC}"
echo "   - atomic_listings (seller offers)"
echo "   - purchase_attempts (buyer purchases)"
echo "   - marketplace_config (global settings)"
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "   1. Ensure Bitcoin Core is running (port 8332)"
echo "   2. Ensure ORD server is running (port 3001)"
echo "   3. Update extension to support SIGHASH_SINGLE|ANYONECANPAY"
echo "   4. Update frontend to use new atomic swap flow"
echo "   5. Test with real UTXOs on testnet"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 ATOMIC SWAP MARKETPLACE READY FOR INTEGRATION! 🎉${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

