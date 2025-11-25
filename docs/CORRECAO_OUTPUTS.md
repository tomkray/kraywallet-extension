# 🎯 CORREÇÃO CRÍTICA - Outputs do PSBT

## ❌ PROBLEMA ENCONTRADO

Você estava certo! Os **valores e destinos dos outputs estavam ERRADOS**.

### O que estava acontecendo:

1. **Vendedor criava PSBT:**
   - Output 0: Inscription → **vendedor** (placeholder errado)
   - Output 1: Pagamento → vendedor
   - Output 2: Change → vendedor (calculado errado)

2. **Comprador recebia e assinava:**
   - Outputs eram **copiados diretamente** sem correção
   - Inscription continuava indo para o **vendedor**!
   - Comprador pagava mas **NÃO recebia a inscription**

3. **Unisat mostrava valores errados:**
   - Porque os outputs estavam errados mesmo

---

## ✅ CORREÇÃO APLICADA

### 1. `server/utils/psbtBuilder.js`:
```javascript
// ANTES: Output 0 ia para o vendedor
psbt.addOutput({
    address: buyerAddress || sellerAddress, // ❌ Errado!
    value: 546
});

// DEPOIS: Placeholder correto, será substituído
psbt.addOutput({
    address: sellerAddress, // Placeholder (comprador vai sobrescrever)
    value: 546
});

// REMOVIDO: Change incorreto
// const change = inscriptionUtxo.value - 546 - 500; // ❌ Sempre negativo!
```

### 2. `server/routes/purchase.js` (build-atomic-psbt):
```javascript
// ANTES: Copiava outputs sem modificar
sellerPsbtDecoded.txOutputs.forEach((output, idx) => {
    psbt.addOutput({
        script: output.script,  // ❌ Errado! Copia endereço do vendedor
        value: output.value
    });
});

// DEPOIS: Outputs corretos criados do zero
// Output 0: Inscription → COMPRADOR ✅
psbt.addOutput({
    address: buyerAddress,  // ✅ Comprador recebe!
    value: 546
});

// Output 1: Pagamento → VENDEDOR ✅
psbt.addOutput({
    script: sellerPaymentOutput.script,  // Endereço do vendedor
    value: paymentAmount  // Valor correto
});

// Output 2: Change → COMPRADOR ✅
if (change > 546) {
    psbt.addOutput({
        address: buyerAddress,  // ✅ Comprador recebe troco
        value: change
    });
}
```

---

## 🎯 ESTRUTURA CORRETA AGORA

### PSBT do Vendedor (inicial):
```
Input 0:  Inscription UTXO (546 sats) + tapInternalKey ✅
Output 0: Inscription → vendedor (placeholder temporário)
Output 1: Pagamento (10000 sats) → vendedor
```

### PSBT Atômico (comprador adiciona):
```
Input 0:  Inscription UTXO (vendedor, assinado) ✅
Input 1+: Payment UTXOs (comprador, não assinado) ✅

Output 0: Inscription (546 sats) → COMPRADOR ✅
Output 1: Pagamento (10000 sats) → VENDEDOR ✅
Output 2: Change (resto) → COMPRADOR ✅
```

---

## 🧪 TESTE AGORA

### Quando você assinar com Unisat, DEVE ver:

**Vendedor (Create Offer):**
- Sending: 1 inscription (546 sats)
- Receiving: nada (ainda)
- É só para autorizar uso da inscription

**Comprador (Buy Now):**
- Sending: ~11000 sats (10000 + fee)
- Receiving: 1 inscription (546 sats)
- Os valores devem estar CORRETOS!

---

## 📊 LOGS ESPERADOS

**Servidor - Vendedor cria oferta:**
```
✅ Extracted tapInternalKey from P2TR script
Output 0: Inscription placeholder (546 sats) → will be updated to buyer
Output 1: Payment to seller (10000 sats)
```

**Servidor - Comprador reconstrói PSBT:**
```
Adding outputs (inscription → buyer, payment → seller)...
✅ Output 0: Inscription → BUYER (546 sats)
✅ Output 1: Payment → SELLER (10000 sats)
Added buyer change output: 42000 sats
```

---

## 🚀 STATUS

- ✅ Servidor reiniciado
- ✅ Banco limpo
- ✅ Outputs corrigidos
- ✅ tapInternalKey presente
- ✅ Ordem de operações correta
- ✅ Finalização simplificada

**TESTE AGORA!** Os valores devem aparecer corretos na Unisat! 🎉



