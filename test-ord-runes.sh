#!/bin/bash

echo "🧪 TESTANDO ORD SERVER - RUNES"
echo "================================"
echo ""

echo "1️⃣ Testando endpoint do ORD server diretamente:"
echo "URL: http://localhost/address/bc1pvz02d8z6c4d7r2m4vzx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
echo ""

curl -s "http://localhost/address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx" | grep -A 10 "rune balances"

echo ""
echo ""
echo "2️⃣ Testando endpoint do backend:"
echo "URL: http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4vzx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
echo ""

curl -s "http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4vzx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx" | jq .

echo ""
echo "================================"
echo "✅ Teste concluído!"

