#!/bin/bash

# Script para desbloquear a wallet LND
# A senha precisa ser fornecida via stdin

PROJECT_DIR="/Volumes/D2/KRAY WALLET- V1"
LND_CLI="$PROJECT_DIR/lnd/lncli"
LND_DIR="$PROJECT_DIR/lnd-data"

echo "🔓 Desbloqueando wallet LND..."
echo ""
echo "⚠️  Digite a senha da sua wallet:"
echo ""

# Lê a senha do usuário
read -s WALLET_PASSWORD

# Desbloqueia usando echo para passar a senha
echo "$WALLET_PASSWORD" | $LND_CLI --lnddir=$LND_DIR --rpcserver=localhost:10009 unlock

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Wallet desbloqueada com sucesso!"
    echo ""
    echo "📊 Informações do LND:"
    $LND_CLI --lnddir=$LND_DIR --rpcserver=localhost:10009 getinfo
else
    echo ""
    echo "❌ Erro ao desbloquear wallet"
    echo ""
    echo "💡 Dica: Verifique se a senha está correta"
fi

