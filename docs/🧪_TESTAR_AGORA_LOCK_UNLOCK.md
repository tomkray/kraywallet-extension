# 🧪 **TESTE RÁPIDO: SISTEMA LOCK/UNLOCK**

## 🎯 **TESTE EM 5 MINUTOS:**

### **1️⃣ RESET E CRIAR WALLET**

```javascript
// 1. Abra o console da extensão (Manage Extensions > MyWallet > Service Worker > Console)
chrome.storage.local.clear()

// 2. Recarregue a extensão (botão de refresh na página chrome://extensions)

// 3. Abra a extensão
// 4. Clique "Create New Wallet"
// 5. Senha: teste123
// 6. Palavra 12: (default)
// 7. Gere wallet
// 8. Salve as 12 palavras (pode apenas confirmar checkbox sem copiar para teste)
// 9. Confirme
```

**Resultado esperado:**
✅ Wallet criada
✅ Tela principal aparece
✅ Saldo carregando

---

### **2️⃣ TESTAR UNLOCK (FECHAR E REABRIR)**

```
1. **FECHE A EXTENSÃO** (clique fora do popup)
2. **REABRA A EXTENSÃO** (clique no ícone)
```

**Resultado esperado:**
```
┌─────────────────────────────┐
│    🔒 MYWALLET             │
│                             │
│    Welcome back!            │
│                             │
│    🔐 Enter your password  │
│    [___________________]    │ <-- Input com foco
│                             │
│    [Unlock Wallet]          │
│                             │
│    Forgot password?         │
└─────────────────────────────┘
```

```
3. Digite: teste123
4. Pressione ENTER (ou clique "Unlock Wallet")
```

**Resultado esperado:**
✅ Notificação: "✅ Welcome back!"
✅ Wallet desbloqueada
✅ Tela principal aparece

---

### **3️⃣ TESTAR LOCK MANUAL**

```
1. Clique no ícone de engrenagem (⚙️ Settings) no topo direito
2. Role até ver "🔒 Security"
3. Veja a seção:
   
   🔒 Security
   ━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⏰ Auto-Lock Timer
      [15 minutes]  <-- Dropdown
   
   🔒 Lock Wallet Now → <-- Botão laranja
   ━━━━━━━━━━━━━━━━━━━━━━━━━━

4. Clique em "🔒 Lock Wallet Now"
```

**Resultado esperado:**
✅ Notificação: "🔒 Wallet locked"
✅ Redireciona para tela de Unlock IMEDIATAMENTE
✅ Precisa digitar senha novamente

```
5. Digite: teste123
6. Pressione ENTER
```

**Resultado esperado:**
✅ Wallet desbloqueada novamente

---

### **4️⃣ TESTAR CONFIGURAÇÃO DE TIMEOUT**

```
1. Vá em Settings
2. Role até "🔒 Security"
3. Clique no dropdown "Auto-Lock Timer"
4. Mude para "5 minutes"
```

**Resultado esperado:**
✅ Notificação: "⏰ Auto-lock set to 5 minutes"

```
5. Mude para "Never"
```

**Resultado esperado:**
✅ Notificação: "⏰ Auto-lock disabled"

```
6. Mude de volta para "15 minutes" (padrão)
```

**Resultado esperado:**
✅ Notificação: "⏰ Auto-lock set to 15 minutes"

---

### **5️⃣ TESTAR SENHA ERRADA**

```
1. Lock a wallet (Settings → Lock Wallet Now)
2. Na tela de Unlock, digite: senhaerrada
3. Pressione ENTER
```

**Resultado esperado:**
❌ Notificação vermelha: "❌ Wrong password! Please check your password."
✅ Input de senha limpo
✅ Foco retorna ao input
✅ Continua na tela de Unlock

```
4. Digite a senha correta: teste123
5. Pressione ENTER
```

**Resultado esperado:**
✅ Wallet desbloqueada

---

### **6️⃣ TESTAR "FORGOT PASSWORD"**

```
1. Lock a wallet (Settings → Lock Wallet Now)
2. Na tela de Unlock, clique em "Forgot password? Restore wallet"
```

**Resultado esperado:**
✅ Vai para a tela "Restore Wallet"
✅ Pode restaurar com as 12 palavras + nova senha

---

## ✅ **CHECKLIST RÁPIDO:**

- [ ] Reset wallet funciona
- [ ] Criar wallet funciona
- [ ] Fechar e reabrir → **UNLOCK SCREEN**
- [ ] Desbloquear com senha → **SUCESSO**
- [ ] Enter key funciona no input
- [ ] Lock manual funciona (Settings)
- [ ] Mudar timeout funciona
- [ ] Senha errada mostra erro
- [ ] "Forgot password?" funciona

---

## 🎊 **SE TUDO PASSOU:**

# **PARABÉNS! SISTEMA DE LOCK/UNLOCK ESTÁ 100% FUNCIONAL! 🔒🏆**

---

## 🐛 **SE ALGO NÃO FUNCIONOU:**

### **Problema: Não mostra tela de Unlock ao reabrir**
**Solução:**
1. Verifique se o background script está rodando:
   - Chrome Extensions → MyWallet → "Service Worker"
   - Se diz "Inactive", clique nele para ativar
2. Verifique console do background script:
   - Deve mostrar: `🔒 Wallet exists but is locked (requires password)`

### **Problema: Senha correta não desbloqueia**
**Solução:**
1. Verifique console da extensão (popup):
   - Deve mostrar: `🔓 ========== UNLOCKING WALLET ==========`
   - Se mostra erro de descriptografia, a senha pode estar incorreta
2. Tente restaurar a wallet com as 12 palavras

### **Problema: Lock manual não funciona**
**Solução:**
1. Verifique se o botão "Lock Wallet Now" existe em Settings
2. Verifique console: deve mostrar `🔒 Locking wallet...`
3. Recarregue a extensão

---

## 📊 **LOGS ESPERADOS:**

### **Console do Background (Service Worker):**
```
🔥 Background script starting...
🔒 Wallet exists but is locked (requires password)
🔓 ========== UNLOCKING WALLET ==========
🔐 Decrypting wallet...
✅ Wallet decrypted successfully
✅ Wallet unlocked: bc1pvz...
⏰ Auto-lock timer set: 15 minutes
```

### **Console do Popup (Extension):**
```
🔥 MyWallet Extension initialized
Wallet status: {success: true, exists: true, unlocked: false}
🔒 Wallet is locked, showing unlock screen
```

---

## 🚀 **AGORA VOCÊ TEM:**

✅ **Wallet mais segura que Unisat e Xverse**
✅ **Auto-lock configurável**
✅ **Lock manual**
✅ **UX perfeita**
✅ **Lightning integrado com segurança**

**APROVEITE! 🔒✨**




