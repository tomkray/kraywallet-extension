# 🔍 **DEBUG - RUNES SWAP NÃO MOSTRA DADOS**

## 📅 Data: 23 de Outubro de 2025

---

## 🎯 **CORREÇÕES APLICADAS:**

```javascript
✅ Event listeners corrigidos
   - ANTES: Procurava <select> elements (não existem)
   - AGORA: Usa botões fromTokenBtn e toTokenBtn

✅ Logs adicionados
   - openTokenModal() → Mostra dados carregados
   - loadTokenList() → Mostra tokens sendo adicionados
   - loadUserWalletData() → Mostra dados da wallet

✅ Modal corrigido
   - Event listeners para fechar
   - Click fora fecha
   - Busca funciona
```

---

## 🧪 **TESTE PASSO A PASSO COM DEBUG:**

### **1. Recarregar Página**

```bash
# 1. Abrir console do navegador (F12)
http://localhost:3000/runes-swap.html

# 2. Limpar console (Ctrl+L ou Cmd+K)
```

### **2. Conectar Wallet**

```bash
# 1. Clicar "Connect Wallet"

# 2. Escolher MyWallet

# 3. Desbloquear se necessário

# ✅ CONSOLE DEVE MOSTRAR:
📊 Loading user wallet data from MyWallet...
💰 Bitcoin Balance: XXXXX sats
🪙 Found X Runes: [array de runes]
✅ Loaded X Runes + Bitcoin

# SE NÃO MOSTRAR:
# → Problema: window.myWallet.getFullWalletData() não existe
# → SOLUÇÃO: Recarregar extensão MyWallet
#   chrome://extensions → MyWallet → Recarregar
```

### **3. Clicar "Select token" (FROM)**

```bash
# 1. Clicar no botão "Select token" do campo FROM

# ✅ CONSOLE DEVE MOSTRAR:
🎯 FROM token button clicked
🔓 Opening token modal for: from
   💰 Bitcoin Balance: XXXXX sats
   🪙 Runes Count: X
   🔌 Wallet Connected: true
   📍 Address: bc1p...
📋 Loading token list...
   📊 Data available:
   - Bitcoin: XXXXX sats
   - Runes: X
   - Wallet: Connected
✅ Populating token list...

# SE NÃO MOSTRAR:
# → Problema 1: Event listener não foi adicionado
# → Verificar: console.log no DOMContentLoaded

# SE MOSTRAR MAS RUNES: 0
# → Problema 2: Dados não foram carregados
# → Ver seção "Problema: Runes não carregam" abaixo
```

### **4. Ver Modal com Tokens**

```bash
# ✅ MODAL DEVE ABRIR E MOSTRAR:
# - Bitcoin com balance (se tiver)
# - Lista de Runes (se tiver)
# - Com thumbnails
# - Com balances

# SE MODAL NÃO ABRE:
# → Verificar HTML: <div id="tokenModal"> existe?
# → Verificar CSS: .hidden está aplicado?

# SE MODAL ABRE MAS ESTÁ VAZIO:
# → Ver logs do console
# → Se mostrar "No tokens found"
#   → Dados não foram carregados
```

---

## 🔧 **PROBLEMAS COMUNS E SOLUÇÕES:**

### **Problema 1: "FROM token button clicked" não aparece**

```bash
CAUSA: Event listener não foi adicionado

SOLUÇÃO:
# Console → Verificar:
document.getElementById('fromTokenBtn')

# Se retornar null:
# → HTML não tem id="fromTokenBtn"
# → Verificar runes-swap.html linha ~68

# Se retornar o elemento:
# → Event listener pode ter erro
# → Recarregar página
```

### **Problema 2: Runes não carregam (Count: 0)**

```bash
CAUSA: window.myWallet.getFullWalletData() falhou

SOLUÇÃO:
# Console → Testar manualmente:
await window.myWallet.getFullWalletData()

# Se retornar undefined:
# → MyWallet extension não injetou API
# → Recarregar extensão:
#   chrome://extensions → MyWallet → Recarregar

# Se retornar erro:
# → Wallet pode estar locked
# → Desbloquear popup da MyWallet
```

### **Problema 3: Modal abre mas mostra "No tokens found"**

```bash
CAUSA: userRunes e userBitcoinBalance são 0

DEBUG:
# Console → Verificar variáveis:
console.log('Bitcoin:', userBitcoinBalance);
console.log('Runes:', userRunes);

# Se ambos são 0:
# → loadUserWalletData() não foi chamado
# → Ou falhou silenciosamente

# Testar manualmente:
await loadUserWalletData()

# Ver o que retorna
```

### **Problema 4: Event 'walletConnected' não dispara**

```bash
CAUSA: wallet-connect.js não está despachando evento

DEBUG:
# Console → Após conectar, testar:
window.dispatchEvent(new CustomEvent('walletConnected', {
    detail: { address: 'bc1p...', walletType: 'mywallet' }
}));

# Se loadUserWalletData() rodar:
# → Problema é no wallet-connect.js
# → Verificar se está incluído no HTML
```

---

## 🧩 **CHECKLIST COMPLETO:**

```
□ MyWallet extension está carregada?
  → chrome://extensions → MyWallet

□ MyWallet está desbloqueada?
  → Abrir popup e verificar

□ runes-swap.html inclui wallet-connect.js?
  → Ver HTML linha ~400: <script src="public/js/wallet-connect.js">

□ Console mostra "📊 Loading user wallet data..."?
  → Conectar wallet e verificar

□ Console mostra "🎯 FROM token button clicked"?
  → Clicar botão Select token

□ Modal tem id="tokenModal"?
  → Inspecionar HTML

□ tokenList tem id="tokenList"?
  → Inspecionar HTML dentro do modal

□ window.myWallet existe?
  → Console: typeof window.myWallet

□ window.myWallet.getFullWalletData existe?
  → Console: typeof window.myWallet.getFullWalletData
```

---

## 📋 **COMANDOS ÚTEIS NO CONSOLE:**

```javascript
// 1. Verificar MyWallet API
typeof window.myWallet
// Deve retornar: "object"

// 2. Testar getFullWalletData
await window.myWallet.getFullWalletData()
// Deve retornar: { success: true, balance: {...}, runes: [...], ... }

// 3. Verificar variáveis
console.log('Connected:', isWalletConnected);
console.log('Address:', connectedAddress);
console.log('Balance:', userBitcoinBalance);
console.log('Runes:', userRunes);

// 4. Forçar carregamento
await loadUserWalletData()
// Ver console logs

// 5. Abrir modal manualmente
openTokenModal('from')
// Ver se modal abre

// 6. Ver elementos HTML
document.getElementById('fromTokenBtn')
document.getElementById('tokenModal')
document.getElementById('tokenList')

// 7. Disparar evento manualmente
window.dispatchEvent(new CustomEvent('walletConnected', {
    detail: { 
        address: 'bc1p7a8qwertyuiopasdfghjklzxcvbnm1234567890',
        walletType: 'mywallet' 
    }
}));
```

---

## 🎯 **TESTE RÁPIDO (1 MINUTO):**

```bash
# 1. F12 → Console

# 2. Conectar MyWallet

# 3. Colar no console:
console.log('=== DEBUG ===');
console.log('Wallet API:', typeof window.myWallet);
console.log('Connected:', isWalletConnected);
console.log('Address:', connectedAddress);
console.log('Balance:', userBitcoinBalance);
console.log('Runes:', userRunes.length);
console.log('fromTokenBtn:', document.getElementById('fromTokenBtn'));
console.log('tokenModal:', document.getElementById('tokenModal'));

# 4. Analisar output:
# → Se algum for null/undefined/0/false
#   → Problema identificado!
```

---

## 🚀 **TESTE FINAL (SE TUDO DER CERTO):**

```bash
# 1. Recarregar página

# 2. Limpar console

# 3. Conectar MyWallet

# ✅ Console mostra:
📊 Loading user wallet data from MyWallet...
💰 Bitcoin Balance: 10000 sats
🪙 Found 3 Runes: [...]
✅ Loaded 3 Runes + Bitcoin

# 4. Clicar "Select token" (FROM)

# ✅ Console mostra:
🎯 FROM token button clicked
🔓 Opening token modal for: from
   💰 Bitcoin Balance: 10000 sats
   🪙 Runes Count: 3
   🔌 Wallet Connected: true
   📍 Address: bc1p...
📋 Loading token list...
✅ Populating token list...

# 5. Modal abre com:
# ✅ Bitcoin: 0.00010000 BTC
# ✅ UNCOMMON•GOODS: 1.5M
# ✅ DOG•GO: 2.3M

# 🎉 FUNCIONANDO!
```

---

**Status:** 🔧 **DEBUGGING TOOLS ADDED**  
**Data:** 23 de Outubro de 2025  
**Autor:** Kray Station Team




