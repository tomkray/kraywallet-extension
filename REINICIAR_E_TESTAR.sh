#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║         🚀 REINICIAR BACKEND E TESTAR RUNES                           ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ADDRESS="bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"

# 1. Finalizar processos
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Finalizando processos antigos..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pkill -9 -f "node server/index.js" 2>/dev/null
sleep 2
echo -e "${GREEN}✅ Processos finalizados${NC}"
echo ""

# 2. Iniciar backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Iniciando backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd /Users/tomkray/Desktop/PSBT-Ordinals
node server/index.js > /tmp/runes-backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend iniciado (PID: $BACKEND_PID)${NC}"
echo "📋 Logs: tail -f /tmp/runes-backend.log"
sleep 6
echo ""

# 3. Verificar health
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Verificando health..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend está respondendo!${NC}"
else
    echo -e "${RED}❌ Backend não respondeu${NC}"
    echo ""
    echo "📋 Verificando logs..."
    tail -20 /tmp/runes-backend.log
    exit 1
fi
echo ""

# 4. Testar endpoint de runes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Testando endpoint de runes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Endereço: $ADDRESS"
echo ""

RESPONSE=$(curl -s "http://localhost:3000/api/runes/by-address/$ADDRESS")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Endpoint respondeu com sucesso!${NC}"
    echo ""
    
    # Verificar se encontrou runes
    RUNE_COUNT=$(echo "$RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
    
    if [ "$RUNE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}🎉 ENCONTROU $RUNE_COUNT RUNE(S)!${NC}"
        echo ""
        echo "📊 Resposta:"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    else
        echo -e "${YELLOW}⚠️  Nenhuma rune encontrada${NC}"
        echo ""
        echo "📊 Resposta:"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    fi
else
    echo -e "${RED}❌ Erro na resposta${NC}"
    echo "$RESPONSE"
fi
echo ""

# 5. Mostrar logs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Logs do backend (últimas 30 linhas):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -30 /tmp/runes-backend.log
echo ""

# 6. Instruções finais
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
echo "3. ${BLUE}Resultado esperado:${NC}"
echo "   DOG•GO•TO•THE•MOON 🐕"
echo ""
echo "📊 Backend rodando:"
echo "   PID: $BACKEND_PID"
echo "   Logs: tail -f /tmp/runes-backend.log"
echo ""
echo "🛑 Para parar:"
echo "   kill $BACKEND_PID"
echo ""

