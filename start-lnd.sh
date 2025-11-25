#!/bin/bash

# 🚀 Start LND (Lightning Network Daemon)
# Para KrayWallet Lightning DEX

echo "⚡ =========================================="
echo "⚡ Starting LND (Lightning Network Daemon)"
echo "⚡ =========================================="
echo ""

# Diretório do projeto
PROJECT_DIR="/Volumes/D2/KRAY WALLET- V1"
LND_BIN="$PROJECT_DIR/lnd/lnd"
LND_CONF="$PROJECT_DIR/lnd.conf"
LND_DATA="$PROJECT_DIR/lnd-data"

# Criar diretório de dados se não existir
mkdir -p "$LND_DATA"

# Verificar se LND está instalado
if [ ! -f "$LND_BIN" ]; then
    echo "❌ LND não encontrado em: $LND_BIN"
    exit 1
fi

echo "✅ LND encontrado: $LND_BIN"
echo "✅ Config: $LND_CONF"
echo "✅ Data dir: $LND_DATA"
echo ""

# Verificar se já está rodando
if pgrep -x "lnd" > /dev/null; then
    echo "⚠️  LND já está rodando!"
    echo ""
    echo "Para parar: pkill lnd"
    echo "Para ver logs: tail -f $LND_DATA/logs/bitcoin/mainnet/lnd.log"
    exit 0
fi

echo "🚀 Iniciando LND..."
echo ""
echo "📝 Logs estarão em: $LND_DATA/logs/bitcoin/mainnet/lnd.log"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   Na primeira vez, você precisará criar uma wallet:"
echo "   ./lnd/lncli create"
echo ""
echo "🔗 Para usar lncli:"
echo "   ./lnd/lncli getinfo"
echo "   ./lnd/lncli newaddress p2tr"
echo "   ./lnd/lncli openchannel [node_pubkey] [amount_sats]"
echo ""

# Rodar LND
"$LND_BIN" \
    --configfile="$LND_CONF" \
    --lnddir="$LND_DATA"

echo ""
echo "⚡ LND encerrado."




