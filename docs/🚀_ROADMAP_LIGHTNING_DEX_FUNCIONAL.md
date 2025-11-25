# 🚀 ROADMAP: LIGHTNING DEX FUNCIONAL

## 🎯 **SITUAÇÃO ATUAL:**

✅ **O QUE JÁ TEMOS:**
```
✅ Backend com LND connection service
✅ Frontend com Layer Switcher (Mainnet ↔ Lightning)
✅ UTXOs indexados (Inscriptions + Runes)
✅ ORD server rodando (localhost:80)
✅ Runes decoder funcionando (OP_RETURN)
✅ PSBT builder para Runes
✅ Taproot wallet (BIP39 + BIP86)
✅ UI completa para Deposit/Withdraw
```

❌ **O QUE FALTA:**
```
❌ LND não está instalado/rodando
❌ Channels não estão criados
❌ Funding transactions não implementadas
❌ Indexação de UTXOs nos channels
❌ Swaps off-chain não implementados
❌ Settlement on-chain não implementado
```

---

## 📋 **ROADMAP COMPLETO:**

### **FASE 1: INSTALAR E CONFIGURAR LND** ⏳

**Objetivo:** Ter LND rodando e conectado ao Bitcoin Core

**Passos:**
```bash
# 1. Download LND (macOS arm64)
cd /Users/tomkray/Desktop/PSBT-Ordinals
curl -L https://github.com/lightningnetwork/lnd/releases/download/v0.17.0-beta/lnd-darwin-arm64-v0.17.0-beta.tar.gz -o lnd.tar.gz
tar -xzf lnd.tar.gz
mv lnd-darwin-arm64-v0.17.0-beta lnd

# 2. Criar diretório de dados
mkdir -p lnd-data

# 3. Configurar lnd.conf (já temos!)
# Usar o arquivo existente

# 4. Iniciar LND
./lnd/lnd --configfile=./lnd.conf --lnddir=./lnd-data

# 5. Criar wallet (primeira vez)
./lnd/lncli --lnddir=./lnd-data --network=mainnet create

# 6. Desbloquear wallet (futuras vezes)
./lnd/lncli --lnddir=./lnd-data --network=mainnet unlock
```

**Verificação:**
```bash
# Ver status
./lnd/lncli --lnddir=./lnd-data getinfo

# Ver balance
./lnd/lncli --lnddir=./lnd-data walletbalance

# Ver channels
./lnd/lncli --lnddir=./lnd-data listchannels
```

**Tempo estimado:** 1-2 horas

---

### **FASE 2: INTEGRAR LND COM WALLET TAPROOT** ⏳

**Objetivo:** Usar mesma seed (12 palavras) para LND e MyWallet

**Implementação:**

**A) Modificar `lndConnection.js`:**
```javascript
/**
 * Inicializar LND com seed da MyWallet
 */
async initWithSeed(mnemonic) {
    // 1. Derivar seed de 24 palavras do mnemonic de 12
    const seed = await bip39.mnemonicToSeed(mnemonic);
    
    // 2. Inicializar wallet LND com esse seed
    return new Promise((resolve, reject) => {
        this.client.initWallet({
            wallet_password: Buffer.from('your-password'),
            cipher_seed_mnemonic: mnemonic.split(' '),
            aezeed_passphrase: Buffer.from('')
        }, (err, response) => {
            if (err) reject(err);
            else resolve(response);
        });
    });
}
```

**B) No MyWallet, ao criar/restaurar wallet:**
```javascript
// Quando criar wallet
async function createWallet() {
    const mnemonic = bip39.generateMnemonic(128); // 12 palavras
    
    // 1. Criar Taproot address
    const taprootAddress = deriveTaprootAddress(mnemonic);
    
    // 2. Inicializar LND com mesma seed
    await fetch('http://localhost:3000/api/lightning/init-wallet', {
        method: 'POST',
        body: JSON.stringify({ mnemonic })
    });
}
```

**Tempo estimado:** 2-3 horas

---

### **FASE 3: IMPLEMENTAR DEPOSIT (MAINNET → LIGHTNING)** ⏳

**Objetivo:** Enviar UTXOs (com Runes) para channels Lightning

**Fluxo:**

```
1. Usuário clica "💰 Deposit" → Seleciona Rune/Bitcoin
   ↓
2. Backend cria Funding Transaction:
   
   Inputs:
   - UTXO com Rune (ex: 546 sats + DOG)
   - UTXO com BTC puro (para fees + balance)
   
   Outputs:
   - 2-of-2 multisig (channel)
   - OP_RETURN (Runestone com Pointer → output 0)
   - Change (se houver)
   
3. MyWallet assina PSBT
   ↓
4. Broadcast on-chain
   ↓
5. Aguarda 3 confirmações
   ↓
6. Channel ativo com Rune dentro! ✅
```

**Código novo:**

**A) `server/services/lightningPoolManager.js`:**
```javascript
async createChannelWithRune(runeUtxo, btcUtxos, remotePeer) {
    // 1. Calcular total necessário
    const channelAmount = runeUtxo.value + btcAmount;
    
    // 2. Criar funding transaction
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
    
    // Input 1: UTXO com Rune
    psbt.addInput({
        hash: runeUtxo.txid,
        index: runeUtxo.vout,
        witnessUtxo: {
            script: Buffer.from(runeUtxo.scriptPubKey, 'hex'),
            value: runeUtxo.value
        }
    });
    
    // Input 2+: UTXOs BTC puro
    for (const btcUtxo of btcUtxos) {
        psbt.addInput({...});
    }
    
    // Output 0: 2-of-2 Multisig (Channel)
    const multisigScript = createChannelScript(localPubkey, remotePubkey);
    psbt.addOutput({
        script: multisigScript,
        value: channelAmount
    });
    
    // Output 1: OP_RETURN (Runestone)
    const runestone = buildRunestoneWithPointer(runeId, amount, 0); // Pointer to output 0
    psbt.addOutput({
        script: Buffer.concat([
            Buffer.from([0x6a, 0x5d]), // OP_RETURN OP_13
            runestone
        ]),
        value: 0
    });
    
    // Output 2: Change (se houver)
    
    return psbt.toBase64();
}
```

**B) `server/routes/lightning.js`:**
```javascript
router.post('/api/lightning/deposit', async (req, res) => {
    const { rune, amount, address } = req.body;
    
    // 1. Buscar UTXOs
    const utxos = await getUtxosForAddress(address);
    
    // 2. Filtrar UTXO com a Rune
    const runeUtxo = findRuneUtxo(utxos, rune.id);
    
    // 3. Selecionar UTXOs BTC puro
    const btcUtxos = selectPureBitcoinUtxos(utxos, amount);
    
    // 4. Criar PSBT
    const psbt = await lightningPoolManager.createChannelWithRune(
        runeUtxo,
        btcUtxos,
        remotePeer
    );
    
    res.json({ success: true, psbt });
});
```

**Tempo estimado:** 4-6 horas

---

### **FASE 4: INDEXAR RUNES NOS CHANNELS** ⏳

**Objetivo:** Saber quais Runes estão em quais channels

**Estrutura de dados:**

```javascript
// Banco de dados: lightning_channels
CREATE TABLE lightning_channels (
    channel_id TEXT PRIMARY KEY,
    funding_txid TEXT NOT NULL,
    funding_vout INTEGER NOT NULL,
    local_pubkey TEXT NOT NULL,
    remote_pubkey TEXT NOT NULL,
    capacity_sats INTEGER NOT NULL,
    local_balance_sats INTEGER NOT NULL,
    remote_balance_sats INTEGER NOT NULL,
    
    -- Runes no channel
    runes JSON,  -- [{id, amount, owner}]
    
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// Exemplo de `runes` JSON:
[
    {
        "id": "840000:3",
        "name": "DOG•GO•TO•THE•MOON",
        "amount": "500000",
        "owner": "local"  // ou "remote"
    }
]
```

**Indexação:**

```javascript
// Quando funding transaction confirma:
async function indexChannelRunes(channelId, fundingTxid) {
    // 1. Buscar transaction
    const tx = await bitcoinRpc.getRawTransaction(fundingTxid, true);
    
    // 2. Encontrar OP_RETURN
    const opReturn = tx.vout.find(v => v.scriptPubKey.hex.startsWith('6a5d'));
    
    if (opReturn) {
        // 3. Decodificar Runestone
        const runestone = runesDecoder.decode(opReturn.scriptPubKey.hex);
        
        // 4. Salvar no banco
        await db.run(`
            UPDATE lightning_channels 
            SET runes = ? 
            WHERE channel_id = ?
        `, [JSON.stringify(runestone.runes), channelId]);
    }
}
```

**Tempo estimado:** 3-4 horas

---

### **FASE 5: IMPLEMENTAR SWAPS OFF-CHAIN** ⏳

**Objetivo:** Trocar Runes instantaneamente dentro do channel

**Lógica:**

```javascript
// AMM Formula: x * y = k
// Mas off-chain (sem broadcast)

async function swapRuneInChannel(channelId, runeId, amountIn) {
    // 1. Buscar pool state
    const pool = await getChannelPool(channelId);
    
    // 2. Calcular swap (x*y=k)
    const amountOut = calculateSwapOutput(
        amountIn,
        pool.reserveIn,
        pool.reserveOut
    );
    
    // 3. Criar HTLC (Hashed Time-Locked Contract)
    const htlc = {
        hash: sha256(preimage),
        amount: amountOut,
        timeout: currentHeight + 144, // 1 dia
        runeId: runeId
    };
    
    // 4. Atualizar channel state OFF-CHAIN
    // Não precisa broadcast!
    await updateChannelState(channelId, {
        local_balance: pool.local_balance - amountIn,
        remote_balance: pool.remote_balance + amountOut,
        runes: updateRuneBalances(pool.runes, runeId, -amountIn)
    });
    
    // 5. Fee: 1 sat (off-chain)
    
    return { success: true, amountOut, fee: 1 };
}
```

**Características:**
```
✅ Instantâneo (<1 segundo)
✅ Fee: 1 sat
✅ Sem confirmações
✅ Atualiza state local
✅ HTLC garante atomicidade
```

**Tempo estimado:** 5-7 horas

---

### **FASE 6: IMPLEMENTAR WITHDRAW (LIGHTNING → MAINNET)** ⏳

**Objetivo:** Fechar channel e devolver Runes + BTC para Mainnet

**Fluxo:**

```
1. Usuário clica "📤 Withdraw" no Lightning
   ↓
2. Backend cria Closing Transaction:
   
   Input:
   - 2-of-2 multisig (channel)
   
   Outputs:
   - Para usuário: BTC + Runes
   - Para remote peer: BTC dele
   - OP_RETURN: Runestone devolvendo Runes
   
3. Ambos assinam (cooperativo close)
   ↓
4. Broadcast on-chain
   ↓
5. Confirmações (~10 min)
   ↓
6. Runes + BTC de volta no Mainnet! ✅
```

**Código:**

```javascript
async function closeChannelWithRunes(channelId) {
    // 1. Buscar channel state
    const channel = await getChannel(channelId);
    
    // 2. Criar closing transaction
    const psbt = new bitcoin.Psbt();
    
    // Input: Funding output (2-of-2)
    psbt.addInput({
        hash: channel.funding_txid,
        index: channel.funding_vout,
        witnessUtxo: {
            script: channel.multisig_script,
            value: channel.capacity_sats
        }
    });
    
    // Output 1: Para usuário (BTC + onde vão as Runes)
    psbt.addOutput({
        address: userAddress,
        value: channel.local_balance_sats
    });
    
    // Output 2: Para remote peer
    psbt.addOutput({
        address: remotePeerAddress,
        value: channel.remote_balance_sats
    });
    
    // Output 3: OP_RETURN (devolver Runes)
    const runestone = buildRunestoneForClose(channel.runes);
    psbt.addOutput({
        script: Buffer.concat([
            Buffer.from([0x6a, 0x5d]),
            runestone
        ]),
        value: 0
    });
    
    // 4. Assinar (user + remote peer)
    // 5. Broadcast
    
    return psbt.toHex();
}
```

**Tempo estimado:** 4-5 horas

---

## 📊 **TEMPO TOTAL ESTIMADO:**

```
Fase 1: Instalar LND               → 1-2 horas
Fase 2: Integrar com MyWallet      → 2-3 horas
Fase 3: Deposit (Mainnet → LN)     → 4-6 horas
Fase 4: Indexar Runes              → 3-4 horas
Fase 5: Swaps off-chain            → 5-7 horas
Fase 6: Withdraw (LN → Mainnet)    → 4-5 horas
────────────────────────────────────────────
TOTAL:                              19-27 horas
```

**Em dias de trabalho:** 3-5 dias

---

## 🎯 **PRIORIDADES:**

### **Essencial (fazer primeiro):**
```
1. Fase 1: LND rodando ✅
2. Fase 2: Integração com wallet ✅
3. Fase 3: Deposit básico (sem Runes ainda)
4. Fase 6: Withdraw básico (sem Runes ainda)
```

### **Avançado (depois):**
```
5. Fase 4: Indexação de Runes
6. Fase 5: Swaps off-chain
7. Otimizações e UI
```

---

## 💡 **CONCEITOS CHAVE:**

### **1. Funding Transaction:**
```
É a transação que CRIA o channel
- Lock de sats no 2-of-2 multisig
- OP_RETURN com Runestone (Pointer)
- Runes vão para o multisig
```

### **2. Channel State:**
```
Quem tem quanto (off-chain)
- Local balance: seus sats
- Remote balance: sats do peer
- Runes: quais e quantas cada um tem
```

### **3. Closing Transaction:**
```
É a transação que FECHA o channel
- Desbloqueia o 2-of-2
- Devolve sats + Runes para cada um
- OP_RETURN com Runestone final
```

### **4. HTLC:**
```
Hash Time-Locked Contract
- Garante atomicidade dos swaps
- Off-chain (não precisa broadcast)
- Se der problema, reverte
```

---

## 🔥 **O QUE TORNA ISSO REVOLUCIONÁRIO:**

```
✅ Runes são UTXOs reais
✅ OP_RETURN indexado no ORD
✅ Lightning já suporta custom scripts
✅ 2-of-2 multisig pode ter Runes dentro
✅ Runestone com Pointer direciona para multisig
✅ Swaps off-chain com fee de 1 sat
✅ Settlement on-chain documentado
✅ Mesmo endereço Taproot (Mainnet + LN)
```

**= PRIMEIRO DEX DE RUNES NA LIGHTNING DO MUNDO!** 🚀

---

## 📋 **PRÓXIMO PASSO IMEDIATO:**

```bash
# AGORA: Instalar LND
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Download
curl -L https://github.com/lightningnetwork/lnd/releases/download/v0.17.0-beta/lnd-darwin-arm64-v0.17.0-beta.tar.gz -o lnd.tar.gz

# Extrair
tar -xzf lnd.tar.gz
mv lnd-darwin-arm64-v0.17.0-beta lnd

# Criar diretório
mkdir -p lnd-data

# Iniciar
./lnd/lnd --configfile=./lnd.conf --lnddir=./lnd-data
```

---

## ✅ **CHECKLIST COMPLETO:**

```
INFRA:
⏳ LND instalado
⏳ LND conectado ao Bitcoin Core
⏳ Wallet LND criada
⏳ Mesma seed que MyWallet

DEPOSIT:
⏳ Funding transaction com Runestone
⏳ 2-of-2 multisig
⏳ Channel criado
⏳ Runes indexadas no channel

SWAPS:
⏳ AMM formula (x*y=k)
⏳ HTLC implementation
⏳ Off-chain state updates
⏳ Fee: 1 sat

WITHDRAW:
⏳ Cooperative close
⏳ Closing transaction
⏳ Runestone de retorno
⏳ Runes + BTC de volta no Mainnet

UI:
✅ Layer Switcher
✅ Deposit screen
✅ Withdraw screen
⏳ Swap screen (Lightning)
⏳ Pool explorer (Lightning)
```

---

**VAMOS COMEÇAR PELA FASE 1: INSTALAR LND!** 🚀

Quer que eu execute os comandos ou prefere fazer manualmente?




