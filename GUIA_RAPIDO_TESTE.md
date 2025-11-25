# 🚀 GUIA RÁPIDO: TESTAR ATOMIC SWAP

**Última atualização:** 2025-11-01  
**Tempo estimado:** 10-15 minutos

---

## 🎯 O QUE VOCÊ VAI FAZER

Testar o fluxo completo do Atomic Swap:
1. **Seller** cria listagem → assina com `SIGHASH 0x83`
2. **Backend** valida → marca como `OPEN`
3. **Buyer** prepara compra → assina
4. **Backend** finaliza → broadcast na blockchain

---

## ⚡ OPÇÃO 1: TESTE AUTOMATIZADO (DEMONSTRAÇÃO)

Execute o script de teste:

```bash
./test-atomic-swap-complete.sh
```

**O que faz:**
- ✅ Verifica pré-requisitos (backend, RPC, ORD, DB)
- ✅ Cria listagem de teste
- ✅ Lista ofertas
- ✅ Mostra estatísticas
- ⚠️  **NÃO assina** (precisa de chaves privadas reais)

**Resultado:**
```
✅ Listagem criada: abc123-def456-...
⚠️  Status: PENDING_SIGNATURES (esperando assinatura do seller)
```

---

## 🔧 OPÇÃO 2: TESTE MANUAL COMPLETO (REAL)

### **PRÉ-REQUISITOS:**

```bash
# 1. Backend rodando
npm start

# 2. Bitcoin Core RPC rodando
bitcoin-cli getblockchaininfo

# 3. ORD Server rodando
curl http://127.0.0.1:3001/

# 4. Ter chaves privadas (WIF) do seller e buyer
```

---

### **PASSO A PASSO:**

#### **1️⃣ Criar Listagem**

```bash
# Defina suas variáveis
export SELLER_TXID="abc123...seu-txid"
export SELLER_VOUT="0"
export SELLER_VALUE="10000"
export PRICE_SATS="50000"
export SELLER_PAYOUT_ADDRESS="bc1q...seu-endereço"

# Crie a listagem
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

**Salve da resposta:**
```bash
export ORDER_ID="abc123-def456-..."
export TEMPLATE_PSBT="cHNidP8BAF..."
```

---

#### **2️⃣ Assinar PSBT do Seller**

```bash
# Sua chave privada (WIF format)
export SELLER_WIF="cT1...sua-chave-privada..."

# Assinar
node sign-seller-psbt.js "$TEMPLATE_PSBT" "$SELLER_WIF"

# Arquivo criado: signed-seller-psbt.txt
export SIGNED_SELLER_PSBT=$(cat signed-seller-psbt.txt)
```

---

#### **3️⃣ Enviar Assinatura do Seller**

```bash
curl -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/seller-signature" \
  -H "Content-Type: application/json" \
  -d "{
    \"listing_psbt_base64\": \"$SIGNED_SELLER_PSBT\"
  }" | jq .
```

**Resposta esperada:**
```json
{
  "ok": true,
  "status": "OPEN",
  "message": "Listing is now OPEN for buyers"
}
```

---

#### **4️⃣ Listar Ofertas (Buyer)**

```bash
curl http://localhost:3000/api/atomic-swap/ | jq .
```

---

#### **5️⃣ Preparar Compra (Buyer)**

```bash
# Dados do buyer
export BUYER_ADDRESS="bc1q...buyer-address"
export BUYER_CHANGE_ADDRESS="bc1q...buyer-change"

# Preparar compra
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

**Salve da resposta:**
```bash
export ATTEMPT_ID="xyz-123-abc"
export BUYER_PSBT_TO_SIGN="cHNidP8BAFUCA..."
```

---

#### **6️⃣ Assinar PSBT do Buyer**

```bash
# Chave privada do buyer
export BUYER_WIF="cT1...buyer-wif..."

# Assinar
node sign-buyer-psbt.js "$BUYER_PSBT_TO_SIGN" "$BUYER_WIF"

# Arquivo criado: signed-buyer-psbt.txt
export SIGNED_BUYER_PSBT=$(cat signed-buyer-psbt.txt)
```

---

#### **7️⃣ Finalizar e Broadcast**

```bash
curl -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/buy/finalize" \
  -H "Content-Type: application/json" \
  -d "{
    \"attempt_id\": \"$ATTEMPT_ID\",
    \"psbt_signed_by_buyer_base64\": \"$SIGNED_BUYER_PSBT\"
  }" | jq .
```

**Resposta esperada (SUCESSO!):**
```json
{
  "success": true,
  "txid": "a1b2c3d4e5f6...",
  "status": "BROADCASTED",
  "message": "Transaction broadcasted successfully!"
}
```

---

#### **8️⃣ Verificar Transação**

```bash
# Ver no Bitcoin Core
bitcoin-cli getrawtransaction "a1b2c3d4e5f6..." 1

# Ver no database
sqlite3 server/db/ordinals.db "SELECT * FROM atomic_listings WHERE order_id = '$ORDER_ID';"

# Ver no Mempool.space
# https://mempool.space/testnet/tx/a1b2c3d4e5f6...
```

---

## 🎉 SUCESSO!

Se você chegou até aqui:

✅ **Seller** recebeu `50,000 sats` no endereço dele  
✅ **Buyer** recebeu a inscrição  
✅ **Marketplace** recebeu `1,000 sats` (2%) em:  
   `bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2`

---

## 🔍 VERIFICAÇÕES DE SEGURANÇA

### **O que NÃO é possível fazer:**

❌ Buyer alterar o payout do seller  
❌ Buyer pagar menos que o preço  
❌ Buyer roubar a inscrição sem pagar  
❌ Seller gastar o UTXO e manter a listagem aberta  
❌ Omitir a taxa de 2% do marketplace  

**Por quê?**  
→ `SIGHASH_SINGLE|ANYONECANPAY (0x83)` trava o `output[0]` do seller  
→ Backend valida tudo antes de broadcast  

---

## 📊 ESTATÍSTICAS DO MARKETPLACE

```bash
# Ver stats
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_stats;"

# Ver listagens ativas
sqlite3 server/db/ordinals.db "SELECT * FROM active_listings;"

# Ver todas as tentativas de compra
sqlite3 server/db/ordinals.db "SELECT * FROM purchase_attempts;"
```

---

## 🐛 TROUBLESHOOTING

### **"UTXO already spent"**
→ O UTXO do seller foi gasto. Use outro UTXO.

### **"Invalid SIGHASH"**
→ Certifique-se de usar `0x83` no seller (`sign-seller-psbt.js`).

### **"Output[0] mismatch"**
→ Alguém tentou alterar o payout. Isso é bloqueado.

### **"Insufficient funds"**
→ Buyer precisa ter UTXOs suficientes para:
- Preço do seller
- Market fee (2%)
- Miner fee

### **Backend não responde**
```bash
# Verificar se está rodando
curl http://localhost:3000/api/health

# Se não, iniciar:
npm start
```

---

## 📚 DOCUMENTAÇÃO COMPLETA

Para tutorial detalhado passo a passo com explicações:
→ **`TUTORIAL_TESTE_ATOMIC_SWAP.md`**

Para verificação final da implementação:
→ **`FINAL_STATUS.md`**

---

## 🎯 PRÓXIMOS PASSOS

Depois de testar via scripts:

1. **Integrar Extension** (Kray Wallet)
   - Adicionar suporte para `SIGHASH 0x83`
   - Criar UI para assinar PSBTs

2. **Integrar Frontend** (Marketplace)
   - UI para criar listagens (seller)
   - UI para comprar (buyer)

3. **Testes em Testnet**
   - Com UTXOs reais
   - Verificar confirmações

---

**PRONTO PARA TESTAR! 🚀**

Execute:
```bash
./test-atomic-swap-complete.sh
```

Ou siga o passo a passo manual para teste completo!

