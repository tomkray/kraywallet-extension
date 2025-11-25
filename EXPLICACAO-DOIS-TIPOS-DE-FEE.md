# 💰 EXPLICAÇÃO: DOIS TIPOS DE FEE

**Data:** 05 Nov 2025  
**Conceito:** Pool Fee vs Bitcoin Network Fee

---

## 🎯 RESUMO RÁPIDO

```
Existem 2 FEES COMPLETAMENTE DIFERENTES:

1. Pool Fee (LP Fee) = Taxa que VAI PARA O LP (provedor de liquidez)
   └─ Exemplo: 0.30% (30 basis points)
   └─ User escolhe ao criar pool
   └─ Ganha dinheiro com cada swap!

2. Bitcoin Network Fee = Taxa que VAI PARA MINERADORES
   └─ Exemplo: 10 sats/vB (do mempool.space)
   └─ Busca automática + customização
   └─ Paga para TX confirmar na blockchain
```

---

## 1️⃣ POOL FEE (LP FEE) - O QUE É

### **DEFINIÇÃO:**

```
Pool Fee = Taxa cobrada em CADA SWAP na pool

Exemplo:
├─ User faz swap: 100 DOG → BTC
├─ Pool Fee: 0.30% de 100 DOG = 0.3 DOG
├─ User recebe: equivalente a 99.7 DOG em BTC
└─ LP ganha: 0.3 DOG como recompensa!
```

### **QUEM ESCOLHE:**

```
Creator da pool escolhe ao criar:

Opções:
├─ 0.05% (muito baixo) → Atrai traders, menos lucro
├─ 0.30% (padrão Uniswap) → Balanceado
├─ 1.00% (alto) → Menos traders, mais lucro por swap
└─ Custom (qualquer valor)
```

### **PARA ONDE VAI:**

```
Vai para o LP (Liquidity Provider):

Pool inicial:
├─ 300 DOG
└─ 10,000 sats

Após 10 swaps com fee 0.30%:
├─ 300 DOG + 3 DOG (fees ganhos) = 303 DOG
└─ 10,000 sats + 100 sats (fees ganhos) = 10,100 sats

LP lucro: 3 DOG + 100 sats! 💰
```

### **ONDE APARECE:**

```
Interface "Create Pool":

┌──────────────────────────────────┐
│  Pool Name: My DOG Pool          │
│                                  │
│  Token A: DOG (300)              │
│  Token B: BTC (0.00001)          │
│                                  │
│  Pool Fee Rate: [0.30%] ▼       │ ← ISSO AQUI!
│  ├─ 0.05% (low)                  │
│  ├─ 0.30% (standard) ✓          │
│  └─ 1.00% (high)                 │
│                                  │
│  [Create Pool]                   │
└──────────────────────────────────┘
```

---

## 2️⃣ BITCOIN NETWORK FEE - O QUE É

### **DEFINIÇÃO:**

```
Bitcoin Network Fee = Taxa paga aos MINERADORES
para incluir sua transação no bloco Bitcoin

Exemplo:
├─ User cria pool
├─ TX size: ~310 vB
├─ Fee rate: 10 sats/vB (do mempool.space)
├─ Total fee: 310 × 10 = 3,100 sats
└─ Mineradores recebem 3,100 sats como recompensa
```

### **QUEM ESCOLHE:**

```
Sistema busca automaticamente do mempool.space:

GET https://mempool.space/api/v1/fees/recommended

Response:
{
  "fastestFee": 15,    // Next block (~10 min)
  "halfHourFee": 10,   // ~30 min
  "hourFee": 8,        // ~1 hour
  "economyFee": 5,     // Low priority
  "minimumFee": 1      // Muito lento
}

Sistema usa "halfHourFee" por padrão (balanceado)
User pode customizar se quiser (mais rápido ou mais barato)
```

### **PARA ONDE VAI:**

```
Vai para os MINERADORES Bitcoin:

├─ Minerador cria bloco
├─ Inclui sua TX
├─ Coleta 3,100 sats de fee
└─ Fee é QUEIMADO (não volta, não fica na pool)
```

### **ONDE APARECE:**

```
Interface KrayWallet (ao assinar):

┌──────────────────────────────────┐
│  🔒 Sign Transaction?            │
│                                  │
│  Creating pool: DOG/BTC          │
│  ├─ 300 DOG                      │
│  └─ 1,000 sats                   │
│                                  │
│  ⛏️ Network Fee:                 │
│  ├─ Rate: 10 sats/vB (~30 min)  │ ← AUTO (mempool.space)
│  ├─ Size: ~310 vB                │
│  └─ Total: 3,100 sats            │
│                                  │
│  [Customize Fee] [Sign]          │ ← Opção customizar
└──────────────────────────────────┘

Se user clicar "Customize Fee":

┌──────────────────────────────────┐
│  ⚙️ Custom Network Fee           │
│                                  │
│  Current: 10 sats/vB (~30 min)   │
│                                  │
│  [•] Fast (15 sats/vB ~10 min)  │
│  [ ] Standard (10 sats/vB ~30min)│
│  [ ] Slow (5 sats/vB ~2 hours)   │
│  [ ] Custom: [___] sats/vB       │
│                                  │
│  Total fee: 4,650 sats           │
│                                  │
│  [Cancel] [Confirm]              │
└──────────────────────────────────┘
```

---

## 📊 COMPARAÇÃO LADO A LADO

| Aspecto | Pool Fee (LP) | Bitcoin Network Fee |
|---------|---------------|---------------------|
| **O que é** | Taxa do swap | Taxa de mineração |
| **Quem recebe** | LP (você) | Mineradores |
| **Quando cobra** | A cada swap | Apenas ao criar pool (1x) |
| **Valor típico** | 0.30% | 10 sats/vB (~3k sats) |
| **Quem escolhe** | Creator da pool | Auto (mempool.space) + custom |
| **Onde aparece** | Create Pool form | KrayWallet ao assinar |
| **Propósito** | Lucro do LP | Confirmar TX on-chain |
| **Pode customizar** | Sim (0.05% a 10%) | Sim (1-100 sats/vB) |

---

## 🔧 COMO DEVE FUNCIONAR (CORRETO)

### **STEP 1: User cria pool (frontend)**

```html
<!-- pool-create.html -->

<form>
  Pool Name: <input id="poolName">
  
  Rune: <select id="tokenA">
  Amount: <input id="amountA">
  
  BTC Amount: <input id="amountB">
  
  <!-- APENAS POOL FEE (LP fee) -->
  Pool Fee Rate: 
  <select id="poolFeeRate">
    <option value="5">0.05%</option>
    <option value="30" selected>0.30%</option>
    <option value="100">1.00%</option>
  </select>
  
  <!-- NÃO TEM Bitcoin network fee aqui! -->
  
  <button>Create Pool</button>
</form>
```

### **STEP 2: Sistema busca network fee (backend)**

```javascript
// server/routes/lightningDefi.js

router.post('/create-pool', async (req, res) => {
  const { ...poolData, poolFeeRate } = req.body;
  
  // ✅ BUSCAR Bitcoin network fee do mempool.space
  let bitcoinNetworkFee;
  
  try {
    const mempoolResponse = await axios.get('https://mempool.space/api/v1/fees/recommended');
    bitcoinNetworkFee = mempoolResponse.data.halfHourFee; // Padrão: ~30 min
  } catch (error) {
    console.warn('Failed to fetch mempool fees, using default');
    bitcoinNetworkFee = 10; // Fallback
  }
  
  console.log('⛏️  Bitcoin Network Fee (from mempool.space):', bitcoinNetworkFee, 'sats/vB');
  console.log('💰 Pool Fee (LP fee):', poolFeeRate / 100, '%');
  
  // Calcular fee estimado
  const estimatedSize = (filteredUtxos.length * 57) + (3 * 43) + 10;
  const fee = Math.ceil(estimatedSize * bitcoinNetworkFee);
  
  // Criar PSBT...
  // Retornar para frontend...
});
```

### **STEP 3: KrayWallet assina e mostra fees**

```javascript
// kraywallet-extension/background/signer.js

async function signPsbt(psbt, options = {}) {
  // Parse PSBT
  const tx = bitcoin.Psbt.fromBase64(psbt);
  
  // Calcular fee da TX
  const inputs = tx.data.inputs.reduce((sum, input) => sum + input.witnessUtxo.value, 0);
  const outputs = tx.txOutputs.reduce((sum, output) => sum + output.value, 0);
  const fee = inputs - outputs;
  const size = estimateSize(tx);
  const feeRate = fee / size;
  
  // Buscar fees recomendados do mempool.space (para comparação)
  const recommended = await fetch('https://mempool.space/api/v1/fees/recommended');
  const mempoolFees = await recommended.json();
  
  // Mostrar popup para user
  showSignaturePopup({
    type: 'CREATE_POOL',
    poolName: options.poolName,
    poolFee: options.poolFeeRate, // 0.30%
    networkFee: {
      current: feeRate,
      recommended: mempoolFees.halfHourFee,
      fast: mempoolFees.fastestFee,
      economy: mempoolFees.economyFee
    },
    allowCustomFee: true
  });
}
```

---

## ✅ RESUMO FINAL: VOCÊ ESTÁ CORRETO!

### **O QUE ESTÁ ACONTECENDO AGORA (ERRADO):**

```javascript
❌ pool-create.html pega "Fee Rate %" (pool fee)
❌ Envia como "feeRate": 100 (confunde com network fee!)
❌ Backend usa 100 sats/vB (MUITO ALTO!)
❌ Fee = 310 × 100 = 31,000 sats (absurdo!)
```

### **O QUE DEVERIA ACONTECER (CORRETO):**

```javascript
✅ pool-create.html pega "Pool Fee %" (0.30%)
✅ Envia como "poolFeeRate": 30
✅ Backend busca network fee do mempool.space (10 sats/vB)
✅ Fee = 310 × 10 = 3,100 sats (razoável!)
✅ KrayWallet mostra ao assinar + permite customizar
```

---

## 🎯 AÇÃO IMEDIATA

Vou corrigir o código agora para:
1. ✅ Separar pool fee de network fee
2. ✅ Buscar network fee do mempool.space
3. ✅ KrayWallet permitir customização

**Me confirme se está correto e eu começo a corrigir!** 🚀

