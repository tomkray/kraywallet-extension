# 🔧 Fix "No input #2" Error

## ❌ Problema

```
Atomic swap error: {code: -32603, message: 'No input #2', data: {…}}
```

**Causa:** 
Estávamos pedindo para Unisat assinar inputs que não existiam no PSBT!

**Exemplo:**
```
PSBT real:
  Input 0: Vendedor (inscription) ✅
  Input 1: Comprador (payment UTXO) ✅

Mas estávamos pedindo para assinar:
  toSignInputs: [
    { index: 1 },  // ✅ Existe
    { index: 2 },  // ❌ NÃO EXISTE!
    { index: 3 },  // ❌ NÃO EXISTE!
    ...
  ]
```

---

## ✅ Solução

Usar `atomicPsbtResponse.details.totalInputs` para saber quantos inputs realmente existem:

### Antes (Errado):
```javascript
const numBuyerInputs = utxoList.length; // ❌ Número de UTXOs disponíveis
for (let i = 1; i <= numBuyerInputs; i++) {
    toSignInputs.push({ index: i });
}
```

**Problema:** Backend pode ter selecionado MENOS UTXOs do que o total disponível!

### Depois (Correto):
```javascript
const totalInputs = atomicPsbtResponse.details.totalInputs; // ✅ Número REAL no PSBT
const buyerInputsCount = totalInputs - 1; // -1 do vendedor

for (let i = 1; i < totalInputs; i++) { // De 1 até totalInputs-1
    toSignInputs.push({ index: i, publicKey: buyerPublicKey });
}
```

**Resultado:** Só pede para assinar inputs que REALMENTE existem!

---

## 📊 Exemplo Prático

### Cenário:
- Buyer tem 15 UTXOs disponíveis
- Precisa pagar 1000 + 500 fee = 1500 sats
- Backend seleciona APENAS 1 UTXO (54,150 sats) - suficiente!

### PSBT Final:
```
Input 0: Inscription (546 sats) - vendedor
Input 1: Payment (54,150 sats) - comprador
--------------------------------
Total: 2 inputs
```

### toSignInputs Correto:
```javascript
toSignInputs: [
  { index: 1, publicKey: "..." }  // ✅ Só o input 1!
]
```

### Logs:
```
PSBT has 2 inputs total (1 seller + 1 buyer)
Signing buyer inputs (indices 1+)...
toSignInputs: 1 inputs (indices 1-1)
```

---

## 🎯 Por Que Funciona Agora

1. **Backend retorna `details.totalInputs`** → Número real de inputs
2. **Frontend calcula** `buyerInputsCount = totalInputs - 1`
3. **Loop correto:** `for (let i = 1; i < totalInputs; i++)`
4. **Unisat recebe** apenas índices que existem
5. **✅ Sucesso!**

---

## 🚀 Teste Agora

1. **REFRESH a página** (F5)
2. **Vendedor:** Create Offer → Sign
3. **Comprador:** Buy Now → Select fee → Confirm
4. **Console vai mostrar:**
   ```
   PSBT has 2 inputs total (1 seller + 1 buyer)
   toSignInputs: 1 inputs (indices 1-1)
   ```
5. **Unisat abre** → Sign
6. **Broadcast** → **TXID!** 🎉

**AGORA VAI FUNCIONAR!** 🚀



