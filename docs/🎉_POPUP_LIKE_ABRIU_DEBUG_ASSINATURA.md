# 🎉 Popup de Like Abrindo! Debug da Assinatura

**Data:** 24 de outubro de 2025  
**Status:** ✅ Popup abre corretamente! 🎉 | 🐛 Debugando assinatura

---

## ✅ PROGRESSO ALCANÇADO

### O que está funcionando:
1. ✅ Click no ❤️ detecta wallet conectada
2. ✅ `signMessage()` é chamado corretamente
3. ✅ Background abre o popup automaticamente
4. ✅ Tela "Sign Message" aparece com a mensagem
5. ✅ Campo de senha está presente e focado

### O que ainda não funciona:
- ❌ Ao clicar em "Sign Message", erro: `No wallet found`
- Erro ocorre na linha **8270** de `popup.js`

---

## 🐛 Problema Atual

### Logs do Popup (anterior):
```javascript
popup.js:8300 Error signing message: Error: No wallet found
    at HTMLButtonElement.handleMessageSign (popup.js:8270:19)
```

### Causa Provável:
O `handleMessageSign()` não está conseguindo acessar `walletEncrypted` ou `salt` do `chrome.storage.local`.

Possíveis razões:
1. Wallet está em outro namespace (session vs local)
2. Chaves com nomes diferentes
3. Permissões de storage não sincronizadas entre popup e background

---

## ✅ Solução Implementada

### Arquivo Modificado: `popup/popup.js` (linhas 8256-8287)

#### ANTES:
```javascript
try {
    showLoading('Signing message...');
    
    // Get pending message
    const storage = await chrome.storage.local.get(['pendingMessageRequest']);
    if (!storage.pendingMessageRequest) {
        throw new Error('No pending message found');
    }
    
    const message = storage.pendingMessageRequest.message;
    
    // Get wallet from storage
    const walletStorage = await chrome.storage.local.get(['walletEncrypted', 'salt']);
    if (!walletStorage.walletEncrypted || !walletStorage.salt) {
        throw new Error('No wallet found');
    }
```

#### DEPOIS (Com Debug):
```javascript
try {
    showLoading('Signing message...');
    
    // Get pending message
    const storage = await chrome.storage.local.get(['pendingMessageRequest']);
    console.log('📦 Pending message storage:', storage);  // 🆕
    if (!storage.pendingMessageRequest) {
        throw new Error('No pending message found');
    }
    
    const message = storage.pendingMessageRequest.message;
    console.log('✍️  Message to sign:', message);  // 🆕
    
    // Get wallet from storage
    const walletStorage = await chrome.storage.local.get(['walletEncrypted', 'salt']);
    console.log('🔐 Wallet storage check:', {  // 🆕
        hasWallet: !!walletStorage.walletEncrypted,
        hasSalt: !!walletStorage.salt,
        walletLength: walletStorage.walletEncrypted?.length || 0,
        saltLength: walletStorage.salt?.length || 0
    });
    
    if (!walletStorage.walletEncrypted || !walletStorage.salt) {
        console.error('❌ Wallet not found in storage!');  // 🆕
        console.error('   Available keys:', Object.keys(walletStorage));  // 🆕
        
        // Tentar buscar TODAS as chaves para debug
        const allStorage = await chrome.storage.local.get(null);  // 🆕
        console.error('   All storage keys:', Object.keys(allStorage));  // 🆕
        
        throw new Error('No wallet found. Please unlock your wallet first.');
    }
```

### Mudanças:
1. **🆕 Log de pendingMessageRequest:** Ver se a mensagem está sendo passada corretamente
2. **🆕 Log da mensagem:** Ver o conteúdo exato da mensagem
3. **🆕 Log detalhado do wallet storage:** Ver se wallet e salt existem
4. **🆕 Log de todas as chaves disponíveis:** Ver o que realmente está no storage
5. **🆕 Erro mais específico:** "Please unlock your wallet first" em vez de "No wallet found"

---

## 🔍 Como Testar

### 1. Recarregar Extensão
```
chrome://extensions/ → Click 🔄 na KrayWallet
```

### 2. Abrir Console do POPUP (não Background!)
**IMPORTANTE:** Abrir o console DO POPUP, não da página!

Opções:
- **Opção A:** Click no ❤️ → Popup abre → Right-click no popup → "Inspect"
- **Opção B:** Click no ❤️ → Popup abre → Pressione F12

### 3. Testar Like com Console Aberto
```
1. http://localhost:3000/ordinals.html
2. Click no ❤️
3. Digite a senha
4. Click "Sign Message"
5. OBSERVAR os logs no console do popup
```

### 4. Logs Esperados

**Se funcionar (wallet encontrada):**
```javascript
📦 Pending message storage: {pendingMessageRequest: {message: "...", timestamp: ...}}
✍️  Message to sign: I like this offer: 1761343045923
🔐 Wallet storage check: {
    hasWallet: true,
    hasSalt: true,
    walletLength: 256,
    saltLength: 32
}
✅ Message signed successfully!
```

**Se falhar (wallet não encontrada):**
```javascript
📦 Pending message storage: {pendingMessageRequest: {message: "...", timestamp: ...}}
✍️  Message to sign: I like this offer: 1761343045923
🔐 Wallet storage check: {
    hasWallet: false,
    hasSalt: false,
    walletLength: 0,
    saltLength: 0
}
❌ Wallet not found in storage!
   Available keys: []
   All storage keys: ['pendingMessageRequest', 'pendingPsbtRequest', ...]
```

---

## 🎯 Próximos Passos

Com os logs do console do POPUP, vamos descobrir:
1. ✅ Se `pendingMessageRequest` está sendo passado corretamente
2. ✅ Se a mensagem está íntegra
3. ✅ Se `walletEncrypted` e `salt` existem no storage
4. ✅ Se estão com outros nomes (ex: `wallet_encrypted`)

### Possíveis Soluções (dependendo dos logs):

**Cenário 1:** Wallet está em `chrome.storage.session`
```javascript
// Mudar de:
const walletStorage = await chrome.storage.local.get(['walletEncrypted', 'salt']);

// Para:
const walletStorage = await chrome.storage.session.get(['walletEncrypted', 'salt']);
```

**Cenário 2:** Wallet tem nome diferente
```javascript
// Se logs mostrarem: 'wallet_encrypted' ou 'encrypted_wallet'
const walletStorage = await chrome.storage.local.get(['wallet_encrypted', 'salt']);
```

**Cenário 3:** Usar walletState do background
```javascript
// Pedir ao background para descriptografar
const result = await chrome.runtime.sendMessage({
    action: 'signMessage',
    data: { message, password }
});
```

---

## 📋 Informações para Enviar

Por favor, envie os logs do **console do POPUP** (não do background), a partir de:
```
📦 Pending message storage: ...
```

Até o erro ou sucesso.

---

**Status:** 🐛 Aguardando logs do popup para identificar causa raiz  
**Próximo:** Fix definitivo baseado nos logs  
**Teste:** Recarregar extensão + Abrir console do popup + Click no ❤️

