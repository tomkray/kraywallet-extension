# 🧪 TUTORIAL: TESTE COMPLETO DO ATOMIC SWAP

**Data:** 2025-11-01  
**Implementação:** SIGHASH_SINGLE|ANYONECANPAY (0x83)  
**Marketplace:** Treasure Marketplace (2% fee)

---

## 📋 PRÉ-REQUISITOS

Antes de começar, verifique:

```bash
# 1. Bitcoin Core RPC rodando
curl --user bitcoin:bitcoin \
  --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}' \
  http://127.0.0.1:8332

# 2. ORD Server rodando
curl http://127.0.0.1:3001/

# 3. Backend rodando
curl http://localhost:3000/api/health

# 4. Verificar marketplace config
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_config;"
```

**Se algum não estiver rodando, inicie antes de continuar!**

---

## 🎬 FLUXO COMPLETO DO TESTE

```
┌─────────────────┐
│  1. SELLER      │  → Criar listagem + Assinar PSBT
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. BACKEND     │  → Validar assinatura do seller
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. BUYER       │  → Preparar compra + Assinar PSBT
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. BACKEND     │  → Finalizar + Broadcast TX
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ✅ SUCESSO     │  → TXID confirmado
└─────────────────┘
```

---

## 🔧 PASSO 1: PREPARAR DADOS DO SELLER

### 1.1 Você precisa ter:

```
✅ Um UTXO do seller com uma inscrição
✅ O endereço do seller para receber pagamento
✅ O preço em sats
```

### 1.2 Formato dos dados:

```json
{
  "seller_txid": "abc123...def",
  "seller_vout": 0,
  "seller_value": 10000,
  "price_sats": 50000,
  "seller_payout_address": "bc1q..."
}
```

### 1.3 Exemplo real (ADAPTE OS SEUS DADOS):

```bash
# Defina suas variáveis
export SELLER_TXID="0000000000000000000000000000000000000000000000000000000000000001"
export SELLER_VOUT="0"
export SELLER_VALUE="10000"
export PRICE_SATS="50000"
export SELLER_PAYOUT_ADDRESS="bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
```

---

## 🚀 PASSO 2: SELLER CRIA A LISTAGEM

### 2.1 Criar Template PSBT

```bash
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

### 2.2 Resposta esperada:

```json
{
  "order_id": "abc123-def456-...",
  "template_psbt_base64": "cHNidP8BAF...",
  "message": "Template PSBT created. Seller must sign input[0] with SIGHASH_SINGLE|ANYONECANPAY (0x83)"
}
```

### 2.3 Salvar o order_id e template_psbt:

```bash
# Copie da resposta acima
export ORDER_ID="abc123-def456-..."
export TEMPLATE_PSBT="cHNidP8BAF..."
```

---

## ✍️ PASSO 3: SELLER ASSINA A PSBT

### 3.1 OPÇÃO A: Usando Bitcoin Core CLI

```bash
# Decodificar PSBT para ver conteúdo
bitcoin-cli decodepsbt "$TEMPLATE_PSBT"

# Assinar com wallet (IMPORTANTE: usar SIGHASH 0x83)
# ⚠️ Bitcoin Core não suporta SIGHASH customizado facilmente via CLI
# Você precisará usar a extension ou script Node.js
```

### 3.2 OPÇÃO B: Usando Node.js Script (RECOMENDADO)

Crie o arquivo `sign-seller-psbt.js`:

```javascript
import bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet; // ou bitcoin.networks.bitcoin

// 🔑 CHAVE PRIVADA DO SELLER (WIF format)
const sellerWIF = 'cT1...your-private-key...';
const keyPair = ECPair.fromWIF(sellerWIF, network);

// 📄 PSBT do template (da resposta do passo 2)
const templatePsbtBase64 = process.argv[2];
const psbt = bitcoin.Psbt.fromBase64(templatePsbtBase64, { network });

console.log('\n🔐 Assinando input[0] com SIGHASH_SINGLE|ANYONECANPAY (0x83)...\n');

// 🖊️ ASSINAR com SIGHASH 0x83
psbt.signInput(0, keyPair, [
    bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY
]);

// ✅ Validar assinatura
psbt.validateSignaturesOfInput(0, () => true);

const signedPsbt = psbt.toBase64();
console.log('✅ PSBT assinada!\n');
console.log('Signed PSBT Base64:');
console.log(signedPsbt);
console.log('\n');

// Salvar em arquivo
import fs from 'fs';
fs.writeFileSync('signed-seller-psbt.txt', signedPsbt);
console.log('💾 Salvo em: signed-seller-psbt.txt\n');
```

Execute:

```bash
node sign-seller-psbt.js "$TEMPLATE_PSBT"
```

### 3.3 Salvar a PSBT assinada:

```bash
export SIGNED_SELLER_PSBT=$(cat signed-seller-psbt.txt)
```

---

## 📤 PASSO 4: ENVIAR ASSINATURA DO SELLER

```bash
curl -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/seller-signature" \
  -H "Content-Type: application/json" \
  -d "{
    \"listing_psbt_base64\": \"$SIGNED_SELLER_PSBT\"
  }" | jq .
```

### 4.1 Resposta esperada:

```json
{
  "ok": true,
  "order_id": "abc123-def456-...",
  "status": "OPEN",
  "message": "Listing is now OPEN for buyers"
}
```

---

## 🛍️ PASSO 5: BUYER LISTA OFERTAS

```bash
curl http://localhost:3000/api/atomic-swap/ | jq .
```

### 5.1 Resposta esperada:

```json
[
  {
    "order_id": "abc123-def456-...",
    "price_sats": 50000,
    "market_fee_sats": 1000,
    "total_buyer_pays": 51000,
    "status": "OPEN",
    "created_at": 1730505600,
    "seller_txid": "0000...0001",
    "seller_vout": 0
  }
]
```

### 5.2 Ver detalhes de uma oferta:

```bash
curl "http://localhost:3000/api/atomic-swap/$ORDER_ID" | jq .
```

---

## 💰 PASSO 6: BUYER PREPARA A COMPRA

### 6.1 Você precisa ter:

```
✅ Endereço do buyer para receber inscrição
✅ Endereço do buyer para troco
✅ UTXOs do buyer para pagar (inputs)
```

### 6.2 Exemplo de dados do buyer:

```bash
export BUYER_ADDRESS="bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el"
export BUYER_CHANGE_ADDRESS="bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el"
```

### 6.3 Formato dos inputs do buyer:

```json
{
  "buyer_address": "bc1q...",
  "buyer_change_address": "bc1q...",
  "buyer_inputs": [
    {
      "txid": "xyz789...",
      "vout": 0,
      "value": 100000,
      "script_pubkey": "0014..."
    }
  ]
}
```

### 6.4 Preparar a compra:

```bash
curl -X POST "http://localhost:3000/api/atomic-swap/$ORDER_ID/buy/prepare" \
  -H "Content-Type: application/json" \
  -d "{
    \"buyer_address\": \"$BUYER_ADDRESS\",
    \"buyer_change_address\": \"$BUYER_CHANGE_ADDRESS\",
    \"buyer_inputs\": [
      {
        \"txid\": \"xyz789abc...\",
        \"vout\": 0,
        \"value\": 100000,
        \"script_pubkey\": \"0014...\"
      }
    ]
  }" | jq .
```

### 6.5 Resposta esperada:

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

### 6.6 Salvar:

```bash
export ATTEMPT_ID="xyz-123-abc"
export BUYER_PSBT_TO_SIGN="cHNidP8BAFUCA..."
```

---

## ✍️ PASSO 7: BUYER ASSINA A PSBT

### 7.1 Script Node.js para assinar (crie `sign-buyer-psbt.js`):

```javascript
import bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

// 🔑 CHAVE PRIVADA DO BUYER
const buyerWIF = 'cT1...buyer-private-key...';
const keyPair = ECPair.fromWIF(buyerWIF, network);

// 📄 PSBT do prepare (da resposta do passo 6)
const buyerPsbtBase64 = process.argv[2];
const psbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64, { network });

console.log('\n🔐 Buyer assinando seus inputs (1+)...\n');

// 🖊️ ASSINAR todos os inputs do buyer (normalmente input[1] em diante)
// Input[0] já está assinado pelo seller
for (let i = 1; i < psbt.data.inputs.length; i++) {
    console.log(`   Assinando input[${i}]...`);
    psbt.signInput(i, keyPair); // SIGHASH_ALL padrão
    psbt.validateSignaturesOfInput(i, () => true);
}

const signedPsbt = psbt.toBase64();
console.log('\n✅ Buyer PSBT assinada!\n');
console.log('Signed PSBT Base64:');
console.log(signedPsbt);

import fs from 'fs';
fs.writeFileSync('signed-buyer-psbt.txt', signedPsbt);
console.log('\n💾 Salvo em: signed-buyer-psbt.txt\n');
```

Execute:

```bash
node sign-buyer-psbt.js "$BUYER_PSBT_TO_SIGN"
```

### 7.2 Salvar:

```bash
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

### 8.1 Resposta esperada (SUCESSO!):

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

## ✅ PASSO 9: VERIFICAR A TRANSAÇÃO

### 9.1 No Bitcoin Core:

```bash
bitcoin-cli getrawtransaction "a1b2c3d4e5f6..." 1
```

### 9.2 Verificar no banco de dados:

```bash
sqlite3 server/db/ordinals.db "SELECT * FROM atomic_listings WHERE order_id = '$ORDER_ID';"
sqlite3 server/db/ordinals.db "SELECT * FROM purchase_attempts WHERE order_id = '$ORDER_ID';"
```

### 9.3 Ver no mempool/blockchain:

```bash
# Se testnet
https://mempool.space/testnet/tx/a1b2c3d4e5f6...

# Se mainnet
https://mempool.space/tx/a1b2c3d4e5f6...
```

---

## 🎉 SUCESSO! VOCÊ COMPLETOU UM ATOMIC SWAP!

### Resumo do que aconteceu:

1. ✅ Seller criou listagem e assinou com `SIGHASH_SINGLE|ANYONECANPAY (0x83)`
2. ✅ Backend validou e marcou como `OPEN`
3. ✅ Buyer preparou compra (adicionou inputs + outputs)
4. ✅ Buyer assinou seus inputs
5. ✅ Backend finalizou PSBT e fez broadcast
6. ✅ Transação confirmada na blockchain!

### Validações que funcionaram:

- ✅ `output[0]` permaneceu imutável (seller payout)
- ✅ Market fee 2% foi cobrado (mínimo 546 sats)
- ✅ Inscrição foi roteada corretamente para o buyer
- ✅ Seller não pode mudar o preço
- ✅ Buyer não pode alterar payout do seller

---

## 🐛 TROUBLESHOOTING

### Erro: "UTXO already spent"
```
Solução: O UTXO do seller foi gasto. Escolha outro UTXO.
```

### Erro: "Invalid SIGHASH"
```
Solução: Certifique-se de usar 0x83 (SIGHASH_SINGLE|ANYONECANPAY) no input do seller.
```

### Erro: "Output[0] mismatch"
```
Solução: Alguém tentou alterar o payout do seller. Isso é bloqueado automaticamente.
```

### Erro: "Insufficient funds"
```
Solução: Buyer precisa ter UTXOs suficientes para cobrir:
  - Preço do seller
  - Market fee (2%)
  - Miner fee
```

### Erro: "Dust limit"
```
Solução: Todos os outputs devem ser >= 546 sats.
```

---

## 📊 VERIFICAR ESTATÍSTICAS DO MARKETPLACE

```bash
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_stats;"
```

Retorna:

```
total_listings|3
open_listings|1
filled_listings|1
cancelled_listings|1
total_volume|150000
total_fees_collected|3000
```

---

## 🎯 PRÓXIMO TESTE RECOMENDADO

### Teste de Segurança: Tentar Fraude

1. No PASSO 7, **antes** de assinar, tente modificar a PSBT:
   - Alterar valor do `output[0]`
   - Trocar endereço do `output[0]`
   - Remover `output_market_fee`

2. Enviar para `/buy/finalize`

3. **Resultado esperado:** ❌ Backend rejeita com erro de validação

---

## 📞 SUPORTE

Se tiver problemas:

1. Verifique logs do backend: `console` no terminal do servidor
2. Verifique database: `sqlite3 server/db/ordinals.db`
3. Teste APIs individualmente com cURL
4. Verifique se Bitcoin RPC e ORD server estão rodando

---

## 🚀 READY TO TEST!

**Comece pelo PASSO 1 e siga em ordem!**

Boa sorte! 🍀

