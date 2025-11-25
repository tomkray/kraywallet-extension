# 🎯 SEU TESTE AGORA - PASSO A PASSO

**Data:** 2025-11-01  
**Status:** Backend verificado e funcionando! ✅

---

## ✅ O QUE EU JÁ VERIFIQUEI PRA VOCÊ:

```
✅ Backend rodando (http://localhost:3000)
✅ Database OK (ordinals.db)
✅ Treasure Marketplace configurado (bc1pe3nvk...)
✅ Taxa 2% configurada (mínimo 546 sats)
✅ API /api/atomic-swap/ funcionando
✅ 0 listagens ativas (normal - vamos criar a primeira!)
```

---

## 🚀 AGORA É COM VOCÊ - VAMOS CRIAR A PRIMEIRA LISTAGEM!

---

## 📋 PASSO 1: PREPARAR SEUS DADOS

### **O que você precisa ter:**

1. **UTXO do seller** com uma inscrição:
   - `txid` (hash da transação)
   - `vout` (índice do output, normalmente 0)
   - `value` (valor em sats do UTXO)

2. **Endereço do seller** para receber o pagamento:
   - Pode ser qualquer endereço Bitcoin válido

3. **Preço** que você quer cobrar (em sats)

---

## 🔧 PASSO 2: CRIAR A LISTAGEM

### **Copie e cole este comando (ADAPTE OS VALORES!):**

```bash
# ⚠️ IMPORTANTE: Substitua com seus dados reais!

export SELLER_TXID="abc123...seu-txid-real"
export SELLER_VOUT="0"
export SELLER_VALUE="10000"
export PRICE_SATS="50000"
export SELLER_PAYOUT_ADDRESS="bc1q...seu-endereço"

# Criar listagem
curl -X POST http://localhost:3000/api/atomic-swap/ \
  -H "Content-Type: application/json" \
  -d "{
    \"seller_txid\": \"$SELLER_TXID\",
    \"seller_vout\": $SELLER_VOUT,
    \"seller_value\": $SELLER_VALUE,
    \"price_sats\": $PRICE_SATS,
    \"seller_payout_address\": \"$SELLER_PAYOUT_ADDRESS\"
  }" | jq .
```

### **Resposta esperada:**

```json
{
  "order_id": "abc123-def456-...",
  "template_psbt_base64": "cHNidP8BAF...",
  "message": "Template PSBT created. Seller must sign input[0] with SIGHASH_SINGLE|ANYONECANPAY (0x83)",
  "details": {
    "seller_txid": "abc123...",
    "seller_vout": 0,
    "price_sats": 50000,
    "output_0_value": 50000,
    "output_0_address": "bc1q..."
  }
}
```

### **📝 ANOTE:**
```bash
export ORDER_ID="abc123-def456-..."
export TEMPLATE_PSBT="cHNidP8BAF..."
```

---

## ✍️ PASSO 3: ASSINAR A PSBT DO SELLER

### **Você tem 2 opções:**

#### **OPÇÃO A: Usar o script pronto**

```bash
# Sua chave privada em formato WIF
export SELLER_WIF="cT1...sua-chave-privada..."

# Assinar
node sign-seller-psbt.js "$TEMPLATE_PSBT" "$SELLER_WIF"

# Resultado salvo em: signed-seller-psbt.txt
export SIGNED_SELLER_PSBT=$(cat signed-seller-psbt.txt)
```

#### **OPÇÃO B: Usar sua wallet/extension**

1. Pegue o `template_psbt_base64`
2. Importe na sua wallet
3. Assine com `SIGHASH_SINGLE|ANYONECANPAY (0x83)`
4. Exporte a PSBT assinada

---

## 📤 PASSO 4: ENVIAR ASSINATURA DO SELLER

```bash
curl -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/seller-signature" \
  -H "Content-Type: application/json" \
  -d "{
    \"listing_psbt_base64\": \"$SIGNED_SELLER_PSBT\"
  }" | jq .
```

### **Resposta esperada:**

```json
{
  "ok": true,
  "order_id": "abc123-def456-...",
  "status": "OPEN",
  "message": "Listing is now OPEN for buyers"
}
```

---

## 🎉 SUCESSO! LISTAGEM CRIADA!

Agora sua oferta está **OPEN** e visível para compradores!

---

## 🛍️ PASSO 5: LISTAR OFERTAS (COMO BUYER)

```bash
curl http://localhost:3000/api/atomic-swap/ | jq .
```

**Você verá sua listagem!**

---

## 💰 PASSO 6: COMPRAR (PREPARAR)

### **Dados do buyer:**

```bash
export BUYER_ADDRESS="bc1q...buyer-inscription-address"
export BUYER_CHANGE_ADDRESS="bc1q...buyer-change"

# ⚠️ Você precisa de UTXOs suficientes para:
# - Pagar o preço do seller
# - Pagar taxa 2% do marketplace (mínimo 546 sats)
# - Pagar taxa de rede (miner fee)

# Exemplo: se preço = 50,000 sats
# Total buyer paga ≈ 51,000 sats + miner fee

curl -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/buy/prepare" \
  -H "Content-Type: application/json" \
  -d "{
    \"buyer_address\": \"$BUYER_ADDRESS\",
    \"buyer_change_address\": \"$BUYER_CHANGE_ADDRESS\",
    \"buyer_inputs\": [
      {
        \"txid\": \"xyz789...\",
        \"vout\": 0,
        \"value\": 100000,
        \"script_pubkey\": \"0014...\"
      }
    ]
  }" | jq .
```

### **Resposta:**

```json
{
  "attempt_id": "xyz-123-abc",
  "psbt_to_sign_base64": "cHNidP8BAFUCA...",
  "summary": {
    "seller_payout": 50000,
    "inscription_to_buyer": 10000,
    "market_fee": 1000,
    "buyer_change": 38000,
    "miner_fee": 1000,
    "total_buyer_pays": 51000
  }
}
```

### **📝 ANOTE:**
```bash
export ATTEMPT_ID="xyz-123-abc"
export BUYER_PSBT_TO_SIGN="cHNidP8BAFUCA..."
```

---

## ✍️ PASSO 7: ASSINAR PSBT DO BUYER

```bash
export BUYER_WIF="cT1...buyer-wif..."

node sign-buyer-psbt.js "$BUYER_PSBT_TO_SIGN" "$BUYER_WIF"

export SIGNED_BUYER_PSBT=$(cat signed-buyer-psbt.txt)
```

---

## 🚀 PASSO 8: FINALIZAR E BROADCAST

```bash
curl -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/buy/finalize" \
  -H "Content-Type: application/json" \
  -d "{
    \"attempt_id\": \"$ATTEMPT_ID\",
    \"psbt_signed_by_buyer_base64\": \"$SIGNED_BUYER_PSBT\"
  }" | jq .
```

### **Resposta (SUCESSO!):**

```json
{
  "success": true,
  "txid": "a1b2c3d4e5f6...",
  "status": "BROADCASTED",
  "message": "Transaction broadcasted successfully!",
  "details": {
    "seller_received": 50000,
    "market_fee": 1000,
    "buyer_received_inscription": true
  }
}
```

---

## ✅ VERIFICAR RESULTADO

### **No Bitcoin Core:**
```bash
bitcoin-cli getrawtransaction "a1b2c3d4e5f6..." 1
```

### **No Database:**
```bash
sqlite3 server/db/ordinals.db "SELECT * FROM atomic_listings WHERE order_id = '$ORDER_ID';"
sqlite3 server/db/ordinals.db "SELECT * FROM purchase_attempts WHERE order_id = '$ORDER_ID';"
```

### **Estatísticas atualizadas:**
```bash
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_stats;"
```

---

## 🎉 PARABÉNS!

Você completou seu primeiro Atomic Swap!

✅ **Seller** recebeu o preço  
✅ **Buyer** recebeu a inscrição  
✅ **Treasure Marketplace** recebeu 2% em:  
   `bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2`

---

## 📊 COMANDOS RÁPIDOS

```bash
# Listar ofertas
curl http://localhost:3000/api/atomic-swap/ | jq .

# Ver uma oferta específica
curl http://localhost:3000/api/atomic-swap/$ORDER_ID | jq .

# Ver estatísticas
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_stats;"

# Ver config
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_config;"

# Ver todas listagens
sqlite3 server/db/ordinals.db "SELECT order_id, status, price_sats, created_at FROM atomic_listings;"
```

---

## 🐛 SE ALGO DER ERRADO

### **Erro: "UTXO already spent"**
→ O UTXO foi gasto. Use outro UTXO.

### **Erro: "Invalid SIGHASH"**
→ Use `SIGHASH_SINGLE|ANYONECANPAY (0x83)` no seller.

### **Erro: "Insufficient funds"**
→ Buyer precisa de mais sats nos inputs.

### **Erro: "Output[0] mismatch"**
→ Backend detectou tentativa de alterar payout do seller (bloqueado!).

---

## 💡 DICAS

1. **Testnet primeiro!** Use testnet para testar sem risco.

2. **Valores de teste:**
   - UTXO seller: 10,000 sats
   - Preço: 50,000 sats
   - Taxa marketplace: 1,000 sats (2%)
   - Buyer precisa: ~51,000 + miner fee

3. **Chaves WIF:**
   - Testnet: começa com 'c'
   - Mainnet: começa com '5', 'K' ou 'L'

4. **Backup:**
   - Sempre faça backup das PSBTs assinadas
   - Salve os `order_id` e `attempt_id`

---

## 📞 LOGS

Se precisar debugar, veja os logs do backend:

```bash
tail -f server-live.log
```

---

**BOA SORTE! 🚀🍀**

Qualquer problema, me avise!

