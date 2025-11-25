# 🧪 **TESTAR CONEXÃO PERSISTENTE - GUIA RÁPIDO**

## 🎯 O que vamos testar:

✅ Wallet **permanece conectada** ao trocar de página  
✅ Wallet **desconecta automaticamente** ao dar lock

---

## 📝 **PASSO A PASSO:**

### **1. RECARREGAR EXTENSÃO**
```
chrome://extensions
→ MyWallet → Recarregar 🔄
```

---

### **2. CONECTAR WALLET (Home)**
```
http://localhost:3000/

1. Clicar "Connect Wallet"
2. Clicar "MyWallet"
3. Desbloquear se necessário
4. ✅ Ver seu address no header
```

**Console deve mostrar:**
```
💾 Saved wallet state to localStorage
✅ MyWallet connected: bc1p...
```

---

### **3. VERIFICAR LOCALSTORAGE**
```
F12 → Console → Digite:

localStorage.getItem('krayspace_wallet_state')
```

**Deve retornar:**
```json
{
  "connected": true,
  "address": "bc1p...",
  "walletType": "mywallet",
  "balance": null
}
```

---

### **4. TROCAR PARA ORDINALS**
```
Clicar "Ordinals" no menu
```

**✅ ESPERADO:**
- Address **CONTINUA** no header
- **NÃO** pede para conectar de novo

**Console deve mostrar:**
```
💾 Loaded wallet state from localStorage: {...}
💾 Found saved connection: {...}
✅ Restored connection from localStorage
```

---

### **5. TROCAR PARA RUNES SWAP**
```
Clicar "Runes (On-chain)" no menu
```

**✅ ESPERADO:**
- Address **CONTINUA** no header
- Runes carregam automaticamente
- Modal de tokens funciona

**Console deve mostrar:**
```
💾 Loaded wallet state from localStorage
📊 Loading user wallet data from MyWallet...
🪙 Found X Runes: [...]
```

---

### **6. TROCAR PARA LIGHTNING DEX**
```
Clicar "⚡ Lightning DEX" no menu
```

**✅ ESPERADO:**
- Address **CONTINUA** no header
- Pools carregam
- Conexão mantida

---

### **7. LOCK MANUAL (Desconectar)**
```
1. Abrir popup da MyWallet (clicar no ícone)
2. Clicar "Settings" ⚙️
3. Clicar "Lock Wallet Now" 🔒
```

**✅ ESPERADO:**
- Popup: "🔒 MyWallet locked"
- **TODAS AS PÁGINAS** desconectam
- Address **DESAPARECE** do header
- Botão "Connect Wallet" **VOLTA**

**Console deve mostrar:**
```
🔒 Wallet locked, notifying page...
🔒 MyWallet locked, disconnecting frontend...
🔌 Disconnecting wallet...
🗑️ Cleared wallet state from localStorage
✅ Wallet disconnected
```

---

### **8. VERIFICAR LOCALSTORAGE (Limpo)**
```
F12 → Console → Digite:

localStorage.getItem('krayspace_wallet_state')
```

**Deve retornar:**
```
null
```

---

### **9. TROCAR DE PÁGINA (Ainda Desconectado)**
```
Clicar "Home" ou qualquer outra página
```

**✅ ESPERADO:**
- Botão "Connect Wallet" aparece
- **NÃO** restaura conexão automaticamente
- Precisa conectar de novo (correto!)

---

## ✅ **CHECKLIST DE SUCESSO:**

```
✅ Conecta uma vez na Home
✅ Address aparece no header
✅ Navega para Ordinals → Address continua
✅ Navega para Runes Swap → Address continua
✅ Navega para Lightning DEX → Address continua
✅ Dá lock → Address desaparece em TODAS as páginas
✅ localStorage é limpo
✅ Precisa reconectar (segurança)
```

---

## 🔍 **DEBUG (Se algo não funcionar):**

### **Problema: Address não aparece após trocar página**

```javascript
// Console:
localStorage.getItem('krayspace_wallet_state')

// Se retornar null:
// → Problema: Estado não foi salvo
// → Verificar console ao conectar (deve ter "💾 Saved...")

// Se retornar {...}:
// → Problema: loadWalletState() não está rodando
// → Verificar console ao carregar (deve ter "💾 Loaded...")
```

### **Problema: Não desconecta ao dar lock**

```javascript
// Console da página:
// Deve mostrar:
"🔒 Wallet locked, notifying page..."

// Se não mostrar:
// → Verificar content.js foi recarregado
// → Recarregar extensão novamente
```

---

## 🎉 **TUDO FUNCIONANDO?**

```
SIM:
✅ Conexão persiste entre páginas
✅ Desconecta automaticamente ao lock
✅ localStorage é usado corretamente
✅ MyWallet e Kray Space sincronizados

PRONTO PARA PRODUÇÃO! 🚀
```

---

**Data:** 23 de Outubro de 2025  
**Autor:** Kray Station Team




