# 🧪 GUIA DE TESTE COMPLETO - LIGHTNING DEFI

## ✅ STATUS ATUAL

- ✅ **Node.js Server** - Rodando em http://localhost:3000
- ✅ **LND** - Rodando e desbloqueado
- ✅ **KrayWallet Extension** - Instalada no Chrome
- ✅ **Todas as APIs** - Funcionando

---

## 📋 TESTES A REALIZAR

### **1️⃣ TESTE: Lightning Básico (Send/Receive BTC)**
### **2️⃣ TESTE: Create Pool (Criar Liquidez de Runes)**
### **3️⃣ TESTE: Swap (Trocar Runes por BTC)**

---

# 1️⃣ TESTE: LIGHTNING BÁSICO

## 🎯 Objetivo
Testar se o KrayWallet consegue:
- Criar invoices Lightning
- Pagar invoices Lightning
- Abrir canais Lightning

---

## 📝 PASSO A PASSO:

### **PASSO 1.1: Abrir o KrayWallet no Chrome**

1. Abra o **Google Chrome**
2. Clique no ícone da extensão **KrayWallet**
3. Verifique se a carteira está aberta

---

### **PASSO 1.2: Testar "Receive Lightning"**

1. No popup do KrayWallet, clique em **"Receive Lightning"**
2. Preencha:
   - **Amount (sats):** `1000`
   - **Description:** `Teste de recebimento`
3. Clique em **"Create Invoice"**
4. Deve aparecer um **invoice BOLT11** (string começando com `lnbc`)
5. Copie o invoice

**✅ SUCESSO:** Invoice criado com sucesso!

---

### **PASSO 1.3: Testar "Send Lightning"**

1. No popup do KrayWallet, clique em **"Send Lightning"**
2. Cole um invoice válido (você pode usar um de teste ou criar um em outro wallet)
3. Clique em **"Decode Invoice"**
4. Verifique se as informações aparecem (amount, destination, etc)
5. Clique em **"Pay Invoice"**
6. Digite sua senha
7. Aguarde a confirmação

**✅ SUCESSO:** Pagamento enviado com sucesso!

**⚠️ IMPORTANTE:** Para este teste funcionar, você precisa ter:
- Canal Lightning aberto
- Liquidez suficiente
- Ou use o testnet primeiro

---

### **PASSO 1.4: Testar "Open Channel"**

1. No popup do KrayWallet, clique em **"Open Channel"**
2. Preencha:
   - **Node Pubkey:** (chave pública de um nó Lightning)
   - **Host:** (endereço do nó, ex: `192.168.1.1:9735`)
   - **Amount (sats):** `100000`
3. Clique em **"Open Channel"**
4. Aguarde a confirmação

**✅ SUCESSO:** Canal sendo aberto!

---

# 2️⃣ TESTE: CREATE POOL (Criar Liquidez)

## 🎯 Objetivo
Criar uma pool de liquidez para trocar Runes por BTC via Lightning Network

---

## 📝 PASSO A PASSO:

### **PASSO 2.1: Abrir a página de Create Pool**

1. Abra o Chrome
2. Navegue para: **http://localhost:3000/runes-swap.html**
3. Você verá a interface do DeFi Swap

---

### **PASSO 2.2: Ir para "Create Pool"**

1. Na página, procure pela aba ou seção **"Create Pool"**
2. Clique nela

---

### **PASSO 2.3: Preencher o formulário**

Preencha os campos:

```
Rune Name: UNCOMMON•GOODS
Rune ID: 840000:3
BTC Amount (sats): 1000000
Rune Amount: 500000
Fee Rate (sat/vB): 10
```

---

### **PASSO 2.4: Submeter o formulário**

1. Clique em **"Create Pool"**
2. O sistema vai preparar uma **PSBT** (Bitcoin transaction)
3. Aguarde...

---

### **PASSO 2.5: Assinar a PSBT no KrayWallet**

1. Automaticamente vai abrir o **popup do KrayWallet**
2. Você verá a tela: **"Sign Bitcoin Transaction"**
3. Revise os detalhes:
   - **Inputs:** Onde estão seus BTC e Runes
   - **Outputs:** Para onde vão (funding UTXO)
   - **Fee:** Taxa da transação
4. Digite sua **senha**
5. Clique em **"Sign Transaction"**

---

### **PASSO 2.6: Aguardar confirmação**

1. A PSBT assinada será enviada ao backend
2. O backend vai:
   - Assinar com sua chave privada (node)
   - Broadcast na blockchain
   - Abrir um canal Lightning
3. Aguarde a mensagem: **"Pool criada com sucesso!"**

**✅ SUCESSO:** Pool de liquidez criada!

---

### **PASSO 2.7: Verificar a pool criada**

1. Vá para a página: **http://localhost:3000/lightning-hub.html**
2. Você deve ver sua pool listada
3. Verifique:
   - Rune Name
   - BTC Balance
   - Rune Balance
   - Status: "Active"

---

# 3️⃣ TESTE: SWAP (Trocar Runes por BTC)

## 🎯 Objetivo
Realizar uma troca (swap) de Runes por BTC usando a pool de liquidez

---

## 📝 PASSO A PASSO:

### **PASSO 3.1: Abrir a página de Swap**

1. Navegue para: **http://localhost:3000/runes-swap.html**
2. Você verá a interface de Swap

---

### **PASSO 3.2: Selecionar a pool**

1. No dropdown **"Select Pool"**, escolha a pool que você criou
2. Exemplo: **UNCOMMON•GOODS / BTC**

---

### **PASSO 3.3: Preencher o swap**

Preencha os campos:

```
Amount In: 1000 (quantidade de Runes que quer trocar)
Token In: UNCOMMON•GOODS
Token Out: BTC
```

O sistema vai calcular automaticamente quanto BTC você vai receber usando a fórmula AMM (x * y = k).

---

### **PASSO 3.4: Executar o Swap**

1. Clique em **"Execute Swap"**
2. O backend vai:
   - Calcular o swap usando a fórmula AMM
   - Gerar um **Lightning Invoice** (BOLT11)
   - Retornar o invoice para você

---

### **PASSO 3.5: Pagar o Invoice no KrayWallet**

1. Automaticamente vai abrir o **popup do KrayWallet**
2. Você verá a tela: **"Confirm Lightning Payment"**
3. Revise os detalhes:
   - **Amount:** Valor em sats
   - **Description:** "Swap UNCOMMON•GOODS for BTC"
   - **Destination:** Node Lightning do pool
4. Digite sua **senha**
5. Clique em **"Pay Invoice"**

---

### **PASSO 3.6: Aguardar confirmação**

1. O pagamento será processado via Lightning Network
2. O backend vai:
   - Receber o pagamento
   - Atualizar o State Tracker (SQLite)
   - Creditar os Runes na sua conta off-chain
3. Aguarde a mensagem: **"Swap executado com sucesso!"**

**✅ SUCESSO:** Swap realizado com sucesso!

---

### **PASSO 3.7: Verificar o swap**

1. Vá para: **http://localhost:3000/api/lightning-defi/pools**
2. Verifique que os balances da pool mudaram:
   - BTC balance diminuiu
   - Rune balance aumentou

---

# 🔍 VERIFICAÇÕES ADICIONAIS

## **Verificar State Tracker (SQLite)**

```bash
cd "/Volumes/D2/KRAY WALLET- V1/server"
sqlite3 kray-defi-state.db "SELECT * FROM channel_balances;"
sqlite3 kray-defi-state.db "SELECT * FROM swap_history;"
```

---

## **Verificar Canais Lightning**

No seu Terminal.app:

```bash
cd "/Volumes/D2/KRAY WALLET- V1"
./lnd/lncli --lnddir=./lnd-data listchannels
```

---

## **Verificar Logs do Servidor**

```bash
tail -f "/Volumes/D2/KRAY WALLET- V1/server-output.log"
```

---

## **Verificar Logs do LND**

```bash
tail -f "/Volumes/D2/KRAY WALLET- V1/lnd-data/logs/bitcoin/mainnet/lnd.log"
```

---

# ⚠️ PROBLEMAS COMUNS

## **1. "Insufficient balance"**
- Certifique-se de ter BTC on-chain para funding
- Use `lncli newaddress` para gerar um endereço e receber BTC

## **2. "Channel not active"**
- Aguarde confirmações on-chain (6 confirmações)
- Verifique: `lncli listchannels`

## **3. "Invoice expired"**
- Lightning invoices expiram em 5 minutos
- Gere um novo invoice

## **4. "Wallet locked"**
- Desbloqueie novamente: `lncli unlock`

## **5. "Connection refused"**
- Verifique se o servidor está rodando: `lsof -i :3000`
- Verifique se o LND está rodando: `lsof -i :10009`

---

# 🎉 CONCLUSÃO

Se todos os testes passarem, significa que:

✅ **Lightning Network funcionando** (send/receive/channels)
✅ **Create Pool funcionando** (PSBT signing + funding TX)
✅ **Swap funcionando** (Lightning invoices + State Tracker)
✅ **KrayWallet integração completa**

---

# 🚀 PRÓXIMOS PASSOS

1. **Testar em testnet primeiro** (para não perder BTC real)
2. **Implementar UI de histórico de swaps**
3. **Adicionar múltiplas pools**
4. **Implementar "Close Pool"**
5. **Testar com usuários reais**

---

**BOA SORTE NOS TESTES! 🎊**

Se encontrar qualquer erro, anote e me avise que vou ajudar a resolver!

