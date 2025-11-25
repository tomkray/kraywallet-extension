#!/bin/bash

echo "🔍 DEBUGANDO PARSER DE RUNES"
echo "=============================="
echo ""

echo "1️⃣ Salvando HTML do ORD server..."
curl -s "http://localhost/address/bc1pvz02d8z6c4d7r2m4vzx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx" > /tmp/ord-runes.html
echo "✅ Salvo em /tmp/ord-runes.html"
echo ""

echo "2️⃣ Procurando 'rune balances' no HTML..."
grep -i "rune balances" /tmp/ord-runes.html
echo ""

echo "3️⃣ Extraindo seção de runes..."
grep -A 5 "rune balances" /tmp/ord-runes.html
echo ""

echo "4️⃣ Rodando teste do parser..."
cd /Users/tomkray/Desktop/PSBT-Ordinals
node test-runes-parser.js
echo ""

echo "=============================="
echo "✅ Debug concluído!"

