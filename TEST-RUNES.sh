#!/bin/bash

echo "🧪 Testando endpoint de runes..."
echo ""

curl "http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4vzx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"

echo ""
echo ""
echo "✅ Se funcionou, você deve ver JSON com a rune DOG•GO•TO•THE•MOON"

