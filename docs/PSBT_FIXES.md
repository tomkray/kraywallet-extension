# 🔧 Correções no Sistema de PSBT - Atomic Swaps

## ❌ Problemas Identificados

### 1. **Falta de Imports no `psbt.js`**
O arquivo `server/routes/psbt.js` estava tentando usar `bitcoin.Psbt.fromBase64()` sem importar o módulo `bitcoinjs-lib`.

**Erro:**
```javascript
const psbt = bitcoin.Psbt.fromBase64(psbtBase64); // bitcoin is not defined
```

**Correção:**
```javascript
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);
```

### 2. **Perda de Assinaturas do Vendedor**
No arquivo `server/routes/purchase.js`, ao construir o PSBT atômico, as assinaturas do vendedor eram **perdidas**.

**Código Problemático:**
```javascript
psbt.addInput({
    hash: txInput.hash,
    index: txInput.index,
    witnessUtxo: input.witnessUtxo,
    tapInternalKey: input.tapInternalKey
    // NÃO copiar tapKeySig ainda! ❌
});
```

**Correção:**
```javascript
const inputData = {
    hash: txInput.hash,
    index: txInput.index,
    witnessUtxo: input.witnessUtxo
};

// CRÍTICO: Copiar assinaturas do vendedor!
if (input.tapKeySig) {
    inputData.tapKeySig = input.tapKeySig; // ✅
}

if (input.partialSig) {
    inputData.partialSig = input.partialSig; // ✅
}

// Copiar outros campos Taproot
if (input.tapInternalKey) {
    inputData.tapInternalKey = input.tapInternalKey;
}
```

### 3. **Finalização Taproot Incorreta**
A finalização de inputs Taproot (P2TR) não estava criando o witness stack no formato correto.

**Correção:**
```javascript
if (isP2TR && input.tapKeySig) {
    psbt.finalizeInput(i, (inputIndex, input) => {
        // Witness stack para Taproot key path spend: [<signature>]
        const witnessBuffer = Buffer.concat([
            Buffer.from([1]), // número de items na stack
            Buffer.from([input.tapKeySig.length]), // tamanho da assinatura
            input.tapKeySig // assinatura
        ]);
        
        return {
            finalScriptWitness: witnessBuffer
        };
    });
}
```

## ✅ Fluxo Correto de Atomic Swap

### Passo 1: Vendedor Cria Oferta
```javascript
// 1. Vendedor cria PSBT com inscription
POST /api/sell/create-offer-psbt
{
    "inscriptionId": "abc123...",
    "price": 10000,
    "sellerAddress": "bc1p..."
}

// 2. Vendedor assina o PSBT com Unisat
const signedPsbt = await window.unisat.signPsbt(psbtBase64);

// 3. Oferta é salva no banco
POST /api/offers
{
    "psbt": signedPsbt,
    "price": 10000,
    ...
}
```

### Passo 2: Comprador Aceita Oferta
```javascript
// 1. Comprador pega a oferta do vendedor
GET /api/offers/:offerId

// 2. Comprador constrói PSBT atômico
// IMPORTANTE: Preserva assinaturas do vendedor!
POST /api/purchase/build-atomic-psbt
{
    "sellerPsbt": offer.psbt,  // PSBT JÁ ASSINADO pelo vendedor
    "buyerAddress": "bc1p...",
    "buyerUtxos": [...],        // UTXOs do comprador
    "paymentAmount": 10000,     // Valor para o vendedor
    "feeRate": 5
}

// 3. Comprador assina seus inputs
const signedPsbt = await window.unisat.signPsbt(atomicPsbt);

// 4. Finalizar PSBT
POST /api/psbt/finalize
{
    "psbt": signedPsbt
}

// 5. Broadcast
POST /api/psbt/broadcast
{
    "hex": finalizedData.hex  // ou "psbt": finalizedData.psbt
}
```

## 🔐 Assinaturas no PSBT

### Tipos de Assinaturas

#### Legacy/SegWit v0 (P2PKH, P2WPKH):
```javascript
input.partialSig = [{
    pubkey: Buffer,
    signature: Buffer
}]
```

#### Taproot/SegWit v1 (P2TR):
```javascript
input.tapKeySig = Buffer  // Assinatura Schnorr de 64 ou 65 bytes
input.tapInternalKey = Buffer  // Chave pública interna (32 bytes)
```

### Verificação de Assinaturas
```javascript
// Verificar se input está assinado
const isSigned = !!(input.tapKeySig || input.partialSig);

// Verificar tipo de script
const script = input.witnessUtxo.script;
const isP2TR = script.length === 34 && script[0] === 0x51 && script[1] === 0x20;
const isP2WPKH = script.length === 22 && script[0] === 0x00 && script[1] === 0x14;
```

## 🎯 Pontos Críticos

### 1. **NUNCA Perder Assinaturas**
Quando combinar PSBTs ou adicionar inputs, **SEMPRE** copie:
- `tapKeySig` (Taproot)
- `partialSig` (Legacy/SegWit v0)
- `tapInternalKey` (Taproot metadata)
- `tapMerkleRoot` (se existir)

### 2. **Finalização Correta**
- Para Taproot: witness stack = `[<num_items>] [<sig_length>] [<signature>]`
- Para SegWit v0: use `psbt.finalizeInput(i)` padrão
- Verificar `finalScriptWitness` ou `finalScriptSig` após finalizar

### 3. **Atomic Swap = PSBT Combinado**
Um atomic swap precisa:
- Input(s) do vendedor (com inscription) - **assinado**
- Input(s) do comprador (com satoshis) - **assinado**
- Output(s) corretos (inscription → comprador, pagamento → vendedor)
- Todos os inputs devem estar finalizados antes do broadcast

## 🧪 Testando

### Teste 1: Verificar Imports
```bash
curl http://localhost:3000/api/psbt/fees
# Deve retornar fees sem erro
```

### Teste 2: Criar e Decodificar PSBT
```bash
# Criar
curl -X POST http://localhost:3000/api/psbt/create \
  -H "Content-Type: application/json" \
  -d '{"inputs": [...], "outputs": [...]}'

# Decodificar
curl -X POST http://localhost:3000/api/psbt/decode \
  -H "Content-Type: application/json" \
  -d '{"psbt": "cHNi..."}'
```

### Teste 3: Atomic Swap Completo
1. Vendedor cria oferta → assina → salva
2. Comprador pega oferta → constrói PSBT atômico → assina
3. Backend finaliza → verifica assinaturas
4. Backend faz broadcast → retorna txid

## 📊 Debugging

### Verificar PSBT no Console
```javascript
// Decodificar PSBT
const psbt = bitcoin.Psbt.fromBase64(psbtBase64);

// Ver inputs
psbt.data.inputs.forEach((input, i) => {
    console.log(`Input ${i}:`, {
        hasTapKeySig: !!input.tapKeySig,
        hasPartialSig: !!input.partialSig,
        witnessUtxo: input.witnessUtxo,
        finalized: !!(input.finalScriptWitness || input.finalScriptSig)
    });
});

// Ver outputs
psbt.txOutputs.forEach((output, i) => {
    console.log(`Output ${i}:`, {
        value: output.value,
        address: output.address || 'script',
        script: output.script.toString('hex')
    });
});
```

### Logs Úteis
O servidor agora loga:
- ✅ Quando assinaturas são copiadas
- 🔍 Status de cada input (assinado/não assinado)
- 📊 Balanço do PSBT (inputs vs outputs)
- ⚡ Método de finalização usado

## 🚨 Erros Comuns

### Erro: "No inputs are signed"
**Causa:** PSBT não foi assinado pela carteira (Unisat)
**Solução:** Certifique-se de chamar `window.unisat.signPsbt()` antes de finalizar

### Erro: "Failed to finalize PSBT"
**Causa:** Input não tem assinatura ou assinatura inválida
**Solução:** Verificar se `tapKeySig` ou `partialSig` está presente e correto

### Erro: "Request failed with status code 500"
**Causa:** Bitcoin Core retornou erro ao finalizar/broadcast
**Solução:** Verificar logs do servidor para erro específico do Bitcoin Core

## 🎉 Status Atual

✅ Imports corrigidos
✅ Assinaturas preservadas durante atomic swap
✅ Finalização Taproot corrigida
✅ Servidor rodando e funcional
✅ Todos os nodes conectados (Bitcoin Core + Ord Server)

## 🔗 Próximos Passos

1. Testar fluxo completo no frontend
2. Verificar que Unisat está assinando corretamente
3. Confirmar que broadcast está funcionando
4. Testar com inscription real (não mock)

---

**Data da correção:** 17/10/2025
**Versão:** Ordinals v0.23.3
**Status:** ✅ Correções aplicadas e servidor rodando



