#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║     🧪 TESTE AUTOMÁTICO COMPLETO - RUNES + BITCOIN CORE RPC          ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

ADDRESS="bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════
# 1. LIMPAR PROCESSOS ANTIGOS
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Limpando processos antigos..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pkill -9 -f "node server/index.js" 2>/dev/null
sleep 2
echo -e "${GREEN}✅ Processos antigos finalizados${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 2. INICIAR BACKEND
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Iniciando backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd /Users/tomkray/Desktop/PSBT-Ordinals
node server/index.js > /tmp/psbt-backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend iniciado (PID: $BACKEND_PID)${NC}"
echo "   Log: /tmp/psbt-backend.log"
sleep 6
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 3. VERIFICAR HEALTH
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Verificando health do backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend está respondendo!${NC}"
else
    echo -e "${RED}❌ Backend não respondeu${NC}"
    echo ""
    echo "📋 Últimas linhas do log:"
    tail -30 /tmp/psbt-backend.log
    echo ""
    echo -e "${RED}🛑 Abortando teste${NC}"
    exit 1
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 4. TESTAR BITCOIN CORE RPC
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Testando Bitcoin Core RPC..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BLOCKCHAIN_INFO=$(curl -s --user Tomkray7:bobeternallove77$ \
  --data-binary '{"jsonrpc":"1.0","method":"getblockchaininfo","params":[]}' \
  http://127.0.0.1:8332/ 2>/dev/null)

if echo "$BLOCKCHAIN_INFO" | grep -q "blocks"; then
    BLOCKS=$(echo "$BLOCKCHAIN_INFO" | grep -o '"blocks":[0-9]*' | grep -o '[0-9]*')
    echo -e "${GREEN}✅ Bitcoin Core RPC está respondendo!${NC}"
    echo "   Blocos sincronizados: $BLOCKS"
else
    echo -e "${RED}❌ Bitcoin Core RPC não respondeu${NC}"
    echo -e "${YELLOW}⚠️  Continuando mesmo assim...${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 5. TESTAR ENDPOINT DE TRANSAÇÕES
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Testando endpoint de transações..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Endereço: $ADDRESS"
echo ""

TRANSACTIONS_RESPONSE=$(curl -s "http://localhost:3000/api/wallet/transactions/$ADDRESS")

if echo "$TRANSACTIONS_RESPONSE" | grep -q '"success":true'; then
    TX_COUNT=$(echo "$TRANSACTIONS_RESPONSE" | grep -o '"transactions":\[[^]]*\]' | grep -o '{"txid"' | wc -l | tr -d ' ')
    echo -e "${GREEN}✅ Endpoint de transações funcionando!${NC}"
    echo "   Transações encontradas: $TX_COUNT"
else
    echo -e "${RED}❌ Erro no endpoint de transações${NC}"
    echo "   Resposta: $TRANSACTIONS_RESPONSE"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 6. TESTAR ENDPOINT DE RUNES
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Testando endpoint de runes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RUNES_RESPONSE=$(curl -s "http://localhost:3000/api/runes/by-address/$ADDRESS")

if echo "$RUNES_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Endpoint de runes funcionando!${NC}"
    
    # Verificar se encontrou runes
    if echo "$RUNES_RESPONSE" | grep -q '"runes":\['; then
        if echo "$RUNES_RESPONSE" | grep -q 'DOG'; then
            echo -e "${GREEN}🐕 Rune DOG•GO•TO•THE•MOON encontrada!${NC}"
        else
            RUNE_COUNT=$(echo "$RUNES_RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
            echo "   Runes encontradas: $RUNE_COUNT"
        fi
    else
        echo -e "${YELLOW}⚠️  Nenhuma rune encontrada${NC}"
    fi
else
    echo -e "${RED}❌ Erro no endpoint de runes${NC}"
    echo "   Resposta: $RUNES_RESPONSE"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 7. TESTAR OVERVIEW COMPLETO
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  Testando overview completo..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

OVERVIEW_RESPONSE=$(curl -s "http://localhost:3000/api/wallet/overview/$ADDRESS")

if echo "$OVERVIEW_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Overview funcionando!${NC}"
    
    # Extrair informações
    BALANCE=$(echo "$OVERVIEW_RESPONSE" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*')
    UTXOS=$(echo "$OVERVIEW_RESPONSE" | grep -o '"utxos":\[[^]]*\]' | grep -o '{"txid"' | wc -l | tr -d ' ')
    
    echo "   Balance: $BALANCE sats"
    echo "   UTXOs: $UTXOS"
else
    echo -e "${RED}❌ Erro no overview${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 8. VERIFICAR LOGS DO BACKEND
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8️⃣  Logs do backend (últimas 20 linhas)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -20 /tmp/psbt-backend.log
echo ""

# ═══════════════════════════════════════════════════════════════════════
# 9. RESULTADO FINAL
# ═══════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TESTE COMPLETO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. ${BLUE}Recarregar MyWallet:${NC}"
echo "   chrome://extensions → MyWallet → 🔄 Reload"
echo ""
echo "2. ${BLUE}Abrir MyWallet:${NC}"
echo "   Clique no ícone → Tab 'Runes'"
echo ""
echo "3. ${BLUE}Deve aparecer:${NC}"
echo "   DOG•GO•TO•THE•MOON 🐕"
echo ""
echo "📊 URLs para testar no navegador:"
echo ""
echo "   Transações:"
echo "   http://localhost:3000/api/wallet/transactions/$ADDRESS"
echo ""
echo "   Runes:"
echo "   http://localhost:3000/api/runes/by-address/$ADDRESS"
echo ""
echo "   Overview:"
echo "   http://localhost:3000/api/wallet/overview/$ADDRESS"
echo ""
echo "📋 Backend rodando:"
echo "   PID: $BACKEND_PID"
echo "   Log: tail -f /tmp/psbt-backend.log"
echo ""
echo "🛑 Para parar o backend:"
echo "   kill $BACKEND_PID"
echo ""
echo -e "${GREEN}🚀 TUDO PRONTO PARA TESTAR NA MYWALLET!${NC}"
echo ""

