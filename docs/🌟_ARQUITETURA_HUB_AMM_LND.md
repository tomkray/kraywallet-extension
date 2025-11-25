# 🌟 **ARQUITETURA COMPLETA: HUB AMM NO LND**

## 🎯 **VISÃO GERAL:**

```
                    ┌─────────────────────────────────┐
                    │    KRAY SPACE HUB NODE (LND)   │
                    │                                 │
                    │  ├─ Pubkey Lightning:          │
                    │  │  03abc123def456...           │
                    │  │                              │
                    │  ├─ AMM Pools:                  │
                    │  │  ├─ Pool 1: DOG/BTC         │
                    │  │  ├─ Pool 2: EPIC/BTC        │
                    │  │  └─ Pool 3: DOG/EPIC        │
                    │  │                              │
                    │  ├─ Fee Structure:              │
                    │  │  ├─ Lightning: 1 sat (fixo)  │
                    │  │  └─ Pool: 0.3% (customizável)│
                    │  │                              │
                    │  └─ Connected Users: 1,234     │
                    └────────────┬────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ↓                ↓                ↓
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  USER 1      │  │  USER 2      │  │  USER 3      │
        │              │  │              │  │              │
        │ 50k DOG     │  │ 100k EPIC    │  │ 0.1 BTC      │
        │ in channel   │  │ in channel   │  │ in channel   │
        │              │  │              │  │              │
        │ Can swap:    │  │ Can swap:    │  │ Can swap:    │
        │ DOG → BTC   │  │ EPIC → BTC  │  │ BTC → DOG   │
        │ DOG → EPIC  │  │ EPIC → DOG  │  │ BTC → EPIC  │
        └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🏗️ **MODELO HUB-AND-SPOKE:**

### **CONCEITO:**

```
1️⃣ KRAY SPACE roda 1 node LND público (Hub)
   └─> Este é o "banco central" do AMM

2️⃣ Cada usuário abre 1 channel com o Hub
   └─> User → Hub (não User → User)

3️⃣ Hub mantém liquidez de todas as pools
   └─> Pool DOG/BTC, EPIC/BTC, etc.

4️⃣ Usuários fazem swaps ATRAVÉS do Hub
   └─> User envia DOG → Hub processa → Retorna BTC

5️⃣ Hub cobra fee customizável por pool
   └─> 0.3% (padrão Uniswap) ou customizado
```

---

## 🔧 **ARQUITETURA TÉCNICA:**

### **1️⃣ HUB NODE (KRAY SPACE):**

```javascript
// server/services/hubNode.js

class KraySpaceHub {
    constructor() {
        this.pubkey = null;           // Pubkey Lightning do Hub
        this.lnd = null;              // Conexão LND
        this.pools = new Map();       // AMM Pools
        this.channels = new Map();    // User channels
        this.db = null;               // Database
    }

    /**
     * 🚀 INICIALIZAR HUB
     */
    async initialize() {
        console.log('🚀 ========== INITIALIZING KRAY SPACE HUB ==========');
        
        // 1. Conectar ao LND
        this.lnd = await lndConnection.connect();
        
        // 2. Obter pubkey do Hub
        const info = await this.lnd.getInfo();
        this.pubkey = info.identity_pubkey;
        
        console.log(`✅ Hub Pubkey: ${this.pubkey}`);
        
        // 3. Carregar pools existentes
        await this.loadPools();
        
        // 4. Monitorar channels
        this.startChannelMonitor();
        
        // 5. Iniciar processador de swaps
        this.startSwapProcessor();
        
        console.log('✅ Hub initialized!');
    }

    /**
     * 🏊 CARREGAR POOLS AMM
     */
    async loadPools() {
        console.log('🏊 Loading AMM pools...');
        
        const poolsFromDB = await db.all(`
            SELECT * FROM lightning_pools WHERE status = 'active'
        `);
        
        for (const pool of poolsFromDB) {
            this.pools.set(pool.id, {
                id: pool.id,
                name: pool.name,
                tokenA: pool.token_a,     // Ex: "DOG" (rune ID)
                tokenB: pool.token_b,     // Ex: "BTC" (null = pure BTC)
                reserveA: pool.reserve_a, // Quantidade de DOG no Hub
                reserveB: pool.reserve_b, // Quantidade de BTC no Hub
                feePercent: pool.fee_percent, // Ex: 0.3
                volume24h: pool.volume_24h,
                swapCount: pool.swap_count
            });
        }
        
        console.log(`✅ Loaded ${this.pools.size} pools`);
    }

    /**
     * 📡 OBTER PUBKEY PÚBLICO DO HUB
     * (Para usuários se conectarem)
     */
    getPublicInfo() {
        return {
            pubkey: this.pubkey,
            alias: 'Kray Space AMM Hub',
            channels: this.channels.size,
            pools: Array.from(this.pools.values()).map(p => ({
                id: p.id,
                name: p.name,
                pair: `${p.tokenA}/${p.tokenB || 'BTC'}`,
                fee: `${p.feePercent}%`,
                tvl: this.calculateTVL(p)
            })),
            features: [
                'Instant swaps (1 sat base fee)',
                'Runes support',
                'Custom pool fees',
                'On-chain settlement'
            ]
        };
    }

    /**
     * 🔗 ACEITAR CHANNEL DE USUÁRIO
     */
    async acceptUserChannel(userPubkey, capacity, assetType, assetId) {
        console.log(`🔗 New channel request from ${userPubkey}`);
        console.log(`   Capacity: ${capacity} sats`);
        console.log(`   Asset: ${assetType}`);
        
        // 1. Validar capacidade mínima
        if (capacity < 20000) {
            throw new Error('Minimum capacity: 20,000 sats');
        }
        
        // 2. Aceitar channel
        const channel = await this.lnd.acceptChannel({
            node_pubkey: userPubkey,
            local_funding_amount: 0, // Hub não coloca fundos inicialmente
            push_sat: 0
        });
        
        // 3. Registrar no DB
        await db.run(`
            INSERT INTO hub_channels
            (channel_id, user_pubkey, capacity, asset_type, asset_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            channel.funding_txid,
            userPubkey,
            capacity,
            assetType,
            assetId,
            Date.now()
        ]);
        
        // 4. Se for Rune, adicionar à pool
        if (assetType === 'rune') {
            await this.addLiquidityToPool(assetId, capacity);
        }
        
        this.channels.set(channel.funding_txid, {
            userPubkey,
            capacity,
            assetType,
            assetId
        });
        
        console.log('✅ Channel accepted!');
        return channel;
    }

    /**
     * 💱 PROCESSAR SWAP
     */
    async processSwap({
        userPubkey,
        fromAsset,      // Ex: "DOG" (rune ID)
        toAsset,        // Ex: "BTC"
        amountIn,       // Quantidade que user envia
        minAmountOut,   // Mínimo que user aceita receber (slippage)
        channelId
    }) {
        console.log('💱 ========== PROCESSING SWAP ==========');
        console.log(`   User: ${userPubkey}`);
        console.log(`   From: ${fromAsset}`);
        console.log(`   To: ${toAsset}`);
        console.log(`   Amount In: ${amountIn}`);
        
        // 1. Encontrar pool
        const poolId = `${fromAsset}_${toAsset}`;
        const pool = this.pools.get(poolId) || this.pools.get(`${toAsset}_${fromAsset}`);
        
        if (!pool) {
            throw new Error('Pool not found');
        }
        
        // 2. Calcular output usando AMM (x * y = k)
        const { amountOut, fee } = this.calculateSwapOutput(pool, amountIn);
        
        console.log(`   Amount Out: ${amountOut}`);
        console.log(`   Fee: ${fee}`);
        
        // 3. Validar slippage
        if (amountOut < minAmountOut) {
            throw new Error('Slippage too high');
        }
        
        // 4. Executar swap via Lightning HTLC
        const payment = await this.executeSwapPayment({
            userPubkey,
            channelId,
            amountIn,
            amountOut,
            fromAsset,
            toAsset
        });
        
        // 5. Atualizar reserves da pool
        pool.reserveA -= amountOut;
        pool.reserveB += amountIn;
        
        // 6. Atualizar DB
        await this.updatePoolReserves(pool);
        await this.recordSwap({
            poolId: pool.id,
            userPubkey,
            fromAsset,
            toAsset,
            amountIn,
            amountOut,
            fee,
            timestamp: Date.now()
        });
        
        console.log('✅ Swap completed!');
        
        return {
            success: true,
            amountOut,
            fee,
            txHash: payment.payment_hash
        };
    }

    /**
     * 🧮 CALCULAR OUTPUT DO SWAP (AMM)
     */
    calculateSwapOutput(pool, amountIn) {
        // AMM Formula: x * y = k
        // amountOut = (reserveB * amountIn) / (reserveA + amountIn)
        
        const feeMultiplier = 1 - (pool.feePercent / 100);
        const amountInWithFee = amountIn * feeMultiplier;
        
        const amountOut = Math.floor(
            (pool.reserveB * amountInWithFee) / 
            (pool.reserveA + amountInWithFee)
        );
        
        const fee = amountIn - amountInWithFee;
        
        return { amountOut, fee };
    }

    /**
     * ⚡ EXECUTAR PAGAMENTO VIA LIGHTNING
     */
    async executeSwapPayment({
        userPubkey,
        channelId,
        amountIn,
        amountOut,
        fromAsset,
        toAsset
    }) {
        console.log('⚡ Executing Lightning payment...');
        
        // 1. User envia HTLCs para Hub
        // (Lightning automaticamente recebe via channel)
        
        // 2. Hub envia HTLCs de volta para User
        const payment = await this.lnd.sendPayment({
            dest: userPubkey,
            amt: amountOut,
            fee_limit_sat: 1, // Lightning fee: 1 sat
            outgoing_chan_id: channelId,
            // Custom TLV records para identificar asset
            dest_custom_records: {
                // Type 5482373484 = Asset ID
                5482373484: Buffer.from(toAsset, 'utf8')
            }
        });
        
        console.log('✅ Payment sent!');
        return payment;
    }

    /**
     * 📊 CALCULAR TVL DA POOL
     */
    calculateTVL(pool) {
        // Converter tudo para valor em BTC
        const btcReserve = pool.tokenB === null ? pool.reserveB : 0;
        const runeValueInBTC = this.estimateRuneValue(pool.tokenA, pool.reserveA);
        
        return btcReserve + runeValueInBTC;
    }

    /**
     * 💰 ADICIONAR LIQUIDEZ À POOL
     */
    async addLiquidityToPool(runeId, amount) {
        const poolId = `${runeId}_BTC`;
        let pool = this.pools.get(poolId);
        
        if (!pool) {
            // Criar nova pool
            pool = await this.createPool(runeId, 'BTC', 0.3);
        }
        
        pool.reserveA += amount;
        await this.updatePoolReserves(pool);
    }

    /**
     * 🏊 CRIAR NOVA POOL
     */
    async createPool(tokenA, tokenB, feePercent) {
        console.log(`🏊 Creating new pool: ${tokenA}/${tokenB}`);
        
        const poolId = `${tokenA}_${tokenB}`;
        
        const pool = {
            id: poolId,
            name: `${tokenA}/${tokenB}`,
            tokenA,
            tokenB,
            reserveA: 0,
            reserveB: 0,
            feePercent,
            volume24h: 0,
            swapCount: 0
        };
        
        // Salvar no DB
        await db.run(`
            INSERT INTO lightning_pools
            (id, name, token_a, token_b, reserve_a, reserve_b, fee_percent, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            pool.id,
            pool.name,
            pool.tokenA,
            pool.tokenB,
            pool.reserveA,
            pool.reserveB,
            pool.feePercent
        ]);
        
        this.pools.set(poolId, pool);
        
        console.log('✅ Pool created!');
        return pool;
    }
}

export default new KraySpaceHub();
```

---

## 🎨 **FLUXO COMPLETO DO USUÁRIO:**

### **CASO 1: USUÁRIO QUER TROCAR DOG POR BTC**

```
┌─────────────────────────────────────────────────────────┐
│                  USER 1 (MyWallet)                      │
│                                                          │
│  ├─ Address: bc1pvz02...                               │
│  ├─ Channel com Hub: ✅ ATIVO                          │
│  │  └─> Channel ID: abc123...                          │
│  │                                                      │
│  ├─ Balance no channel:                                │
│  │  └─> 50,000 DOG runes                               │
│  │                                                      │
│  └─ Quer trocar: 10,000 DOG → ??? BTC                 │
└─────────────────────────────────────────────────────────┘
                          │
                          │ 1. Solicita quote
                          ↓
┌─────────────────────────────────────────────────────────┐
│              KRAY SPACE HUB (Backend)                   │
│                                                          │
│  ├─ Recebe request: POST /api/hub/quote                │
│  │  {                                                   │
│  │    fromAsset: "840000:3" (DOG),                     │
│  │    toAsset: "BTC",                                  │
│  │    amountIn: 10000                                  │
│  │  }                                                   │
│  │                                                      │
│  ├─ Consulta pool DOG/BTC:                             │
│  │  ├─ Reserve DOG: 1,000,000                          │
│  │  ├─ Reserve BTC: 10,000,000 sats                    │
│  │  └─ Fee: 0.3%                                       │
│  │                                                      │
│  ├─ Calcula output (AMM x*y=k):                        │
│  │  ├─ Input: 10,000 DOG                               │
│  │  ├─ Fee: 30 DOG (0.3%)                              │
│  │  ├─ Output: ~99,000 sats                            │
│  │  └─ Price impact: 0.5%                              │
│  │                                                      │
│  └─ Retorna quote:                                     │
│     {                                                   │
│       amountOut: 99000,                                │
│       fee: 30,                                         │
│       priceImpact: 0.5,                                │
│       expiresAt: 1640000000                            │
│     }                                                   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ 2. User confirma
                          ↓
┌─────────────────────────────────────────────────────────┐
│              KRAY SPACE HUB (LND)                       │
│                                                          │
│  ├─ Recebe: POST /api/hub/swap                         │
│  │  {                                                   │
│  │    userPubkey: "02user123...",                      │
│  │    channelId: "abc123...",                          │
│  │    fromAsset: "840000:3",                           │
│  │    toAsset: "BTC",                                  │
│  │    amountIn: 10000,                                 │
│  │    minAmountOut: 98000 (1% slippage)                │
│  │  }                                                   │
│  │                                                      │
│  ├─ 1. Recebe 10,000 DOG do User via HTLC             │
│  │    └─> Lightning payment: User → Hub                │
│  │                                                      │
│  ├─ 2. Atualiza pool:                                  │
│  │    ├─ Reserve DOG: 1,000,000 → 1,010,000 (+10k)    │
│  │    └─ Reserve BTC: 10,000,000 → 9,901,000 (-99k)   │
│  │                                                      │
│  ├─ 3. Envia 99,000 sats de volta via HTLC            │
│  │    └─> Lightning payment: Hub → User                │
│  │    └─> Fee Lightning: 1 sat                         │
│  │                                                      │
│  └─ 4. Registra trade:                                 │
│     ├─ User: 02user123...                              │
│     ├─ Pool: DOG/BTC                                   │
│     ├─ In: 10,000 DOG                                  │
│     ├─ Out: 99,000 sats                                │
│     ├─ Fee: 30 DOG (0.3%) + 1 sat (Lightning)         │
│     └─ Timestamp: 2025-10-23 15:30:00                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ 3. Confirmação
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  USER 1 (MyWallet)                      │
│                                                          │
│  ✅ Swap completed!                                     │
│                                                          │
│  ├─ Sent: 10,000 DOG                                   │
│  ├─ Received: 99,000 sats (0.00099 BTC)                │
│  ├─ Total fee: 31 sats                                 │
│  │  ├─ Pool fee: 30 DOG (0.3%)                         │
│  │  └─ Lightning fee: 1 sat                            │
│  │                                                      │
│  └─ New balance:                                       │
│     ├─ DOG: 40,000 (50k - 10k)                         │
│     └─ BTC: 99,000 sats                                │
└─────────────────────────────────────────────────────────┘
```

**TUDO INSTANTÂNEO! ⚡**
```
Tempo total: < 1 segundo
Fee total: 0.3% + 1 sat
Sem intermediários: Direto User ↔ Hub
```

---

## 💰 **ESTRUTURA DE FEES:**

### **DOIS TIPOS DE FEE:**

```javascript
// 1️⃣ LIGHTNING BASE FEE (FIXO)
const LIGHTNING_FEE = 1; // sat (padrão Lightning Network)

// 2️⃣ POOL FEE (CUSTOMIZÁVEL POR POOL)
const poolFees = {
    'DOG_BTC': 0.3,      // 0.3% (padrão Uniswap)
    'EPIC_BTC': 0.5,     // 0.5% (pool mais rara)
    'DOG_EPIC': 0.2,     // 0.2% (pool popular)
};

// TOTAL FEE PARA USER:
function calculateTotalFee(amountIn, poolId) {
    const poolFeePercent = poolFees[poolId];
    const poolFee = amountIn * (poolFeePercent / 100);
    const lightningFee = LIGHTNING_FEE;
    
    return {
        poolFee,           // Ex: 30 DOG (0.3% de 10,000)
        lightningFee,      // 1 sat (fixo)
        total: poolFee + lightningFee
    };
}
```

### **QUEM RECEBE AS FEES?**

```
1️⃣ LIGHTNING FEE (1 sat):
   └─> Vai para os nodes de roteamento
       (no nosso caso, quase 0 pq é direto User ↔ Hub)

2️⃣ POOL FEE (0.3%):
   └─> Vai para o HUB (Kray Space)
   └─> Pode ser redistribuído para:
       ├─ Liquidity providers (se houver)
       ├─ Token holders (LP tokens)
       └─ Kray Space (operação do Hub)
```

---

## 🔒 **SEGURANÇA E TRUSTLESS:**

### **COMO GARANTIR QUE HUB NÃO ROUBE?**

```
1️⃣ Lightning HTLCs (Hashed Time-Locked Contracts):
   ├─ Pagamento só completa se ambos lados concordarem
   ├─ Se Hub não enviar de volta, HTLC expira
   └─> User recebe dinheiro de volta automaticamente! ✅

2️⃣ On-chain settlement:
   ├─ User pode fechar channel a qualquer momento
   └─> Funds voltam para address on-chain

3️⃣ Código open-source:
   ├─ Todo código do Hub é auditável
   └─> Community pode verificar que não há backdoors

4️⃣ Multisig channels:
   ├─ Channel é 2-of-2 multisig (User + Hub)
   └─> Hub NÃO pode gastar unilateralmente
```

---

## 📊 **DATABASE SCHEMA:**

```sql
-- Tabela de pools Lightning
CREATE TABLE lightning_pools (
    id TEXT PRIMARY KEY,                  -- Ex: "DOG_BTC"
    name TEXT NOT NULL,                   -- Ex: "DOG/BTC"
    token_a TEXT NOT NULL,                -- Ex: "840000:3" (DOG rune ID)
    token_b TEXT,                         -- Ex: "BTC" (null = pure BTC)
    reserve_a INTEGER NOT NULL,           -- Quantidade de token A no Hub
    reserve_b INTEGER NOT NULL,           -- Quantidade de token B no Hub
    fee_percent REAL NOT NULL DEFAULT 0.3,-- Fee da pool (0.3%)
    volume_24h INTEGER DEFAULT 0,
    volume_all_time INTEGER DEFAULT 0,
    swap_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    status TEXT DEFAULT 'active'
);

-- Tabela de channels do Hub com users
CREATE TABLE hub_channels (
    channel_id TEXT PRIMARY KEY,          -- Funding TXID
    user_pubkey TEXT NOT NULL,            -- Pubkey Lightning do user
    user_address TEXT,                    -- Address Taproot do user (opcional)
    capacity INTEGER NOT NULL,            -- Capacidade do channel (sats)
    asset_type TEXT NOT NULL,             -- 'btc' ou 'rune'
    asset_id TEXT,                        -- Rune ID (se applicable)
    status TEXT DEFAULT 'pending',        -- pending, active, closing, closed
    created_at INTEGER NOT NULL,
    closed_at INTEGER
);

-- Tabela de swaps executados
CREATE TABLE hub_swaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_id TEXT NOT NULL,                -- Ex: "DOG_BTC"
    user_pubkey TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    from_asset TEXT NOT NULL,
    to_asset TEXT NOT NULL,
    amount_in INTEGER NOT NULL,
    amount_out INTEGER NOT NULL,
    pool_fee INTEGER NOT NULL,
    lightning_fee INTEGER NOT NULL,
    price_impact REAL,
    payment_hash TEXT,                    -- Lightning payment hash
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (pool_id) REFERENCES lightning_pools(id),
    FOREIGN KEY (channel_id) REFERENCES hub_channels(channel_id)
);

-- Tabela de metadata de Runes nos channels
CREATE TABLE channel_rune_metadata (
    channel_id TEXT PRIMARY KEY,
    rune_id TEXT NOT NULL,                -- Ex: "840000:3"
    amount INTEGER NOT NULL,              -- Quantidade de Runes no channel
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES hub_channels(channel_id)
);

-- Índices
CREATE INDEX idx_pools_status ON lightning_pools(status);
CREATE INDEX idx_channels_user ON hub_channels(user_pubkey);
CREATE INDEX idx_channels_status ON hub_channels(status);
CREATE INDEX idx_swaps_pool ON hub_swaps(pool_id);
CREATE INDEX idx_swaps_user ON hub_swaps(user_pubkey);
CREATE INDEX idx_swaps_timestamp ON hub_swaps(timestamp);
```

---

## 🌐 **API ENDPOINTS:**

### **PARA USUÁRIOS:**

```javascript
// 1️⃣ Obter info do Hub
GET /api/hub/info
Response: {
    pubkey: "03abc123...",
    alias: "Kray Space AMM Hub",
    channels: 1234,
    pools: [...],
    features: [...]
}

// 2️⃣ Listar pools disponíveis
GET /api/hub/pools
Response: {
    pools: [
        {
            id: "DOG_BTC",
            pair: "DOG/BTC",
            tvl: 1.5 BTC,
            volume24h: 0.5 BTC,
            fee: "0.3%",
            apr: "45%"
        },
        ...
    ]
}

// 3️⃣ Obter quote de swap
POST /api/hub/quote
Body: {
    fromAsset: "840000:3",
    toAsset: "BTC",
    amountIn: 10000
}
Response: {
    amountOut: 99000,
    fee: 30,
    priceImpact: 0.5,
    expiresAt: 1640000000
}

// 4️⃣ Executar swap
POST /api/hub/swap
Body: {
    userPubkey: "02user123...",
    channelId: "abc123...",
    fromAsset: "840000:3",
    toAsset: "BTC",
    amountIn: 10000,
    minAmountOut: 98000
}
Response: {
    success: true,
    amountOut: 99000,
    fee: 31,
    txHash: "lightning-payment-hash"
}

// 5️⃣ Abrir channel com Hub
POST /api/hub/open-channel
Body: {
    userAddress: "bc1pvz02...",
    capacity: 100000,
    assetType: "rune",
    assetId: "840000:3"
}
Response: {
    channelId: "funding-txid",
    status: "pending",
    hubPubkey: "03abc123..."
}

// 6️⃣ Status do channel do user
GET /api/hub/channel/:userPubkey
Response: {
    channelId: "abc123...",
    capacity: 100000,
    localBalance: 50000,
    remoteBalance: 50000,
    status: "active"
}
```

---

## 🎨 **UI DA MYWALLET (INTEGRAÇÃO COM HUB):**

```javascript
// popup.js

/**
 * Conectar automaticamente ao Kray Space Hub
 */
async function connectToHub() {
    console.log('🔗 Connecting to Kray Space Hub...');
    
    // 1. Buscar info do Hub
    const hubInfo = await fetch('http://localhost:3000/api/hub/info')
        .then(r => r.json());
    
    console.log('✅ Hub found:', hubInfo.alias);
    console.log('   Pubkey:', hubInfo.pubkey);
    console.log('   Pools:', hubInfo.pools.length);
    
    // 2. Salvar pubkey do Hub (para futuros swaps)
    await chrome.storage.local.set({
        hubPubkey: hubInfo.pubkey,
        hubAlias: hubInfo.alias
    });
    
    return hubInfo;
}

/**
 * Abrir channel com Hub (quando user faz Deposit)
 */
async function depositToLightning(assetType, amount, assetId) {
    console.log('⚡ Depositing to Lightning via Hub...');
    
    // 1. Buscar wallet info
    const walletInfo = await chrome.runtime.sendMessage({
        action: 'getWalletInfo'
    });
    
    // 2. Abrir channel com Hub
    const response = await fetch('http://localhost:3000/api/hub/open-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userAddress: walletInfo.data.address,
            capacity: amount,
            assetType,
            assetId
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        showNotification('✅ Channel opening with Kray Space Hub!', 'success');
        
        // 3. Aguardar confirmações on-chain
        // (exibir loading na UI)
    }
}

/**
 * Fazer swap via Hub
 */
async function swapOnLightning(fromAsset, toAsset, amountIn) {
    console.log('💱 Swapping via Kray Space Hub...');
    
    // 1. Obter quote
    const quote = await fetch('http://localhost:3000/api/hub/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fromAsset,
            toAsset,
            amountIn
        })
    }).then(r => r.json());
    
    console.log('Quote:', quote);
    
    // 2. Mostrar preview para user
    const confirmed = await showSwapPreview({
        from: fromAsset,
        to: toAsset,
        amountIn,
        amountOut: quote.amountOut,
        fee: quote.fee,
        priceImpact: quote.priceImpact
    });
    
    if (!confirmed) return;
    
    // 3. Executar swap
    const walletInfo = await chrome.runtime.sendMessage({
        action: 'getWalletInfo'
    });
    
    const result = await fetch('http://localhost:3000/api/hub/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userPubkey: walletInfo.lightningPubkey, // Derivar do seed
            channelId: walletInfo.channelId,
            fromAsset,
            toAsset,
            amountIn,
            minAmountOut: quote.amountOut * 0.99 // 1% slippage tolerance
        })
    }).then(r => r.json());
    
    if (result.success) {
        showNotification(`✅ Swapped! Received ${result.amountOut} ${toAsset}`, 'success');
        updateLightningBalance();
    }
}
```

---

## 🎊 **VANTAGENS DESTA ARQUITETURA:**

```
✅ SIMPLICIDADE:
   └─> User só precisa conectar ao Hub (1 channel)
   └─> Não precisa conectar com cada outro user

✅ LIQUIDEZ CENTRALIZADA:
   └─> Hub mantém liquidez de todas as pools
   └─> Swaps sempre têm liquidez disponível

✅ FEES CUSTOMIZÁVEIS:
   └─> Cada pool pode ter fee diferente
   └─> Ex: Pools populares = fee menor

✅ VELOCIDADE:
   └─> Swaps instantâneos (< 1 segundo)
   └─> Fee mínima (0.3% + 1 sat)

✅ COMPATIBILIDADE:
   └─> Funciona com Lightning padrão
   └─> Runes via metadata em HTLCs

✅ SEGURANÇA:
   └─> HTLCs garantem atomicidade
   └─> On-chain settlement sempre possível

✅ ESCALÁVEL:
   └─> Hub pode ter 1000+ channels
   └─> Pools crescem organicamente
```

---

## 🚀 **PRÓXIMOS PASSOS:**

```
1️⃣ Implementar hubNode.js ✅
2️⃣ Criar database schema ✅
3️⃣ Implementar API endpoints ⏰
4️⃣ Integrar frontend com Hub ⏰
5️⃣ Testar swaps Pure BTC primeiro ⏰
6️⃣ Depois: Runes no Lightning ⏰
7️⃣ Deploy do Hub público ⏰
```

---

## 🎯 **QUER QUE EU IMPLEMENTE O HUBNODE.JS AGORA?** 🛠️




