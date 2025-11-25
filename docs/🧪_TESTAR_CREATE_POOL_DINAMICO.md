# 🧪 **TESTE - CREATE POOL DINÂMICO NA MYWALLET**

## 📅 Data: 23 de Outubro de 2025

---

## 🎯 **O QUE DEVE ACONTECER:**

Quando clicar em **"Create Liquidity Pool"** no popup da MyWallet:
1. ✅ Tela de criar pool abre
2. ✅ Carrega automaticamente os Runes do address
3. ✅ Dropdowns já vêm populados com símbolos e quantidades
4. ✅ Mostra balances disponíveis
5. ✅ Botão "MAX" funciona
6. ✅ Validação em tempo real

---

## 🧪 **TESTE PASSO A PASSO:**

### **1. Abrir MyWallet**

```bash
# 1. Clicar no ícone da MyWallet extension

# 2. Desbloquear se necessário
```

### **2. Ir para DEX**

```bash
# 1. Clicar na aba "DEX" no popup

# ✅ DEVE MOSTRAR:
# - Painel com "Total Value Locked"
# - Botão verde "Create Liquidity Pool"
```

### **3. Clicar "Create Liquidity Pool"**

```bash
# 1. Clicar no botão verde

# 2. Abrir console do popup (F12 na popup)

# ✅ CONSOLE DEVE MOSTRAR:
🏊 ===== CREATE POOL SCREEN OPENING =====
   📍 User wants to create a new liquidity pool
   🔄 Loading user runes dynamically...
🔥 ===== LOADING USER RUNES FOR POOL =====
   📊 Fetching wallet info...
   ✅ User address: bc1p...
   ✅ Loaded 3 runes for pool
   📋 Runes: UNCOMMON•GOODS (1500000), DOG•GO (2300000), RSIC (500000)

# ✅ TELA DEVE ABRIR COM:
# - Formulário de criar pool
# - Dropdown "Select a rune..." com SEUS runes
```

### **4. Ver Dropdowns Populados**

```bash
# ✅ DROPDOWN "RUNE A" DEVE MOSTRAR:
# - Select a rune...
# - UNCOMMON•GOODS ᚢ (1,500,000)
# - DOG•GO•TO•THE•MOON 🐕 (2,300,000)
# - RSIC•GENESIS•RUNE ᚱ (500,000)

# ✅ DROPDOWN "RUNE B" DEVE MOSTRAR:
# (Mesma lista)

# OU se "BTC Pair" está marcado:
# - RUNE A mostra os runes
# - RUNE B está oculto (par com Bitcoin)
```

### **5. Selecionar um Rune**

```bash
# 1. Clicar dropdown "Rune A"

# 2. Escolher "UNCOMMON•GOODS ᚢ (1,500,000)"

# ✅ DEVE ACONTECER:
# - Mostra card com info do Rune:
#   Nome: UNCOMMON•GOODS ᚢ
#   ID: 840000:3
#   Balance: 1,500,000
# - Input de "Initial Amount" aparece
# - Botão "MAX" aparece
```

### **6. Testar Botão "MAX"**

```bash
# 1. Clicar botão "MAX" ao lado do amount

# ✅ DEVE PREENCHER:
# Input → 1500000 (todo o balance)
```

### **7. Testar Validação**

```bash
# 1. Digitar 2000000 (mais que o balance)

# ✅ DEVE MOSTRAR:
# - Borda vermelha no input
# - Mensagem: "⚠️ Amount exceeds your balance"

# 2. Digitar 500000 (dentro do balance)

# ✅ DEVE MOSTRAR:
# - Borda verde
# - Sem warning
```

---

## 🔍 **SE NÃO FUNCIONAR:**

### **Problema 1: Console não mostra logs ao clicar**

```bash
CAUSA: Event listener não foi adicionado ao botão

DEBUG:
# Console do popup:
document.getElementById('create-pool-btn')

# Se retornar null:
# → HTML não tem o botão
# → Verificar popup.html linha ~303

# Se retornar o elemento:
# → Event listener pode não estar adicionado
# → Verificar popup.js setupEventListeners
```

### **Problema 2: Console mostra "Wallet not found"**

```bash
CAUSA: Wallet não está desbloqueada ou getWalletInfo falhou

DEBUG:
# Console do popup:
chrome.runtime.sendMessage({ action: 'getWalletInfo' }, (response) => {
    console.log('Wallet Info:', response);
});

# Se retornar error:
# → Wallet está locked
# → Desbloquear e tentar novamente

# Se retornar success: true mas sem address:
# → Bug no background-real.js
```

### **Problema 3: Dropdowns vazios (só "Select a rune...")**

```bash
CAUSA: getRunes não retornou runes ou falhou

DEBUG:
# Console do popup:
chrome.runtime.sendMessage({ 
    action: 'getRunes'
}, (response) => {
    console.log('Runes Response:', response);
    console.log('Runes Count:', response.runes?.length);
});

# Se retornar runes: []:
# → Address não tem runes
# → Testar com address que tem runes

# Se retornar error:
# → Backend /api/runes/address falhou
# → Ver console do backend (terminal)
```

### **Problema 4: Dropdowns têm runes mas sem quantities**

```bash
CAUSA: Formato de exibição incorreto

DEBUG:
# Ver console logs:
   📋 Runes: UNCOMMON•GOODS (undefined), DOG (undefined)

# Se mostrar undefined:
# → rune.amount está undefined
# → Backend não está retornando amount
# → Verificar server/routes/runes.js
```

---

## 📋 **CHECKLIST COMPLETO:**

```
□ MyWallet está desbloqueada?
  → Abrir popup, ver se pede senha

□ Aba DEX está visível?
  → Clicar nas tabs do popup

□ Botão "Create Liquidity Pool" existe?
  → Ver se está na aba DEX

□ Console mostra logs ao clicar?
  → F12 no popup, clicar botão

□ getWalletInfo retorna address?
  → Ver logs do console

□ getRunes retorna array?
  → Ver logs do console

□ Dropdowns estão populados?
  → Ver se tem opções além de "Select..."

□ Quantidades aparecem?
  → Ex: (1,500,000)

□ Botão MAX funciona?
  → Clicar e ver se preenche

□ Validação funciona?
  → Digitar mais que balance
```

---

## 🎯 **TESTE VISUAL RÁPIDO:**

```bash
# 1. Popup MyWallet → DEX → Create Pool

# ✅ SE FUNCIONAR, VOCÊ VÊ:

┌────────────────────────────────────────┐
│  ← 🏊 Create Liquidity Pool            │
├────────────────────────────────────────┤
│  💰 Earn Trading Fees                  │
│  Provide liquidity and earn...         │
├────────────────────────────────────────┤
│  Pool Name                             │
│  [DOG/BTC Official Pool           ]    │
│                                        │
│  🎨 Use My Inscription as Pool Image   │
│  □ Yes (show inscription selector)     │
│                                        │
│  Rune A *                              │
│  [UNCOMMON•GOODS ᚢ (1,500,000)  ▼]    │ ← POPULADO!
│                                        │
│  📊 UNCOMMON•GOODS ᚢ                   │
│     ID: 840000:3                       │
│     Balance: 1,500,000                 │
│                                        │
│  Initial Amount *                      │
│  [                         ] [MAX]     │
│                                        │
│  ☑ BTC Pair (pair with Bitcoin)        │
│                                        │
│  Fee Rate (%) *                        │
│  [0.3]                                 │
│                                        │
│  [Create Pool]                         │
└────────────────────────────────────────┘
```

---

## 💻 **COMANDOS DEBUG NO CONSOLE:**

```javascript
// 1. Ver se botão existe
document.getElementById('create-pool-btn')

// 2. Testar getWalletInfo
chrome.runtime.sendMessage({ action: 'getWalletInfo' }, console.log)

// 3. Testar getRunes
chrome.runtime.sendMessage({ action: 'getRunes' }, console.log)

// 4. Forçar carregar runes (se tela já está aberta)
// (Não pode, precisa abrir tela de novo)

// 5. Ver dropdowns após abrir tela
document.querySelector('#rune-a-select').options.length
// Deve retornar > 1 (1 = só "Select...")

// 6. Ver opções
Array.from(document.querySelector('#rune-a-select').options).map(o => o.textContent)
// Deve mostrar: ["Select a rune...", "UNCOMMON... (1500000)", ...]
```

---

## 🌟 **RESULTADO ESPERADO:**

```
FUNCIONANDO:

✅ Clicar "Create Pool"
✅ Tela abre
✅ Console mostra logs detalhados
✅ Dropdowns populados com runes reais
✅ Quantidades aparecem
✅ Seleção funciona
✅ Info do rune aparece
✅ Botão MAX funciona
✅ Validação em tempo real
✅ Experiência IGUAL à MyWallet interna

NÃO FUNCIONANDO:

❌ Dropdowns vazios
❌ Sem logs no console
❌ Erro "Wallet not found"
❌ Runes sem quantidades

→ Seguir guia de debug acima
→ Ou me avisar para investigar mais!
```

---

**Status:** 🔧 **LOGS ADICIONADOS PARA DEBUG**  
**Data:** 23 de Outubro de 2025  
**Autor:** Kray Station Team




