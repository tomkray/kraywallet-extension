# 🆘 EMERGÊNCIA - NADA ESTÁ FUNCIONANDO!

## 🚨 **SINTOMAS:**

- ❌ Ordinals tab: NÃO mostra inscriptions
- ❌ Runes tab: NÃO mostra runes  
- ❌ Activity tab: NÃO mostra transações
- ⚠️  Aparecem e depois SOMEM

---

## 🔍 **DIAGNÓSTICO IMEDIATO:**

### **1️⃣ VERIFICAR EXTENSÃO NO CHROME:**

```
1. Abra: chrome://extensions
2. Encontre: MyWallet
3. Verifique:
   ✅ Extension está ATIVADA (toggle azul)?
   ✅ Não há erros em vermelho?
   ✅ Service Worker está "ativo" (não "inativo")?
```

**Se houver erros:**
- Clique em "Errors" para ver detalhes
- Copie os erros e me envie

---

### **2️⃣ ABRIR CONSOLE DO BACKGROUND:**

```
1. chrome://extensions
2. Developer mode: ON
3. MyWallet → Clique em "service worker" ou "background page"
4. Console deve abrir
```

**Procure por erros em VERMELHO:**
```
❌ Uncaught Error: ...
❌ TypeError: ...
❌ ReferenceError: ...
```

**Se houver erros, me envie!**

---

### **3️⃣ ABRIR CONSOLE DO POPUP:**

```
1. Clique no ícone da MyWallet (abre popup)
2. Clique DIREITO em qualquer lugar do popup
3. Selecione: "Inspecionar" ou "Inspect"
4. Console deve abrir
```

**Procure por:**
```
❌ Erros em vermelho
⚠️  loadOrdinalsInProgress = true (e nunca volta false)
🔍 "Loading inscriptions..." mas sem resposta
```

---

### **4️⃣ VERIFICAR SERVIDOR BACKEND:**

```bash
# Ver se está rodando
lsof -ti:3000

# Testar API
curl http://localhost:3000/api/health

# Ver logs
tail -50 server-with-numbers.log
```

**Resultado esperado:**
```json
{"status":"ok","version":"0.23.3","timestamp":"..."}
```

---

### **5️⃣ VERIFICAR ORD SERVER:**

```bash
# Ver se está rodando
lsof -ti:80

# Testar
curl http://127.0.0.1:80/
```

**Resultado esperado:**
```html
<!doctype html>
<html lang=en>
  <head>
    <title>Ordinals</title>
```

---

## 🔧 **SOLUÇÕES RÁPIDAS:**

### **Solução 1: HARD RELOAD da Extensão**

```
1. chrome://extensions
2. MyWallet → ❌ REMOVER
3. Aguarde 5 segundos
4. Clique em "Load unpacked"
5. Selecione: /Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension
6. Teste novamente
```

---

### **Solução 2: LIMPAR CACHE e RECARREGAR**

```
1. chrome://extensions
2. MyWallet → Console do service worker
3. No console, rode:
   chrome.storage.local.clear(() => console.log('Cache cleared!'))
4. Recarregue a extensão (🔄)
5. Recrie/Restaure a wallet
6. Teste novamente
```

---

### **Solução 3: REINICIAR SERVIDOR BACKEND**

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
pkill -9 node
sleep 2
npm start
```

---

### **Solução 4: REVERTER MUDANÇAS**

Se as mudanças que fizemos quebraram tudo:

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
git status
git diff mywallet-extension/popup/popup.js
```

**Para reverter:**
```bash
git checkout mywallet-extension/popup/popup.js
git checkout mywallet-extension/background/background-real.js
```

Depois:
```
chrome://extensions → MyWallet → 🔄 Reload
```

---

## 📋 **CHECKLIST COMPLETO:**

```
□ Extensão está ativada?
□ Não há erros no console do background?
□ Não há erros no console do popup?
□ Servidor backend está rodando (porta 3000)?
□ API /api/health responde OK?
□ ORD server está rodando (porta 80)?
□ Wallet foi criada/restaurada?
□ Wallet está unlocked?
□ Endereço tem inscriptions/runes?
```

---

## 🐛 **DEBUG PASSO A PASSO:**

### **Passo 1: Abrir Popup e Ver Console**

```
1. Abrir MyWallet popup
2. F12 ou Botão Direito → Inspect
3. Console
4. Procurar mensagens:
   🖼️ Loading ordinals for address: ...
   📦 Inscriptions response: ...
   ✅ Found X inscriptions
```

**Se VER "Found X inscriptions" mas NÃO aparecer:**
- ✅ API está funcionando
- ❌ Problema no RENDERING (DOM)

**Se NÃO VER "Found X inscriptions":**
- ❌ API não está respondendo ou retornou vazio

---

### **Passo 2: Testar API Manualmente**

```bash
# No terminal:
curl "http://localhost:3000/api/ordinals/by-address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
```

**Deve retornar:**
```json
{
  "success": true,
  "inscriptions": [ ... ],
  "count": 1
}
```

**Se retornar vazio:**
- Problema no ORD server ou no endereço

---

### **Passo 3: Verificar Flags de Proteção**

No console do popup, rode:

```javascript
console.log('loadOrdinalsInProgress:', loadOrdinalsInProgress);
console.log('loadRunesInProgress:', loadRunesInProgress);
```

**Se ambos forem `true`:**
- ❌ As flags travaram!
- Solução: Recarregar extensão

---

## 🆘 **SE NADA FUNCIONAR:**

**Me envie:**

1. ✅ Print do console do background (erros)
2. ✅ Print do console do popup (erros)
3. ✅ Resultado de: `curl http://localhost:3000/api/health`
4. ✅ Resultado de: `lsof -ti:3000` e `lsof -ti:80`
5. ✅ Últimas 50 linhas do log: `tail -50 server-with-numbers.log`

---

**Data:** 23/10/2024  
**Status:** 🆘 MODO EMERGÊNCIA  
**Prioridade:** CRÍTICA


