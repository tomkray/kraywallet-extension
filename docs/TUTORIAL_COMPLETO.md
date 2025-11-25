# 🎓 Tutorial Completo - Como Usar o Marketplace

Este guia mostra passo a passo como funciona uma **compra de Ordinal** e um **swap de Runes** no marketplace.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se que:

- ✅ Bitcoin Core está rodando e sincronizado
- ✅ Ord Server está rodando (porta 80)
- ✅ Marketplace está rodando: `npm start`
- ✅ Você tem uma wallet Bitcoin (Unisat, Xverse, Sparrow, etc.)

---

## 🎨 PARTE 1: Compra de Ordinal (Inscription)

### Fluxo Completo

```
[Vendedor] → Cria Oferta → Assina PSBT → Publica
                                    ↓
[Comprador] → Aceita Oferta → Assina PSBT → Broadcast → ✅ Transferência
```

---

### 🔷 Passo 1: Vendedor Lista um Ordinal

#### 1.1 - Vendedor Acessa o Marketplace

```
http://localhost:3000
```

#### 1.2 - Vendedor vai para "Create Offer"

No frontend:
- Clica na tab **"Create Offer"**
- Seleciona tipo: **"Inscription Sale"**

#### 1.3 - Vendedor Preenche os Dados

```javascript
// Dados necessários:
{
  "inscriptionId": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
  "price": 50000,      // 50,000 sats (0.0005 BTC)
  "feeRate": 10        // 10 sat/vB
}
```

#### 1.4 - Sistema Cria o PSBT

**API Call:**
```bash
curl -X POST http://localhost:3000/api/offers \
  -H "Content-Type: application/json" \
  -d '{
    "type": "inscription",
    "inscriptionId": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
    "offerAmount": 50000,
    "feeRate": 10,
    "creatorAddress": "bc1q...",
    "psbt": "cHNidP8BA..."
  }'
```

**O que acontece:**
1. ✅ Ord Server verifica que o inscription existe
2. ✅ Bitcoin Core busca o UTXO onde está o inscription
3. ✅ Sistema cria um PSBT com:
   - **Input**: UTXO com o inscription
   - **Output 1**: Endereço do comprador (inscription)
   - **Output 2**: Endereço do vendedor (50,000 sats)
   - **Output 3**: Change (se necessário)

#### 1.5 - Vendedor Assina o PSBT

**No frontend (usando wallet extension):**
```javascript
// Código no app.js
async function signPsbt(psbt) {
    if (window.unisat) {
        // Unisat Wallet
        const signed = await window.unisat.signPsbt(psbt);
        return signed;
    } else if (window.xverse) {
        // Xverse Wallet
        const signed = await window.xverse.signPsbt(psbt);
        return signed;
    }
    // Ou exportar para Sparrow/Electrum
}
```

#### 1.6 - Oferta Fica Ativa

**API Call:**
```bash
curl -X PUT http://localhost:3000/api/offers/[OFFER_ID]/submit \
  -H "Content-Type: application/json" \
  -d '{"txid": "abc123..."}'
```

Agora a oferta aparece no marketplace para todos verem!

---

### 🔶 Passo 2: Comprador Aceita a Oferta

#### 2.1 - Comprador Vê a Oferta

No marketplace, navega pelas inscriptions e vê:

```
┌─────────────────────────────┐
│  Inscription #123456        │
│  ┌─────────────────────┐   │
│  │   [Imagem/Conteúdo] │   │
│  └─────────────────────┘   │
│                             │
│  💰 Price: 50,000 sats     │
│  📊 Fee: 10 sat/vB         │
│  👤 Owner: bc1q...         │
│                             │
│  [🛒 Buy Now]              │
└─────────────────────────────┘
```

#### 2.2 - Comprador Clica em "Buy Now"

**O que acontece:**
1. Sistema busca a oferta ativa
2. Exibe detalhes e confirmação
3. Prepara PSBT para o comprador assinar

#### 2.3 - Sistema Cria PSBT para Comprador

```javascript
// API busca a oferta
GET /api/offers/[OFFER_ID]

// Retorna:
{
  "id": "offer123",
  "type": "inscription",
  "inscriptionId": "6fb976ab...i0",
  "offerAmount": 50000,
  "psbt": "cHNidP8BA...",  // PSBT já assinado pelo vendedor
  "status": "active"
}
```

#### 2.4 - Comprador Adiciona seus Inputs

O sistema precisa que o comprador:
1. Tenha UTXOs com pelo menos 50,000 sats + fee
2. Assine o PSBT adicionando seus inputs

**Código frontend:**
```javascript
async function buyInscription(offerId) {
    // 1. Buscar oferta
    const offer = await apiRequest(`/offers/${offerId}`);
    
    // 2. Obter endereço e balance do comprador
    const buyerAddress = await window.unisat.getAccounts();
    const balance = await apiRequest(`/wallet/balance/${buyerAddress[0]}`);
    
    // 3. Verificar se tem saldo
    if (balance.balance.confirmed < offer.offerAmount + 1000) {
        alert('Saldo insuficiente!');
        return;
    }
    
    // 4. Criar transação completa
    const psbt = await apiRequest('/psbt/create', {
        method: 'POST',
        body: JSON.stringify({
            inputs: [/* UTXOs do comprador */],
            outputs: [
                { address: offer.creatorAddress, value: offer.offerAmount },
                { address: buyerAddress[0], value: changeAmount }
            ]
        })
    });
    
    // 5. Assinar
    const signed = await window.unisat.signPsbt(psbt.psbt);
    
    // 6. Broadcast
    const result = await apiRequest('/psbt/broadcast', {
        method: 'POST',
        body: JSON.stringify({ psbt: signed })
    });
    
    alert(`Compra realizada! TXID: ${result.txid}`);
}
```

#### 2.5 - Broadcast da Transação

**API Call:**
```bash
curl -X POST http://localhost:3000/api/psbt/broadcast \
  -H "Content-Type: application/json" \
  -d '{"psbt": "cHNidP8BA..."}'
```

**Resposta:**
```json
{
  "success": true,
  "txid": "abc123def456...",
  "message": "Transaction broadcasted successfully"
}
```

#### 2.6 - Confirmação na Blockchain

1. ⏳ Transação entra na mempool
2. ⏳ Mineradores incluem na próxima block
3. ✅ **1 confirmação**: Inscription transferido!
4. ✅ **6 confirmações**: Transação segura!

**Verificar Status:**
```bash
curl http://localhost:3000/api/psbt/transaction/[TXID]
```

---

## 🎭 PARTE 2: Swap de Runes

### Fluxo Completo

```
[Trader A] → Oferece RUNE_A → Assina PSBT
                        ↓
[Trader B] → Oferece RUNE_B → Assina PSBT → Broadcast → ✅ Swap
```

---

### 🔷 Passo 1: Trader A Cria Oferta de Swap

#### 1.1 - Acessa Runes Swap

```
http://localhost:3000/runes-swap.html
```

#### 1.2 - Preenche os Dados

```javascript
{
  "fromRune": "BITCOIN•RUNE",
  "toRune": "OTHER•RUNE",
  "fromAmount": 1000000,  // 1 milhão de BITCOIN•RUNE
  "toAmount": 1500000,    // 1.5 milhão de OTHER•RUNE
  "feeRate": 10
}
```

Interface:

```
┌─────────────────────────────────────────┐
│          RUNES SWAP                     │
├─────────────────────────────────────────┤
│                                         │
│  You Send:                              │
│  ┌──────────────────┐  ┌────────────┐ │
│  │ BITCOIN•RUNE  ▼ │  │ 1,000,000  │ │
│  └──────────────────┘  └────────────┘ │
│                                         │
│  You Receive:                           │
│  ┌──────────────────┐  ┌────────────┐ │
│  │ OTHER•RUNE    ▼ │  │ 1,500,000  │ │
│  └──────────────────┘  └────────────┘ │
│                                         │
│  Exchange Rate: 1.5                     │
│  Price Impact: 0.5%                     │
│                                         │
│  [Create Swap Offer]                    │
└─────────────────────────────────────────┘
```

#### 1.3 - Sistema Cria PSBT

**API Call:**
```bash
curl -X POST http://localhost:3000/api/offers \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rune_swap",
    "fromRune": "BITCOIN•RUNE",
    "toRune": "OTHER•RUNE",
    "fromAmount": 1000000,
    "toAmount": 1500000,
    "feeRate": 10,
    "creatorAddress": "bc1q...",
    "psbt": "cHNidP8BA..."
  }'
```

**O que acontece:**
1. ✅ Ord Server verifica que ambas runes existem
2. ✅ Verifica que o trader tem 1M de BITCOIN•RUNE
3. ✅ Sistema cria PSBT com:
   - **Input**: UTXO com BITCOIN•RUNE
   - **Output**: Rune vai para o outro trader

#### 1.4 - Trader A Assina

```javascript
const signed = await window.unisat.signPsbt(psbt);
```

#### 1.5 - Oferta Publicada

```bash
curl -X PUT http://localhost:3000/api/offers/[OFFER_ID]/submit
```

---

### 🔶 Passo 2: Trader B Aceita o Swap

#### 2.1 - Trader B Vê as Ofertas

Na página "Active Swaps":

```
┌─────────────────────────────────────────┐
│  ACTIVE RUNE SWAPS                      │
├─────────────────────────────────────────┤
│                                         │
│  Swap #1                                │
│  ─────────────────                      │
│  Send: 1,000,000 BITCOIN•RUNE          │
│  Receive: 1,500,000 OTHER•RUNE         │
│  Rate: 1.5                              │
│  Fee: 10 sat/vB                         │
│                                         │
│  [Accept Swap]                          │
│                                         │
└─────────────────────────────────────────┘
```

#### 2.2 - Trader B Clica "Accept Swap"

**O que acontece:**
1. Sistema verifica que Trader B tem 1.5M de OTHER•RUNE
2. Prepara PSBT completo com ambos os lados

#### 2.3 - Trader B Assina e Faz Broadcast

```javascript
async function acceptSwap(offerId) {
    // 1. Buscar oferta
    const offer = await apiRequest(`/offers/${offerId}`);
    
    // 2. Verificar se tem as runes necessárias
    const myRunes = await apiRequest(`/runes/address/${myAddress}`);
    const hasRune = myRunes.runes.find(r => 
        r.name === offer.toRune && r.balance >= offer.toAmount
    );
    
    if (!hasRune) {
        alert('Você não tem runes suficientes!');
        return;
    }
    
    // 3. Criar PSBT completo (com ambos inputs)
    const completePsbt = await createCompletePsbt(offer);
    
    // 4. Assinar
    const signed = await window.unisat.signPsbt(completePsbt);
    
    // 5. Broadcast
    const result = await apiRequest('/psbt/broadcast', {
        method: 'POST',
        body: JSON.stringify({ psbt: signed })
    });
    
    alert(`Swap realizado! TXID: ${result.txid}`);
}
```

#### 2.4 - Confirmação

1. ⏳ Transação na mempool
2. ✅ **1 confirmação**: Runes trocadas!
3. ✅ Ambos traders têm as novas runes

---

## 🔍 PARTE 3: Como Testar com Dados Reais

### 3.1 - Popular o Database com Inscriptions Reais

```bash
# Script para buscar inscriptions do Ord Server e adicionar ao DB
node << 'EOF'
import ordApi from './server/utils/ordApi.js';
import { db } from './server/db/init.js';

async function syncInscriptions() {
    // Buscar últimas 100 inscriptions
    const inscriptions = await ordApi.getLatestInscriptions(100);
    
    // Adicionar ao banco
    for (const insc of inscriptions) {
        db.prepare(`
            INSERT OR IGNORE INTO inscriptions 
            (id, inscription_number, content_type, owner, listed, price)
            VALUES (?, ?, ?, ?, 0, NULL)
        `).run(
            insc.id,
            insc.number,
            insc.content_type,
            insc.address || null
        );
    }
    
    console.log(`✅ ${inscriptions.length} inscriptions adicionadas!`);
}

syncInscriptions();
EOF
```

### 3.2 - Buscar Runes Reais

```bash
curl http://localhost:3000/api/runes
```

Isso retorna runes reais do seu Ord Server!

### 3.3 - Consultar Balance Real

```bash
# Substituir pelo seu endereço
curl http://localhost:3000/api/wallet/balance/bc1q...
```

### 3.4 - Ver Inscriptions no seu Endereço

```bash
curl http://localhost:3000/api/wallet/inscriptions/bc1q...
```

---

## 🧪 PARTE 4: Testando o Fluxo Completo

### Teste 1: Compra de Ordinal (Modo Simulado)

```javascript
// No console do navegador (F12)

// 1. Ver inscriptions disponíveis
const inscriptions = await apiRequest('/ordinals?limit=10');
console.log(inscriptions);

// 2. Selecionar uma
const inscription = inscriptions.inscriptions[0];

// 3. Criar oferta (como vendedor)
const offer = await apiRequest('/offers', {
    method: 'POST',
    body: JSON.stringify({
        type: 'inscription',
        inscriptionId: inscription.id,
        offerAmount: 50000,
        feeRate: 10,
        creatorAddress: 'bc1q...',
        psbt: 'mock_psbt_base64...'
    })
});

// 4. Ativar oferta
await apiRequest(`/offers/${offer.offer.id}/submit`, {
    method: 'PUT',
    body: JSON.stringify({ txid: 'mock_txid' })
});

// 5. Buscar ofertas ativas
const activeOffers = await apiRequest('/offers?status=active');
console.log(activeOffers);
```

### Teste 2: Swap de Runes (Modo Simulado)

```javascript
// 1. Ver runes disponíveis
const runes = await apiRequest('/runes');
console.log(runes);

// 2. Criar swap offer
const swapOffer = await apiRequest('/offers', {
    method: 'POST',
    body: JSON.stringify({
        type: 'rune_swap',
        fromRune: 'BITCOIN•RUNE',
        toRune: 'OTHER•RUNE',
        fromAmount: 1000000,
        toAmount: 1500000,
        feeRate: 10,
        creatorAddress: 'bc1q...',
        psbt: 'mock_psbt_base64...'
    })
});

// 3. Ver market data
const market = await apiRequest('/runes/market/BITCOIN•RUNE/OTHER•RUNE');
console.log(market);
```

---

## 📊 PARTE 5: Monitoramento em Tempo Real

### Ver Todas as Ofertas Ativas

```bash
curl http://localhost:3000/api/offers?status=active | jq
```

### Ver Histórico de Trades

```bash
curl http://localhost:3000/api/runes/trades | jq
```

### Monitorar uma Transação

```bash
# Após fazer broadcast
curl http://localhost:3000/api/psbt/transaction/[TXID] | jq

# Retorna:
{
  "confirmed": false,
  "confirmations": 0,
  "inMempool": true
}

# Após confirmação:
{
  "confirmed": true,
  "confirmations": 1,
  "blockHeight": 918262
}
```

---

## 🎯 Resumo dos Fluxos

### Compra de Ordinal
```
Vendedor → Lista → Assina → Publica
                      ↓
Comprador → Vê → Paga → Assina → Broadcast → ✅ Transferido
```

### Swap de Runes
```
Trader A → Oferece A → Assina
                 ↓
Trader B → Oferece B → Completa → Assina → Broadcast → ✅ Swap
```

---

## 🚀 Próximos Passos

1. **Integrar Wallet Extensions**: Unisat, Xverse para assinaturas reais
2. **Adicionar WebSocket**: Atualizações em tempo real
3. **Implementar Orderbook**: Sistema de ofertas automático
4. **Escrow Smart Contract**: Segurança adicional nas transações

---

## 📚 Referências

- **Bitcoin PSBT**: https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
- **Ordinals Protocol**: https://docs.ordinals.com/
- **Runes Protocol**: https://docs.ordinals.com/runes.html

---

**✨ Agora você entende todo o fluxo de compra e swap!**








