#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║          🧪 TESTE COMPLETO DE RUNES - AUTOMÁTICO                      ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Matar processos antigos
echo "1️⃣  Finalizando processos antigos..."
pkill -9 -f "node server/index.js" 2>/dev/null
sleep 2
echo "✅ Processos finalizados"
echo ""

# 2. Iniciar backend
echo "2️⃣  Iniciando backend..."
cd /Users/tomkray/Desktop/PSBT-Ordinals
node server/index.js > /tmp/backend-runes.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend PID: $BACKEND_PID"
sleep 5
echo ""

# 3. Verificar se backend está respondendo
echo "3️⃣  Verificando health do backend..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Backend está respondendo!"
else
    echo "❌ Backend não respondeu"
    echo "📋 Logs do backend:"
    tail -50 /tmp/backend-runes.log
    exit 1
fi
echo ""

# 4. Testar endpoint de runes
echo "4️⃣  Testando endpoint de runes..."
ADDRESS="bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
echo "Endereço: $ADDRESS"
echo ""

RESPONSE=$(curl -s "http://localhost:3000/api/runes/by-address/$ADDRESS")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Endpoint respondeu com sucesso!"
    echo ""
    echo "📊 Resposta:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo "❌ Erro na resposta do endpoint"
    echo ""
    echo "📋 Resposta recebida:"
    echo "$RESPONSE"
    echo ""
    echo "📋 Logs do backend:"
    tail -50 /tmp/backend-runes.log
fi
echo ""

# 5. Instruções finais
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TESTE COMPLETO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. Recarregar MyWallet:"
echo "   chrome://extensions → MyWallet → 🔄 Reload"
echo ""
echo "2. Abrir MyWallet:"
echo "   Clique no ícone → Tab 'Runes'"
echo ""
echo "3. Deve aparecer: DOG•GO•TO•THE•MOON 🐕"
echo ""
echo "📋 Logs do backend em: /tmp/backend-runes.log"
echo "   tail -f /tmp/backend-runes.log"
echo ""
echo "🛑 Para parar o backend:"
echo "   kill $BACKEND_PID"
echo ""

