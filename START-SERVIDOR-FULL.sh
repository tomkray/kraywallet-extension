#!/bin/bash

# ============================================
# 🚀 START SERVIDOR FULL - KRAY STATION
# ============================================
# Script para iniciar todo o sistema perfeitamente
# Autor: AI Assistant
# Data: 23/10/2024
# ============================================

echo "============================================"
echo "🚀 INICIANDO KRAY STATION - FULL SYSTEM"
echo "============================================"
echo ""

# Diretório do projeto
PROJECT_DIR="/Volumes/D2/KRAY WALLET"
cd "$PROJECT_DIR" || exit 1

echo "📍 Working directory: $PROJECT_DIR"
echo ""

# ============================================
# 1️⃣ PARAR TODOS OS PROCESSOS NODE
# ============================================
echo "🛑 Parando todos os processos Node.js..."
pkill -9 node 2>/dev/null
sleep 2

# Limpar porta 3000 (se ainda estiver ocupada)
lsof -ti:3000 | xargs kill -9 2>/dev/null
echo "✅ Processos Node parados!"
echo ""

# ============================================
# 2️⃣ VERIFICAR ORD SERVER (PORTA 80)
# ============================================
echo "🔍 Verificando ORD Server (porta 80)..."
if lsof -ti:80 > /dev/null 2>&1; then
    echo "✅ ORD Server está rodando na porta 80"
else
    echo "⚠️  ORD Server NÃO está rodando!"
    echo "   Para iniciar o ORD server, execute:"
    echo "   sudo ord --index-runes --index-sats server --http-port 80"
    echo ""
    echo "   ⚠️  O sistema funcionará parcialmente sem o ORD server"
    echo "   (inscriptions e runes não serão indexadas do blockchain)"
fi
echo ""

# ============================================
# 3️⃣ LIMPAR LOGS ANTIGOS (OPCIONAL)
# ============================================
echo "🗑️  Limpando logs antigos..."
rm -f "$PROJECT_DIR/server-*.log" 2>/dev/null
rm -f "$PROJECT_DIR/backend-*.log" 2>/dev/null
echo "✅ Logs limpos!"
echo ""

# ============================================
# 4️⃣ INICIAR SERVIDOR NODE.JS (BACKEND + FRONTEND)
# ============================================
echo "🚀 Iniciando servidor Node.js..."
echo "   Backend API: http://localhost:3000/api"
echo "   Frontend: http://localhost:3000"
echo ""

# Iniciar em background com log
nohup npm start > "$PROJECT_DIR/server-full.log" 2>&1 &
SERVER_PID=$!

echo "📝 PID do servidor: $SERVER_PID"
echo "📄 Log file: $PROJECT_DIR/server-full.log"
echo ""

# ============================================
# 5️⃣ AGUARDAR SERVIDOR INICIALIZAR
# ============================================
echo "⏳ Aguardando servidor inicializar (8 segundos)..."
sleep 8
echo ""

# ============================================
# 6️⃣ VERIFICAR SE SERVIDOR ESTÁ FUNCIONANDO
# ============================================
echo "🔍 Verificando status do servidor..."
echo ""

# Verificar se processo está rodando
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "✅ Processo Node.js está rodando (PID: $SERVER_PID)"
else
    echo "❌ Processo Node.js NÃO está rodando!"
    echo "   Verifique o log: tail -50 $PROJECT_DIR/server-full.log"
    exit 1
fi

# Verificar se porta 3000 está aberta
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "✅ Porta 3000 está aberta"
else
    echo "❌ Porta 3000 NÃO está aberta!"
    exit 1
fi

# Testar API Health
echo ""
echo "🧪 Testando API Health..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo "✅ API Health: OK"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "⚠️  API Health não respondeu corretamente"
    echo "   Response: $HEALTH_RESPONSE"
fi

# Testar Frontend
echo ""
echo "🧪 Testando Frontend..."
FRONTEND_RESPONSE=$(curl -s http://localhost:3000 2>/dev/null | head -1)
if echo "$FRONTEND_RESPONSE" | grep -q "DOCTYPE"; then
    echo "✅ Frontend: OK"
else
    echo "⚠️  Frontend não respondeu corretamente"
fi

echo ""
echo "============================================"
echo "✅ KRAY STATION INICIADO COM SUCESSO!"
echo "============================================"
echo ""
echo "📊 SERVIÇOS DISPONÍVEIS:"
echo ""
echo "   🌐 Frontend Home:        http://localhost:3000"
echo "   🖼️  Ordinals Market:     http://localhost:3000/ordinals.html"
echo "   🪙 Runes Swap:           http://localhost:3000/runes-swap.html"
echo "   ⚡ Lightning DEX:        http://localhost:3000/lightning-hub.html"
echo ""
echo "   🔌 API Health:           http://localhost:3000/api/health"
echo "   📦 API Ordinals:         http://localhost:3000/api/ordinals"
echo "   🪙 API Runes:            http://localhost:3000/api/runes"
echo ""
echo "📝 LOGS:"
echo "   tail -f $PROJECT_DIR/server-full.log"
echo ""
echo "🛑 PARAR SERVIDOR:"
echo "   pkill -9 node"
echo "   ou use: kill $SERVER_PID"
echo ""
echo "============================================"
echo "🎯 PRÓXIMOS PASSOS:"
echo "============================================"
echo ""
echo "1. Abra o browser em: http://localhost:3000"
echo "2. Recarregue a extensão MyWallet (chrome://extensions)"
echo "3. Conecte sua wallet e teste!"
echo ""
echo "✨ Tudo pronto para usar! ✨"
echo ""


