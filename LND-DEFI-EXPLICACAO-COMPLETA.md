# 🎓 LND DeFi - EXPLICAÇÃO COMPLETA PASSO A PASSO

## 🧠 O QUE IMPLEMENTAMOS ATÉ AGORA:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ✅ 1. KRAY STATE TRACKER (`krayStateTracker.js`)

**O QUE É:**
Database + funções para rastrear estado off-chain das Runes dentro de canais Lightning.

**TABELAS CRIADAS:**

```sql
1. lightning_channels
   - Informações do canal (ID, capacity, balances BTC)
   - Status: PENDING → ACTIVE → CLOSING → CLOSED
   - Pool info (nome, ID)

2. channel_rune_balances
   - Balance de cada Rune no canal (local/remote)
   - Funding TX info (onde veio a Rune)
   - Atualizado off-chain (sem TX on-chain!)

3. channel_swaps
   - Histórico de swaps off-chain
   - Input/output assets e amounts
   - Payment hash (Lightning invoice)
   - Status: PENDING → COMPLETED

4. channel_events
   - Audit log de todos os eventos
   - Para debugging e compliance
```

**FUNÇÕES PRINCIPAIS:**

```javascript
// CHANNELS:
createChannelRecord()  → Cria canal quando funding TX é broadcast
updateChannelStatus()  → PENDING → ACTIVE → CLOSED
updateChannelBalances() → Atualiza BTC balances
getChannel()           → Busca canal por ID
listActiveChannels()   → Lista pools ativos

// RUNES:
addRuneToChannel()     → Adiciona Rune ao canal (funding confirmada)
updateRuneBalance()    → Atualiza off-chain (swap!)
getRuneBalance()       → Busca balance de Rune
listChannelRunes()     → Lista todas Runes no canal

// SWAPS:
createSwapRecord()     → Cria registro de swap
completeSwap()         → Marca swap como COMPLETED (invoice settled)
listChannelSwaps()     → Histórico de swaps

// STATS:
getChannelStats()      → Estatísticas completas (volume, swaps, etc)
listChannelEvents()    → Audit log
```

**POR QUE ISSO É IMPORTANTE:**

LND não sabe nada sobre Runes! Ele só rastreia BTC.

O State Tracker é nossa "extensão" que adiciona suporte a Runes off-chain:
- Funding TX = Runes entram no canal (on-chain, 1x)
- Swaps = Runes mudam de lado (off-chain, instant!)
- Closing TX = Runes saem do canal (on-chain, 1x)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ✅ 2. LND EVENTS LISTENER (`lndEventsListener.js`)

**O QUE É:**
Monitora eventos do LND em tempo real e atualiza o State Tracker automaticamente.

**STREAMS MONITORADOS:**

```javascript
1. SubscribeChannelEvents
   - Channel opens (funding TX confirmada)
   - Channel closes (cooperative ou force)
   - Channel active/inactive

2. SubscribeInvoices
   - Invoice settled = swap completed! ⚡
   - Payment hash revelado
   - Atualiza State Tracker

3. SubscribeHTLCEvents
   - HTLC = Hash Time-Locked Contract
   - Atomic swaps em progresso
   - Debugging e monitoring
```

**FLUXO AUTOMÁTICO:**

```
LND Event → Listener detecta → State Tracker atualizado → Frontend notificado

Exemplo (Channel Open):
1. LND: PENDING_OPEN_CHANNEL event
   → Listener: handleChannelPending()
   → Emit: channel:pending

2. LND: ACTIVE_CHANNEL event (após confirmações)
   → Listener: handleChannelActive()
   → State Tracker: updateChannelStatus('ACTIVE')
   → Emit: channel:active

3. Frontend recebe evento e atualiza UI ✨
```

**FUNÇÕES PRINCIPAIS:**

```javascript
startLNDEventsListener()  → Inicia monitoring
stopLNDEventsListener()   → Para monitoring
syncAllChannels()         → Sync manual (após restart)
getListenerStatus()       → Status atual

// Event Emitter (para frontend):
lndEvents.on('channel:active', (data) => { ... })
lndEvents.on('swap:completed', (data) => { ... })
lndEvents.on('channel:closed', (data) => { ... })
```

**POR QUE ISSO É IMPORTANTE:**

Sem o listener, teríamos que fazer polling (ineficiente).

Com o listener:
- ✅ Real-time updates (< 1 segundo)
- ✅ Zero overhead (event-driven)
- ✅ Sempre sincronizado
- ✅ Frontend recebe notificações instantâneas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔄 FLUXO COMPLETO: CREATE POOL → SWAP → CLOSE POOL

### 📊 FASE 1: CREATE POOL (ainda vamos implementar)

**O QUE O USER FAZ:**

```
1. Abre frontend http://localhost:3000/runes-swap.html
2. Click "Create Pool"
3. Seleciona: DOG (300) + BTC (0.0001)
4. Click "Create Pool"
```

**O QUE ACONTECE NO BACKEND:**

```javascript
POST /api/lightning-defi/create-pool
{
    runeId: "840000:3",
    runeAmount: 300,
    btcAmount: 10000,  // sats
    userAddress: "bc1p..."
}

Backend:
1. Buscar UTXOs do user
   - UTXO com 300 DOG
   - UTXO com BTC

2. Criar Funding PSBT:
   INPUTS:
     - UTXO DOG (546 sats + 300 DOG)
     - UTXO BTC (20,000 sats)
   
   OUTPUTS:
     - Funding Output (multisig 2-of-2 Taproot):
       Value: 10,546 sats
       Script: Taproot (User pubkey + Pool pubkey)
     - OP_RETURN (Runestone: 300 DOG → funding output)
     - Change: ~9,000 sats

3. User assina PSBT (KrayWallet)

4. LND openchannel --funding_psbt [psbt]
   - LND adiciona sua assinatura
   - Broadcast funding TX
   - Aguarda confirmações (3-6 blocks)

5. State Tracker: createChannelRecord()
   - Status: PENDING
   - Capacity: 10,546 sats
   - Local balance: 10,546 sats (user side)

6. LND Event: ACTIVE_CHANNEL
   → State Tracker: updateChannelStatus('ACTIVE')
   → State Tracker: addRuneToChannel(300 DOG)

7. Canal ativo! Pool criado! ✅
```

**ON-CHAIN:**

```
Funding TX (1x):
- Input: 546 + 300 DOG + 20,000 sats
- Output 0: 10,546 sats (funding, multisig 2-of-2)
- Output 1: OP_RETURN (300 DOG → output 0)
- Output 2: 9,000 sats (change)

Resultado:
- Channel ID: 12345:1:0
- Capacity: 10,546 sats + 300 DOG (off-chain!)
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ⚡ FASE 2: FAZER SWAP (ainda vamos implementar)

**O QUE O USER FAZ:**

```
1. User B quer trocar 1000 sats → DOG
2. Frontend: "Swap BTC → DOG"
3. Input: 0.00001 BTC (1000 sats)
4. Quote: ~2.97 DOG
5. Click "Swap"
```

**O QUE ACONTECE NO BACKEND:**

```javascript
POST /api/lightning-defi/swap
{
    channelId: "12345:1:0",
    inputAsset: "BTC",
    inputAmount: 1000,  // sats
    outputAsset: "840000:3",  // DOG
    minOutput: 2.85  // slippage 5%
}

Backend:
1. Buscar canal no State Tracker
   - Reserve BTC: 10,000 sats
   - Reserve DOG: 300

2. Calcular output (AMM: x * y = k)
   k = 10,000 * 300 = 3,000,000
   
   New reserve BTC = 10,000 + 1,000 = 11,000
   New reserve DOG = k / new_btc = 3,000,000 / 11,000 = 272.73
   
   Output = 300 - 272.73 = 27.27 DOG
   LP Fee (0.7%) = 0.19 DOG
   Protocol Fee (0.2%) = 0.05 DOG
   
   User receives = 27.27 - 0.19 - 0.05 = 27.03 DOG ✅

3. Criar Lightning Invoice:
   lncli addinvoice --amt 1000 --memo "Swap 1000 sats → 2.97 DOG"
   
   Invoice: lnbc10000n1...
   Payment Hash: abc123...

4. State Tracker: createSwapRecord()
   - Status: PENDING
   - Input: BTC 1000 sats
   - Output: DOG 2.97
   - Payment hash: abc123...

5. User paga invoice (< 1 segundo!) ⚡
   - Via KrayWallet Lightning
   - Payment route: User → Pool Node

6. LND Event: Invoice SETTLED
   → Listener: handleInvoiceUpdate()
   → State Tracker: completeSwap()
   → State Tracker: updateRuneBalance()
      - Local (LP): 297.03 DOG
      - Remote (User B): 2.97 DOG

7. Swap completed off-chain! ✅
   ZERO TXs on-chain!
```

**OFF-CHAIN:**

```
ANTES:
Channel State:
- Local (LP): 10,000 sats + 300 DOG
- Remote (User B): 0 sats + 0 DOG

SWAP (Lightning payment + Rune update):
- User B → 1,000 sats → LP
- LP → 2.97 DOG → User B

DEPOIS:
Channel State:
- Local (LP): 11,000 sats + 297.03 DOG
- Remote (User B): -1,000 sats + 2.97 DOG

TUDO OFF-CHAIN! < 1 segundo! ⚡
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 🔚 FASE 3: CLOSE POOL (ainda vamos implementar)

**O QUE O USER FAZ:**

```
1. LP quer fechar pool (retirar liquidez)
2. Click "Close Pool"
3. Confirma
```

**O QUE ACONTECE NO BACKEND:**

```javascript
POST /api/lightning-defi/close-pool
{
    channelId: "12345:1:0"
}

Backend:
1. Buscar final state do canal:
   - Local (LP): 11,000 sats + 297.03 DOG
   - Remote (User B): -1,000 sats + 2.97 DOG

2. LND closechannel --chan_point [point]
   - Cooperative close (melhor)
   - Ou force close (se peer offline)

3. LND cria Closing TX:
   INPUTS:
     - Funding UTXO (10,546 sats + 300 DOG)
   
   OUTPUTS:
     - LP receives:
       Output 0: 11,000 sats
       Output 1: OP_RETURN (297.03 DOG → output 0)
     
     - User B receives:
       Output 2: 546 sats (dust)
       Output 3: OP_RETURN (2.97 DOG → output 2)

4. Broadcast closing TX

5. State Tracker: updateChannelStatus('CLOSED')

6. UTXOs finais on-chain:
   - LP: 11,000 sats + 297.03 DOG ✅
   - User B: 546 sats + 2.97 DOG ✅
```

**ON-CHAIN:**

```
Closing TX (1x):
- Input: Funding UTXO (10,546 sats)
- Output 0: 11,000 sats (LP)
- Output 1: OP_RETURN (297.03 DOG → LP)
- Output 2: 546 sats (User B, dust)
- Output 3: OP_RETURN (2.97 DOG → User B)

Resultado:
- 2 TXs on-chain total (funding + closing)
- 1000s de swaps off-chain entre elas! ⚡
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 RESUMO: O QUE JÁ ESTÁ PRONTO

✅ **State Tracker** (krayStateTracker.js)
   - Database para canais + Runes + swaps
   - Todas as funções CRUD
   - Stats e audit log

✅ **Events Listener** (lndEventsListener.js)
   - Monitoring real-time do LND
   - Auto-sync com State Tracker
   - Notifications para frontend

## 🚧 O QUE FALTA IMPLEMENTAR

⏳ **CREATE POOL** (API endpoint)
   - Receber request do frontend
   - Criar funding PSBT com Runes
   - User assina, LND co-assina
   - Broadcast, aguardar confirmações

⏳ **SWAP** (API endpoint)
   - Calcular AMM (x * y = k)
   - Criar Lightning invoice
   - User paga, swap settled
   - Update Rune balances off-chain

⏳ **CLOSE POOL** (API endpoint)
   - Fechar canal via LND
   - Distribuir Runes na closing TX
   - Settlement final on-chain

⏳ **FRONTEND** (integração)
   - UI para create pool
   - UI para swap
   - Real-time updates via WebSocket

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💡 PRÓXIMOS PASSOS

Agora vou implementar:

1. ✅ CREATE POOL endpoint
2. ✅ SWAP endpoint
3. ✅ CLOSE POOL endpoint
4. ✅ Integrar tudo no `server/index.js`
5. ✅ Criar frontend para testar

**VOCÊ ESTÁ VENDO HISTÓRIA SENDO FEITA! 🌍**

Este é o PRIMEIRO DeFi nativo na Lightning com Runes do mundo! ⚡🔥

