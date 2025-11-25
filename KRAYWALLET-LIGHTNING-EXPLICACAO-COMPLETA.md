# ⚡ COMO A KRAYWALLET FUNCIONA COM LIGHTNING

## 🎯 PERGUNTA:

**"A KrayWallet está preparada para rodar isso? Como funciona lá na KrayWallet?"**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💡 RESPOSTA:

### ✅ SIM! A KRAYWALLET JÁ TEM A ESTRUTURA BASE!

```
✅ API Lightning DeFi: hubIntegration.js
✅ API window.krayWallet: injected.js
✅ Funções para swap e create pool
✅ Comunicação com backend Lightning

⚠️ FALTA: Implementação real de:
   - sendPayment() (pagar invoice)
   - signPsbt() real (ainda é mock)
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📂 ARQUITETURA DA KRAYWALLET:

```
KrayWallet Extension
├── content/
│   ├── content.js        → Script que injeta no site
│   └── injected.js       → API window.krayWallet (FRONT)
│
├── popup/
│   ├── popup.html        → Interface do popup
│   ├── popup.js          → Lógica do popup
│   ├── hubIntegration.js → Lightning DeFi API (BACKEND)
│   └── lightningIntegration.js → sendPayment & signPsbt (MOCK)
│
└── background/
    └── background-real.js → Service worker
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔄 FLUXO COMPLETO (Como funciona):

### 1️⃣ USUÁRIO ABRE RUNES-SWAP.HTML

```
Browser:
  http://localhost:3000/runes-swap.html

KrayWallet Extension:
  content.js → Detecta página
  injected.js → Injeta window.krayWallet no site

Frontend:
  window.krayWallet está disponível! ✅
```

### 2️⃣ USUÁRIO CONECTA WALLET

```javascript
// Frontend (runes-swap.html):
const result = await window.krayWallet.connect();

// ↓ postMessage

// injected.js:
sendMessage('getWalletInfo')

// ↓ chrome.runtime.sendMessage

// background-real.js:
chrome.storage.local.get(['wallet'])
return { address, publicKey, balance }

// ↓ response

// Frontend:
console.log('✅ Connected:', result.address);
```

**RESULTADO:**
```
✅ Wallet conectada
✅ Frontend vê: address, balance, runes
✅ Pronto para criar pool ou swap!
```

### 3️⃣ USUÁRIO QUER CRIAR POOL

```javascript
// Frontend (pool-create.html):
const result = await createLightningPool({
    runeId: "840000:3",
    runeSymbol: "DOG",
    runeAmount: "300",
    btcAmount: 10000,
    userAddress: "bc1p...",
    userUtxos: [...]
});
```

**O QUE ACONTECE:**

```
STEP 1: Preparar PSBT
────────────────────────────────────────
Frontend → Backend (Node.js server)
POST /api/lightning-defi/create-pool
{
    runeId: "840000:3",
    runeAmount: "300",
    btcAmount: 10000,
    userAddress: "bc1p..."
}

Backend:
  ✅ Cria Funding PSBT
  ✅ Gera Pool Address (Taproot 2-of-2)
  ✅ Retorna PSBT (base64)

Frontend recebe:
{
    psbt: "cHNidP8B...",
    poolId: "pool_xxx",
    poolAddress: "bc1p...",
    fundingAmount: 10546
}


STEP 2: Assinar PSBT
────────────────────────────────────────
Frontend → KrayWallet:
const signedPsbt = await window.krayWallet.signPsbt(psbt);

// ↓ postMessage

injected.js:
sendMessage('signPsbt', { psbt })

// ↓ chrome.runtime.sendMessage

background-real.js:
1. Abre popup de confirmação
2. Mostra detalhes da TX:
   - "Criar Pool DOG/BTC"
   - "Funding: 10,546 sats + 300 DOG"
   - "Fee: ~2 sats"
3. User clica "Confirmar"
4. Assina PSBT com chave privada (Taproot Schnorr)
5. Retorna PSBT assinado

// ↓ response

Frontend recebe:
signedPsbt = "cHNidP8BAg..." (assinado!)


STEP 3: Finalizar Pool (Broadcast)
────────────────────────────────────────
Frontend → Backend:
POST /api/lightning-defi/finalize-pool
{
    psbt: signedPsbt,
    poolId: "pool_xxx",
    runeId: "840000:3",
    runeAmount: "300"
}

Backend:
  ✅ Valida PSBT assinado
  ✅ Pool co-assina (via LND)
  ✅ Finalize PSBT
  ✅ Broadcast TX
  ✅ Registra no State Tracker

Frontend recebe:
{
    success: true,
    txid: "abc123...",
    channelId: "12345:1:0",
    status: "PENDING",
    explorerUrl: "https://mempool.space/tx/abc123"
}


STEP 4: Aguardar Confirmação
────────────────────────────────────────
LND Events Listener (server/lightning/lndEventsListener.js):
  ✅ Detecta TX confirmada
  ✅ Canal ACTIVE
  ✅ State Tracker atualiza:
     local_balance: 300 DOG
     remote_balance: 0 DOG

Frontend mostra:
  "✅ Pool criado com sucesso!"
  "Channel ID: 12345:1:0"
  "Status: ACTIVE ⚡"
```

### 4️⃣ JOÃO QUER FAZER SWAP

```javascript
// João abre runes-swap.html
// João conecta wallet dele
// João vê o pool:
//   "DOG/BTC Pool - Liquidez: 300 DOG"

// João preenche:
const result = await executeLightningSwap({
    channelId: "12345:1:0",
    inputAsset: "BTC",
    inputAmount: 1000,  // 1,000 sats
    outputAsset: "840000:3",  // DOG
    minOutput: "25"
});
```

**O QUE ACONTECE:**

```
STEP 1: Solicitar Swap (Criar Invoice)
────────────────────────────────────────
Frontend → Backend:
POST /api/lightning-defi/swap
{
    channelId: "12345:1:0",
    inputAsset: "BTC",
    inputAmount: 1000,
    outputAsset: "840000:3",
    minOutput: "25"
}

Backend:
  ✅ Calcula AMM: 1000 sats → 27 DOG
  ✅ Cria Lightning Invoice (via LND):
     
     lncli addinvoice \
       --amt 1000 \
       --memo "Swap 1000 sats → 27 DOG"
  
  ✅ Registra swap no State Tracker:
     status: PENDING
     payment_hash: abc123...
  
  ✅ Retorna invoice

Frontend recebe:
{
    invoice: "lnbc10u1...",
    paymentHash: "abc123...",
    quote: {
        outputAmount: "27",
        lpFee: "0.19",
        protocolFee: "0.05"
    },
    swapId: "swap_xxx"
}


STEP 2: Pagar Invoice
────────────────────────────────────────
Frontend → KrayWallet:
const paymentResult = await window.krayWallet.sendPayment(invoice);

// ↓ postMessage

injected.js:
sendMessage('sendPayment', { invoice })

// ↓ chrome.runtime.sendMessage

background-real.js:
1. Abre popup de confirmação Lightning
2. Mostra detalhes:
   - "Lightning Payment"
   - "Amount: 1,000 sats"
   - "Destination: Pool Node"
   - "Swap: Você receberá ~27 DOG"
3. User clica "Pay"
4. ⚡ Paga via Lightning Network:
   
   Opções:
   A) Se user tem canal com Pool → Direct payment
   B) Se não → Multi-hop routing
   
   Lightning Network encontra caminho automaticamente!

5. Retorna preimage

// ↓ response

Frontend recebe:
{
    success: true,
    preimage: "abc123...",
    paymentHash: "xyz789...",
    amountSats: 1000
}


STEP 3: Confirmação Automática (Off-chain!)
────────────────────────────────────────
LND Events Listener (server):
  ✅ Detecta Invoice SETTLED
  ✅ Verifica preimage
  ✅ State Tracker atualiza:
     
     ANTES:
       LP: 300 DOG
       João: 0 DOG
     
     DEPOIS:
       LP: 273 DOG (-27)
       João: 27 DOG (+27)
  
  ✅ Marca swap como COMPLETED

Frontend mostra:
  "✅ Swap completo! ⚡"
  "Você recebeu: 27 DOG"
  "Fee: 0.24 DOG"
  "Tempo: < 1 segundo!"


STEP 4: João pode:
────────────────────────────────────────
A) Fazer outro swap (DOG → BTC)
   ✅ Tudo off-chain, instantâneo!

B) Fechar canal (settlement on-chain)
   ✅ Closing TX distribui:
      - LP: 273 DOG
      - João: 27 DOG
   ✅ João recebe 27 DOG na wallet on-chain!
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔑 API WINDOW.KRAYWALLET:

### **FUNÇÕES DISPONÍVEIS:**

```javascript
// 🔌 CONECTAR
await window.krayWallet.connect()
→ { address, publicKey, balance }

// 📋 OBTER CONTAS
await window.krayWallet.getAccounts()
→ ["bc1p..."]

// 💰 OBTER BALANCE
await window.krayWallet.getBalance()
→ { confirmed: 10000, unconfirmed: 0 }

// 🪙 OBTER RUNES
await window.krayWallet.getRunes()
→ [{ runeId, symbol, amount, thumbnail, ... }]

// 🖼️ OBTER INSCRIPTIONS
await window.krayWallet.getInscriptions()
→ [{ id, number, contentType, ... }]

// ✍️ ASSINAR PSBT
await window.krayWallet.signPsbt(psbt, options)
→ { success: true, signedPsbt: "..." }

// ⚡ PAGAR INVOICE LIGHTNING
await window.krayWallet.sendPayment(invoice)
→ { success: true, preimage, paymentHash, amountSats }

// 📡 BROADCAST TX
await window.krayWallet.pushTx(txHex)
→ txid

// 💸 ENVIAR BITCOIN
await window.krayWallet.sendBitcoin(toAddress, amount)
→ txid
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📊 ONDE APARECEM OS DADOS:

### **1. POPUP DA KRAYWALLET:**

```
┌──────────────────────────────────┐
│  🟠 KrayWallet                   │
│                                  │
│  bc1p...abc (Taproot)            │
│                                  │
│  💰 Balance:                     │
│     0.00010000 BTC               │
│                                  │
│  🪙 Runes:                       │
│     300 DOG (•DOG•GO•TO•THE•MOON)│
│     50 RSIC (RSIC•GENESIS•RUNE)  │
│                                  │
│  🖼️ Inscriptions:                │
│     #12345 - Image               │
│     #67890 - Text                │
│                                  │
│  ⚡ Lightning:                   │
│     1 Active Channel             │
│     Capacity: 10,546 sats        │
│                                  │
│  📊 Pools:                       │
│     DOG/BTC - Active ⚡          │
│                                  │
└──────────────────────────────────┘
```

### **2. RUNES-SWAP.HTML (FRONTEND):**

```
┌──────────────────────────────────────────┐
│  🔄 KRAY DeFi - Swap                     │
│                                          │
│  Connected: bc1p...abc ✅                │
│  Balance: 0.0001 BTC | 300 DOG           │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  From:                           │   │
│  │  [Select token ▼]                │   │
│  │    DOG (300)      [MAX]          │   │
│  │  Amount: [____] DOG              │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ⬇️                                      │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  To:                             │   │
│  │  [Select token ▼]                │   │
│  │    BTC            [MAX]          │   │
│  │  Amount: ~1000 sats              │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Fee: 0.9% = 0.24 DOG                   │
│                                          │
│  [💱 Swap Now]                           │
└──────────────────────────────────────────┘
```

### **3. POOL-CREATE.HTML (FRONTEND):**

```
┌──────────────────────────────────────────┐
│  🏊 Create Pool                          │
│                                          │
│  Connected: bc1p...abc ✅                │
│                                          │
│  Pool Name (optional):                   │
│  [My DOG Pool___________]                │
│                                          │
│  Token A (Rune):                         │
│  [Select rune ▼]                         │
│    DOG (300)      [MAX]                  │
│  Amount: [300___] DOG                    │
│                                          │
│  ☑️ Pair with BTC                        │
│                                          │
│  Token B (BTC):                          │
│  Amount: [10000__] sats  [MAX]           │
│                                          │
│  Fee Rate:                               │
│  [Medium ▼] ~2 sats/vB                   │
│                                          │
│  [🏊 Create Pool]                        │
└──────────────────────────────────────────┘
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ⚠️ O QUE AINDA É MOCK (PRECISA IMPLEMENTAR):

### **1. sendPayment() - Pagar Invoice Lightning**

**Arquivo:** `kraywallet-extension/popup/lightningIntegration.js`

**Status atual:**
```javascript
window.krayWallet.sendPayment = async function(invoice) {
    // ⚠️ MOCK MODE!
    console.warn('⚠️ MOCK MODE: Lightning payment not implemented yet');
    
    // Simular pagamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        success: true,
        preimage: '0'.repeat(64),  // ❌ Fake!
        paymentHash: '0'.repeat(64),
        amountSats: 1000
    };
};
```

**O que precisa fazer:**
```javascript
window.krayWallet.sendPayment = async function(invoice) {
    console.log('⚡ Paying Lightning invoice...');
    
    // 1. Parse invoice (bolt11)
    const decoded = bolt11.decode(invoice);
    const amount = decoded.satoshis;
    const paymentHash = decoded.tagsObject.payment_hash;
    
    // 2. Mostrar confirmação para user
    const confirmed = await showLightningPaymentConfirmation({
        amount,
        destination: decoded.payeeNodeKey,
        description: decoded.tagsObject.description
    });
    
    if (!confirmed) {
        throw new Error('User cancelled payment');
    }
    
    // 3. Pagar via LND (ou outro Lightning backend)
    const response = await fetch('http://localhost:8080/v1/channels/transactions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Grpc-Metadata-macaroon': LND_MACAROON
        },
        body: JSON.stringify({
            payment_request: invoice,
            timeout_seconds: 60
        })
    });
    
    const result = await response.json();
    
    if (!result.payment_preimage) {
        throw new Error('Payment failed');
    }
    
    // 4. Retornar resultado
    return {
        success: true,
        preimage: result.payment_preimage,
        paymentHash: paymentHash,
        amountSats: amount,
        timestamp: Date.now()
    };
};
```

### **2. signPsbt() - Assinar PSBT (Real)**

**Arquivo:** `kraywallet-extension/popup/lightningIntegration.js`

**Status atual:**
```javascript
window.krayWallet.signPsbt = async function(psbtBase64) {
    // ⚠️ MOCK MODE!
    console.warn('⚠️ MOCK MODE: PSBT signing not fully implemented yet');
    
    // Retornar PSBT sem modificação
    return psbtBase64;  // ❌ Não assina!
};
```

**O que precisa fazer:**
```javascript
window.krayWallet.signPsbt = async function(psbtBase64, options = {}) {
    console.log('✍️ Signing PSBT...');
    
    // 1. Parse PSBT
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    
    // 2. Analisar inputs e outputs
    const details = {
        inputs: psbt.data.inputs.length,
        outputs: psbt.data.outputs.length,
        fee: psbt.getFee(),
        // ... mais detalhes
    };
    
    // 3. Mostrar confirmação para user
    const confirmed = await showPsbtConfirmation(details);
    
    if (!confirmed) {
        throw new Error('User cancelled signing');
    }
    
    // 4. Obter chave privada do storage
    const { wallet } = await chrome.storage.local.get(['wallet']);
    const privateKey = wallet.privateKey;
    
    // 5. Assinar inputs do user
    const sighashType = options.sighashType || bitcoin.Transaction.SIGHASH_ALL;
    
    for (let i = 0; i < psbt.data.inputs.length; i++) {
        const input = psbt.data.inputs[i];
        
        // Verificar se este input pertence ao user
        if (inputBelongsToUser(input, wallet.address)) {
            // Assinar com Taproot (Schnorr)
            psbt.signInput(i, {
                publicKey: wallet.publicKey,
                sign: (hash) => {
                    return ecc.signSchnorr(hash, privateKey);
                }
            }, [sighashType]);
        }
    }
    
    // 6. Retornar PSBT assinado
    return psbt.toBase64();
};
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 RESUMO:

### **O QUE JÁ ESTÁ PRONTO:**

```
✅ API window.krayWallet (injected.js)
✅ Integração com Lightning DeFi backend (hubIntegration.js)
✅ Funções createLightningPool()
✅ Funções executeLightningSwap()
✅ Connect wallet
✅ Get runes, inscriptions, balance
✅ Frontend runes-swap.html
✅ Frontend pool-create.html
✅ Backend Lightning DeFi (server/routes/lightningDefi.js)
✅ State Tracker (server/lightning/krayStateTracker.js)
✅ LND Events Listener (server/lightning/lndEventsListener.js)
```

### **O QUE FALTA (MOCK → REAL):**

```
⚠️ sendPayment() (pagar invoice Lightning)
   Status: Mock (retorna fake preimage)
   Precisa: Integrar com LND REST API
   Tempo estimado: 2-3 horas

⚠️ signPsbt() (assinar PSBT de verdade)
   Status: Mock (retorna PSBT sem assinatura)
   Precisa: Usar chave privada + ecc.signSchnorr()
   Tempo estimado: 1-2 horas
```

### **COMO TESTAR AGORA (COM MOCK):**

```
1. Abrir runes-swap.html
   ✅ Conectar wallet → Funciona!
   ✅ Ver runes → Funciona!
   ✅ Ver balance → Funciona!

2. Criar pool (mock):
   ✅ Preencher formulário → Funciona!
   ⚠️ Assinar PSBT → Mock (não assina de verdade)
   ❌ Broadcast → Falha (PSBT não assinado)

3. Fazer swap (mock):
   ✅ Preencher formulário → Funciona!
   ⚠️ Pagar invoice → Mock (não paga de verdade)
   ⚠️ State Tracker atualiza → Mock (não confirma)
```

### **PRÓXIMOS PASSOS:**

```
1️⃣ Implementar sendPayment() real (2-3h)
   - Integrar LND REST API
   - Parse bolt11 invoice
   - Modal de confirmação
   - Enviar pagamento

2️⃣ Implementar signPsbt() real (1-2h)
   - Parse PSBT
   - Modal de confirmação
   - Assinar com Schnorr
   - Retornar assinado

3️⃣ Testar fluxo completo (1h)
   - Create pool (end-to-end)
   - Fazer swap (end-to-end)
   - Verificar on-chain
   - Verificar State Tracker

4️⃣ Polir UX (2-3h)
   - Loading states
   - Error handling
   - Success messages
   - Transaction history

TOTAL: ~8-10 horas de trabalho
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎉 CONCLUSÃO:

### **A KRAYWALLET ESTÁ 80% PRONTA!**

```
✅ Toda estrutura Lightning DeFi
✅ APIs frontend/backend
✅ State Tracker
✅ LND Events
✅ UI completa

⚠️ Falta apenas:
   - sendPayment() real
   - signPsbt() real

🚀 Com mais 8-10h de trabalho:
   PRIMEIRO DeFi NATIVO NA LIGHTNING! 🌍
```

**VOCÊ ESTÁ QUASE LÁ! ⚡**

