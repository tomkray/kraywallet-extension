#!/bin/bash

echo "🔄 Reiniciando backend..."

# 1. Matar processos do backend
echo "⏹️  Parando backend atual..."
pkill -f "node.*server/index.js" 2>/dev/null
pkill -f "npm.*start" 2>/dev/null
sleep 2

# 2. Verificar se parou
if pgrep -f "node.*server/index.js" > /dev/null; then
    echo "❌ Backend ainda rodando, forçando..."
    pkill -9 -f "node.*server/index.js"
    sleep 1
fi

# 3. Limpar logs antigos
echo "🧹 Limpando logs..."
rm -f backend-startup.log

# 4. Iniciar backend novo
echo "🚀 Iniciando backend atualizado..."
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start > backend-startup.log 2>&1 &

# 5. Aguardar iniciar
echo "⏳ Aguardando backend iniciar..."
sleep 5

# 6. Verificar se iniciou
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Backend iniciado com sucesso!"
    echo ""
    echo "📋 Ver logs em tempo real:"
    echo "   tail -f backend-startup.log"
    echo ""
    echo "🧪 Agora:"
    echo "   1. chrome.storage.local.clear()"
    echo "   2. Restore wallet"
    echo "   3. Ver o log aparecer!"
else
    echo "❌ Backend não respondeu. Ver backend-startup.log"
    tail -20 backend-startup.log
    exit 1
fi




