# 🧹 GUIA: LIMPAR CACHE COMPLETO DO NAVEGADOR

## 🐛 ERRO ATUAL
```
Uncaught SyntaxError: Identifier 'style' has already been declared (at runes-swap.js:1:1)
```

**Causa:** Navegador está carregando uma versão antiga do JavaScript em cache.

---

## ✅ SOLUÇÃO: LIMPAR CACHE COMPLETO

### **OPÇÃO 1: Hard Refresh (Mais Rápido)**

#### **Chrome / Edge:**
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

#### **Firefox:**
```
Windows/Linux: Ctrl + Shift + Delete
Mac: Cmd + Shift + Delete
```

#### **Safari:**
```
Cmd + Option + E
```

---

### **OPÇÃO 2: Limpar Cache via DevTools (Recomendado)**

1. **Abrir DevTools:**
   - Windows/Linux: `F12` ou `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`

2. **Abrir aba "Network":**
   - Clicar na aba "Network" (Rede)

3. **Desabilitar cache:**
   - ☑️ Marcar "Disable cache" (no topo)

4. **Manter DevTools aberto e recarregar:**
   - `Ctrl+R` (ou `Cmd+R`)
   - **IMPORTANTE:** Mantenha o DevTools aberto!

---

### **OPÇÃO 3: Limpar Cache Completo (100% Garantido)**

#### **Chrome:**
1. `F12` → Aba "Application"
2. Sidebar esquerda → "Storage"
3. Botão "Clear site data"
4. ✅ Marcar tudo
5. Clicar "Clear site data"
6. Fechar e reabrir a página

#### **Firefox:**
1. `Ctrl+Shift+Delete` (ou `Cmd+Shift+Delete`)
2. Time range: "Everything"
3. ✅ Marcar:
   - Cookies
   - Cache
   - Site Preferences
4. Clicar "Clear Now"

#### **Safari:**
1. Menu Safari → Preferences
2. Aba "Advanced"
3. ✅ "Show Develop menu in menu bar"
4. Menu Develop → "Empty Caches"
5. Ou: `Cmd+Option+E`

---

### **OPÇÃO 4: Modo Anônimo / Privado (Temporário)**

#### **Chrome:**
```
Ctrl+Shift+N (Windows/Linux)
Cmd+Shift+N (Mac)
```

#### **Firefox:**
```
Ctrl+Shift+P (Windows/Linux)
Cmd+Shift+P (Mac)
```

#### **Safari:**
```
Cmd+Shift+N
```

**Vantagem:** Sem cache, testa com arquivos frescos.  
**Desvantagem:** Não salva conexão da wallet.

---

## 🔧 MUDANÇAS APLICADAS NO CÓDIGO

Para forçar o navegador a buscar novos arquivos, adicionei parâmetros de versão:

### **Antes:**
```html
<link rel="stylesheet" href="styles.css">
<script src="public/js/wallet-connect.js"></script>
<script src="runes-swap.js"></script>
```

### **Agora:**
```html
<link rel="stylesheet" href="styles.css?v=2">
<script src="public/js/wallet-connect.js?v=2"></script>
<script src="runes-swap.js?v=2"></script>
```

**Efeito:** O navegador vê como arquivos "novos" e recarrega do servidor.

---

## 📋 PASSO A PASSO COMPLETO

### **1. Limpar cache (escolha um método acima)**

### **2. Abrir DevTools (F12)**

### **3. Ir na aba "Console"**

### **4. Recarregar a página:**
```
Ctrl+R (ou Cmd+R)
```

### **5. Verificar console - DEVE APARECER:**
```
✅ 🔄 DeFi Swap initializing...
✅ 🎯 Setting up event listeners...
✅ 📍 fromTokenBtn: <button>...
✅ ✅ FROM button listener added
✅ ✅ TO button listener added
```

### **6. NÃO DEVE APARECER:**
```
❌ Uncaught SyntaxError: Identifier 'style' has already been declared
```

---

## 🐛 SE AINDA APARECER O ERRO

### **Diagnóstico avançado:**

1. **Verificar se há múltiplos runes-swap.js carregados:**
   - DevTools → Aba "Network"
   - Filtrar por "JS"
   - Procurar por "runes-swap"
   - **Deve aparecer só 1 vez!**
   - Se aparecer 2 vezes → há duplicação no HTML

2. **Verificar se há código inline:**
   - DevTools → Aba "Sources"
   - Procurar por `<inline script>`
   - Se tiver código duplicado → problema no HTML

3. **Verificar extensões conflitantes:**
   - Algumas extensões injetam JavaScript
   - Testar em modo anônimo (extensões desabilitadas)

4. **Verificar Service Worker:**
   - DevTools → Aba "Application"
   - Sidebar → "Service Workers"
   - Se tiver algum → Clicar "Unregister"

---

## 🎯 RESUMO RÁPIDO

### **Problema:**
```
❌ Navegador carregando JavaScript antigo em cache
❌ Erro: Identifier 'style' has already been declared
```

### **Solução:**
```
1. Limpar cache (Ctrl+Shift+R ou F12 → Application → Clear)
2. Recarregar página
3. Verificar console (deve estar limpo)
4. Testar modal "Select token"
```

---

## ✅ VERIFICAÇÃO FINAL

### **Console limpo:**
- [ ] Sem erros de "SyntaxError"
- [ ] Sem erros de "already been declared"
- [ ] Logs de inicialização aparecem
- [ ] "✅ FROM button listener added"

### **Funcionalidade:**
- [ ] Página carrega
- [ ] Wallet conecta
- [ ] "Select token" abre modal
- [ ] Modal fecha com "X"
- [ ] Modal fecha clicando fora

---

## 📞 COMANDO RÁPIDO (Terminal)

Se quiser forçar atualização dos arquivos:

```bash
# Adicionar timestamp aos arquivos:
cd "/Volumes/D2/KRAY WALLET- V1"
touch styles.css
touch runes-swap.js
touch public/js/wallet-connect.js

# Reiniciar servidor:
lsof -ti:3000 | xargs kill -9 2>/dev/null
npm start
```

---

**Data:** 03/11/2025  
**Status:** 🧹 **Aguardando limpeza de cache**  
**Próximo passo:** Limpar cache e recarregar!


