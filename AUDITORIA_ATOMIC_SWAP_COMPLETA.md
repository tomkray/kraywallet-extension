# 🔐 AUDITORIA COMPLETA - ATOMIC SWAP MARKETPLACE

## 📋 RESUMO EXECUTIVO

Analisei todo o código do Atomic Swap comparando com a implementação padrão do ORD CLI e Bitcoin Core.

### STATUS: ⚠️ REQUER CORREÇÕES MENORES

---

## 1️⃣ FLUXO DO ATOMIC SWAP (ANÁLISE)

### PADRÃO ORD CLI / BITCOIN CORE:
```
┌─────────────────────────────────────────────────────────────┐
│                    SIGHASH_SINGLE|ANYONECANPAY (0x83)       │
├─────────────────────────────────────────────────────────────┤
│ O que É ASSINADO pelo seller:                              │
│   • Input[0] - seu UTXO da inscription                     │
│   • Output[0] - seu pagamento                              │
├─────────────────────────────────────────────────────────────┤
│ O que PODE SER ADICIONADO pelo buyer:                      │
│   • Mais inputs (ANYONECANPAY)                             │
│   • Mais outputs após [0] (SINGLE)                         │
└─────────────────────────────────────────────────────────────┘
```

### SEU FLUXO ATUAL:
```
1. POST /api/atomic-swap/       → Cria PSBT template
2. POST /api/atomic-swap/:id/sign → Seller assina com 0x83
3. POST /api/atomic-swap/:id/buy  → Monta PSBT final para buyer
4. POST /api/atomic-swap/:id/broadcast → Valida e broadcast
```

✅ **FLUXO ESTÁ CORRETO** - segue o padrão ORD CLI

---

## 2️⃣ ANÁLISE DO CÓDIGO

### `marketplacePSBT.js - createSellerTemplate()` ✅ CORRETO

```javascript
// Output[0]: Seller Payout (LOCKED BY SIGHASH_SINGLE)
psbt.addOutput({
    address: sellerAddress,
    value: priceSats
});
```

✅ Cria apenas 1 output (seller payout) - CORRETO!
✅ Não adiciona tapInternalKey (deixa para wallet) - CORRETO!
✅ Define sighashType: 0x83 - CORRETO!

### `atomicSwap.js - POST /:id/sign` ✅ CORRETO

```javascript
// Verifica SIGHASH 0x83
if (sig.length === 65) {
    const sighashType = sig[64];
    if (sighashType !== 0x83) {
        return res.status(400).json({ error: 'Invalid SIGHASH' });
    }
}
```

✅ Valida que assinatura usa 0x83

### `atomicSwap.js - POST /:id/buy` ⚠️ TEM PROBLEMA

**PROBLEMA IDENTIFICADO:**

Quando adiciona inputs do buyer (linhas 563-576):
```javascript
for (const utxo of buyer_utxos) {
    completePsbt.addInput({
        hash: txidBuffer,
        index: utxo.vout,
        witnessUtxo: {
            script: scriptPubKey,
            value: utxo.value
        }
        // ⚠️ FALTA tapInternalKey PARA TAPROOT!
    });
}
```

**FIX NECESSÁRIO:** Adicionar tapInternalKey para inputs Taproot do buyer

### `atomicSwap.js - POST /:id/broadcast` ✅ CORRETO

```javascript
// Valida output[0] imutável
if (output0Address !== listing.seller_payout_address) {
    errors.push('SECURITY: Output[0] address was modified!');
}
if (output0.value !== listing.price_sats) {
    errors.push('SECURITY: Output[0] value was modified!');
}
```

---

## 3️⃣ BUGS IDENTIFICADOS

### BUG 1: Inputs Taproot do Buyer sem tapInternalKey ⚠️

**Localização:** `atomicSwap.js` linha 567

**Problema:** 
Quando o buyer tem UTXOs Taproot, precisa de tapInternalKey para assinar.
Atualmente o código não adiciona.

**Fix:**
```javascript
for (const utxo of buyer_utxos) {
    const txidBuffer = Buffer.from(utxo.txid, 'hex').reverse();
    const scriptPubKey = Buffer.from(utxo.scriptPubKey, 'hex');
    
    // DETECTAR TAPROOT E EXTRAIR tapInternalKey
    let tapInternalKey = null;
    if (scriptPubKey.length === 34 && scriptPubKey[0] === 0x51) {
        // ⚠️ NOTA: Isso é OUTPUT KEY (P), não INTERNAL KEY (Q)
        // Para key-path spend, a wallet precisa fornecer Q
        // Por enquanto, deixamos a wallet lidar com isso
    }
    
    completePsbt.addInput({
        hash: txidBuffer,
        index: utxo.vout,
        witnessUtxo: {
            script: scriptPubKey,
            value: utxo.value
        }
        // Wallet irá adicionar tapInternalKey ao assinar
    });
}
```

### BUG 2: Não está passando info de Taproot para wallet ⚠️

**Problema:**
O frontend precisa informar ao wallet quais inputs assinar e com qual sighash.

**Solução atual (linha 646):**
```javascript
inputs_to_sign: buyer_utxos.map((_, i) => i + 1)
```

**Fix melhorado:**
```javascript
inputs_to_sign: buyer_utxos.map((utxo, i) => ({
    index: i + 1,
    sighashTypes: [0x01], // SIGHASH_ALL para buyer
    publicKey: utxo.publicKey || undefined
}))
```

---

## 4️⃣ COMPARAÇÃO COM ORD CLI

### ORD CLI Flow:
```bash
ord wallet create-listing --inscription <id> --price <sats>
# Gera PSBT assinado com SIGHASH_SINGLE|ANYONECANPAY

ord wallet buy --listing <psbt>
# Adiciona inputs de pagamento, outputs, e assina com SIGHASH_ALL
```

### Seu Flow:
```
POST /api/atomic-swap/          ≈ ord wallet create-listing
POST /api/atomic-swap/:id/sign  ≈ (assinatura do seller)
POST /api/atomic-swap/:id/buy   ≈ ord wallet buy (parte 1)
POST /api/atomic-swap/:id/broadcast ≈ ord wallet buy (parte 2)
```

✅ **COMPATÍVEL** com o padrão ORD

---

## 5️⃣ VERIFICAÇÃO DE SEGURANÇA

### ✅ SIGHASH Correto
- Seller: SIGHASH_SINGLE|ANYONECANPAY (0x83)
- Buyer: SIGHASH_ALL (0x01)

### ✅ Validação de Output[0]
- Verifica endereço do seller
- Verifica valor do pagamento
- Impede modificação maliciosa

### ✅ Verificação de UTXO
- Usa QuickNode/Mempool.space para verificar
- Checa se UTXO existe e não foi gasto

### ✅ Consenso Multi-Validator
- 2/3 dos validators precisam aprovar
- Prevenção de double-spend

---

## 6️⃣ CORREÇÕES RECOMENDADAS

### Correção 1: Melhorar handling de Taproot no /buy

```javascript
// atomicSwap.js - linha ~563
for (const utxo of buyer_utxos) {
    const txidBuffer = Buffer.from(utxo.txid, 'hex').reverse();
    const scriptPubKey = Buffer.from(utxo.scriptPubKey, 'hex');
    
    const inputData = {
        hash: txidBuffer,
        index: utxo.vout,
        witnessUtxo: {
            script: scriptPubKey,
            value: utxo.value
        }
    };
    
    // Para Taproot, indicar ao wallet que é key-path spend
    const isTaproot = scriptPubKey.length === 34 && 
                      scriptPubKey[0] === 0x51 && 
                      scriptPubKey[1] === 0x20;
    
    if (isTaproot) {
        // Wallet precisa adicionar tapInternalKey (internal key Q)
        // Não podemos derivar Q do scriptPubKey (só temos P = Q + tweak)
        inputData.sighashType = 0x01; // SIGHASH_ALL
    }
    
    completePsbt.addInput(inputData);
}
```

### Correção 2: Melhorar resposta do /buy

```javascript
res.json({
    // ... outros campos
    inputs_to_sign: buyer_utxos.map((utxo, i) => {
        const scriptPubKey = Buffer.from(utxo.scriptPubKey, 'hex');
        const isTaproot = scriptPubKey.length === 34 && 
                          scriptPubKey[0] === 0x51;
        return {
            index: i + 1,
            sighashTypes: [0x01],
            type: isTaproot ? 'taproot' : 'segwit'
        };
    })
});
```

---

## 7️⃣ TESTE MANUAL RECOMENDADO

### Passo 1: Criar Listing
```bash
curl -X POST https://seu-backend.onrender.com/api/atomic-swap/ \
  -H "Content-Type: application/json" \
  -d '{
    "seller_txid": "SEU_TXID",
    "seller_vout": 0,
    "seller_value": 546,
    "seller_script_pubkey": "5120...",
    "price_sats": 100000,
    "seller_payout_address": "bc1p...",
    "inscription_id": "txidi0"
  }'
```

### Passo 2: Verificar PSBT Template
```javascript
// Decodificar o PSBT retornado
const psbt = bitcoin.Psbt.fromBase64(response.psbt_base64);
console.log('Inputs:', psbt.txInputs.length); // Deve ser 1
console.log('Outputs:', psbt.txOutputs.length); // Deve ser 1
```

### Passo 3: Assinar com Wallet
- Usar UniSat/XVerse/KrayWallet
- Verificar que assina com SIGHASH 0x83

### Passo 4: Verificar Assinatura
```javascript
const signed = bitcoin.Psbt.fromBase64(signedPsbt);
const input = signed.data.inputs[0];
console.log('tapKeySig:', input.tapKeySig?.length); // 64 ou 65 bytes
if (input.tapKeySig?.length === 65) {
    console.log('SIGHASH:', input.tapKeySig[64].toString(16)); // Deve ser 83
}
```

---

## 8️⃣ CONCLUSÃO

### O que está BOM ✅
1. Fluxo geral segue padrão ORD CLI
2. SIGHASH_SINGLE|ANYONECANPAY implementado corretamente
3. Validação de Output[0] para segurança
4. Sistema de consenso para broadcast
5. Verificação de UTXOs

### O que PRECISA AJUSTAR ⚠️
1. Adicionar info de Taproot nos inputs do buyer
2. Melhorar resposta do /buy com info de assinatura
3. Testar com diferentes tipos de wallets

### PRIORIDADE
1. 🔴 Alta: Testar fluxo completo com inscription real
2. 🟡 Média: Aplicar correções de Taproot
3. 🟢 Baixa: Melhorar logs e error handling

---

*Gerado em: ${new Date().toISOString()}*
*Por: KRAY SPACE Analysis*

