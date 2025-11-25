#!/bin/bash

echo "🧪 TESTANDO ENDPOINT DE RUNES - FORÇADO"
echo "========================================"
echo ""

# Fazer requisição e salvar resultado
curl -v "http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4vzx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx" > /tmp/runes-result.json 2>&1

echo ""
echo "📋 RESULTADO SALVO EM /tmp/runes-result.json"
echo ""
echo "Conteúdo:"
cat /tmp/runes-result.json

echo ""
echo ""
echo "📋 LOGS DO BACKEND (últimas 20 linhas):"
tail -20 /Users/tomkray/Desktop/PSBT-Ordinals/server.log

echo ""
echo "========================================"
echo "✅ Teste completo!"

