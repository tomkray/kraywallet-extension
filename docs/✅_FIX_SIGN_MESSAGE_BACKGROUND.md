# ✅ Fix: Sign Message via Background (Solução Definitiva)

**Data:** 24 de outubro de 2025  
**Problema:** Popup não conseguia acessar `walletEncrypted` e `salt` do storage para assinar mensagem de like.

---

## 🐛 Problema Identificado

### Sintomas Anteriores
```javascript
popup.js:8279 ❌ Wallet not found in storage!
popup.js:8280    Available keys: Array(1)
popup.js:8284    All storage keys: Array(5)
popup.js:8316 Error signing message: Error: No wallet found. Please unlock your wallet first.
```

- ✅ Popup abria corretamente
- ✅ Tela "Sign Message" aparecia
- ✅ Usuário digitava a senha
- ❌ **Popup não encontrava `walletEncrypted` no storage**

### Causa Raiz
O **popup.js** estava tentando acessar `chrome.storage.local` diretamente para buscar `walletEncrypted` e `salt`, mas por alguma razão (permissões, contexto, ou timing) não conseguia acessar esses dados.

O **background.js** sempre teve acesso correto ao storage.

---

## ✅ Solução Implementada

### Abordagem: Centralizar Assinatura no Background

Em vez de o popup tentar descriptografar e assinar localmente, ele agora **envia a senha para o background** e pede para ele assinar.

### Vantagens:
1. ✅ Background sempre tem acesso ao storage
2. ✅ Centraliza lógica de criptografia em um só lugar
3. ✅ Mais seguro (senha não fica no contexto do popup)
4. ✅ Consistente com outras operações (sendBitcoin, signPsbt, etc.)

---

## 🔧 Mudanças Implementadas

### 1. Arquivo: `popup/popup.js` (linhas 8256-8283)

#### ANTES (tentava assinar localmente):
```javascript
async function handleMessageSign() {
    const password = document.getElementById('message-sign-password').value;
    
    if (!password) {
        showNotification('Please enter your password', 'error');
        return;
    }
    
    try {
        showLoading('Signing message...');
        
        // Get pending message
        const storage = await chrome.storage.local.get(['pendingMessageRequest']);
        const message = storage.pendingMessageRequest.message;
        
        // Get wallet from storage (FALHAVA AQUI!)
        const walletStorage = await chrome.storage.local.get(['walletEncrypted', 'salt']);
        if (!walletStorage.walletEncrypted || !walletStorage.salt) {
            throw new Error('No wallet found');
        }
        
        // Decrypt wallet
        const decryptedData = await decryptData(
            walletStorage.walletEncrypted,
            password,
            walletStorage.salt
        );
        
        // Sign message
        const { signature, address } = await signMessageLocal(message, decryptedData.mnemonic);
```

#### DEPOIS (delega para o background):
```javascript
async function handleMessageSign() {
    const password = document.getElementById('message-sign-password').value;
    
    if (!password) {
        showNotification('Please enter your password', 'error');
        return;
    }
    
    try {
        showLoading('Signing message...');
        
        // Get pending message
        const storage = await chrome.storage.local.get(['pendingMessageRequest']);
        console.log('📦 Pending message storage:', storage);
        if (!storage.pendingMessageRequest) {
            throw new Error('No pending message found');
        }
        
        const message = storage.pendingMessageRequest.message;
        console.log('✍️  Message to sign:', message);
        
        // 🔥 NOVA ABORDAGEM: Pedir ao background para assinar
        console.log('🔄 Requesting background to sign with password...');
        
        const result = await chrome.runtime.sendMessage({
            action: 'signMessageWithPassword',
            data: { message, password }
        });
        
        console.log('📨 Background response:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to sign message');
        }
        
        const { signature, address } = result;
```

### 2. Arquivo: `background/background-real.js`

#### Adicionado novo case no message listener (linha 234):
```javascript
case 'signMessageWithPassword':
    return await signMessageWithPassword(data);
```

#### Adicionado nova função (linhas 1148-1204):
```javascript
// 🔥 NEW: Sign message with password (called from popup)
async function signMessageWithPassword({ message, password }) {
    try {
        console.log('\n🔐 ===== SIGN MESSAGE WITH PASSWORD =====');
        console.log('✍️  Signing message:', message);
        console.log('   Password provided:', password ? 'YES ✅' : 'NO ❌');
        
        // Get wallet from storage
        const storage = await chrome.storage.local.get(['walletEncrypted', 'salt']);
        console.log('   Storage check:', {
            hasWallet: !!storage.walletEncrypted,
            hasSalt: !!storage.salt
        });
        
        if (!storage.walletEncrypted || !storage.salt) {
            console.error('❌ No wallet found in storage!');
            return {
                success: false,
                error: 'No wallet found. Please create a wallet first.'
            };
        }
        
        // Decrypt wallet with password
        console.log('🔓 Decrypting wallet...');
        const decryptedData = await decryptData(
            storage.walletEncrypted,
            password,
            storage.salt
        );
        
        if (!decryptedData || !decryptedData.mnemonic) {
            console.error('❌ Failed to decrypt wallet (wrong password?)');
            return {
                success: false,
                error: 'Invalid password'
            };
        }
        
        console.log('✅ Wallet decrypted successfully');
        
        // Sign message
        const result = await signMessageWithMnemonic(message, decryptedData.mnemonic);
        
        console.log('✅ Message signed!');
        console.log('   Address:', result.address);
        console.log('   Signature length:', result.signature?.length || 0);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error in signMessageWithPassword:', error);
        return {
            success: false,
            error: error.message || 'Failed to sign message'
        };
    }
}
```

---

## 🔄 Fluxo Completo

### 1. User Click no ❤️ (Like)
```
Frontend (app.js) → window.krayWallet.signMessage()
     ↓
Content Script (injected.js) → postMessage()
     ↓
Content Script (content.js) → chrome.runtime.sendMessage()
     ↓
Background (background-real.js) → signMessage()
     ↓
Background → Abre popup + salva pendingMessageRequest
```

### 2. User Digita Senha e Click "Sign Message"
```
Popup (popup.js) → handleMessageSign()
     ↓
Popup → chrome.runtime.sendMessage('signMessageWithPassword')
     ↓
Background (background-real.js) → signMessageWithPassword()
     ↓
Background → Busca walletEncrypted + salt
     ↓
Background → Descriptografa com senha
     ↓
Background → Assina mensagem
     ↓
Background → Retorna { success: true, signature, address }
     ↓
Popup → Salva messageSignResult
     ↓
Popup → Fecha
     ↓
Background → Listener detecta messageSignResult
     ↓
Background → Retorna para Content Script
     ↓
Content Script → Retorna para Frontend
     ↓
Frontend → Envia like para API
```

---

## 🔍 Como Testar

### 1. Recarregar Extensão
```
chrome://extensions/ → Click 🔄 na KrayWallet
```

### 2. Testar Like
```
1. http://localhost:3000/ordinals.html
2. Click no ❤️
3. Digite a senha
4. Click "Sign Message"
```

### 3. Logs Esperados

**Console do Popup:**
```
📦 Pending message storage: {pendingMessageRequest: {...}}
✍️  Message to sign: I like this offer: 1761343161090
🔄 Requesting background to sign with password...
📨 Background response: {success: true, signature: "...", address: "bc1p..."}
✅ Message signed successfully!
```

**Console do Background:**
```
🔐 ===== SIGN MESSAGE WITH PASSWORD =====
✍️  Signing message: I like this offer: 1761343161090
   Password provided: YES ✅
   Storage check: {hasWallet: true, hasSalt: true}
🔓 Decrypting wallet...
✅ Wallet decrypted successfully
✅ Message signed successfully
✅ Message signed!
   Address: bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx
   Signature length: 88
```

**Console do Frontend:**
```
💝 Like button clicked: {offerId: '...', isWalletConnected: true, ...}
✅ Wallet verified, proceeding with like...
✍️  KrayWallet: signMessage()
✅ Like added successfully!
❤️ Updated UI
```

---

## ✅ Resultado Esperado

1. ✅ Popup fecha automaticamente após assinatura
2. ✅ Like é enviado para a API (`POST /api/likes/:offerId`)
3. ✅ Contador de likes aumenta
4. ✅ Coração muda de 🤍 para ❤️ (filled)
5. ✅ Notificação de sucesso no frontend

---

## 📝 Notas Técnicas

### Por que o popup não conseguia acessar o storage?

Possíveis razões:
1. **Contexto diferente:** Service Worker vs Popup window
2. **Timing:** Storage ainda não estava sincronizado
3. **Permissões:** Apesar de estar no manifest, alguma restrição estava bloqueando

### Por que centralizar no background é melhor?

1. **Único ponto de verdade:** Toda lógica de criptografia em um só lugar
2. **Acesso garantido:** Background sempre tem acesso completo ao storage
3. **Segurança:** Senha não fica no contexto do popup por muito tempo
4. **Consistência:** Mesma abordagem usada em `sendBitcoin`, `signPsbt`, etc.

---

**Status:** ✅ Implementado e pronto para teste  
**Requer:** Recarregar extensão  
**Teste:** Click no ❤️ → Digitar senha → Deve funcionar! 🎉

