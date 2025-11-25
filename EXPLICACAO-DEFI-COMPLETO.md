# 🏊 COMO FUNCIONA O DEFI DE RUNES - EXPLICAÇÃO COMPLETA

## 📚 CONCEITO: O QUE É UMA LIQUIDITY POOL?

Uma **Liquidity Pool** é como um "cofre compartilhado" on-chain que guarda:
- **Runes** (ex: 10,000 DOG)
- **Bitcoin** (ex: 0.1 BTC)

Qualquer pessoa pode **trocar** (swap) usando esse cofre.

### EXEMPLO:
```
POOL DOG/BTC:
┌─────────────────────────┐
│  10,000 DOG             │  ← Reserve A
│  +                      │
│  0.1 BTC (10,000,000 sats) │  ← Reserve B
└─────────────────────────┘

Preço: 1 DOG = 0.00001 BTC
```

## 🔄 FLUXO COMPLETO: CRIAR POOL

### PASSO 1: USER CRIA POOL (Frontend)
```
User preenche:
- Pool Name: "Official DOG Pool"
- Token A: DOG (10,000)
- Token B: BTC (0.1)
- Fee: 0.3%

Clica "Create Pool"
```

### PASSO 2: BACKEND CRIA PSBT (Partially Signed Bitcoin Transaction)

**O que é PSBT?**
- É uma transação Bitcoin **NÃO finalizada**
- Precisa de **assinaturas** de várias partes
- Permite **multisig** (várias pessoas assinarem)

**Backend cria:**
```javascript
PSBT {
  INPUTS: [
    {
      // UTXO do user com 10,000 DOG
      txid: "abc123...",
      vout: 0,
      value: 546 sats,
      runes: [{ id: "840000:3", amount: 10000 }]
    },
    {
      // UTXO do user com BTC
      txid: "def456...",
      vout: 1,
      value: 10,000,000 sats (0.1 BTC)
    }
  ],
  
  OUTPUTS: [
    {
      // POOL ADDRESS (Taproot 2-of-2 Multisig)
      address: "bc1p...pool...",
      value: 10,000,546 sats,  // BTC + dust
      runes: [{ id: "840000:3", amount: 10000 }]  // DOG
    },
    {
      // OP_RETURN (Runestone - metadados das Runes)
      script: OP_RETURN <runestone_bytes>
    },
    {
      // CHANGE (troco do user)
      address: "bc1p...user...",
      value: 5000 sats
    }
  ]
}
```

**Pool Address = Taproot 2-of-2 Multisig:**
- **1 chave:** User (provedor de liquidez)
- **1 chave:** Pool Protocol (nosso backend)

Ambos precisam assinar para **gastar** depois!

### PASSO 3: USER ASSINA PSBT

Backend retorna PSBT (base64) para frontend:
```javascript
// Frontend
const psbtBase64 = response.psbt;

// KrayWallet assina
const signedPsbt = await window.krayWallet.signPsbt(psbtBase64);

// Envia de volta para backend
fetch('/api/defi/pools/finalize', {
  method: 'POST',
  body: JSON.stringify({ psbt: signedPsbt })
});
```

**Assinatura do user:**
- Autoriza gastar seus UTXOs (DOG + BTC)
- Envia para o pool address

### PASSO 4: POOL SIGNER CO-ASSINA

Backend recebe PSBT assinado pelo user:
```javascript
// server/routes/defiSwap.js
const userSignedPsbt = Psbt.fromBase64(req.body.psbt);

// Pool Protocol assina (nossa chave privada)
const fullySignedPsbt = await poolSigner.coSign(userSignedPsbt);

// Finaliza e extrai tx hex
fullySignedPsbt.finalizeAllInputs();
const txHex = fullySignedPsbt.extractTransaction().toHex();
```

**Co-assinatura do pool:**
- Confirma que os outputs estão corretos
- Pool address vai receber os fundos
- Runestone está correto (DOG vai para pool)

### PASSO 5: BROADCAST (ENVIAR PARA BLOCKCHAIN)

```javascript
// Envia para Bitcoin Core RPC
const txid = await bitcoinRpc.call('sendrawtransaction', [txHex]);

console.log('✅ Pool created! TXID:', txid);

// Salva no banco de dados
db.run(`
  INSERT INTO defi_pools (
    pool_id, pool_utxo_txid, pool_utxo_vout,
    reserve_btc, reserve_rune, status
  ) VALUES (?, ?, ?, ?, ?, 'ACTIVE')
`, [poolId, txid, 0, 10000000, 10000]);
```

### PASSO 6: POOL ESTÁ ATIVO! 🎉

Agora no blockchain existe:
```
UTXO (bc1p...pool...):
- Value: 10,000,546 sats
- Runes: 10,000 DOG
- Status: UNSPENT
- Owned by: 2-of-2 Multisig (user + protocol)
```

**Este UTXO É A POOL!**

## 🔄 COMO FUNCIONA O SWAP?

### USER QUER TROCAR 0.01 BTC POR DOG

### PASSO 1: QUOTE (Cotação)
```javascript
// Frontend pede cotação
POST /api/defi/quote
{
  poolId: "840000:3:BTC",
  fromToken: "BTC",
  amount: 0.01
}

// Backend calcula (AMM - Automated Market Maker)
Response:
{
  amountIn: 1,000,000 sats,
  amountOut: 900 DOG,  // ~10% do pool
  priceImpact: 9.5%,   // preço mudou 9.5%
  fee: 9 DOG (0.9%)
}
```

**AMM Formula (x * y = k):**
```
Antes:
reserve_btc = 10,000,000 sats
reserve_dog = 10,000 DOG
k = 10,000,000 * 10,000 = 100,000,000,000

User adiciona: 1,000,000 sats
Novo reserve_btc = 11,000,000

11,000,000 * reserve_dog = 100,000,000,000
reserve_dog = 9,090.9 DOG

User recebe: 10,000 - 9,090.9 = 909.1 DOG (- fee)
```

### PASSO 2: CRIAR PSBT DO SWAP

```javascript
PSBT {
  INPUTS: [
    {
      // UTXO do user com BTC
      txid: "user_tx...",
      vout: 0,
      value: 1,000,000 sats
    },
    {
      // UTXO DO POOL (contém DOG + BTC)
      txid: "pool_tx...",
      vout: 0,
      value: 10,000,546 sats,
      runes: [{ id: "840000:3", amount: 10000 }]
      // ⚠️ PRECISA 2 ASSINATURAS! (user + protocol)
    }
  ],
  
  OUTPUTS: [
    {
      // USER RECEBE DOG
      address: "bc1p...user...",
      value: 546 sats,  // dust
      runes: [{ id: "840000:3", amount: 900 }]  // 900 DOG
    },
    {
      // POOL ATUALIZADO (novo UTXO)
      address: "bc1p...pool_novo...",
      value: 11,000,000 sats,  // mais BTC
      runes: [{ id: "840000:3", amount: 9100 }]  // menos DOG
    },
    {
      // PROTOCOL FEE (taxa para nós)
      address: "bc1p...treasure...",
      value: 2000 sats,
      runes: [{ id: "840000:3", amount: 9 }]  // fee
    },
    {
      // OP_RETURN (Runestone)
      script: OP_RETURN <runestone_swap>
    }
  ]
}
```

### PASSO 3: USER ASSINA

```javascript
const signedSwapPsbt = await window.krayWallet.signPsbt(swapPsbtBase64);
```

User assina:
- ✅ Seu input (1,000,000 sats)
- ⚠️ NÃO pode assinar o input do pool (não tem a chave)

### PASSO 4: POLICY ENGINE VALIDA

```javascript
// server/defi/policyEngine.js
const isValid = validateSwapPsbtBeforeSigning(psbt, pool);

Verifica:
✅ Output do user tem 900 DOG? SIM
✅ Output do pool tem 11M sats + 9100 DOG? SIM
✅ Fee está correto (9 DOG)? SIM
✅ Runestone está correto? SIM
✅ Price impact < 50%? SIM (9.5% < 50%)
✅ Slippage < 5%? SIM

if (!isValid) {
  throw new Error('PSBT violates pool rules!');
}
```

**SE ALGO ESTIVER ERRADO, NÃO ASSINA!**

### PASSO 5: POOL SIGNER CO-ASSINA

```javascript
// server/defi/poolSignerLND.js
const poolSigned = await signPoolInputSafe(psbt, poolUtxo);

// Agora temos 2 assinaturas:
// ✅ User (seu BTC)
// ✅ Protocol (pool UTXO)

// Finaliza
poolSigned.finalizeAllInputs();
const txHex = poolSigned.extractTransaction().toHex();
```

### PASSO 6: BROADCAST

```javascript
const swapTxid = await bitcoinRpc.call('sendrawtransaction', [txHex]);

// Atualiza pool no DB
db.run(`
  UPDATE defi_pools SET
    pool_utxo_txid = ?,
    pool_utxo_vout = ?,
    reserve_btc = 11000000,
    reserve_rune = 9100,
    total_volume_btc = total_volume_btc + 1000000
  WHERE pool_id = ?
`, [swapTxid, 1, poolId]);

// Salva swap no histórico
db.run(`
  INSERT INTO defi_swaps (
    swap_id, pool_id, user_address,
    amount_in_btc, amount_out_rune, txid, status
  ) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')
`, [swapId, poolId, userAddress, 1000000, 900, swapTxid]);
```

### PASSO 7: SWAP COMPLETO! 🎉

No blockchain:
```
ANTES:
- User tinha: 1,000,000 sats, 0 DOG
- Pool tinha: 10,000,000 sats, 10,000 DOG

DEPOIS:
- User tem: 0 sats, 900 DOG ✅
- Pool tem: 11,000,000 sats, 9,100 DOG ✅
- Treasure tem: 2000 sats, 9 DOG (fee) ✅
```

## 🔐 SEGURANÇA: POR QUE É SEGURO?

### 1. MULTISIG 2-OF-2
Pool UTXO precisa de **2 assinaturas**:
- User (provedor de liquidez)
- Protocol (nosso backend)

**Ninguém pode roubar sozinho!**

### 2. POLICY ENGINE
Backend **SÓ assina** se:
- Outputs corretos (AMM formula)
- Fee correto
- Runestone correto
- Price impact OK
- Slippage OK

**Se user tentar trapacear (mudar outputs), backend NÃO assina!**

### 3. USER SEMPRE VÊ O QUE ASSINA
KrayWallet mostra:
```
Você está assinando:
- Enviar: 0.01 BTC
- Receber: 900 DOG
- Fee: 9 DOG (0.9%)

[Assinar] [Rejeitar]
```

**User tem controle total!**

## 📊 RESUMO: ONDE VAI O QUE?

### CRIAR POOL:
```
User → PSBT → User assina → Protocol co-assina → Blockchain

UTXO criado em: bc1p...pool... (Taproot 2-of-2)
Contém: BTC + Runes
Owned by: User + Protocol (multisig)
```

### FAZER SWAP:
```
User → PSBT (gasta pool UTXO) → User assina → Policy valida → Protocol co-assina → Blockchain

UTXO antigo (pool): GASTO ✅
UTXO novo (pool): CRIADO com novas reserves ✅
UTXO user: RECEBE Runes ✅
```

## 🚀 PRÓXIMO PASSO:

Vou implementar TUDO isso agora:
1. ✅ buildCreatePoolPSBT()
2. ✅ POST /api/defi/pools/prepare
3. ✅ POST /api/defi/pools/finalize
4. ✅ buildSwapPSBT()
5. ✅ Policy Engine completo
6. ✅ Pool Signer co-signing
7. ✅ Frontend (signPsbt + callbacks)

**ESTÁ PRONTO PARA COMEÇAR?** 🎯
