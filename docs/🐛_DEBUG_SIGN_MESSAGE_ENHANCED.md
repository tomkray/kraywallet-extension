# 🐛 Debug Enhanced: Sign Message for Likes

**Data:** 24 de outubro de 2025  
**Problema:** Erro "No wallet found. Please create a wallet first." ao tentar assinar mensagem para likes.

---

## 🐛 Problema Identificado

### Sintomas
```javascript
app.js:714 💝 Like button clicked: {offerId: '...', isWalletConnected: true, ...}
app.js:734 ✅ Wallet verified, proceeding with like...
injected.js:294 ✍️  KrayWallet: signMessage()
content.js:80 📨 KrayWallet request: signMessage
app.js:794 ❌ Error processing like: Error: No wallet found. Please create a wallet first.
```

- Frontend detecta wallet conectada ✅
- `signMessage()` é chamado corretamente ✅
- **Background rejeita** com erro "No wallet found" ❌

### Causa Provável
O `signMessage()` no background estava checando `chrome.storage.local` por `walletEncrypted` e `salt`, mas pode haver casos onde:
1. Service Worker reiniciou e perdeu referência
2. Storage tem wallet com nome diferente
3. `walletState` tem dados mas storage não foi checado completamente

---

## ✅ Solução Implementada

### Arquivo Modificado: `background/background-real.js`

#### ANTES (linhas 971-989):
```javascript
async function signMessage({ message }) {
    try {
        console.log('✍️  Signing message:', message);
        console.log('   Wallet state:', { unlocked: walletState.unlocked, exists: !!walletState.address });
        
        // Verificar se há wallet
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
```

#### DEPOIS (Enhanced Debug + Fallback):
```javascript
async function signMessage({ message }) {
    try {
        console.log('\n🔐 ===== SIGN MESSAGE CALLED =====');
        console.log('✍️  Signing message:', message);
        console.log('   Wallet state:', { 
            unlocked: walletState.unlocked, 
            exists: !!walletState.address,
            address: walletState.address  // 🆕 Mostrar address
        });
        
        // Verificar se há wallet
        const storage = await chrome.storage.local.get(['walletEncrypted', 'salt']);
        console.log('   Storage check:', {
            hasWallet: !!storage.walletEncrypted,
            hasSalt: !!storage.salt,
            walletLength: storage.walletEncrypted?.length || 0  // 🆕 Tamanho da wallet
        });
        
        // 🔥 FIX: Se não encontrar no storage, mas walletState tem address, tentar recarregar
        if (!storage.walletEncrypted || !storage.salt) {
            console.warn('⚠️  Wallet not found in storage, checking walletState...');
            
            // Se walletState tem address, significa que a wallet existe mas não foi carregada
            if (walletState.address) {
                console.log('✅ WalletState has address, wallet exists! Reloading wallet info...');
                // Tentar recarregar wallet do storage com todas as chaves possíveis
                const fullStorage = await chrome.storage.local.get(null);
                console.log('   Full storage keys:', Object.keys(fullStorage));  // 🆕 Ver TODAS as chaves
                
                // Se encontrou alguma wallet encrypted com outro nome
                if (Object.keys(fullStorage).some(k => k.includes('wallet') || k.includes('Wallet'))) {
                    console.log('✅ Found wallet-related keys in storage');
                    // Continuar com o fluxo de popup
                } else {
                    console.error('❌ No wallet found in storage!');
                    return {
                        success: false,
                        error: 'No wallet found. Please unlock your wallet first.'
                    };
                }
            } else {
                console.error('❌ No wallet found in storage and walletState is empty!');
                return {
                    success: false,
                    error: 'No wallet found. Please create a wallet first.'
                };
            }
        }
```

### Mudanças Principais

1. **🆕 Logs Detalhados:**
   - Banner `🔐 ===== SIGN MESSAGE CALLED =====`
   - Mostra `address` completo no walletState
   - Mostra tamanho da wallet encrypted (`walletLength`)
   - Lista **TODAS** as chaves do storage (`Object.keys(fullStorage)`)

2. **🔥 Fallback Logic:**
   - Se `walletEncrypted` não for encontrado, mas `walletState.address` existe
   - Busca **todas** as chaves do storage
   - Procura por qualquer chave que contenha "wallet" ou "Wallet"
   - Continua com o fluxo se encontrar

3. **📝 Mensagens de Erro Específicas:**
   - "Please **unlock** your wallet first" (se walletState tem address)
   - "Please **create** a wallet first" (se walletState está vazio)

---

## 🔍 Como Testar

### 1. Recarregar Extensão
```bash
chrome://extensions/
→ Click no ícone 🔄 da KrayWallet
```

### 2. Abrir DevTools do Background
```bash
chrome://extensions/
→ Click em "service worker" (link azul) abaixo de KrayWallet
→ DevTools abre
```

### 3. Testar Like
```bash
1. Abrir: http://localhost:3000/ordinals.html
2. Click no ❤️ de qualquer inscription
3. Observar logs no DevTools do Background
```

### 4. Logs Esperados (Sucesso)
```
🔐 ===== SIGN MESSAGE CALLED =====
✍️  Signing message: I like this offer: 1761342838338
   Wallet state: { unlocked: false, exists: true, address: 'bc1p...' }
   Storage check: { hasWallet: true, hasSalt: true, walletLength: 256 }
🔓 Wallet is locked, opening popup for password...
✅ Popup opened
```

### 5. Logs para Debug (Se falhar)
```
🔐 ===== SIGN MESSAGE CALLED =====
✍️  Signing message: I like this offer: 1761342838338
   Wallet state: { unlocked: false, exists: false, address: undefined }
   Storage check: { hasWallet: false, hasSalt: false, walletLength: 0 }
⚠️  Wallet not found in storage, checking walletState...
   Full storage keys: ['pendingPsbtRequest', 'walletEncrypted', 'salt', ...]
✅ Found wallet-related keys in storage
🔓 Wallet is locked, opening popup for password...
```

---

## 📋 Próximos Passos

1. **Usuário deve:**
   - Recarregar extensão
   - Abrir DevTools do Background
   - Click no ❤️
   - **Enviar logs completos** a partir de `🔐 ===== SIGN MESSAGE CALLED =====`

2. **Com os logs, podemos:**
   - Ver exatamente onde está falhando
   - Ver se wallet existe no storage
   - Ver se walletState está populado
   - Ver todas as chaves do storage

3. **Possíveis Descobertas:**
   - Wallet com nome diferente no storage
   - WalletState não está sendo inicializado
   - Storage está vazio (wallet não criada)
   - Service Worker perdeu contexto

---

## 🎯 Objetivo

Identificar a causa raiz do erro "No wallet found" com logs detalhados e implementar fallback para garantir que a wallet seja encontrada se ela existir no sistema.

---

**Status:** 🐛 Debug em andamento  
**Aguardando:** Logs do Background após teste  
**Próximo:** Análise dos logs e fix definitivo

