# 🎯 NOVA ARQUITETURA: Como Marketplaces REAIS Funcionam

## ❌ O que estávamos fazendo ERRADO:

1. Vendedor **pré-assina** um PSBT
2. Comprador tenta adicionar inputs ao PSBT já assinado
3. **PROBLEMA**: Unisat assina com `SIGHASH_ALL` (padrão), que TRAVA todos outputs
4. Quando comprador adiciona outputs, a assinatura do vendedor fica **inválida**

---

## ✅ Como marketplaces REAIS (Magic Eden, Unisat) funcionam:

### Fluxo Correto:

#### 1. **VENDEDOR CRIA LISTING** (SEM ASSINAR!)
```javascript
// Vendedor apenas registra no banco de dados:
{
  inscription_id: "abc123i0",
  price: 1000,
  seller_address: "bc1p...",
  utxo: { txid, vout, value, scriptPubKey }
}
// ⚠️ SEM PSBT! SEM ASSINATURA!
```

#### 2. **COMPRADOR CLICA "BUY NOW"**
Backend cria PSBT COMPLETO:
```javascript
// PSBT COMPLETO (não assinado):
Input 0:  Inscription UTXO (vendedor) - SEM ASSINATURA
Input 1:  Payment UTXO (comprador)    - SEM ASSINATURA
Input 2:  Payment UTXO (comprador)    - SEM ASSINATURA

Output 0: Pagamento → Vendedor (1000 sats)
Output 1: Inscription → Comprador (546 sats)
Output 2: Change → Comprador (resto)
```

#### 3. **COMPRADOR ASSINA PRIMEIRO**
```javascript
// Unisat assina APENAS inputs do comprador (1, 2)
const signedPsbt = await unisat.signPsbt(psbt, {
  autoFinalized: false,
  toSignInputs: [
    { index: 1, publicKey: buyerPubKey },
    { index: 2, publicKey: buyerPubKey }
  ]
});
```

#### 4. **VENDEDOR ASSINA DEPOIS**
Frontend envia PSBT para o vendedor:
```javascript
// Vendedor assina APENAS seu input (0)
const fullySignedPsbt = await unisat.signPsbt(psbtWithBuyerSigs, {
  autoFinalized: false,
  toSignInputs: [
    { index: 0, publicKey: sellerPubKey }
  ]
});
```

#### 5. **BROADCAST**
Agora o PSBT tem TODAS as assinaturas:
```javascript
const finalizedPsbt = await backend.finalize(fullySignedPsbt);
const txid = await backend.broadcast(finalizedPsbt);
```

---

## 🔧 Mudanças Necessárias:

### 1. **Frontend: `createOffer()` não assina mais**
```javascript
// ANTES (ERRADO):
const signedPsbt = await unisat.signPsbt(psbt);
await saveOffer({ psbt: signedPsbt });

// DEPOIS (CORRETO):
await saveOffer({ 
  inscription_id,
  price,
  seller_address,
  utxo: { txid, vout, value }
  // SEM PSBT!
});
```

### 2. **Frontend: `buyNow()` coordena assinaturas**
```javascript
// 1. Criar PSBT completo no backend
const { psbt } = await backend.createAtomicPsbt({
  offer_id,
  buyer_address,
  buyer_utxos,
  fee_rate
});

// 2. Comprador assina seus inputs
const psbtWithBuyerSig = await unisat.signPsbt(psbt, {
  toSignInputs: [1, 2, ...] // Apenas inputs do comprador
});

// 3. Pedir vendedor assinar
showNotification("Waiting for seller to sign...");
const psbtWithAllSigs = await requestSellerSignature(psbtWithBuyerSig);

// 4. Finalizar e broadcast
const txid = await backend.finalizeAndBroadcast(psbtWithAllSigs);
```

### 3. **Backend: Novo endpoint `/purchase/create-complete-psbt`**
```javascript
router.post('/create-complete-psbt', async (req, res) => {
  const { offerId, buyerAddress, buyerUtxos, feeRate } = req.body;
  
  // 1. Buscar oferta no banco
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offerId);
  
  // 2. Criar PSBT COMPLETO (sem assinaturas)
  const psbt = new bitcoin.Psbt({ network });
  
  // Input 0: Inscription do vendedor
  psbt.addInput({
    hash: offer.utxo.txid,
    index: offer.utxo.vout,
    witnessUtxo: { ... },
    tapInternalKey: ...
  });
  
  // Input 1+: UTXOs do comprador
  for (const utxo of buyerUtxos) {
    psbt.addInput({ ... });
  }
  
  // Output 0: Pagamento para vendedor
  psbt.addOutput({
    address: offer.seller_address,
    value: offer.price
  });
  
  // Output 1: Inscription para comprador
  psbt.addOutput({
    address: buyerAddress,
    value: offer.utxo.value
  });
  
  // Output 2: Change para comprador
  psbt.addOutput({
    address: buyerAddress,
    value: change
  });
  
  return res.json({ psbt: psbt.toBase64() });
});
```

---

## 🎯 Vantagens desta Arquitetura:

1. ✅ **Compatível com Unisat/Xverse** (usa `SIGHASH_ALL` padrão)
2. ✅ **Verdadeiramente atômico** (ambos assinam o mesmo PSBT completo)
3. ✅ **Sem dependência de Bitcoin Core RPC**
4. ✅ **Simples e robusto**
5. ✅ **Como marketplaces reais fazem**

---

## ⚠️ Consideração: Coordenação de Assinaturas

Como fazer o vendedor assinar DEPOIS do comprador?

### Opção A: Popup para o vendedor
```javascript
// Quando comprador assina, backend notifica vendedor
// Vendedor recebe popup: "Alguém quer comprar sua inscription!"
// Vendedor assina → transação completa
```

### Opção B: Ordem inversa (vendedor primeiro)
```javascript
// Quando comprador clica "Buy":
// 1. Backend cria PSBT
// 2. Pede vendedor assinar PRIMEIRO
// 3. Depois comprador assina
// 4. Broadcast
```

### Opção C: Escrow intermediário
```javascript
// Marketplace segura ambas assinaturas
// Só faz broadcast quando AMBOS assinaram
```

---

## 🚀 Próximo Passo:

Implementar esta nova arquitetura, começando por:
1. Remover assinatura do vendedor em `createOffer()`
2. Salvar apenas metadata da listing
3. Criar PSBT completo em `buyNow()`
4. Implementar fluxo de assinaturas sequenciais



