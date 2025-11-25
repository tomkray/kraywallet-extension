# 🚀 INSTALAR LND - PASSO A PASSO COMPLETO!

## ✅ **O QUE JÁ FIZ:**

```
✅ Download do LND v0.18.0 (33.3 MB)
✅ Extraído para: /Users/tomkray/Desktop/PSBT-Ordinals/lnd/
✅ Binários executáveis:
   - lnd (Lightning Network Daemon)
   - lncli (Lightning Network CLI)
✅ Criado: lnd.conf (configuração)
✅ Criado: start-lnd.sh (script de inicialização)
```

---

## 🎯 **PRÓXIMOS PASSOS (VOCÊ EXECUTA):**

### **PASSO 1: Corrigir npm cache (apenas uma vez)**

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Corrigir permissões do npm
sudo chown -R 501:20 "/Users/tomkray/.npm"

# Instalar biblioteca Lightning para Node.js
npm install lightning --save
```

---

### **PASSO 2: Iniciar LND pela primeira vez**

Abra um **NOVO TERMINAL** (deixe o backend rodando no atual):

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Iniciar LND
./start-lnd.sh
```

**O que vai acontecer:**
```
⚡ ==========================================
⚡ Starting LND (Lightning Network Daemon)
⚡ ==========================================

✅ LND encontrado: .../lnd/lnd
✅ Config: .../lnd.conf
✅ Data dir: .../lnd-data

🚀 Iniciando LND...

📝 Logs estarão em: .../lnd-data/logs/bitcoin/mainnet/lnd.log

⚠️  IMPORTANTE:
   Na primeira vez, você precisará criar uma wallet:
   ./lnd/lncli create

Attempting automatic RPC configuration to btcd
Attempting automatic RPC configuration to bitcoind
Automatically obtained lnd's wallet password
Starting lnd...
```

**Deixe este terminal rodando!** LND precisa ficar ativo!

---

### **PASSO 3: Criar wallet Lightning (NOVO TERMINAL)**

Abra **OUTRO TERMINAL** (LND deve estar rodando no anterior):

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Criar wallet Lightning
./lnd/lncli create
```

**O que vai pedir:**

1. **Password da wallet Lightning:**
   ```
   Input wallet password:
   Confirm password:
   ```
   → Digite uma senha forte (ex: mesma do MyWallet)

2. **Seed phrase existente ou nova?**
   ```
   Do you have an existing cipher seed mnemonic or extended master root key you want to use?
   Enter 'y' to use an existing cipher seed mnemonic, 'n' to create a new seed: [n]:
   ```
   → Digite `n` (criar nova)

3. **Password do seed (opcional):**
   ```
   Your cipher seed can optionally be encrypted.
   Input your passphrase if you wish to encrypt it (or press enter to proceed without a cipher seed passphrase):
   ```
   → Aperte ENTER (sem passphrase adicional)

4. **GUARDE O SEED!**
   ```
   !!!YOU MUST WRITE DOWN THIS SEED TO BE ABLE TO RESTORE THE WALLET!!!

   1. word1
   2. word2
   ...
   24. word24

   !!!YOU MUST WRITE DOWN THIS SEED TO BE ABLE TO RESTORE THE WALLET!!!
   ```
   → **COPIE E GUARDE ESSAS 24 PALAVRAS!**

5. **Confirme que guardou:**
   ```
   Input your 24-word mnemonic separated by spaces:
   ```
   → Digite as 24 palavras novamente

**Pronto! Wallet Lightning criada!** ✅

---

### **PASSO 4: Verificar se está funcionando**

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Ver info do seu node Lightning
./lnd/lncli getinfo
```

**Resposta esperada:**
```json
{
    "version": "0.18.0-beta",
    "commit_hash": "...",
    "identity_pubkey": "03abc123...",  ← Seu node ID!
    "alias": "MyWallet-DEX-Node",
    "color": "#ff9500",
    "num_pending_channels": 0,
    "num_active_channels": 0,
    "num_inactive_channels": 0,
    "num_peers": 0,
    "block_height": 870000,
    "block_hash": "...",
    "best_header_timestamp": "...",
    "synced_to_chain": true,
    "synced_to_graph": false,
    "chains": [
        {
            "chain": "bitcoin",
            "network": "mainnet"
        }
    ]
}
```

✅ **Se viu isso, LND está funcionando!**

---

### **PASSO 5: Gerar endereço Taproot para receber fundos**

```bash
# Gerar endereço Taproot
./lnd/lncli newaddress p2tr
```

**Resposta:**
```json
{
    "address": "bc1p..."  ← Seu endereço Lightning!
}
```

**Envie alguns sats para este endereço!**
```
Mínimo recomendado: 1.000.000 sats (0.01 BTC)
Para abrir 1 channel médio
```

---

## 🔧 **CONECTAR BACKEND AO LND:**

Depois que o LND estiver rodando, vou atualizar o backend para se conectar!

### **Arquivos que vou modificar:**

```
server/routes/lightning.js
    ↓
GET /api/lightning/balance/:address
    ↓
Em vez de retornar mock (0 sats)
    ↓
Vai chamar LND e retornar balance REAL! ⚡
```

---

## 📊 **COMANDOS ÚTEIS:**

### **Ver info do node:**
```bash
./lnd/lncli getinfo
```

### **Ver balance:**
```bash
./lnd/lncli walletbalance
./lnd/lncli channelbalance
```

### **Ver endereços:**
```bash
./lnd/lncli newaddress p2tr
```

### **Listar channels:**
```bash
./lnd/lncli listchannels
```

### **Conectar a um peer:**
```bash
./lnd/lncli connect [node_pubkey]@[ip]:9735
```

### **Abrir channel:**
```bash
./lnd/lncli openchannel [node_pubkey] [amount_sats]
```

### **Ver logs:**
```bash
tail -f lnd-data/logs/bitcoin/mainnet/lnd.log
```

### **Parar LND:**
```bash
pkill lnd
```

---

## 🎯 **RESUMO - ORDEM DE EXECUÇÃO:**

### **Terminal 1 (Backend - já está rodando):**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start
# Deixe rodando!
```

### **Terminal 2 (LND - NOVO):**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Corrigir npm (apenas uma vez)
sudo chown -R 501:20 "/Users/tomkray/.npm"
npm install lightning --save

# Iniciar LND
./start-lnd.sh
# Deixe rodando!
```

### **Terminal 3 (lncli - comandos):**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Criar wallet (primeira vez)
./lnd/lncli create

# Verificar
./lnd/lncli getinfo

# Gerar endereço
./lnd/lncli newaddress p2tr

# Ver balance
./lnd/lncli walletbalance
```

---

## ⚡ **APÓS TUDO RODANDO:**

### **1. LND rodando ✅**
```
Terminal 2: LND daemon ativo
```

### **2. Wallet Lightning criada ✅**
```
24 palavras guardadas
Password configurada
```

### **3. Endereço gerado ✅**
```
bc1p... (Taproot)
```

### **4. Fundos recebidos ✅**
```
Enviar 0.01 BTC (~1M sats)
Aguardar 3 confirmações (~30 min)
```

### **5. Backend conectado (eu faço) ✅**
```
Modificar server/routes/lightning.js
Conectar ao LND
API retorna balance REAL
```

### **6. MyWallet atualizada ✅**
```
[⚡ Lightning ▼]
1,000,000 sats ← REAL!
📡 0 channels active (ainda)
```

### **7. Abrir channel ✅**
```
Conectar a um node
Abrir channel
Aguardar confirmações
```

### **8. Lightning ATIVO! 🔥**
```
[⚡ Lightning ▼]
1,000,000 sats
📡 1 channel active ← FUNCIONAL!

Pode fazer swaps <1 segundo!
```

---

## 🚀 **COMECE AGORA:**

```bash
# 1. Corrigir npm
sudo chown -R 501:20 "/Users/tomkray/.npm"

# 2. Instalar biblioteca
npm install lightning --save

# 3. Iniciar LND (NOVO TERMINAL)
./start-lnd.sh

# 4. Criar wallet (OUTRO TERMINAL)
./lnd/lncli create

# 5. Ver info
./lnd/lncli getinfo

# 6. Gerar endereço
./lnd/lncli newaddress p2tr

# 7. ME AVISE QUANDO ESTIVER PRONTO!
# Vou conectar o backend ao LND!
```

---

## 📝 **CHECKLIST:**

```
☐ sudo chown npm cache
☐ npm install lightning
☐ ./start-lnd.sh (rodando)
☐ ./lnd/lncli create (wallet criada)
☐ Seed 24 palavras guardado
☐ ./lnd/lncli getinfo (funcionando)
☐ ./lnd/lncli newaddress p2tr (endereço gerado)
☐ Enviar 0.01 BTC para o endereço
☐ ME AVISAR! (vou conectar backend)
```

---

## 🎊 **DEPOIS DISSO:**

```
✅ LND rodando localmente
✅ Backend conectado ao LND
✅ MyWallet mostrando balance REAL
✅ Pode abrir channels
✅ Pode fazer swaps Lightning
✅ Transações <1 segundo!
✅ Fee: 1 sat!

= LIGHTNING FUNCIONAL! ⚡🔥
```

---

**EXECUTE OS PASSOS ACIMA E ME AVISE QUANDO CHEGAR NO PASSO 4!**

**Vou conectar o backend ao seu LND!** 🚀⚡




