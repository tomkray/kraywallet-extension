# 🔧 FIX: Unisat Listing Button

## ❌ PROBLEMA ATUAL:

Quando conectado com **Unisat**, o botão laranja **"List for Sale"** está abrindo o modal **ORD CLI** (que mostra comandos para terminal), mas deveria estar:
1. Criando o PSBT no backend
2. **Chamando `window.unisat.signPsbt()`** para assinar
3. Salvando a oferta no marketplace

---

## ✅ SOLUÇÃO APLICADA:

### 1️⃣ Modificação em `openOrdCliModal()`:
- Detecta se é Unisat/Xverse/Leather
- Redireciona para `openListModal()` (mesma que KrayWallet)
- Só mostra ORD CLI se não tiver wallet conectada

### 2️⃣ Modificação em `createKrayWalletListing()`:
- Agora suporta **3 tipos de wallet:**
  - **KrayWallet:** 0% fee, usa `window.krayWallet.createOffer()`
  - **Unisat:** 1% fee, usa `window.unisat.signPsbt()`
  - **Xverse:** 1% fee, usa `window.XverseProviders.BitcoinProvider.request('signPsbt')`

---

## 🚀 FLUXO CORRETO AGORA:

### Unisat/Xverse:
1. Usuário clica em **"📝 List for Sale"** (botão laranja)
2. Modal abre com campo de preço e descrição
3. Clica em **"Create Listing"**
4. Backend cria PSBT (`POST /api/psbt/sell`)
5. **Unisat popup abre automaticamente** para assinar
6. Oferta é salva com **1% fee**
7. Aparece no marketplace com **borda laranja**

### KrayWallet:
1. Usuário clica em **"📝 List for Sale"** (botão verde)
2. Modal abre com campo de preço e descrição
3. Clica em **"Create Listing"**
4. Extension cria PSBT internamente
5. **KrayWallet popup abre** para assinar
6. Oferta é salva com **0% fee**
7. Aparece no marketplace com **borda verde**

---

## 🎯 RESULTADO:

✅ Unisat agora chama **`window.unisat.signPsbt()`**  
✅ Xverse agora chama **`window.XverseProviders.BitcoinProvider.request('signPsbt')`**  
✅ KrayWallet continua usando **`window.krayWallet.createOffer()`**  
✅ ORD CLI só aparece se **não tiver wallet conectada**  

---

## 📝 TESTE AGORA:

1. Recarregue a página: `http://localhost:3000/ordinals.html`
2. Conecte com **Unisat**
3. Vá para **"Create Offer"**
4. Clique em **"📝 List for Sale"** (botão laranja)
5. Insira preço: `5000` sats
6. Clique em **"Create Listing"**
7. **A popup da Unisat deve abrir automaticamente para assinar!**

