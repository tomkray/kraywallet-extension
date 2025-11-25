#!/bin/bash

echo "🚀 ========================================="
echo "   INICIANDO BACKEND - SEND RUNES"
echo "========================================="
echo ""

cd /Users/tomkray/Desktop/PSBT-Ordinals

echo "🔪 Matando processos antigos do backend..."
pkill -9 -f "node server/index.js" 2>/dev/null
sleep 1

echo "✅ Processos antigos mortos!"
echo ""

echo "🚀 Iniciando backend na porta 3000..."
node server/index.js

# Se o comando acima falhar, mostra erro
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ ERRO ao iniciar backend!"
    echo "   Verifique se o Node.js está instalado"
    echo "   e se não há erros nos arquivos."
    exit 1
fi


