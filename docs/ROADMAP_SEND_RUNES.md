# 🚀 ROADMAP: IMPLEMENTAR SEND DE RUNES

**Objetivo:** Criar funcionalidade de envio de runes na MyWallet com padrão oficial do Ordinals  
**Status:** 🟡 EM PLANEJAMENTO  
**Prioridade:** 🔥 ALTA (antes de Swap/Pools)

---

## 🎯 POR QUE PRECISAMOS DO DECODER OFFICIAL?

Para **ENVIAR** runes de forma segura:

```
❌ MÉTODO INSEGURO (HTML parsing):
- Não sabe quais UTXOs contêm a rune
- Não valida quantidade correta
- Pode perder runes ao criar PSBT
- Sem garantia de integridade

✅ MÉTODO SEGURO (Decoder official):
- ✅ Identifica UTXOs corretos
- ✅ Decodifica edicts para saber quantidade exata
- ✅ Constrói Runestone correto no PSBT
- ✅ Valida que não há perda de runes
- ✅ 100% à prova de fraude
```

---

## 📋 FASES DE IMPLEMENTAÇÃO

### FASE 1: BACKEND - DECODER OFFICIAL ✅
**Status:** PRONTO (já criado)

Arquivos:
- ✅ `server/utils/runesDecoderOfficial.js` - Decoder completo
- ⚠️ Precisa integrar no sistema

**O que faz:**
1. Busca UTXOs via Bitcoin Core RPC
2. Decodifica OP_RETURN (Runestone)
3. Valida edicts
4. Retorna runes com UTXOs corretos

---

### FASE 2: BACKEND - MÉTODOS RPC 🔨
**Status:** EM DESENVOLVIMENTO

**Arquivo:** `server/utils/bitcoinRpc.js`

**Métodos necessários:**
```javascript
// Já temos:
✅ listUnspent(minconf, maxconf, addresses)
✅ getRawTransaction(txid, verbose)

// Precisamos adicionar:
⚠️ getBlock(blockhash) - Para obter altura do bloco
⚠️ createRawTransaction(inputs, outputs) - Para PSBT
⚠️ signRawTransactionWithWallet(hex) - Para assinar
⚠️ sendRawTransaction(hex) - Para broadcast
```

---

### FASE 3: BACKEND - BUILD PSBT COM RUNESTONE 🔨
**Status:** EM DESENVOLVIMENTO

**Arquivo:** `server/utils/psbtBuilderRunes.js` (NOVO)

**Função principal:**
```javascript
async function buildRuneSendPSBT({
    fromAddress,
    toAddress,
    runeName,
    amount,
    feeRate
}) {
    // 1. Buscar UTXOs que contêm a rune
    const runes = await runesDecoderOfficial.getRunesForAddress(fromAddress);
    const targetRune = runes.find(r => r.name === runeName);
    
    if (!targetRune || !targetRune.utxos || targetRune.utxos.length === 0) {
        throw new Error('Rune not found or no UTXOs available');
    }
    
    // 2. Selecionar UTXOs suficientes
    const selectedUtxos = selectRuneUtxos(targetRune.utxos, amount);
    
    // 3. Construir Runestone (OP_RETURN)
    const runestone = buildRunestone({
        runeId: targetRune.runeId,
        amount: amount,
        outputIndex: 1 // Índice do output de destino
    });
    
    // 4. Construir PSBT
    const psbt = {
        inputs: selectedUtxos.map(utxo => ({
            txid: utxo.txid,
            vout: utxo.vout
        })),
        outputs: [
            // Output 0: OP_RETURN (Runestone)
            {
                scriptPubKey: runestone,
                value: 0
            },
            // Output 1: Rune para destino
            {
                address: toAddress,
                value: 546 // Dust limit
            },
            // Output 2: Change (se houver runes sobrando)
            // Output 3: BTC change
        ]
    };
    
    return psbt;
}
```

**Estrutura do Runestone:**
```javascript
function buildRunestone({ runeId, amount, outputIndex }) {
    // Formato: OP_RETURN + OP_13 + edicts (LEB128)
    
    // 1. Parse rune ID (blockHeight:txIndex)
    const [blockHeight, txIndex] = runeId.split(':').map(Number);
    
    // 2. Criar edict
    const edict = {
        blockHeight: blockHeight,
        txIndex: txIndex,
        amount: amount,
        output: outputIndex
    };
    
    // 3. Encode em LEB128
    const encoded = encodeLEB128([
        edict.blockHeight,
        edict.txIndex,
        edict.amount,
        edict.output
    ]);
    
    // 4. Construir scriptPubKey
    return '6a5d' + encoded; // OP_RETURN + OP_13 + data
}
```

---

### FASE 4: BACKEND - API ENDPOINT 🔨
**Status:** EM DESENVOLVIMENTO

**Arquivo:** `server/routes/runes.js`

**Novo endpoint:**
```javascript
/**
 * POST /api/runes/build-send-psbt
 * Constrói PSBT para enviar runes
 */
router.post('/build-send-psbt', async (req, res) => {
    try {
        const { fromAddress, toAddress, runeName, amount, feeRate } = req.body;
        
        // Validações
        if (!fromAddress || !toAddress || !runeName || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Construir PSBT
        const psbt = await buildRuneSendPSBT({
            fromAddress,
            toAddress,
            runeName,
            amount: parseInt(amount),
            feeRate: feeRate || 10
        });
        
        res.json({
            success: true,
            psbt: psbt,
            fee: calculateFee(psbt, feeRate)
        });
        
    } catch (error) {
        console.error('Error building rune send PSBT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

### FASE 5: FRONTEND - UI DE ENVIO 🎨
**Status:** EM DESENVOLVIMENTO

**Arquivo:** `mywallet-extension/popup/popup.js`

**Modal de detalhes da rune:**
```html
<!-- Já temos o modal, adicionar botões -->
<div class="rune-details-actions">
    <button id="send-rune-btn" class="btn-primary">
        Send ⧈
    </button>
    <button id="receive-rune-btn" class="btn-secondary">
        Receive
    </button>
</div>
```

**Formulário de envio:**
```html
<div id="send-rune-form" class="send-form" style="display: none;">
    <h3>Send ${runeName}</h3>
    
    <label>Recipient Address</label>
    <input type="text" id="send-rune-address" placeholder="bc1p...">
    
    <label>Amount</label>
    <input type="number" id="send-rune-amount" placeholder="0" max="${maxAmount}">
    <small>Available: ${maxAmount}</small>
    
    <label>Fee Rate (sat/vB)</label>
    <select id="send-rune-fee">
        <option value="1">Low (1 sat/vB)</option>
        <option value="5">Medium (5 sat/vB)</option>
        <option value="10" selected>High (10 sat/vB)</option>
    </select>
    
    <div class="fee-estimate">
        Estimated fee: <span id="fee-amount">~0.00001 BTC</span>
    </div>
    
    <button id="confirm-send-rune" class="btn-primary">
        Send Rune
    </button>
</div>
```

---

### FASE 6: FRONTEND - LÓGICA DE ENVIO 🔨
**Status:** EM DESENVOLVIMENTO

**Arquivo:** `mywallet-extension/popup/popup.js`

```javascript
async function sendRune(runeName, toAddress, amount) {
    try {
        console.log('📤 Sending rune:', runeName, 'to', toAddress, 'amount', amount);
        
        // 1. Get current address
        const walletInfo = await chrome.runtime.sendMessage({
            action: 'getWalletInfo'
        });
        
        if (!walletInfo.success) {
            throw new Error('Wallet not unlocked');
        }
        
        // 2. Build PSBT via backend
        const response = await fetch('http://localhost:3000/api/runes/build-send-psbt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromAddress: walletInfo.data.address,
                toAddress: toAddress,
                runeName: runeName,
                amount: amount,
                feeRate: 10
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        console.log('✅ PSBT built:', data.psbt);
        
        // 3. Sign PSBT via background script
        const signResult = await chrome.runtime.sendMessage({
            action: 'signPSBT',
            psbt: data.psbt
        });
        
        if (!signResult.success) {
            throw new Error('Failed to sign transaction');
        }
        
        console.log('✅ PSBT signed');
        
        // 4. Broadcast transaction
        const broadcastResult = await chrome.runtime.sendMessage({
            action: 'broadcastTransaction',
            hex: signResult.signedHex
        });
        
        if (!broadcastResult.success) {
            throw new Error('Failed to broadcast transaction');
        }
        
        console.log('✅ Transaction broadcast! TXID:', broadcastResult.txid);
        
        // 5. Show success
        alert(`Rune sent successfully!\nTXID: ${broadcastResult.txid}`);
        
        // 6. Refresh runes list
        loadRunes(walletInfo.data.address);
        
    } catch (error) {
        console.error('❌ Error sending rune:', error);
        alert(`Failed to send rune: ${error.message}`);
    }
}
```

---

### FASE 7: BACKGROUND - SIGN & BROADCAST 🔨
**Status:** EM DESENVOLVIMENTO

**Arquivo:** `mywallet-extension/background/background-real.js`

```javascript
async function signPSBT(psbtData) {
    try {
        console.log('✍️  Signing PSBT...');
        
        // 1. Get private key from wallet
        const privateKey = await getPrivateKey();
        
        // 2. Sign inputs
        const signedPsbt = await signPSBTWithKey(psbtData, privateKey);
        
        // 3. Finalize
        const signedHex = finalizePSBT(signedPsbt);
        
        return {
            success: true,
            signedHex: signedHex
        };
        
    } catch (error) {
        console.error('❌ Error signing PSBT:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function broadcastTransaction(hex) {
    try {
        console.log('📡 Broadcasting transaction...');
        
        // Via backend (Bitcoin Core RPC)
        const response = await fetch('http://localhost:3000/api/wallet/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hex: hex })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        return {
            success: true,
            txid: data.txid
        };
        
    } catch (error) {
        console.error('❌ Error broadcasting:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
```

---

## 🔧 HELPERS NECESSÁRIOS

### LEB128 Encoder
```javascript
function encodeLEB128(integers) {
    let hex = '';
    
    for (const num of integers) {
        let value = num;
        
        while (value >= 0x80) {
            hex += ((value & 0x7f) | 0x80).toString(16).padStart(2, '0');
            value >>= 7;
        }
        
        hex += value.toString(16).padStart(2, '0');
    }
    
    return hex;
}
```

### UTXO Selector
```javascript
function selectRuneUtxos(utxos, targetAmount) {
    let selected = [];
    let totalAmount = 0n;
    
    for (const utxo of utxos) {
        selected.push(utxo);
        totalAmount += BigInt(utxo.amount);
        
        if (totalAmount >= BigInt(targetAmount)) {
            break;
        }
    }
    
    if (totalAmount < BigInt(targetAmount)) {
        throw new Error('Insufficient rune balance');
    }
    
    return selected;
}
```

---

## 🎯 ORDEM DE IMPLEMENTAÇÃO

### Sprint 1: FUNDAÇÃO (2-3 horas)
1. ✅ Integrar `runesDecoderOfficial.js`
2. ✅ Adicionar métodos ao `bitcoinRpc.js`
3. ✅ Criar `psbtBuilderRunes.js`
4. ✅ Testar decodificação de edicts

### Sprint 2: BACKEND (2-3 horas)
5. ✅ Implementar `buildRuneSendPSBT()`
6. ✅ Criar endpoint `/api/runes/build-send-psbt`
7. ✅ Testar construção de PSBT

### Sprint 3: FRONTEND (2-3 horas)
8. ✅ Adicionar UI de envio na modal
9. ✅ Implementar formulário de envio
10. ✅ Integrar com background script

### Sprint 4: TESTES (1-2 horas)
11. ✅ Testar envio end-to-end
12. ✅ Validar segurança
13. ✅ Testar edge cases

---

## 🛡️ VALIDAÇÕES DE SEGURANÇA

Antes de enviar, validar:
- ✅ Endereço de destino é válido
- ✅ Amount não excede balance
- ✅ UTXOs selecionados contêm a rune
- ✅ Runestone está correto
- ✅ Change está correto (runes + BTC)
- ✅ Fee é razoável
- ✅ Usuário confirmou a transação

---

## 📊 TEMPO ESTIMADO

| Fase | Tempo | Status |
|------|-------|--------|
| Decoder Integration | 1h | ⏳ Pendente |
| RPC Methods | 1h | ⏳ Pendente |
| PSBT Builder | 2h | ⏳ Pendente |
| API Endpoint | 1h | ⏳ Pendente |
| Frontend UI | 2h | ⏳ Pendente |
| Sign & Broadcast | 1h | ⏳ Pendente |
| Testing | 2h | ⏳ Pendente |
| **TOTAL** | **~10h** | 🎯 MVP |

---

## 🚀 APÓS SEND FUNCIONAR

Próximos passos:
1. ✅ Send Runes working
2. 🔮 Implementar Swap (P2P)
3. 🔮 Implementar Pools (AMM)
4. 🔮 Integração com DEXs

---

**Status:** 📋 ROADMAP COMPLETO  
**Próximo passo:** Começar implementação do Decoder Official Integration! 🚀


