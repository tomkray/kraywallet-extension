# 🔧 FIX: Background tentando abrir popup já aberto (loop de timeout)

## 🐛 PROBLEMA REAL

### **Logs mostraram o verdadeiro problema:**

```
background-real.js:875 ❌ Failed to open popup: Error: Could not find an active browser window.
background-real.js:876 ⚠️  chrome.action.openPopup() can only be called in response to user action
background-real.js:889 ⏳ Waiting for user confirmation...
background-real.js:894 ⏱️  TIMEOUT: User did not confirm in 120 seconds
```

### **O que estava acontecendo:**

1. ✅ Usuário clica em "Create Listing" (popup **já está aberto**)
2. ✅ PSBT é criado com sucesso
3. ✅ Popup envia `signPsbt` para background
4. ❌ **Background tenta abrir OUTRO popup** (`chrome.action.openPopup()`)
5. ❌ Falha porque:
   - Já existe um popup aberto
   - Não está em resposta direta a ação do usuário
6. ❌ Background fica em **loop de timeout (120 segundos)**
7. ⏰ Usuário vê a tela de assinatura, mas background não "ouve" porque está esperando um popup que nunca abrirá

### **Resultado:**
- ❌ Botões Cancel e Sign **parecem travados**
- ❌ Background em loop aguardando timeout
- ❌ Após 120 segundos, background rejeita a Promise com erro de timeout

---

## ✅ SOLUÇÃO

### **1. Remover tentativa de abrir popup no background**

O background **NÃO deve tentar abrir popup** quando `signPsbt` é chamado de um popup já aberto!

**Antes:**
```javascript
// ❌ Sempre tentava abrir popup novo
if (!isPopupOpening) {
    isPopupOpening = true;
    console.log('📱 Opening popup at standard extension position...');
    
    try {
        await chrome.action.openPopup();  // ❌ Falha quando popup já está aberto!
        console.log('✅ Popup opened at standard position');
    } catch (err) {
        console.error('❌ Failed to open popup:', err);
        console.warn('⚠️  chrome.action.openPopup() can only be called in response to user action');
        console.warn('⚠️  User may need to click the extension icon manually');
    }
}
```

**Depois:**
```javascript
// ✅ NÃO TENTAR ABRIR POPUP SE JÁ ESTIVER ABERTO
// Quando createMarketListing() chama signPsbt(), o popup já está aberto!
// Apenas salvar o PSBT e deixar o popup exibir a tela de assinatura
console.log('📱 PSBT saved, popup will show confirmation screen...');
```

### **2. Não fazer `await` na mensagem para o background**

**Antes:**
```javascript
await chrome.runtime.sendMessage({
    action: 'signPsbt',
    data: { psbt, sighashType, autoFinalized }
});
```

**Depois:**
```javascript
// ✅ NÃO AWAIT - Apenas disparar a mensagem e continuar
chrome.runtime.sendMessage({
    action: 'signPsbt',
    data: { psbt, sighashType, autoFinalized }
}).catch(err => {
    console.warn('⚠️  Background may be waiting, ignoring error:', err);
});
```

---

## 🎯 COMO FUNCIONA AGORA

### **Fluxo Corrigido:**

1. ✅ Usuário clica "Create Listing" (popup aberto)
2. ✅ PSBT criado
3. ✅ Popup envia `signPsbt` para background (**sem await**)
4. ✅ Background **apenas salva PSBT** no storage
5. ✅ Background **entra em modo de espera** (120 segundos)
6. ✅ Popup **muda para tela de assinatura** imediatamente
7. ✅ Usuário vê botões Cancel/Sign **funcionando**
8. ✅ Quando usuário clica Sign:
   - Popup assina PSBT
   - Popup salva resultado no `chrome.storage.local`
   - Background detecta mudança no storage
   - Background resolve a Promise com PSBT assinado
9. ✅ Quando usuário clica Cancel:
   - Popup notifica background (`cancelPsbtSign`)
   - Background limpa tudo
   - Popup volta para tela da wallet

---

## 📊 LOGS ESPERADOS AGORA

### **Ao clicar "Create Listing":**

**Background:**
```
🔐 ===== SIGN PSBT CALLED =====
✍️  Signing PSBT (via popup confirmation)...
  PSBT length: 192
✅ Wallet found in storage
✅ pendingPsbtRequest saved in memory AND storage
📱 PSBT saved, popup will show confirmation screen...
⏳ Waiting for user confirmation...
✅ Promise listener registered, waiting for psbtSignResult...
🎧 Storage listener active
```

**Popup:**
```
🔏 Saving PSBT for signing...
📤 Sending signPsbt message to background...
✅ signPsbt message sent!
🚪 Closing list-market screen...
📱 Showing confirm-psbt screen...
✅ Screen shown, waiting for signature...
```

### **Ao clicar "Cancel":**

**Popup:**
```
❌ Cancel button clicked
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ USER CANCELLED - CLEANING EVERYTHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Background notified
✅ Storage cleaned
✅ isCreatingListing reset
```

**Background:**
```
📨 Message received: cancelPsbtSign
❌ PSBT signing cancelled by user (cleared from memory and storage)
```

### **Ao clicar "Sign & Send":**

**Popup:**
```
✅ Sign button clicked
✅ PSBT signed successfully!
```

**Background:**
```
📩 Received psbtSignResult from popup
✅ PSBT signed successfully! Resolving...
```

---

## 🧪 TESTE

### **1. Recarregar Extension**
```
chrome://extensions/ → Click 🔄 em KrayWallet
```

### **2. Criar Listing**
1. Abrir popup
2. Desbloquear wallet
3. Click "📋 List" em uma inscription
4. Preencher preço (ex: 10000)
5. Click "Create Listing"

### **3. Verificar Console (F12)**

**Deve aparecer:**
```
✅ signPsbt message sent!
🚪 Closing list-market screen...
📱 Showing confirm-psbt screen...
✅ Screen shown, waiting for signature...
```

**NÃO deve aparecer:**
```
❌ Failed to open popup
⏱️  TIMEOUT: User did not confirm in 120 seconds
```

### **4. Testar Cancel**
- ✅ Botão deve responder
- ✅ Deve voltar para wallet
- ✅ Nada salvo no banco de dados

### **5. Testar Sign**
- ✅ Botão deve responder
- ✅ Deve pedir password
- ✅ Deve assinar e salvar oferta

---

## 📝 ARQUIVOS MODIFICADOS

### `/Volumes/D2/KRAY WALLET/kraywallet-extension/background/background-real.js`

**Linhas 863-866:** Removida lógica de `chrome.action.openPopup()`

**Mudança:**
```diff
- // Abrir popup na posição padrão da extensão
- if (!isPopupOpening) {
-     await chrome.action.openPopup();
- }
+ // ✅ NÃO TENTAR ABRIR POPUP SE JÁ ESTIVER ABERTO
+ console.log('📱 PSBT saved, popup will show confirmation screen...');
```

### `/Volumes/D2/KRAY WALLET/kraywallet-extension/popup/popup.js`

**Linhas 7449-7460:** Removido `await` e adicionado `.catch()`

**Mudança:**
```diff
- await chrome.runtime.sendMessage({
+ chrome.runtime.sendMessage({
      action: 'signPsbt',
      data: { psbt, sighashType, autoFinalized }
+ }).catch(err => {
+     console.warn('⚠️  Background may be waiting, ignoring error:', err);
  });
```

---

## 🚀 STATUS

✅ **CORRIGIDO** - Background não tenta mais abrir popup quando já está aberto!

**Data:** 2024-10-24
**Versão:** KrayWallet Extension v1.0

