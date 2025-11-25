#!/bin/bash
echo "🧪 Testing PSBT Build..."
curl -s -X POST http://localhost:3000/api/runes/build-send-psbt \
  -H "Content-Type: application/json" \
  -d '{
    "fromAddress": "bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx",
    "toAddress": "bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag",
    "runeName": "DOG•GO•TO•THE•MOON",
    "amount": "500",
    "feeRate": 1
  }' | jq .


