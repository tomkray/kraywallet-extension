#!/bin/bash

echo "🔴 Parando TODOS os processos Node..."
killall -9 node 2>/dev/null
sleep 3

echo "🗑️  Limpando arquivos antigos..."
cd /Users/tomkray/Desktop/PSBT-Ordinals
rm -f server.log .backend.pid

echo ""
echo "🚀 Iniciando backend..."
node server/index.js > server.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > .backend.pid

echo "⏳ Aguardando 5 segundos..."
sleep 5

echo ""
echo "✅ Backend iniciado com PID: $BACKEND_PID"
echo ""

echo "🧪 Testando endpoint de runes..."
curl "http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"

echo ""
echo ""
echo "📋 Últimas 30 linhas do log:"
echo "============================"
tail -30 server.log

echo ""
echo ""
echo "✅ Teste concluído!"
echo ""
echo "Se você viu '🪙 RUNES ENDPOINT CALLED!!!' nos logs, o endpoint está funcionando!"
echo "Se NÃO viu, há um problema com o roteamento do Express."

