#!/bin/bash

echo "🔥 REINICIANDO SERVIDOR LIMPO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Matar todos os processos node
echo "1️⃣ Matando processos Node.js..."
pkill -f "node.*server/index.js" || true
pkill -f "node.*3000" || true
pkill -f "node.*3001" || true
sleep 2

# 2. Verificar se portas estão livres
echo ""
echo "2️⃣ Verificando portas..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "   Porta 3000 livre"
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "   Porta 3001 livre"

# 3. Limpar cache do navegador (instruções)
echo ""
echo "3️⃣ LIMPE O CACHE DO NAVEGADOR:"
echo "   Chrome: Ctrl+Shift+Delete → Limpar tudo"
echo "   OU Hard Refresh: Ctrl+Shift+R"

# 4. Iniciar servidor
echo ""
echo "4️⃣ Iniciando servidor..."
echo ""
cd "/Volumes/D2/KRAY WALLET- V1"
node server/index.js

