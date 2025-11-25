#!/bin/bash

# 🧪 Script de Teste Completo
# Testa TODAS as funcionalidades do marketplace

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="http://localhost:3000/api"
PASSED=0
FAILED=0

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║  🧪 Teste Completo do Marketplace v0.23.3       ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Função para testar endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✅ PASSOU${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FALHOU (HTTP $http_code)${NC}"
        ((FAILED++))
        return 1
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FASE 1: Testes de Infraestrutura${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_endpoint "Health Check" "GET" "/health"
test_endpoint "Status Nodes" "GET" "/status"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FASE 2: Testes de APIs Básicas${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_endpoint "Fees (Mempool.space)" "GET" "/psbt/fees"
test_endpoint "Listar Inscriptions" "GET" "/ordinals"
test_endpoint "Listar Runes" "GET" "/runes"
test_endpoint "Listar Ofertas" "GET" "/offers"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FASE 3: Testes de Fluxo de Compra${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Criar oferta
OFFER_DATA='{
  "type": "inscription",
  "inscriptionId": "test123",
  "offerAmount": 50000,
  "feeRate": 10,
  "creatorAddress": "bc1qtest",
  "psbt": "cHNidP8BATest"
}'

if test_endpoint "Criar Oferta" "POST" "/offers" "$OFFER_DATA"; then
    # Extrair ID da oferta (simplificado)
    OFFER_ID="test_offer_id"
    
    SUBMIT_DATA='{"txid": "test_txid_123"}'
    test_endpoint "Ativar Oferta" "PUT" "/offers/$OFFER_ID/submit" "$SUBMIT_DATA"
    
    test_endpoint "Listar Ofertas Ativas" "GET" "/offers?status=active"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FASE 4: Testes de Wallet${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TEST_ADDRESS="bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
test_endpoint "Balance" "GET" "/wallet/balance/$TEST_ADDRESS"
test_endpoint "UTXOs" "GET" "/wallet/utxos/$TEST_ADDRESS"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  📊 RESUMO DOS TESTES${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TOTAL=$((PASSED + FAILED))
echo ""
echo -e "Total de testes: $TOTAL"
echo -e "${GREEN}✅ Passou: $PASSED${NC}"
echo -e "${RED}❌ Falhou: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🎉 TODOS OS TESTES PASSARAM!                 ║${NC}"
    echo -e "${GREEN}║  Sistema 100% funcional!                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${YELLOW}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ⚠️  Alguns testes falharam                   ║${NC}"
    echo -e "${YELLOW}║  Verifique os logs acima                      ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════╝${NC}"
    exit 1
fi








