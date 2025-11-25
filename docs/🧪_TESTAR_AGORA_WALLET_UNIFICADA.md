# 🧪 TESTAR WALLET UNIFICADA (TAPROOT + LIGHTNING)

## ✅ **STATUS ATUAL:**

```
✅ LND rodando (aguardando wallet)
✅ Backend com integração LND pronto
✅ MyWallet extension pronta
```

---

## 📋 **PASSO A PASSO COMPLETO:**

### **PASSO 1: Resetar wallet atual (se já tem uma)**

Abra o console da MyWallet extension:

```javascript
// 1. Abrir DevTools na extension
// Chrome → Extensões → MyWallet → "Inspect popup"

// 2. No console, executar:
chrome.storage.local.clear()

// 3. Recarregar a extension
// Cmd+R ou fechar e abrir o popup novamente
```

**Resultado esperado:**
```
✅ Tela de "Create Wallet" ou "Restore Wallet" aparece
```

---

### **PASSO 2: Criar nova wallet**

Na interface da MyWallet:

```
1. Clicar "Create Wallet"
   ↓
2. Digitar uma senha (ex: "12345678")
   ↓
3. Confirmar senha
   ↓
4. Clicar "Generate Wallet"
   ↓
5. ANOTAR AS 12 PALAVRAS! (Backup importante!)
   ↓
6. Confirmar
```

---

### **PASSO 3: Verificar logs do backend**

Abrir terminal e ver logs do servidor Node.js:

```bash
# Se backend não estiver rodando:
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start

# Você deve ver:
🔑 Generating 12-word mnemonic...
✅ Mnemonic generated
✅ Taproot address derived: bc1p...
⚡ Initializing LND wallet with same seed...
⚡ ========== INIT LND WALLET WITH SEED ==========
🔑 Mnemonic words: 12
🔐 Password length: 8
📝 Wallet não existe, criando nova...
🔨 Criando wallet LND...
✅ Wallet LND criada!
⚡ ========== CONNECTING TO LND ==========
✅ Connected to LND successfully!
✅ LND wallet initialized: Wallet LND created and unlocked
```

**Se aparecer isso, SUCESSO! 🎉**

---

### **PASSO 4: Verificar wallet LND criada**

No terminal:

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Ver informações do node Lightning
./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=./lnd-data --network=mainnet getinfo
```

**Resultado esperado:**
```json
{
    "version": "0.17.0-beta",
    "identity_pubkey": "03...",
    "alias": "MyWallet-DEX-Node",
    "color": "#ff9500",
    "num_pending_channels": 0,
    "num_active_channels": 0,
    "num_inactive_channels": 0,
    "num_peers": 0,
    "block_height": ...,
    "synced_to_chain": true,
    "synced_to_graph": true
}
```

**Se ver isso, PERFEITO! ⚡**

---

### **PASSO 5: Verificar balance Lightning**

```bash
./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=./lnd-data --network=mainnet walletbalance
```

**Resultado esperado:**
```json
{
    "total_balance": "0",
    "confirmed_balance": "0",
    "unconfirmed_balance": "0"
}
```

**Normal! Wallet nova tem 0 sats.**

---

### **PASSO 6: Testar na MyWallet UI**

Na interface da MyWallet:

```
1. Ver balance Mainnet
   - Deve aparecer: "0 sats" (normal, wallet nova)

2. Alternar para Lightning
   - Clicar dropdown "🔗 Mainnet"
   - Selecionar "⚡ Lightning"
   
3. Ver balance Lightning
   - Deve aparecer: "0 sats"
   - "📡 0 channels active"
   
4. Ver botões Lightning
   - "📡 Open Channel"
   - "💰 Deposit"
   - "📤 Withdraw"
```

**Se ver tudo isso, FUNCIONOU! 🚀**

---

## 🎯 **VERIFICAÇÃO FINAL:**

### **Confirmar que é a MESMA seed:**

**Na MyWallet:**
```
1. Ir em Settings
2. Clicar "Show Seed Phrase"
3. Digitar senha
4. Ver as 12 palavras
```

**No LND (via terminal):**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Criar arquivo temporário para seed
echo "Digite a senha da wallet LND e pressione Enter:"
./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=./lnd-data --network=mainnet unlock
```

**Atenção:** LND não expõe a seed depois de criada (por segurança). Mas podemos confirmar que funcionou se:
1. LND aceitou a seed (não deu erro)
2. Wallet foi criada com sucesso
3. `getinfo` funciona

---

## 🧪 **TESTE ALTERNATIVO: RESTORE WALLET**

Se quiser testar o restore:

```
1. Anotar as 12 palavras da wallet criada
2. Resetar: chrome.storage.local.clear()
3. Clicar "Restore Wallet"
4. Colar as 12 palavras
5. Digitar MESMA senha
6. Confirmar
```

**Backend deve fazer:**
```
🔄 Restoring wallet from mnemonic...
✅ Mnemonic valid
✅ Wallet restored: bc1p...
⚡ Initializing LND wallet with same seed...
🔓 Tentando unlock wallet existente...
✅ Wallet LND já existe e foi desbloqueada!
✅ Connected to LND successfully!
✅ LND wallet initialized: Wallet LND unlocked
```

---

## 🐛 **POSSÍVEIS ERROS:**

### **1. "LND not running"**
```bash
# Reiniciar LND:
cd /Users/tomkray/Desktop/PSBT-Ordinals
./lnd-darwin-arm64-v0.17.0-beta/lnd --configfile=./lnd.conf --lnddir=./lnd-data > lnd-startup.log 2>&1 &

# Aguardar 5 segundos
sleep 5

# Verificar log
tail -20 lnd-startup.log
```

### **2. "Wallet already exists"**
```
Normal! Significa que já criou antes.
Vai fazer unlock automaticamente.
```

### **3. "Failed to connect to LND"**
```bash
# Verificar se TLS cert existe:
ls -la lnd-data/tls.cert

# Se não existir, LND não iniciou corretamente
# Ver log completo:
cat lnd-startup.log
```

### **4. Backend não responde**
```bash
# Verificar se backend está rodando:
curl http://localhost:3000/api/health

# Se não responder, iniciar:
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start
```

---

## 📊 **CHECKLIST COMPLETO:**

```
⏳ LND rodando
⏳ Backend rodando (npm start)
⏳ MyWallet extension carregada
⏳ Storage limpo (chrome.storage.local.clear())
⏳ Criar nova wallet
⏳ Ver log do backend (inicialização LND)
⏳ Verificar `lncli getinfo`
⏳ Alternar para Lightning na UI
⏳ Ver balance Lightning = 0 sats
⏳ Ver botões Lightning
```

**Se TUDO aparecer ✅, estamos prontos para FASE 3!** 🚀

---

## 🎉 **PRÓXIMA FASE:**

**FASE 3: Conectar backend via gRPC**
```
- Backend chama lndConnection.connect()
- Atualiza balance Lightning em tempo real
- Lista channels ativos
- Prepara para Deposit/Withdraw
```

---

**COMECE AGORA!** 🚀

1. Resetar storage: `chrome.storage.local.clear()`
2. Criar wallet nova
3. Ver os logs
4. Me avisar se funcionou! 🎉




