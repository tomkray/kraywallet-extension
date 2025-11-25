# 🔍 DEBUG: Por que as Inscriptions Somem na MyWallet?

## 🎯 **COMO DEBUGAR:**

### **1️⃣ Abrir Console do Background Script:**

```
1. Abra: chrome://extensions
2. Ative: "Developer mode" (canto superior direito)
3. Encontre: MyWallet
4. Clique em: "service worker" ou "background.html" ou "Inspect views"
```

Isso abrirá o **DevTools do background script**.

---

### **2️⃣ Abrir Console do Popup:**

```
1. Clique no ícone da MyWallet (abre o popup)
2. Clique com botão direito em qualquer lugar do popup
3. Selecione: "Inspect" ou "Inspecionar"
```

Isso abrirá o **DevTools do popup**.

---

### **3️⃣ O Que Procurar nos Logs:**

#### **No Console do Background Script:**

Procure por:
```
📡 Fetching inscriptions from ORD server for: bc1p...
   ✅ Found X inscription references in address page
      ✅ 0f1519057f8704cb... → #831
✅ Returning X inscriptions for bc1p...
📦 FINAL RESULT - Returning X inscriptions
```

**Se aparecer:**
- ✅ `Returning 1 inscriptions` = Backend está OK
- ❌ `Returning 0 inscriptions` = Problema no filtro ou API

#### **No Console do Popup:**

Procure por:
```
🖼️  Ordinals tab selected, loading inscriptions...
📍 Got wallet address: bc1p...
📦 Inscriptions response: {success: true, inscriptions: [...]}
   response.success: true
   response.inscriptions: Array(1)
   inscriptions.length: 1
✅ Found 1 inscriptions
   Creating container for: 0f1519057f8704cb...
✅ All containers created!
```

**Se aparecer:**
- ✅ `Found 1 inscriptions` e `All containers created!` = Frontend está OK
- ❌ `No inscriptions found` = Problema na resposta da API

---

### **4️⃣ Verificar se Há Erros:**

#### **Erros Comuns:**

1. **`response.inscriptions is undefined`**
   - Problema: Background não está retornando o formato correto

2. **`Failed to load inscriptions`**
   - Problema: API do backend não respondeu

3. **`Container created but disappeared`**
   - Problema: Há algum código que remove os containers depois

---

### **5️⃣ Teste Manual da API:**

Abra o Terminal e rode:

```bash
# Testar API de inscriptions
curl "http://localhost:3000/api/ordinals/by-address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
```

**Resultado esperado:**
```json
{
  "success": true,
  "inscriptions": [
    {
      "inscription_id": "0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831",
      "inscription_number": 831,
      "content_type": "unknown",
      "output_value": null,
      "address": "bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx",
      "preview": "http://127.0.0.1:80/content/0f1519057f8704cb..."
    }
  ],
  "count": 1
}
```

---

### **6️⃣ Verificar se Extensão Foi Recarregada:**

```
1. chrome://extensions
2. MyWallet → 🔄 Reload
3. Fechar e abrir o popup novamente
```

---

### **7️⃣ Verificar se Há Cache:**

No console do **Background Script**, rode:

```javascript
chrome.storage.local.get(null, (data) => console.log(data));
```

Procure por:
- `pendingInscriptions` - Pode ter inscriptions antigas em cache

Para limpar:
```javascript
chrome.storage.local.clear(() => console.log('Cache cleared!'));
```

---

## 🐛 **POSSÍVEIS CAUSAS:**

### **Causa #1: API do Backend Travando**
- **Sintoma:** "Loading inscriptions..." fica travado
- **Solução:** Verificar se ORD server está respondendo rápido

### **Causa #2: Filtro Ainda Ativo**
- **Sintoma:** Backend retorna inscriptions, mas popup não mostra
- **Solução:** Verificar se o filtro de offers foi realmente removido

### **Causa #3: Formato de Resposta Incorreto**
- **Sintoma:** `response.inscriptions is undefined`
- **Solução:** Verificar estrutura da resposta do background script

### **Causa #4: Cache Antigo**
- **Sintoma:** Mostra inscriptions antigas ou duplicadas
- **Solução:** Limpar `chrome.storage.local`

### **Causa #5: Código Assíncrono**
- **Sintoma:** Containers aparecem e depois somem
- **Solução:** Verificar se há múltiplas chamadas a `loadOrdinals()`

---

## ✅ **CHECKLIST DE DEBUGGING:**

```
□ Servidor rodando na porta 3000?
□ ORD server rodando na porta 80?
□ Extensão foi recarregada?
□ Console do background sem erros?
□ Console do popup sem erros?
□ API retorna inscriptions quando testada via curl?
□ Background script retorna formato correto?
□ Popup recebe a resposta corretamente?
□ Containers são criados no DOM?
□ Containers permanecem no DOM (não são removidos)?
```

---

## 📝 **COMANDOS ÚTEIS:**

```bash
# Ver logs do servidor em tempo real
tail -f server-with-numbers.log

# Testar API
curl "http://localhost:3000/api/ordinals/by-address/bc1p..."

# Ver processos rodando
lsof -ti:3000    # Backend
lsof -ti:80      # ORD server

# Reiniciar servidor
pkill -9 node && sleep 2 && npm start
```

---

## 🎯 **PRÓXIMOS PASSOS:**

1. **Abra o Console do Background Script** e veja os logs
2. **Abra o Console do Popup** e veja os logs
3. **Copie TODOS os logs** e me mande
4. Com os logs, posso identificar EXATAMENTE onde está o problema!

---

**Data:** 23/10/2024  
**Status:** 🔍 Debugging em andamento


