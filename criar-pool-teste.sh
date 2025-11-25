#!/bin/bash

# 🏊 Script para criar primeiro pool de teste no KRAY DeFi

echo "🏊 Criando pool de teste DOG•GO•TO•THE•MOON..."
echo ""

curl -X POST http://localhost:3000/api/defi/pools \
  -H "Content-Type: application/json" \
  -d '{
    "runeId": "840000:3",
    "runeName": "DOG•GO•TO•THE•MOON",
    "initialBtcAmount": 10000000,
    "initialRuneAmount": 100000000000,
    "creatorAddress": "bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2"
  }' | python3 -m json.tool

echo ""
echo ""
echo "✅ Pool criado!"
echo ""
echo "🔍 Ver pools disponíveis:"
echo "curl http://localhost:3000/api/defi/pools | python3 -m json.tool"
echo ""
echo "🧪 Testar quote:"
echo 'curl -X POST http://localhost:3000/api/defi/quote -H "Content-Type: application/json" -d '"'"'{"poolId":"840000:3:BTC","inputCoinId":"0:0","inputAmount":100000,"slippageTolerance":0.05}'"'"' | python3 -m json.tool'
echo ""
echo "🚀 Agora abra: http://localhost:3000/runes-swap.html"


