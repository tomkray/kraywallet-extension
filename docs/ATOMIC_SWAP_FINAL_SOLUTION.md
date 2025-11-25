# 🎯 SOLUÇÃO FINAL PARA ATOMIC SWAP

## ❌ PROBLEMA IDENTIFICADO:

O **buyer está assinando o Input 0** (do seller) quando **NÃO deveria**!

```
❌ COMPORTAMENTO ATUAL:
Buyer assina: Input 0, Input 1, Input 2
                  ↑ ERRADO! É do seller!

✅ COMPORTAMENTO CORRETO:
Buyer assina: Input 1, Input 2 (apenas seus inputs)
Seller já assinou: Input 0 (com SIGHASH_NONE|ANYONECANPAY)
```

---

## 🔍 CAUSA RAIZ:

`inputsToSign` **NÃO está chegando** no backend `/api/kraywallet/sign`.

**Fluxo atual:**
1. Frontend (`app.js`) cria `toSignInputs: [{index: 1, publicKey: "..."}]` ✅
2. Frontend chama `window.krayWallet.signPsbt(psbt, {toSignInputs})` ✅
3. `injected.js` passa para `background-real.js` via `sendMessage('signPsbt', {toSignInputs})` ✅
4. `background-real.js` cria `pendingPsbtRequest = {inputsToSign, ...}` ✅
5. `background-real.js` envia para backend: `inputsToSign: pendingPsbtRequest.inputsToSign` ✅
6. **Backend recebe: `undefined`** ❌❌❌

---

## 🔧 CORREÇÕES APLICADAS:

### 1️⃣ **Frontend (`app.js`):**
- ✅ Seller usa `SIGHASH_NONE|ANYONECANPAY` (linha 1485)
- ✅ Buyer NÃO finaliza o PSBT (linha 1104)
- ✅ `toSignInputs` criado corretamente (linha 1059)

### 2️⃣ **Extension (`background-real.js`):**
- ✅ `inputsToSign` passado para o backend (linha 798)
- ✅ Logs adicionados para debug (linhas 786, 864-866)

### 3️⃣ **Backend (`server/routes/kraywallet.js`):**
- ✅ Aceita `inputsToSign` no request (linha 180)
- ✅ Filtra inputs para assinar (linhas 269-277)
- ✅ SKIP Input 0 se não estiver em `inputsToSign` (linhas 285-288)
- ✅ Logs adicionados para debug (linhas 264-266)

---

## 🧪 PRÓXIMOS PASSOS PARA TESTAR:

### 1️⃣ **Verificar se extensão foi recarregada:**
```
chrome://extensions
→ Kray Wallet → Status: "Atualizado" com timestamp recente
```

### 2️⃣ **Abrir console da extensão:**
```
chrome://extensions
→ Kray Wallet → "Inspect views: service worker"
```

### 3️⃣ **Limpar banco e criar nova oferta:**
```bash
# No terminal:
cd "/Volumes/D2/KRAY WALLET"
rm -f server/db/*.db*
pkill -9 node && npm start > server.log 2>&1 &
```

```
# No popup da Kray Wallet:
1. Desbloqueie
2. Selecione inscrição
3. "List on Market" → 1000 sats
4. Assine
```

### 4️⃣ **Comprar no marketplace:**
```
http://localhost:3000/ordinals.html
→ Buy Now
→ Assine
```

### 5️⃣ **Verificar logs:**

**Console da extensão (service worker):**
```
🔐 ===== SIGN PSBT CALLED =====
🔍 inputsToSign RAW: [{index: 1, publicKey: "..."}]
🔍 inputsToSign type: object
🔍 inputsToSign isArray: true
```

**Log do servidor:**
```bash
tail -f server.log
```
```
🔍 inputsToSign received: [{index: 1, publicKey: "..."}]
🔍 inputsToSign type: object
🔍 inputsToSign isArray: true
🎯 Signing SPECIFIC inputs (atomic swap mode): [1]
⏭️ Input 0: NOT in inputsToSign list, SKIPPING
✅ Input 1 signed
✅ Transaction broadcast successful!
```

---

## 🚨 SE AINDA NÃO FUNCIONAR:

Verificar se `toSignInputs` está sendo passado corretamente no frontend:

**No console do navegador (ordinals.html):**
```javascript
// Adicionar breakpoint em app.js linha 1070:
const signedPsbt = await signWalletPsbt(finalPsbt, {
    autoFinalized: false,
    toSignInputs: toSignInputs  // ← Verificar se está [{index: 1, ...}]
});
```

---

## 📋 CHECKLIST:

- [ ] Extensão recarregada
- [ ] Banco de dados limpo
- [ ] Nova oferta criada
- [ ] Console da extensão aberto
- [ ] Logs do servidor abertos (`tail -f server.log`)
- [ ] Teste de compra executado
- [ ] Logs verificados

