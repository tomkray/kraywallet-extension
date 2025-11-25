# ✅ CHECKLIST DE VERIFICAÇÃO - ORD + KRAYWALLET

## 🎯 OBJETIVO
Garantir que tanto ORD CLI quanto KrayWallet funcionem perfeitamente para criar e comprar ofertas.

---

## 📋 ESTRUTURA ESPERADA DO PSBT

### 🔹 SELLER PSBT (ORD-Compatible):
```
Input 0:  Inscription UTXO
Output 0: Inscription → Buyer (546 sats) [placeholder]
Output 1: Payment → Seller (price + 546 sats)
```

### 🔹 BUYER PSBT (Final):
```
Input 0:  Inscription UTXO (seller) ✅ SIGNED
Input 1+: Payment UTXOs (buyer) ✅ TO BE SIGNED
Output 0: Inscription → Buyer (546 sats)
Output 1: Payment → Seller (price + 546 sats)
Output 2: Service Fee → Kray (1% se ORD CLI) [opcional]
Output 3: Change → Buyer [opcional]
```

---

## ✅ ROTAS A VERIFICAR

### 1️⃣ `/api/psbt/sell` (Criar PSBT do Seller)
**Status:** ✅ ATUALIZADO (2 outputs)
**Arquivo:** `server/utils/psbtBuilder.js` → `createCustomSellPsbt()`
**Verificar:**
- [x] Cria Input 0 (Inscription UTXO)
- [x] Cria Output 0 (Inscription → Buyer, 546 sats)
- [x] Cria Output 1 (Payment → Seller, price + 546)
- [x] `postage` = `inscriptionUtxo.value` (546 sats)
- [x] Total de outputs = **2** (não 1!)

**Código Atual:**
```javascript
// Output 0: Inscription → BUYER
const postage = inscriptionUtxo.value; // 546 sats
psbt.addOutput({
    address: buyerAddress || sellerAddress,  // Placeholder
    value: postage
});

// Output 1: Payment → SELLER
psbt.addOutput({
    address: sellerAddress,
    value: price + postage  // Preço + postage
});
```

---

### 2️⃣ `/api/purchase/build-atomic-psbt` (Buyer Completa PSBT)
**Status:** ⚠️ PRECISA VERIFICAR
**Arquivo:** `server/routes/purchase.js`
**Verificar:**
- [ ] Lê PSBT do seller com **2 outputs**
- [ ] Output 0 do seller = Inscription → Placeholder (546 sats)
- [ ] Output 1 do seller = Payment → Seller (price + 546)
- [ ] Buyer **NÃO** modifica Output 1 (payment protegido!)
- [ ] Buyer adiciona Output 2 (service fee, se ORD CLI)
- [ ] Buyer adiciona Output 3 (change)

**Código Atual (Linha ~200):**
```javascript
// ❌ PROBLEMA: Código atual assume 1 output
// ⚠️ PRECISA ATUALIZAR para lidar com 2 outputs!
```

**Código Esperado:**
```javascript
// ✅ CORRETO: Reconhecer 2 outputs do seller
if (psbtFromSeller.txOutputs.length !== 2) {
    throw new Error('Seller PSBT should have exactly 2 outputs (ORD-compatible)');
}

// Output 0 → Inscription → Buyer (já existe, SUBSTITUIR endereco)
// Output 1 → Payment → Seller (já existe, MANTER!)
// Buyer adiciona:
// Output 2 → Service Fee (se ORD CLI)
// Output 3 → Change
```

---

### 3️⃣ `/api/offers` (Salvar Oferta no Banco)
**Status:** ✅ OK
**Arquivo:** `server/routes/offers.js`
**Verificar:**
- [x] Salva `offer_amount` correto (price, não price + postage)
- [x] Salva `sighashType` (para referência)
- [x] Salva `source` (kraywallet ou ord-cli)
- [x] Salva `service_fee_percentage` (0% ou 1%)

---

### 4️⃣ `/api/ord-offers/submit-psbt` (ORD CLI Externo)
**Status:** ✅ OK
**Arquivo:** `server/routes/ord-offers.js`
**Verificar:**
- [x] Valida PSBT com **2 outputs**
- [x] Extrai seller address
- [x] Calcula service fee (1%)
- [x] Salva no banco com `source: 'ord-cli'`

---

## 🔬 TESTES A FAZER

### Teste 1: ORD CLI → Criar Oferta
```bash
# 1. Criar oferta via ORD CLI
ord wallet offer create 55a082d4...i0 50000

# 2. Copiar PSBT gerado
# 3. Submeter via API
curl -X POST http://localhost:3000/api/ord-offers/submit-psbt \
  -H "Content-Type: application/json" \
  -d '{
    "psbt": "cHNidP8BAH...",
    "inscriptionId": "55a082d4...i0",
    "price": 50000
  }'

# 4. Verificar no marketplace (ordinals.html)
# ✅ Oferta aparece com borda LARANJA (1% fee)
```

### Teste 2: KrayWallet → Criar Oferta
```javascript
// 1. Conectar KrayWallet
// 2. Clicar em "List for Sale" (botão VERDE - 0% fee)
// 3. Inserir preço: 50000 sats
// 4. Assinar PSBT
// 5. Verificar no marketplace
// ✅ Oferta aparece com borda VERDE (0% fee)
```

### Teste 3: Comprar Oferta (ORD CLI)
```javascript
// 1. Conectar wallet (qualquer)
// 2. Clicar "Buy Now" em oferta ORD CLI (laranja)
// 3. Confirmar fee
// 4. Assinar transação
// 5. Verificar broadcast
// ✅ Output 2 = Service Fee → Kray Station (1%)
```

### Teste 4: Comprar Oferta (KrayWallet)
```javascript
// 1. Conectar wallet (qualquer)
// 2. Clicar "Buy Now" em oferta KrayWallet (verde)
// 3. Confirmar fee
// 4. Assinar transação
// 5. Verificar broadcast
// ✅ Sem service fee (0%)
```

---

## 🚨 ATENÇÃO: MUDANÇA CRÍTICA

### ❌ ANTES (ERRADO):
```javascript
// Seller PSBT tinha apenas 1 output
psbt.addOutput({
    address: sellerAddress,
    value: price  // Pagamento
});
// Total: 1 output
```

### ✅ AGORA (CORRETO - Como ORD):
```javascript
// Seller PSBT tem 2 outputs
psbt.addOutput({
    address: buyerAddress || sellerAddress,
    value: postage  // 546 sats (inscription)
});
psbt.addOutput({
    address: sellerAddress,
    value: price + postage  // Pagamento total
});
// Total: 2 outputs
```

---

## 📝 PRÓXIMOS PASSOS

1. [ ] Verificar `purchase.js` linha ~200-300
2. [ ] Atualizar lógica para reconhecer 2 outputs
3. [ ] Testar ORD CLI → Criar → Comprar
4. [ ] Testar KrayWallet → Criar → Comprar
5. [ ] Verificar service fee aplicado corretamente
6. [ ] Validar broadcast final

---

## 🎯 CRITÉRIO DE SUCESSO

✅ ORD CLI cria oferta com 2 outputs  
✅ KrayWallet cria oferta com 2 outputs  
✅ Buyer completa PSBT corretamente  
✅ Service fee aplicado (1% ORD, 0% KrayWallet)  
✅ Broadcast bem-sucedido  
✅ Inscription transferida corretamente  

---

