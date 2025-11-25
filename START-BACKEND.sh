#!/bin/bash

echo "🔴 Parando backend antigo..."
pkill -9 -f "node server/index.js"
sleep 2

echo "✅ Iniciando backend..."
cd /Users/tomkray/Desktop/PSBT-Ordinals
node server/index.js

