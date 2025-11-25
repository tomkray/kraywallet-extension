#!/bin/bash

echo "================================"
echo "🧪 TESTANDO SEND RUNES"
echo "================================"

ADDRESS="bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
TO_ADDRESS="bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag"

echo ""
echo "📋 Step 1: Verificando se backend está rodando..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Backend está rodando"
else
    echo "❌ Backend não está respondendo"
    exit 1
fi

echo ""
echo "📋 Step 2: Buscando runes do endereço..."
RUNES=$(curl -s "http://localhost:3000/api/runes/by-address/$ADDRESS")
echo "$RUNES" | jq .

echo ""
echo "📋 Step 3: Tentando enviar rune..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/runes/build-send-psbt \
  -H "Content-Type: application/json" \
  -d '{
    "fromAddress": "'$ADDRESS'",
    "toAddress": "'$TO_ADDRESS'",
    "runeName": "DOG•GO•TO•THE•MOON",
    "amount": "1000",
    "feeRate": 1
  }')

echo "$RESPONSE" | jq .

if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo ""
    echo "✅ ✅ ✅ PSBT CRIADO COM SUCESSO! ✅ ✅ ✅"
else
    echo ""
    echo "❌ Erro ao criar PSBT"
fi


