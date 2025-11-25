# 🚀 SEND RUNES - IMPLEMENTAÇÃO TÉCNICA

## 📋 RESUMO EXECUTIVO

Implementamos a funcionalidade de **envio de Runes** na MyWallet seguindo o protocolo oficial do Ordinals, usando a arquitetura híbrida Extension + Backend que garante:

✅ **Segurança**: Private keys nunca saem do navegador  
✅ **Compatibilidade**: Funciona com qualquer usuário  
✅ **Confiabilidade**: Segue o padrão oficial do Ordinals

---

## 🏗️ ARQUITETURA

```
┌─────────────────────────────────────────────────┐
│  MyWallet Extension (Browser)                   │
│  • Gera e armazena mnemonic/private key         │
│  • Assina PSBTs localmente                      │
│  • NUNCA envia private key para backend         │
└─────────────────────────────────────────────────┘
                      ↓
        [Solicita PSBT não assinado]
                      ↓
┌─────────────────────────────────────────────────┐
│  Backend API (localhost:3000)                   │
│  • Acessa ORD Server local                      │
│  • Acessa Bitcoin Core RPC local                │
│  • Constrói PSBT com Runestone correto          │
│  • Faz broadcast de TX assinada                 │
└─────────────────────────────────────────────────┘
                      ↓
                 Bitcoin Network
```

---

## 📁 ARQUIVOS MODIFICADOS/CRIADOS

### 1. `server/utils/runesDecoder.js`

**Função Nova: `getRuneUtxos(address, runeName)`**

```javascript
async getRuneUtxos(address, runeName) {
    // 1. Busca página do endereço no ORD server
    // 2. Extrai todos os outputs (txid:vout)
    // 3. Para cada output, verifica se contém a rune
    // 4. Retorna lista de UTXOs com a rune específica
}
```

**Como funciona:**
- Faz parsing do HTML do ORD server: `/address/{address}`
- Regex: `/<a[^>]*href=\/output\/([a-f0-9]{64}):(\d+)[^>]*>/gi`
- Para cada output, consulta `/output/{txid}:{vout}` e verifica se tem a rune
- Retorna: `[{ txid, vout, amount }]`

---

### 2. `server/utils/runesDecoderOfficial.js`

**Função Nova: `getRuneIdByName(runeName)`**

```javascript
async getRuneIdByName(runeName) {
    // 1. Busca página da rune no ORD server
    // 2. Extrai o Rune ID (formato: blockHeight:txIndex)
    // 3. Exemplo: "840000:3"
}
```

**Como funciona:**
- Consulta: `/rune/{runeName}` no ORD server
- Regex: `/<dt>id<\/dt>\s*<dd>([^<]+)<\/dd>/i`
- O Rune ID é essencial para construir o Runestone (OP_RETURN)

---

### 3. `server/utils/psbtBuilderRunes.js`

**Função Principal: `buildRuneSendPSBT()`**

```javascript
async buildRuneSendPSBT({ fromAddress, toAddress, runeName, amount, feeRate }) {
    // 1. Obter Rune ID (ex: 840000:3)
    const runeId = await runesDecoderOfficial.getRuneIdByName(runeName);
    
    // 2. Buscar runes do endereço
    const runes = await runesDecoder.getRunesForAddress(fromAddress);
    
    // 3. Buscar UTXOs que contêm a rune específica
    const runeUtxos = await runesDecoder.getRuneUtxos(fromAddress, runeName);
    
    // 4. Construir Runestone (OP_RETURN com edicts)
    const runestone = this.buildRunestone({ runeId, amount, outputIndex: 1 });
    
    // 5. Construir PSBT com:
    //    - Output 0: OP_RETURN (Runestone)
    //    - Output 1: Rune para destino (546 sats)
    //    - Output 2: Change de runes (se houver)
    //    - Output 3: Change de BTC
}
```

**Runestone Structure:**
```
OP_RETURN (output 0):
┌─────────────────────────────────────┐
│  Runestone (LEB128 encoded)         │
│  • Rune ID (840000:3)               │
│  • Output index (1)                 │
│  • Amount (1000)                    │
└─────────────────────────────────────┘
```

---

## 🔄 FLUXO COMPLETO DE ENVIO

### **PASSO 1: Usuário clica em "Send Rune" na Extension**

```javascript
// mywallet-extension/popup/popup.js
async function sendRuneTransaction(rune, toAddress, amount, feeRate) {
    // 1. Pede PSBT para backend
    const response = await fetch('http://localhost:3000/api/runes/build-send-psbt', {
        method: 'POST',
        body: JSON.stringify({ fromAddress, toAddress, runeName, amount, feeRate })
    });
    
    const { psbt } = await response.json();
    // ... continua
}
```

---

### **PASSO 2: Backend constrói PSBT**

```javascript
// server/routes/runes.js
router.post('/build-send-psbt', async (req, res) => {
    const { fromAddress, toAddress, runeName, amount, feeRate } = req.body;
    
    const result = await psbtBuilderRunes.buildRuneSendPSBT({
        fromAddress,
        toAddress,
        runeName,
        amount,
        feeRate
    });
    
    res.json({
        success: true,
        psbt: result.psbt, // Base64
        fee: result.fee,
        summary: result.summary
    });
});
```

---

### **PASSO 3: Extension assina PSBT localmente**

```javascript
// mywallet-extension/popup/popup.js
// 2. Pede background script para assinar
const signedResult = await chrome.runtime.sendMessage({
    action: 'signRunePSBT',
    psbt: psbt,
    mnemonic: mnemonic // Armazenado localmente
});

const { signedHex } = signedResult;
```

---

### **PASSO 4: Extension envia TX assinada para broadcast**

```javascript
// 3. Pede background script para fazer broadcast
const broadcastResult = await chrome.runtime.sendMessage({
    action: 'broadcastTransaction',
    signedHex: signedHex
});

const { txid } = broadcastResult;
console.log('✅ Rune sent! TXID:', txid);
```

---

### **PASSO 5: Backend faz broadcast via Bitcoin Core**

```javascript
// server/routes/wallet.js
router.post('/broadcast', async (req, res) => {
    const { signedHex } = req.body;
    
    const txid = await bitcoinRpc.sendRawTransaction(signedHex);
    
    res.json({ success: true, txid });
});
```

---

## 🔐 SEGURANÇA

### ✅ O QUE ESTÁ SEGURO:

1. **Private Key nunca sai do navegador**
   - Gerada no navegador via BIP39
   - Armazenada apenas no `chrome.storage.local`
   - Backend **NUNCA** tem acesso

2. **Backend não pode gastar fundos**
   - Backend só constrói PSBT **não assinado**
   - Extension assina localmente
   - Backend só faz broadcast do que o usuário assinou

3. **Usuário sempre controla os fundos**
   - Extension mostra preview antes de assinar
   - Usuário confirma manualmente
   - Pode revisar PSBT antes de enviar

---

## 🧪 TESTES

### Teste 1: Buscar UTXOs com Rune

```bash
curl "http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
```

**Esperado:**
```json
{
  "success": true,
  "runes": [
    {
      "name": "DOG•GO•TO•THE•MOON",
      "amount": "1000",
      "symbol": "🐕",
      "utxos": []
    }
  ]
}
```

---

### Teste 2: Criar PSBT para envio

```bash
curl -X POST http://localhost:3000/api/runes/build-send-psbt \
  -H "Content-Type: application/json" \
  -d '{
    "fromAddress": "bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx",
    "toAddress": "bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag",
    "runeName": "DOG•GO•TO•THE•MOON",
    "amount": "1000",
    "feeRate": 1
  }'
```

**Esperado:**
```json
{
  "success": true,
  "psbt": "cHNidP8BA...",
  "fee": 150,
  "summary": {
    "from": "bc1pvz...",
    "to": "bc1pggc...",
    "rune": "DOG•GO•TO•THE•MOON",
    "amount": "1000"
  }
}
```

---

## 📊 LOGS DE DEBUG

### Backend logs esperados:

```
🚀 ========== BUILD RUNE SEND PSBT ==========
From: bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx
To: bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag
Rune: DOG•GO•TO•THE•MOON
Amount: 1000
Fee Rate: 1 sat/vB

📡 Step 1: Getting Rune ID from ORD server...
   ✅ Rune ID: 840000:3

📡 Step 2: Fetching runes from address...
   ✅ Found 1 runes

📡 Step 2.5: Fetching UTXOs with this rune via ORD server...
   Found 2 outputs for this address
   ✅ Found rune in output 0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28:2 - Amount: 1000
   ✅ Found 1 UTXOs containing "DOG•GO•TO•THE•MOON"

🔨 Step 3: Building Runestone...
   ✅ Runestone built: 6a5d0a00c0a2330380c2d72f02

✅ PSBT created successfully!
```

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### Erro: "Rune not found in address"

**Causa:** `getRunesForAddress()` não está retornando a rune  
**Solução:** Verificar se ORD server está rodando e indexado

---

### Erro: "No UTXOs found containing rune"

**Causa:** `getRuneUtxos()` não está encontrando outputs  
**Solução:** Verificar regex de parsing do HTML do ORD server

---

### Erro: "Could not find Rune ID"

**Causa:** `getRuneIdByName()` não consegue extrair ID do HTML  
**Solução:** Verificar se `/rune/{nome}` existe no ORD server

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Testar criação de PSBT** (CONCLUÍDO)
2. ⏳ **Testar assinatura local** (Implementado, precisa testar)
3. ⏳ **Testar broadcast** (Implementado, precisa testar)
4. ⏳ **Ver TX no mempool** (Após broadcast)
5. ⏳ **Confirmar transferência no ORD server** (Após confirmação)

---

## 📚 REFERÊNCIAS

- [Ordinals Repository](https://github.com/ordinals/ord)
- [Runes Protocol](https://docs.ordinals.com/runes.html)
- [BIP39 - Mnemonic](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP86 - Taproot](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki)
- [Runestone Encoding (LEB128)](https://en.wikipedia.org/wiki/LEB128)

---

## ✅ STATUS FINAL

**IMPLEMENTAÇÃO: CONCLUÍDA** ✅  
**PRONTO PARA TESTES** 🧪

Todos os componentes necessários para enviar Runes foram implementados seguindo o protocolo oficial. A arquitetura garante segurança (private keys no navegador) e funcionalidade (backend com ORD + Bitcoin Core).

**Próximo passo:** Executar testes manuais conforme `✅_TESTAR_SEND_RUNES_AGORA.txt`


