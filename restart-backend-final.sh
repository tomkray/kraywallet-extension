#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║           🔄 REINICIANDO BACKEND FINAL - RUNES CORRIGIDO!             ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Matar processos
echo "1️⃣  Finalizando processos..."
pkill -9 -f "node server/index.js" 2>/dev/null
sleep 2
echo "✅ Processos finalizados"
echo ""

# 2. Iniciar backend
echo "2️⃣  Iniciando backend..."
cd /Users/tomkray/Desktop/PSBT-Ordinals
node server/index.js &
BACKEND_PID=$!
echo "✅ Backend iniciado (PID: $BACKEND_PID)"
echo ""

# 3. Aguardar inicialização
echo "3️⃣  Aguardando inicialização..."
sleep 5
echo ""

# 4. Instruções
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                   ✅ BACKEND RODANDO!                                  ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. Recarregar MyWallet:"
echo "   chrome://extensions → MyWallet → 🔄 Reload"
echo ""
echo "2. Abrir MyWallet → Tab 'Runes'"
echo ""
echo "3. Deve aparecer:"
echo "   ┌────────────────────────────────────┐"
echo "   │ [📷] DOG•GO•TO•THE•MOON  🐕   → │"
echo "   │      1,000                       │"
echo "   └────────────────────────────────────┘"
echo ""
echo "🛑 Para parar: kill $BACKEND_PID"
echo ""

