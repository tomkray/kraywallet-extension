#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTE COMPLETO DO ATOMIC SWAP
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                            ║"
echo "║  🧪 TESTE COMPLETO - ATOMIC SWAP MARKETPLACE                               ║"
echo "║                                                                            ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 PRÉ-REQUISITOS
# ═══════════════════════════════════════════════════════════════════════════════

echo "📋 VERIFICANDO PRÉ-REQUISITOS..."
echo ""

# Verificar backend
echo "   [1/4] Verificando backend..."
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ❌ Backend não está rodando em http://localhost:3000"
    echo "   → Inicie o backend primeiro: npm start"
    exit 1
fi
echo "   ✅ Backend OK"

# Verificar Bitcoin RPC
echo "   [2/4] Verificando Bitcoin RPC..."
if ! curl -s --user bitcoin:bitcoin \
    --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}' \
    http://127.0.0.1:8332 > /dev/null 2>&1; then
    echo "   ⚠️  Bitcoin RPC não está respondendo"
    echo "   → Pode continuar, mas alguns testes podem falhar"
else
    echo "   ✅ Bitcoin RPC OK"
fi

# Verificar ORD Server
echo "   [3/4] Verificando ORD Server..."
if ! curl -s http://127.0.0.1:3001/ > /dev/null 2>&1; then
    echo "   ⚠️  ORD Server não está respondendo"
    echo "   → Pode continuar, mas alguns testes podem falhar"
else
    echo "   ✅ ORD Server OK"
fi

# Verificar database
echo "   [4/4] Verificando database..."
if [ ! -f "server/db/ordinals.db" ]; then
    echo "   ❌ Database não encontrado"
    exit 1
fi
echo "   ✅ Database OK"

echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 PASSO 1: CONFIGURAR DADOS DE TESTE
# ═══════════════════════════════════════════════════════════════════════════════

echo "🎬 PASSO 1: CONFIGURAR DADOS DE TESTE"
echo ""

# IMPORTANTE: Substitua com seus dados reais!
SELLER_TXID="0000000000000000000000000000000000000000000000000000000000000001"
SELLER_VOUT="0"
SELLER_VALUE="10000"
PRICE_SATS="50000"
SELLER_PAYOUT_ADDRESS="bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"

echo "   Seller TXID: $SELLER_TXID"
echo "   Seller Vout: $SELLER_VOUT"
echo "   Seller Value: $SELLER_VALUE sats"
echo "   Price: $PRICE_SATS sats"
echo "   Seller Payout Address: $SELLER_PAYOUT_ADDRESS"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PASSO 2: CRIAR LISTAGEM (SELLER)
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════"
echo "🚀 PASSO 2: CRIAR LISTAGEM"
echo ""

CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/atomic-swap/ \
  -H "Content-Type: application/json" \
  -d "{
    \"seller_txid\": \"$SELLER_TXID\",
    \"seller_vout\": $SELLER_VOUT,
    \"seller_value\": $SELLER_VALUE,
    \"price_sats\": $PRICE_SATS,
    \"seller_payout_address\": \"$SELLER_PAYOUT_ADDRESS\"
  }")

echo "$CREATE_RESPONSE" | jq .

# Extrair order_id e template_psbt
ORDER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.order_id')
TEMPLATE_PSBT=$(echo "$CREATE_RESPONSE" | jq -r '.template_psbt_base64')

if [ "$ORDER_ID" == "null" ] || [ -z "$ORDER_ID" ]; then
    echo ""
    echo "❌ Erro ao criar listagem!"
    echo "$CREATE_RESPONSE"
    exit 1
fi

echo ""
echo "✅ Listagem criada!"
echo "   Order ID: $ORDER_ID"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# ✍️ PASSO 3: ASSINAR PSBT DO SELLER
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════"
echo "✍️ PASSO 3: ASSINAR PSBT DO SELLER"
echo ""

echo "⚠️  ATENÇÃO: Você precisa assinar manualmente!"
echo ""
echo "Use o script:"
echo "   node sign-seller-psbt.js \"$TEMPLATE_PSBT\" \"<SELLER_WIF>\""
echo ""
echo "Ou use sua wallet/extension para assinar com:"
echo "   SIGHASH: SINGLE | ANYONECANPAY (0x83)"
echo ""

# ⚠️ SIMULAÇÃO: Como não temos a chave privada real, vamos criar uma FAKE signed PSBT
# Em produção, o seller assinaria aqui com sua chave privada real!

echo "⚠️  SIMULAÇÃO: Criando PSBT assinada FAKE para demonstração..."
echo ""

# Para teste real, descomente e adicione WIF real:
# SELLER_WIF="cT1...your-real-wif..."
# node sign-seller-psbt.js "$TEMPLATE_PSBT" "$SELLER_WIF"
# SIGNED_SELLER_PSBT=$(cat signed-seller-psbt.txt)

# Simulação (vai falhar na validação, mas mostra o fluxo)
SIGNED_SELLER_PSBT="$TEMPLATE_PSBT"  # FAKE - use assinatura real!

echo "📋 PSBT assinada (primeiros 50 chars): ${SIGNED_SELLER_PSBT:0:50}..."
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 📤 PASSO 4: ENVIAR ASSINATURA DO SELLER
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════"
echo "📤 PASSO 4: ENVIAR ASSINATURA DO SELLER"
echo ""

echo "⚠️  PULANDO: Precisa de assinatura real com SIGHASH 0x83"
echo ""
echo "Para testar de verdade, execute manualmente:"
echo ""
echo "curl -X POST \"http://localhost:3000/api/atomic-swap/$ORDER_ID/seller-signature\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"listing_psbt_base64\": \"<SIGNED_PSBT>\""
echo "  }'"
echo ""

# Descomente para enviar (vai falhar sem assinatura real):
# SELLER_SIG_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/seller-signature" \
#   -H "Content-Type: application/json" \
#   -d "{
#     \"listing_psbt_base64\": \"$SIGNED_SELLER_PSBT\"
#   }")
# echo "$SELLER_SIG_RESPONSE" | jq .

# ═══════════════════════════════════════════════════════════════════════════════
# 🛍️ PASSO 5: LISTAR OFERTAS
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════"
echo "🛍️ PASSO 5: LISTAR OFERTAS"
echo ""

LISTINGS_RESPONSE=$(curl -s http://localhost:3000/api/atomic-swap/)
echo "$LISTINGS_RESPONSE" | jq .

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 PASSO 6: VER DETALHES DA OFERTA
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════"
echo "📊 PASSO 6: VER DETALHES DA OFERTA"
echo ""

LISTING_DETAIL=$(curl -s "http://localhost:3000/api/atomic-swap/$ORDER_ID")
echo "$LISTING_DETAIL" | jq .

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 📈 PASSO 7: VER ESTATÍSTICAS DO MARKETPLACE
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════"
echo "📈 PASSO 7: ESTATÍSTICAS DO MARKETPLACE"
echo ""

echo "Database stats:"
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_stats;" 2>/dev/null || echo "   (vazio)"

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 RESUMO FINAL
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "✅ TESTE PARCIAL COMPLETO!"
echo ""
echo "📊 RESULTADOS:"
echo "   • Listagem criada: $ORDER_ID"
echo "   • Status: PENDING_SIGNATURES"
echo ""
echo "⚠️  PARA TESTE COMPLETO (END-TO-END):"
echo ""
echo "1. Assine a PSBT do seller com:"
echo "   node sign-seller-psbt.js \"<TEMPLATE_PSBT>\" \"<SELLER_WIF>\""
echo ""
echo "2. Envie a assinatura:"
echo "   curl -X POST \"http://localhost:3000/api/atomic-swap/$ORDER_ID/seller-signature\" ..."
echo ""
echo "3. Prepare a compra (buyer):"
echo "   curl -X POST \"http://localhost:3000/api/atomic-swap/$ORDER_ID/buy/prepare\" ..."
echo ""
echo "4. Assine a PSBT do buyer:"
echo "   node sign-buyer-psbt.js \"<BUYER_PSBT>\" \"<BUYER_WIF>\""
echo ""
echo "5. Finalize e broadcast:"
echo "   curl -X POST \"http://localhost:3000/api/atomic-swap/$ORDER_ID/buy/finalize\" ..."
echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📖 DOCUMENTAÇÃO COMPLETA:"
echo "   Veja: TUTORIAL_TESTE_ATOMIC_SWAP.md"
echo ""

