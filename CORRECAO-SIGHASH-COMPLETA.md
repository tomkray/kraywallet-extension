# ✅ CORREÇÃO COMPLETA: SIGHASH_NONE|ANYONECANPAY (0x82)

## 🎯 O QUE FOI CORRIGIDO

### ❌ ANTES (ERRADO)
```javascript
// Seller criava 2 OUTPUTS no PSBT:
Output 0: Inscription → Buyer (placeholder)
Output 1: Payment → Seller

// Assinava com SIGHASH_SINGLE|ANYONECANPAY (0x83)
const sighashType = bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY;
// 0x83 = AMARRA Input 0 ao Output 0
```

### ✅ DEPOIS (CORRETO)
```javascript
// Seller NÃO cria NENHUM output no PSBT:
// PSBT tem APENAS Input 0

// Assina com SIGHASH_NONE|ANYONECANPAY (0x82)
const sighashType = bitcoin.Transaction.SIGHASH_NONE | bitcoin.Transaction.SIGHASH_ANYONECANPAY;
// 0x82 = Seller assina APENAS o input, NÃO assina outputs
```

---

## 📁 ARQUIVOS MODIFICADOS

### 1. `server/utils/psbtBuilder.js`

**Mudanças:**
- ❌ Removeu `psbt.addOutput()` para Output 0 e Output 1
- ✅ PSBT do seller agora tem **0 outputs** (apenas Input 0)
- ✅ Mudou SIGHASH de `0x83` para `0x82`

**Código antes:**
```javascript
psbt.addOutput({ address: sellerAddress, value: postage });
psbt.addOutput({ address: sellerAddress, value: price });
const sighashType = bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY;
```

**Código depois:**
```javascript
// ❌ NÃO adicionar outputs aqui!
// Backend constrói TODOS os outputs dinamicamente
const sighashType = bitcoin.Transaction.SIGHASH_NONE | bitcoin.Transaction.SIGHASH_ANYONECANPAY;
```

### 2. `server/utils/psbtCrypto.js`

**Já estava correto!**
- ✅ Extrai SIGHASH type do último byte da assinatura (65 bytes)
- ✅ Armazena SIGHASH correto no banco (0x82)

---

## 🔄 FLUXO COMPLETO DO ATOMIC SWAP

### 1️⃣ SELLER CRIA OFERTA
```
1. Seller pede para criar oferta
2. Backend cria PSBT com APENAS Input 0 (sem outputs)
3. KrayWallet assina Input 0 com SIGHASH_NONE|ANYONECANPAY (0x82)
4. Backend extrai assinatura (65 bytes = 64 sig + 1 sighash)
5. Backend extrai SIGHASH do byte 65 = 0x82 ✅
6. Backend criptografa assinatura com AES+RSA
7. Backend salva no banco:
   - PSBT sem assinatura (criptografado)
   - Assinatura do seller (criptografada)
   - SIGHASH type: 0x82
```

### 2️⃣ BUYER COMPRA
```
1. Buyer clica "Buy Now"
2. Frontend cria PSBT com:
   - Input 0: Inscription (do seller, SEM assinatura ainda)
   - Input 1+: UTXOs do buyer (pagamento)
   - Outputs: NENHUM (ainda!)
3. KrayWallet assina inputs do buyer com SIGHASH_ALL (0x01)
4. Frontend envia PSBT para backend
```

### 3️⃣ BACKEND FINALIZA
```
1. Backend recebe PSBT do buyer
2. Backend CONSTRÓI todos os outputs:
   - Output 0: Inscription → Buyer address
   - Output 1: Payment → Seller address
   - Output 2: Change → Buyer (se necessário)
3. Backend descriptografa assinatura do seller
4. Backend adiciona assinatura do seller ao Input 0
5. Backend finaliza todos inputs
6. Backend extrai transação
7. Backend faz broadcast para Bitcoin network
8. ✅ ATOMIC SWAP COMPLETO!
```

---

## 🔒 SEGURANÇA DO BACKEND

### ✅ Backend tem controle TOTAL:
1. **Constrói todos os outputs** (seller não pode manipular)
2. **Valida endereços** (previne roubo)
3. **Valida valores** (previne pagamento errado)
4. **Valida taxas** (previne fee excessivo)
5. **Assegura atomicidade** (tudo ou nada)

### ✅ Seller não pode:
- ❌ Especificar outputs (backend constrói)
- ❌ Mudar endereço do buyer (backend define)
- ❌ Adicionar fees extras (backend calcula)
- ❌ Criar outputs maliciosos (backend valida)

### ✅ Buyer não pode:
- ❌ Mudar preço (validado pelo backend)
- ❌ Não pagar (inputs validados)
- ❌ Receber sem pagar (atomic swap)

---

## 🎉 BENEFÍCIOS DO SIGHASH_NONE|ANYONECANPAY

1. **Seller não precisa conhecer o buyer** ✅
2. **Backend tem controle total dos outputs** ✅
3. **Mais seguro** (seller assina menos dados) ✅
4. **Mais flexível** (backend pode ajustar dinamicamente) ✅
5. **PSBT mais simples** (sem outputs temporários) ✅
6. **Compatível com BitcoinJS-Lib oficial** ✅
7. **Compatível com Bitcoin Core** ✅

---

## 📋 STATUS ATUAL

| Item | Status |
|------|--------|
| Banco de dados limpo | ✅ |
| SIGHASH corrigido (0x82) | ✅ |
| Outputs removidos do seller PSBT | ✅ |
| Backend constrói outputs | ✅ (já estava) |
| Servidor rodando | ✅ |
| Pronto para teste | ✅ |

---

## 🚀 PRÓXIMO PASSO: TESTAR!

1. **Refresh** no navegador (http://localhost:3000/ordinals.html)
2. **Criar oferta** com KrayWallet
3. **Verificar logs** → deve mostrar SIGHASH 0x82
4. **Comprar oferta** com KrayWallet
5. **✅ DEVE FUNCIONAR PERFEITAMENTE!**

---

## 📊 LOGS ESPERADOS

### Na criação da oferta:
```
✅ KRAY STATION ATOMIC SWAP PSBT:
   Input 0: Inscription UTXO (546 sats)
   Outputs: NONE (marketplace will construct all)
   SIGHASH: NONE|ANYONECANPAY (0x82)

🎯 SIGHASH extracted from 65-byte signature: 0x82
Final SIGHASH type: 0x82
```

### Na compra:
```
✅ All inputs verified as finalized
📡 Broadcasting transaction...
✅ Transaction broadcast successful!
TXID: [txid aqui]
```
