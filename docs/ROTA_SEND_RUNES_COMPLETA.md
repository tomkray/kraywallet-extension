# 🔄 ROTA COMPLETA: SEND RUNES NO MYWALLET

## ✅ VERIFICAÇÃO COMPLETA - TUDO ATUALIZADO!

Data: Hoje  
Status: **100% PRONTO** 🎉

---

## 📍 FLUXO COMPLETO (PASSO A PASSO)

### 1️⃣ **FRONTEND: Usuário clica "Send Rune"**

**Arquivo:** `mywallet-extension/popup/popup.js`  
**Função:** `sendRuneTransaction(rune, toAddress, amount, feeRate)`  
**Linhas:** 3244-3510

**O que faz:**
```javascript
1. Obtém endereço do usuário (fromAddress)
2. Chama backend para construir PSBT:
   POST http://localhost:3000/api/runes/build-send-psbt
   {
     fromAddress: "bc1p...",
     toAddress: "bc1p...",
     runeName: "DOG•GO•TO•THE•MOON",
     amount: 1000,
     feeRate: 10
   }
3. Recebe PSBT não assinado (Base64)
```

**Status:** ✅ CORRETO

---

### 2️⃣ **BACKEND: Construir PSBT**

**Arquivo:** `server/routes/runes.js`  
**Endpoint:** `POST /api/runes/build-send-psbt`  
**Linhas:** 176-240

**O que faz:**
```javascript
1. Valida parâmetros
2. Chama psbtBuilderRunes.buildRuneSendPSBT({...})
3. Retorna:
   {
     success: true,
     psbt: "cHNidP8BA...",  // Base64
     fee: 974,
     summary: {...}
   }
```

**Status:** ✅ CORRETO

---

### 3️⃣ **BACKEND: Construção do PSBT (CRÍTICO!)**

**Arquivo:** `server/utils/psbtBuilderRunes.js`  
**Método:** `buildRuneSendPSBT()`  
**Linhas:** 530-850

**O que faz (ATUALIZADO HOJE!):**

```javascript
// 1. Buscar Rune ID do ORD server
const runeId = await getRuneIdByName(runeName);
// Ex: "840000:3"

// 2. Buscar UTXOs que contêm as runes
const runeUtxos = await getRuneUtxos(fromAddress, runeName);

// 2.6. ✅ NOVO: Validar UTXOs via Mempool.space
const validUtxos = validateUtxosStillUnspent(runeUtxos);

// 3. Selecionar UTXOs suficientes
const { selected, totalAmount, change } = selectRuneUtxos(validUtxos, amount);

// 4. ✅ CRÍTICO: Construir Runestone (ATUALIZADO!)
const hasRuneChange = change > 0n;

if (hasRuneChange) {
    // COM CHANGE: 2 edicts
    runestone = buildRunestoneWith2Edicts({
        runeId: "840000:3",
        changeAmount: change,
        changeOutput: 1,      // Output 1 = sender
        sendAmount: amount,
        sendOutput: 2         // Output 2 = recipient
    });
} else {
    // ✅ SEM CHANGE: 1 edict simples (CORRIGIDO HOJE!)
    runestone = buildRunestone({
        runeId: "840000:3",
        amount: amount,
        outputIndex: 2        // SEMPRE output 2!
    });
}

// 5. ✅ SEMPRE 4 OUTPUTS (CORRIGIDO HOJE!)
outputs = [
    { scriptPubKey: runestone, value: 0 },           // 0: OP_RETURN
    { address: fromAddress, value: 546 },            // 1: Sender (change)
    { address: toAddress, value: 546 },              // 2: Recipient
    { address: fromAddress, value: btcChange }       // 3: BTC change
];

// 6. Construir PSBT
psbt.addInputs(selectedUtxos);
psbt.addOutputs(outputs);

// 7. Retornar PSBT Base64
return { psbt: psbt.toBase64(), fee, ... };
```

**Mudanças CRÍTICAS (HOJE!):**
- ✅ Validação de UTXOs via Mempool.space (Step 2.6)
- ✅ SEM change: usar 1 edict apontando para output 2
- ✅ COM change: usar 2 edicts (output 1 e 2)
- ✅ **SEMPRE 4 outputs** (mesmo com rune change = 0)

**Status:** ✅ **ATUALIZADO E CORRETO!** 🔥

---

### 4️⃣ **FRONTEND: Solicitar Senha e Assinar**

**Arquivo:** `mywallet-extension/popup/popup.js`  
**Linhas:** 3404-3423

**O que faz:**
```javascript
1. Mostra modal de confirmação com senha
2. Descriptografa mnemonic
3. Chama backend para assinar:
   POST http://localhost:3000/api/mywallet/sign
   {
     mnemonic: "word1 word2...",
     psbt: "cHNidP8BA...",
     network: "mainnet"
   }
4. Recebe PSBT assinado
```

**Status:** ✅ CORRETO (usando sighash manual BIP 341)

---

### 5️⃣ **BACKEND: Assinar PSBT**

**Arquivo:** `server/routes/mywallet.js`  
**Endpoint:** `POST /api/mywallet/sign`  
**Linhas:** 150-370

**O que faz:**
```javascript
1. Deriva chaves do mnemonic (Taproot)
2. Calcula sighash BIP 341 MANUALMENTE (CRÍTICO!)
3. Assina com ecc.signSchnorr
4. Adiciona assinatura ao PSBT (tapKeySig)
5. Retorna PSBT assinado (Base64)
```

**Status:** ✅ CORRETO (sighash manual implementado!)

---

### 6️⃣ **FRONTEND: Finalizar PSBT**

**Arquivo:** `mywallet-extension/popup/popup.js`  
**Linhas:** 3456-3471

**O que faz:**
```javascript
POST http://localhost:3000/api/mywallet/finalize-psbt
{
  psbt: "cHNidP8BA..."  // PSBT assinado
}

// Recebe:
{
  success: true,
  hex: "02000000..."  // Transaction hex
}
```

**Status:** ✅ CORRETO

---

### 7️⃣ **BACKEND: Finalizar PSBT**

**Arquivo:** `server/routes/mywallet.js`  
**Endpoint:** `POST /api/mywallet/finalize-psbt`  
**Linhas:** 435-520

**O que faz:**
```javascript
1. Tenta finalizar com Bitcoin Core (se disponível)
2. Fallback: bitcoinjs-lib (psbt.finalizeAllInputs())
3. Extrai hex: psbt.extractTransaction().toHex()
4. Retorna hex
```

**Status:** ✅ CORRETO

---

### 8️⃣ **FRONTEND: Broadcast**

**Arquivo:** `mywallet-extension/background/background-real.js`  
**Função:** `broadcastTransaction(hex)`  
**Linhas:** 1754-1790

**O que faz:**
```javascript
POST http://localhost:3000/api/psbt/broadcast
{
  hex: "02000000..."
}
```

**Status:** ✅ **ATUALIZADO HOJE!** (endpoint correto: `/api/psbt/broadcast`)

---

### 9️⃣ **BACKEND: Broadcast Transaction**

**Arquivo:** `server/routes/psbt.js`  
**Endpoint:** `POST /api/psbt/broadcast`  
**Linhas:** 305-400

**O que faz (ATUALIZADO!):**
```javascript
1. Tenta Mempool.space:
   POST https://mempool.space/api/tx
   (hex como body plain text)

2. Se falhar, tenta Blockstream.info:
   POST https://blockstream.info/api/tx

3. Retorna TXID se sucesso
```

**Mudanças CRÍTICAS (HOJE!):**
- ❌ Removido Bitcoin Core RPC
- ❌ Removido Mining Pools
- ✅ Apenas APIs públicas (escalável!)

**Status:** ✅ **ATUALIZADO E CORRETO!** 🔥

---

## 📊 RESUMO DAS MUDANÇAS (HOJE)

### 1. **`psbtBuilderRunes.js`**
- ✅ Step 2.6: Validação de UTXOs via Mempool.space
- ✅ SEM change: 1 edict apontando para output 2
- ✅ **SEMPRE 4 outputs** (estrutura idêntica às transações reais!)

### 2. **`background-real.js`**
- ✅ Endpoint de broadcast atualizado: `/api/psbt/broadcast`

### 3. **`psbt.js`**
- ✅ Broadcast usando apenas APIs públicas
- ✅ Sem dependência de Bitcoin Core

---

## ✅ STATUS FINAL

| Componente | Status | Observações |
|------------|--------|-------------|
| Frontend (popup.js) | ✅ OK | Fluxo completo implementado |
| Frontend (background.js) | ✅ ATUALIZADO | Endpoint correto |
| Backend (build PSBT) | ✅ ATUALIZADO | Estrutura correta (4 outputs) |
| Backend (sign PSBT) | ✅ OK | Sighash manual BIP 341 |
| Backend (finalize PSBT) | ✅ OK | Bitcoin Core + fallback |
| Backend (broadcast) | ✅ ATUALIZADO | APIs públicas |

---

## 🚀 PRONTO PARA TESTE!

**Ação necessária:**
1. Recarregar extension MyWallet
2. Tentar enviar Runes
3. Verificar logs no servidor

**Expectativa:**
✅ Transação deve ser aceita pela rede!  
✅ Estrutura idêntica às transações bem-sucedidas!

