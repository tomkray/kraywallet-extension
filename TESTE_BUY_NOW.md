# 🛒 TESTE DO FLUXO DE COMPRA - BUY NOW

## ✅ CORREÇÕES APLICADAS:

1. ✅ **Endpoint `/api/wallet/utxos/:address`** agora usa **ORD server LOCAL**
2. ✅ **utxoFilter** identifica corretamente inscriptions e runes
3. ✅ **Filtra UTXOs puros** para pagamento (sem inscriptions/runes)
4. ✅ **scriptPubKey fix** no `atomicSwapPurchase.js` (linha 106)

---

## 📊 UTXOS DISPONÍVEIS (Buyer):

**Endereço:** `bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag`

| UTXO | Valor | Tipo | Status |
|------|-------|------|--------|
| `72e2...c628:0` | 555 sats | 📜 Inscription | ❌ PROTEGIDO |
| `1fb2...5c46:1` | 546 sats | 🪙 Rune (DOG) | ❌ PROTEGIDO |
| `1fb2...5c46:3` | **2,388 sats** | 💰 Pure BTC | ✅ **DISPONÍVEL** |
| `00eb...675a:2` | **564 sats** | 💰 Pure BTC | ✅ **DISPONÍVEL** |

**Total disponível para compra:** **2,952 sats**

---

## 💰 CÁLCULO DA COMPRA:

- **Preço do seller:** 1,000 sats
- **Taxa do marketplace (2%):** 546 sats (mínimo)
- **Taxa de mineração (estimada):** ~1,000 sats
- **TOTAL NECESSÁRIO:** ~2,546 sats

✅ **Buyer tem fundos suficientes!** (2,952 > 2,546)

---

## 🧪 PASSO A PASSO DO TESTE:

### 1️⃣ **Abrir o Marketplace**
```
http://localhost:3000/ordinals.html
```

### 2️⃣ **Verificar listing**
- ✅ Container deve aparecer com inscription #78630547
- ✅ Preço: 1,000 sats
- ✅ Taxa: 546 sats
- ✅ Total: 1,546 sats
- ✅ Botão "🛒 Buy Now" disponível

### 3️⃣ **Clicar em "Buy Now"**
**O que deve acontecer:**
1. ✅ Frontend chama `window.krayWallet.buyAtomicSwap()`
2. ✅ Extension busca UTXOs do buyer em `/api/wallet/utxos/:address`
3. ✅ Filtra apenas UTXOs puros (2,388 + 564 sats)
4. ✅ Backend prepara PSBT com:
   - Input[0]: Seller UTXO (inscription)
   - Input[1]: Buyer UTXO (2,388 sats)
   - Input[2]: Buyer UTXO (564 sats)
   - Output[0]: Seller payout (1,000 sats)
   - Output[1]: Inscription → Buyer
   - Output[2]: Market fee (546 sats)
   - Output[3]: Buyer change
5. ✅ Popup da Kray Wallet abre automaticamente
6. ✅ Tela de assinatura mostra detalhes da compra

### 4️⃣ **Assinar no popup**
- Inserir senha
- Clicar "Sign Transaction"
- ✅ PSBT é assinada
- ✅ Backend finaliza e faz broadcast
- ✅ TXID é retornado

### 5️⃣ **Verificar resultado**
- ✅ Mensagem de sucesso no frontend
- ✅ Listing some do marketplace
- ✅ Buyer recebe a inscription

---

## 📋 LOGS A VERIFICAR:

### No terminal do servidor:
```bash
tail -f /Volumes/D2/KRAY\ WALLET/server-buy-test.log
```

**O que procurar:**
- ✅ `PREPARE PURCHASE`
- ✅ `Added 2 buyer input(s)` (os 2 UTXOs puros)
- ✅ `Total buyer input: 2952 sats`
- ✅ `Output[0] (seller payout): 1000 sats`
- ✅ `Output[1] (inscription to buyer)`
- ✅ `Output[2] (market fee): 546 sats`
- ✅ `PSBT prepared successfully`

### No console do navegador (F12):
```javascript
// Deve mostrar:
✅ Found 4 total UTXOs
✅ Found 2 pure BTC UTXOs (no inscriptions/runes)
✅ Selected 2 UTXOs (total: 2952 sats)
📦 Preparing purchase...
✅ Purchase prepared
```

---

## ⚠️ POSSÍVEIS ERROS:

### ❌ "No pure BTC UTXOs"
- **Causa:** Todos UTXOs têm inscriptions/runes
- **Solução:** Já corrigido! Agora identifica corretamente

### ❌ "Buffer undefined"
- **Causa:** `scriptPubKey` vs `script_pubkey`
- **Solução:** ✅ Já corrigido!

### ❌ "Insufficient funds"
- **Causa:** UTXOs não cobrem preço + taxas
- **Solução:** Verificar cálculo (buyer tem 2,952 sats disponíveis)

---

## 🎯 TESTE AGORA!

1. Abra `http://localhost:3000/ordinals.html`
2. Clique em "🛒 Buy Now"
3. Assine no popup da Kray Wallet
4. Verifique o TXID na resposta

---

## 📊 MONITORAMENTO EM TEMPO REAL:

```bash
# Terminal 1: Logs do servidor
tail -f /Volumes/D2/KRAY\ WALLET/server-buy-test.log | grep -E "PREPARE|buyer|Output|broadcast"

# Terminal 2: Status dos UTXOs
watch -n 2 "curl -s 'http://localhost:3000/api/wallet/utxos/bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag' | jq '{total: (.utxos | length), pure: [.utxos[] | select(.hasInscription == false and .hasRunes == false)] | length}'"
```

---

## ✅ SUCESSO ESPERADO:

**Frontend:**
```
✅ Purchase successful!
TXID: [64 caracteres hex]
```

**Logs:**
```
🎉 TRANSACTION BROADCAST SUCCESSFUL
   TXID: [txid]
   Status: BROADCASTED
```

---

🚀 **BOA SORTE COM O TESTE!**

