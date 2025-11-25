# ✅ CHECKLIST DE TESTE - ATOMIC SWAP

Use este checklist para acompanhar seus testes!

---

## 🔧 PRÉ-TESTE

```
[ ] Backend rodando (npm start)
[ ] Bitcoin Core RPC respondendo
[ ] ORD Server respondendo
[ ] Database existe e migrado
[ ] Tem chaves privadas (WIF) para teste
[ ] Tem UTXOs para teste (seller + buyer)
```

**Verificação rápida:**
```bash
curl http://localhost:3000/api/health
curl http://127.0.0.1:8332 --user bitcoin:bitcoin -d '{"method":"getblockchaininfo"}'
curl http://127.0.0.1:3001/
ls -la server/db/ordinals.db
```

---

## 🎬 FASE 1: SELLER (Criar Listagem)

### **1.1 Criar Template PSBT**

```bash
curl -X POST http://localhost:3000/api/atomic-swap/ \
  -H "Content-Type: application/json" \
  -d '{ ... }' | jq .
```

**Checklist:**
```
[ ] Retornou 200 OK
[ ] Recebeu order_id
[ ] Recebeu template_psbt_base64
[ ] Status: "PENDING_SIGNATURES"
[ ] Salvou order_id e template_psbt
```

---

### **1.2 Assinar PSBT do Seller**

```bash
node sign-seller-psbt.js "$TEMPLATE_PSBT" "$SELLER_WIF"
```

**Checklist:**
```
[ ] Script executou sem erros
[ ] Arquivo signed-seller-psbt.txt criado
[ ] PSBT contém assinatura em input[0]
[ ] SIGHASH: 0x83 (SINGLE|ANYONECANPAY)
[ ] Validação de assinatura passou
```

---

### **1.3 Enviar Assinatura**

```bash
curl -X POST ".../seller-signature" -d '{ ... }' | jq .
```

**Checklist:**
```
[ ] Retornou 200 OK
[ ] ok: true
[ ] status: "OPEN"
[ ] Mensagem: "Listing is now OPEN for buyers"
```

---

## 🛍️ FASE 2: BUYER (Comprar)

### **2.1 Listar Ofertas**

```bash
curl http://localhost:3000/api/atomic-swap/ | jq .
```

**Checklist:**
```
[ ] Lista contém a oferta criada
[ ] status: "OPEN"
[ ] price_sats correto
[ ] market_fee_sats = 2% (mínimo 546)
[ ] total_buyer_pays = price + fee
```

---

### **2.2 Ver Detalhes da Oferta**

```bash
curl http://localhost:3000/api/atomic-swap/$ORDER_ID | jq .
```

**Checklist:**
```
[ ] Retornou detalhes completos
[ ] seller_txid/vout corretos
[ ] price_sats correto
[ ] status: "OPEN"
```

---

### **2.3 Preparar Compra**

```bash
curl -X POST ".../buy/prepare" -d '{ ... }' | jq .
```

**Checklist:**
```
[ ] Retornou 200 OK
[ ] Recebeu attempt_id
[ ] Recebeu psbt_to_sign_base64
[ ] Summary contém:
    [ ] seller_payout (= price_sats)
    [ ] inscription_to_buyer
    [ ] market_fee (2%, min 546)
    [ ] buyer_change
    [ ] miner_fee
    [ ] total_buyer_pays
[ ] Salvou attempt_id e psbt_to_sign
```

---

### **2.4 Assinar PSBT do Buyer**

```bash
node sign-buyer-psbt.js "$BUYER_PSBT_TO_SIGN" "$BUYER_WIF"
```

**Checklist:**
```
[ ] Script executou sem erros
[ ] Arquivo signed-buyer-psbt.txt criado
[ ] Todos inputs do buyer (1+) assinados
[ ] Validação de assinaturas passou
```

---

### **2.5 Finalizar e Broadcast**

```bash
curl -X POST ".../buy/finalize" -d '{ ... }' | jq .
```

**Checklist:**
```
[ ] Retornou 200 OK
[ ] success: true
[ ] Recebeu txid
[ ] status: "BROADCASTED"
[ ] Mensagem de sucesso
```

---

## ✅ FASE 3: VERIFICAÇÃO

### **3.1 Verificar Transação**

```bash
bitcoin-cli getrawtransaction "$TXID" 1
```

**Checklist:**
```
[ ] Transação existe no mempool/blockchain
[ ] Output[0]: seller payout (valor + endereço corretos)
[ ] Output[1]: inscrição → buyer (correto)
[ ] Output[2]: market fee → bc1pe3nvk... (2%, min 546)
[ ] Output[3]: buyer change (se houver)
[ ] Todas assinaturas válidas
```

---

### **3.2 Verificar Database**

```bash
sqlite3 server/db/ordinals.db "SELECT * FROM atomic_listings WHERE order_id = '$ORDER_ID';"
```

**Checklist:**
```
[ ] status: "FILLED"
[ ] filled_at: timestamp preenchido
[ ] txid: txid da transação
```

```bash
sqlite3 server/db/ordinals.db "SELECT * FROM purchase_attempts WHERE order_id = '$ORDER_ID';"
```

**Checklist:**
```
[ ] state: "BROADCASTED"
[ ] final_txid: txid da transação
[ ] buyer_address correto
[ ] Total values corretos
```

---

### **3.3 Verificar Taxa do Marketplace**

```bash
# Ver endereço de taxa
sqlite3 server/db/ordinals.db "SELECT value FROM marketplace_config WHERE key = 'market_fee_address';"
```

**Checklist:**
```
[ ] Endereço: bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2
[ ] Output da transação contém esse endereço
[ ] Valor = 2% do price_sats (mínimo 546)
```

---

### **3.4 Verificar Estatísticas**

```bash
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_stats;"
```

**Checklist:**
```
[ ] total_listings incrementou
[ ] filled_listings incrementou
[ ] total_volume incrementou (+ price_sats)
[ ] total_fees_collected incrementou (+ market_fee)
```

---

## 🔒 FASE 4: TESTES DE SEGURANÇA

### **4.1 Tentar Alterar Output[0]**

**Teste:**
1. No PASSO 2.4, antes de assinar, modifique o PSBT:
   - Altere valor do `output[0]`
   - OU altere endereço do `output[0]`
2. Assine normalmente
3. Envie para `/buy/finalize`

**Resultado esperado:**
```
[ ] Backend rejeita com erro: "Output[0] mismatch"
[ ] Status HTTP: 400
[ ] Transação NÃO é broadcasted
```

---

### **4.2 Tentar Omitir Market Fee**

**Teste:**
1. Modifique o código do backend temporariamente:
   - No `prepareBuyerPSBT()`, comente a criação do `output_market_fee`
2. Prepare compra
3. Assine e finalize

**Resultado esperado:**
```
[ ] Backend rejeita em /buy/finalize
[ ] Erro: "Market fee output missing or invalid"
[ ] Transação NÃO é broadcasted
```

---

### **4.3 Tentar Reutilizar UTXO do Seller**

**Teste:**
1. Crie listagem 1 com UTXO X
2. Complete a compra (UTXO X gasto)
3. Tente criar listagem 2 com o mesmo UTXO X

**Resultado esperado:**
```
[ ] Backend rejeita ao verificar UTXO
[ ] Erro: "UTXO already spent"
[ ] Listagem 2 NÃO é criada
```

---

### **4.4 Tentar SIGHASH Incorreto**

**Teste:**
1. No `sign-seller-psbt.js`, mude o SIGHASH para `ALL` (0x01)
2. Assine e envie

**Resultado esperado:**
```
[ ] Backend rejeita em /seller-signature
[ ] Erro: "Invalid SIGHASH type. Expected SINGLE|ANYONECANPAY (0x83)"
[ ] Listagem NÃO fica OPEN
```

---

## 🎉 RESUMO FINAL

### **Funcionalidades Testadas:**

```
[ ] Criar listagem (seller)
[ ] Assinar com SIGHASH 0x83 (seller)
[ ] Validar assinatura (backend)
[ ] Listar ofertas (buyer)
[ ] Preparar compra (buyer)
[ ] Assinar PSBT (buyer)
[ ] Finalizar e broadcast (backend)
[ ] Verificar transação
[ ] Verificar database
[ ] Verificar taxa 2%
[ ] Verificar estatísticas
```

### **Segurança Testada:**

```
[ ] Output[0] imutável
[ ] Market fee obrigatório (2%, min 546)
[ ] UTXO verification (não gasto)
[ ] SIGHASH validation (0x83)
[ ] Ordinal routing (inscrição → buyer)
```

---

## 📊 SCORE

**Quantos ✅ você marcou?**

- **25-30:** 🏆 Excelente! Tudo funcionando perfeitamente!
- **20-24:** 👍 Muito bom! Alguns ajustes necessários.
- **15-19:** 🔧 Bom progresso, mas precisa de mais testes.
- **10-14:** ⚠️  Revise a implementação, vários pontos falharam.
- **< 10:** ❌ Problemas sérios. Volte ao TUTORIAL_TESTE_ATOMIC_SWAP.md

---

## 🚀 PRÓXIMOS PASSOS

Depois de completar este checklist:

1. **[ ] Testar em Testnet com UTXOs reais**
2. **[ ] Integrar com Kray Wallet Extension**
3. **[ ] Criar UI no Frontend**
4. **[ ] Fazer testes de carga (múltiplas listagens)**
5. **[ ] Testar cenários de race condition**
6. **[ ] Adicionar monitoramento de confirmações**
7. **[ ] Deploy em produção (mainnet)**

---

**BOM TESTE! 🧪**

Marque cada ✅ conforme completa!

