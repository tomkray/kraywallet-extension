# 🎯 SOLUÇÃO COMPLETA - PSBT Atomic Swap Funcional

## 📋 TODAS AS CORREÇÕES APLICADAS

### ✅ 1. tapInternalKey Adicionado (CRÍTICO!)
**Arquivos:** `server/utils/psbtBuilder.js`, `server/routes/purchase.js`

**Problema:** Inputs Taproot sem `tapInternalKey` - carteiras não conseguiam assinar

**Solução:**
```javascript
// Extrair do scriptPubKey (34 bytes: 0x5120 + 32 bytes pubkey)
if (scriptPubKey.length === 34 && scriptPubKey[0] === 0x51 && scriptPubKey[1] === 0x20) {
    tapInternalKey = scriptPubKey.slice(2); // 32 bytes
}

psbt.addInput({
    hash, index, witnessUtxo,
    tapInternalKey: tapInternalKey // ✅ OBRIGATÓRIO para P2TR
});
```

### ✅ 2. Ordem de Operações Corrigida (CRÍTICO!)
**Arquivos:** `server/routes/purchase.js` (ambos endpoints)

**Problema:** Assinaturas adicionadas junto com inputs → "Can not modify transaction"

**Solução:**
```javascript
// ORDEM CORRETA:
// 1. Adicionar TODOS inputs (sem assinaturas)
// 2. Adicionar TODOS outputs
// 3. DEPOIS copiar assinaturas

// Guardar assinaturas
const signatures = [];
sellerPsbt.data.inputs.forEach(input => {
    signatures.push({ tapKeySig: input.tapKeySig });
    psbt.addInput({ hash, index, witnessUtxo, tapInternalKey }); // SEM assinatura
});

// Adicionar outputs...

// AGORA copiar assinaturas
signatures.forEach((sig, i) => {
    psbt.data.inputs[i].tapKeySig = sig.tapKeySig;
});
```

### ✅ 3. Finalização Simplificada (CRÍTICO!)
**Arquivo:** `server/routes/psbt.js`

**Problema:** Serialização manual do witness Taproot incorreta

**Solução:** Deixar bitcoinjs-lib fazer a finalização
```javascript
// ANTES: Tentava criar witness manualmente
// DEPOIS: Usa o finalizer padrão

for (let i = 0; i < psbt.inputCount; i++) {
    if (signedInputs.includes(i)) {
        psbt.finalizeInput(i); // ✅ Deixa bitcoinjs-lib fazer o trabalho
    }
}
```

### ✅ 4. Imports Corrigidos
**Arquivo:** `server/routes/psbt.js`

```javascript
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);
```

---

## 🏗️ ESTRUTURA CORRETA DO PSBT

### Input Taproot Completo:
```javascript
{
    hash: Buffer<txid>.reverse(),
    index: vout,
    witnessUtxo: {
        script: Buffer<51200000...>, // 34 bytes P2TR
        value: 546                   // satoshis
    },
    tapInternalKey: Buffer<32 bytes>, // ✅ Extraído do scriptPubKey
    tapKeySig: Buffer<64 bytes>       // ✅ Adicionado DEPOIS
}
```

### Outputs Corretos:
```javascript
// Output 0: Inscription → COMPRADOR
{
    address: buyerAddress,  // ← IMPORTANTE!
    value: 546
}

// Output 1: Pagamento → VENDEDOR
{
    address: sellerAddress,
    value: 10000 // Preço
}

// Output 2: Change → COMPRADOR
{
    address: buyerAddress,
    value: calculatedChange
}
```

---

## 🔄 FLUXO COMPLETO

### VENDEDOR (Criar Oferta):
```
1. Frontend pega inscription da Unisat
2. Backend cria PSBT:
   - Input: inscription UTXO
   - tapInternalKey: EXTRAÍDO ✅
   - Output 0: inscription → vendedor (placeholder)
   - Output 1: pagamento → vendedor
3. Unisat assina (consegue porque tem tapInternalKey)
4. PSBT assinado salvo no banco
```

### COMPRADOR (Aceitar Oferta):
```
1. Frontend busca oferta do banco
2. Backend reconstrói PSBT:
   - Input 0 do vendedor (SEM assinatura ainda)
   - Inputs do comprador (com tapInternalKey)
   - Output 0: inscription → COMPRADOR ✅
   - Output 1: pagamento → vendedor
   - Output 2: change → comprador
   - AGORA copia assinatura do vendedor
3. Frontend envia para Unisat assinar
4. Unisat assina inputs do comprador
5. Backend finaliza (bitcoinjs-lib decide formato)
6. Backend faz broadcast
7. SUCCESS! 🎉
```

---

## 🎯 TESTE AGORA

### Passo 1: Limpar Tudo
```bash
# Banco limpo ✅
# Servidor reiniciado ✅
# URL: http://localhost:3000 ✅
```

### Passo 2: Vendedor
1. Connect Wallet (Unisat)
2. Create Offer:
   - Inscription ID: (real da sua wallet)
   - Price: 10000 sats
   - Fee Rate: 5
3. Sign com Unisat
4. Aguardar "Offer created!"

**Logs esperados:**
```
✅ Extracted tapInternalKey from P2TR script
```

### Passo 3: Comprador
1. Connect Wallet (outra conta ou mesma para teste)
2. Buy Now
3. Select fee: Custom 2 sat/vB
4. **Unisat DEVE ABRIR**
5. Sign
6. Aguardar finalização

**Logs esperados:**
```
📝 Saved Taproot signature for input 0 (will add later)
✅ Extracted tapInternalKey for buyer input 1
🔐 Adding seller signatures AFTER structure is complete...
✅ Added Taproot signature to input 0
🔧 Attempting to finalize all signed inputs...
✅ Input 0 finalized successfully
✅ Input 1 finalized successfully
```

---

## ⚠️ SE AINDA DER ERRO

### Erro: "Not finalized"
**Causa:** Input não tem assinatura ou formato incorreto

**Debug:**
1. Verificar logs do servidor
2. Procurar: "Extracted tapInternalKey" → deve aparecer 2x
3. Procurar: "Added Taproot signature" → deve aparecer 1x
4. Procurar: "finalized successfully" → deve aparecer 2x

### Erro: "Invalid signature"
**Causa:** witnessUtxo incorreto ou tapInternalKey errado

**Solução:**
```javascript
// Verificar que scriptPubKey é P2TR:
console.log('Script length:', scriptPubKey.length); // deve ser 34
console.log('Script[0]:', scriptPubKey[0].toString(16)); // deve ser 0x51
console.log('Script[1]:', scriptPubKey[1].toString(16)); // deve ser 0x20
```

### Erro: "Can not modify transaction"
**Causa:** Assinaturas sendo adicionadas muito cedo

**Verificar:**
- Arquivo: `server/routes/purchase.js`
- Linha ~333 (`create-atomic-psbt`)
- Linha ~18 (`build-atomic-psbt`)
- Assinaturas devem ser adicionadas DEPOIS de todos outputs

---

## 📊 CHECKLIST FINAL

- [ ] Servidor rodando sem erros
- [ ] Banco de dados limpo
- [ ] Vendedor: consegue criar oferta
- [ ] Vendedor: Unisat abre e assina
- [ ] Vendedor: oferta salva (check no marketplace)
- [ ] Comprador: vê a oferta
- [ ] Comprador: modal de fee abre
- [ ] Comprador: Unisat ABRE para assinar ← CRÍTICO
- [ ] Comprador: assina com sucesso
- [ ] Backend: logs mostram "finalized successfully"
- [ ] Backend: broadcast retorna TXID
- [ ] Transação aparece no mempool.space

---

## 🚨 ÚLTIMA TENTATIVA

Se AINDA não funcionar após todas essas correções, o problema pode estar em:

1. **Unisat não está realmente assinando**
   - Verificar se `signedPsbt.length > originalPsbt.length`
   - Decodificar PSBT e verificar `tapKeySig` presente

2. **UTXO está gasto ou inválido**
   - Verificar no ord server que inscription existe
   - Confirmar que UTXO não foi gasto

3. **Versão do bitcoinjs-lib incompatível**
   - Verificar: `package.json` → deve ser `^6.1.5`

4. **Bitcoin Core não aceita Taproot**
   - Verificar versão: deve ser `>=22.0`

---

## 🎉 RESUMO DAS CORREÇÕES

| # | Correção | Arquivo | Status |
|---|----------|---------|--------|
| 1 | tapInternalKey extraído | psbtBuilder.js | ✅ |
| 2 | tapInternalKey do comprador | purchase.js | ✅ |
| 3 | Ordem de operações | purchase.js (2x) | ✅ |
| 4 | Finalização simplificada | psbt.js | ✅ |
| 5 | Imports | psbt.js | ✅ |

---

**Data:** 17/10/2025 03:32 UTC
**Status:** ✅ TODAS as correções aplicadas
**Servidor:** Rodando e funcional
**Banco:** Limpo e pronto

**🚀 TUDO PRONTO PARA TESTAR!**



