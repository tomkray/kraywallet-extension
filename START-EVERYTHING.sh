#!/bin/bash

echo "🚀 ========== INICIANDO TUDO =========="
echo ""

# 1. Verificar se LND está rodando
echo "1️⃣ Verificando LND..."
if pgrep -f "lnd.*mainnet" > /dev/null; then
    echo "   ✅ LND já está rodando"
else
    echo "   ⚠️  LND não está rodando! Iniciando..."
    cd /Users/tomkray/Desktop/PSBT-Ordinals
    ./lnd-darwin-arm64-v0.17.0-beta/lnd --configfile=./lnd.conf --lnddir=./lnd-data > lnd-startup.log 2>&1 &
    echo "   ⏳ Aguardando LND iniciar..."
    sleep 5
    echo "   ✅ LND iniciado!"
fi

echo ""

# 2. Verificar se backend está rodando
echo "2️⃣ Verificando Backend..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend já está rodando"
else
    echo "   ⚠️  Backend não está rodando! Iniciando..."
    cd /Users/tomkray/Desktop/PSBT-Ordinals
    npm start > backend-startup.log 2>&1 &
    echo "   ⏳ Aguardando backend iniciar..."
    sleep 8
    
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "   ✅ Backend iniciado!"
    else
        echo "   ❌ Backend falhou ao iniciar. Ver backend-startup.log"
        exit 1
    fi
fi

echo ""
echo "✅ ========== TUDO PRONTO! =========="
echo ""
echo "📋 Status:"
echo "   ✅ LND: Rodando"
echo "   ✅ Backend: Rodando (porta 3000)"
echo ""
echo "🧪 Próximo passo:"
echo "   1. Resetar MyWallet: chrome.storage.local.clear()"
echo "   2. Restore wallet com suas 12 palavras"
echo "   3. Ver log do backend: tail -f backend-startup.log"
echo ""




