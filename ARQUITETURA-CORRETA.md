# 🏗️ ARQUITETURA CORRETA - Lightning DeFi Pools

## ❌ PROBLEMA DO SISTEMA ATUAL

### O que está acontecendo ERRADO:

```
1. User quer criar pool
2. Backend cria NOVO endereço Taproot usando chave do LND
3. User envia BTC + Runes para esse endereço NOVO
4. ❌ User PERDE controle! Chave privada está no LND!
```

**RESULTADO:** Fundos "presos" em endereço que user não controla!

---

## ✅ ARQUITETURA CORRETA

### Como deve funcionar:

```
1. User quer criar pool
2. User JÁ TEM endereço Taproot (na KrayWallet)
3. User envia BTC + Runes para um UTXO especial (marcado como "pool")
4. Backend cria canal Lightning usando esse UTXO
5. ✅ User SEMPRE pode recuperar! Chave está na wallet dele!
```

---

## 🔐 FLUXO CORRETO: Create Pool

### STEP 1: Preparação (Frontend)

```javascript
// User seleciona:
- Rune: DOG•GO•TO•THE•MOON
- Amount: 700 tokens
- BTC: 10,000 sats

// Frontend chama:
POST /api/lightning-defi/create-pool
{
    "userAddress": "bc1pvz02...",  // Endereço Taproot DO USUÁRIO
    "runeId": "840000:3",
    "runeAmount": "70000000000",
    "btcAmount": 10000
}
```

### STEP 2: Backend cria PSBT

```javascript
// Backend cria PSBT que:
// 1. Consome UTXOs do user (BTC + Runes)
// 2. Cria Output 0: BTC + Runes para o MESMO endereço do user
// 3. Cria Output 1: OP_RETURN com Runestone VÁLIDO
// 4. Change: volta para user

// ⚠️ IMPORTANTE: NÃO cria endereço novo!
// ⚠️ Runes vão para o MESMO endereço Taproot do user!
```

### STEP 3: User assina PSBT

```javascript
// User assina com SUA wallet
// ✅ User controla a chave privada
// ✅ User pode sempre recuperar os fundos
```

### STEP 4: Backend faz broadcast

```javascript
// TX confirmada na blockchain
// UTXO agora está "marcado" como pool
// Backend registra no State Tracker
```

### STEP 5: Abrir Canal Lightning (OPCIONAL)

```javascript
// Se quiser integração Lightning real:
// Backend pode abrir canal usando esse UTXO
// Mas isso é OPCIONAL!
```

---

## 🎯 DESIGN CORRETO: State Tracker

### Tabela: pools

```sql
CREATE TABLE pools (
    id TEXT PRIMARY KEY,
    user_address TEXT NOT NULL,  -- Endereço Taproot do user
    utxo_txid TEXT NOT NULL,      -- TXID do funding
    utxo_vout INTEGER NOT NULL,   -- Vout
    rune_id TEXT NOT NULL,
    rune_amount TEXT NOT NULL,
    btc_amount INTEGER NOT NULL,
    status TEXT,  -- 'pending', 'active', 'closed'
    created_at INTEGER,
    UNIQUE(utxo_txid, utxo_vout)
);
```

### Tabela: swaps

```sql
CREATE TABLE swaps (
    id TEXT PRIMARY KEY,
    pool_id TEXT NOT NULL,
    user_address TEXT NOT NULL,
    swap_type TEXT,  -- 'rune_to_btc' ou 'btc_to_rune'
    amount_in TEXT NOT NULL,
    amount_out TEXT NOT NULL,
    timestamp INTEGER,
    FOREIGN KEY (pool_id) REFERENCES pools(id)
);
```

---

## 💡 VANTAGENS DESSA ARQUITETURA:

### 1. **Segurança Total** ✅
- User SEMPRE controla as chaves
- Não há "endereços pool" órfãos
- Recuperação é trivial (está na wallet!)

### 2. **Lightning Compatível** ⚡
- Taproot é perfeito para Lightning
- Pode abrir canal Lightning real depois
- Off-chain swaps funcionam

### 3. **Simples** 🎯
- Menos código
- Menos bugs
- Mais fácil de auditar

### 4. **Auditável** 🔍
- Toda pool tem UTXO on-chain
- State Tracker é "source of truth"
- Pode provar solvência a qualquer momento

---

## 🔧 IMPLEMENTAÇÃO: Pseudocódigo

```javascript
// ═══════════════════════════════════════════════════════════════
// CREATE POOL (versão correta)
// ═══════════════════════════════════════════════════════════════

async function createPool({
    userAddress,  // bc1pvz02... (Taproot do user)
    runeId,
    runeAmount,
    btcAmount
}) {
    // 1. Buscar UTXOs do user
    const utxos = await fetchUserUtxos(userAddress);
    
    // 2. Selecionar inputs (BTC + Rune)
    const selectedInputs = selectInputs(utxos, {
        needsBtc: btcAmount + fees,
        needsRune: { id: runeId, amount: runeAmount }
    });
    
    // 3. Criar PSBT
    const psbt = new bitcoin.Psbt();
    
    // Adicionar inputs
    for (const input of selectedInputs) {
        psbt.addInput({
            hash: input.txid,
            index: input.vout,
            witnessUtxo: {
                script: input.scriptPubKey,
                value: input.value
            },
            tapInternalKey: extractTapKey(userAddress)
        });
    }
    
    // Output 0: Funding (volta pro MESMO endereço!)
    psbt.addOutput({
        address: userAddress,  // ← CHAVE DO SUCESSO!
        value: btcAmount
    });
    
    // Output 1: Runestone (transfere runes pro output 0)
    const runestone = buildRunestone({
        runeId,
        amount: runeAmount,
        outputIndex: 0  // Output 0 = userAddress
    });
    
    psbt.addOutput({
        script: runestone,
        value: 0
    });
    
    // Output 2: Change (se necessário)
    if (change > 546) {
        psbt.addOutput({
            address: userAddress,
            value: change
        });
    }
    
    // 4. Retornar PSBT para user assinar
    return {
        psbt: psbt.toBase64(),
        poolId: generatePoolId()
    };
}

// ═══════════════════════════════════════════════════════════════
// FINALIZE POOL (versão correta)
// ═══════════════════════════════════════════════════════════════

async function finalizePool({ psbt, poolId }) {
    // 1. Parse PSBT assinado
    const signedPsbt = bitcoin.Psbt.fromBase64(psbt);
    
    // 2. Finalizar e extrair TX
    signedPsbt.finalizeAllInputs();
    const tx = signedPsbt.extractTransaction();
    const txid = tx.getId();
    
    // 3. **VALIDAR OP_RETURN ANTES DE BROADCAST!**
    const opReturn = tx.outs[1].script;
    const isValidRunestone = validateRunestone(opReturn);
    
    if (!isValidRunestone) {
        throw new Error('INVALID RUNESTONE! Aborting broadcast.');
    }
    
    // 4. Broadcast
    await bitcoinRpc.call('sendrawtransaction', [tx.toHex()]);
    
    // 5. Registrar no State Tracker
    await stateTracker.createPool({
        poolId,
        userAddress: extractAddress(tx.outs[0]),
        utxoTxid: txid,
        utxoVout: 0,
        runeId,
        runeAmount,
        btcAmount: tx.outs[0].value,
        status: 'pending'
    });
    
    return { txid, poolId };
}
```

---

## 🎯 CHECKLIST DE SEGURANÇA

Antes de broadcast, SEMPRE validar:

- [ ] OP_RETURN contém Runestone válido
- [ ] Runes estão indo para output correto
- [ ] User está assinando com SUA chave
- [ ] Não estamos criando endereços novos
- [ ] Fees são razoáveis
- [ ] Change volta para user
- [ ] Pool é registrada no State Tracker

---

## 📊 COMPARAÇÃO: Antes vs Depois

| Item | ❌ Sistema Antigo | ✅ Sistema Novo |
|------|------------------|-----------------|
| **Endereço** | Pool cria novo | User usa o seu |
| **Chave privada** | No LND | Na KrayWallet |
| **Recuperação** | Impossível | Trivial |
| **Runestone** | Vazio (bug) | Válido |
| **Validação** | Nenhuma | Completa |
| **Segurança** | ❌ Baixa | ✅ Alta |

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Reescrever `/create-pool` (usar endereço do user)
2. ✅ Reescrever `/finalize-pool` (validar Runestone)
3. ✅ Adicionar validações de segurança
4. ✅ Criar testes automatizados
5. ✅ Implementar recuperação de pools antigas
6. ✅ Documentar fluxo completo

---

**Esta é a arquitetura CORRETA e SEGURA! 🛡️**

