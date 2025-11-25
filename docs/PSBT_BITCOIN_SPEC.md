# 📚 PSBT (BIP 174) - Especificação e Implementação Correta

## 🎯 Visão Geral

PSBT (Partially Signed Bitcoin Transaction) é definido no BIP 174 e permite:
- Construir transações em múltiplas etapas
- Assinar inputs individualmente
- Combinar assinaturas de múltiplas partes
- Atomic swaps entre compradores e vendedores

## 📋 Estrutura de um PSBT

### Componentes Principais:

```
PSBT
├── Global Data
│   └── unsigned_tx (transação base sem assinaturas)
├── Input #0
│   ├── witnessUtxo (para SegWit)
│   ├── tapInternalKey (para Taproot)
│   ├── tapKeySig (assinatura Schnorr - após assinar)
│   └── partialSig (assinatura ECDSA - legacy)
├── Input #1
│   └── ...
└── Outputs
    └── (já incluídos em unsigned_tx)
```

## 🔑 Regras Críticas do bitcoinjs-lib

### 1. **Ordem de Operações É CRÍTICA**

```javascript
// ✅ CORRETO
const psbt = new Psbt({ network });

// Passo 1: Adicionar TODOS os inputs (sem assinaturas)
psbt.addInput({ hash, index, witnessUtxo, tapInternalKey });
psbt.addInput({ hash, index, witnessUtxo }); // buyer

// Passo 2: Adicionar TODOS os outputs
psbt.addOutput({ address, value });
psbt.addOutput({ address, value });

// Passo 3: Adicionar assinaturas DEPOIS
psbt.data.inputs[0].tapKeySig = sellerSignature;

// Passo 4: Assinar inputs do comprador
await psbt.signInputAsync(1, buyerKeyPair);
```

```javascript
// ❌ ERRADO - Causa "Can not modify transaction, signatures exist"
psbt.addInput({ hash, index, witnessUtxo, tapKeySig }); // ← Assinatura aqui!
psbt.addInput({ hash, index, witnessUtxo }); // ← ERRO! PSBT está locked
```

### 2. **witnessUtxo é OBRIGATÓRIO para SegWit/Taproot**

```javascript
// Para Taproot (P2TR):
witnessUtxo: {
    script: Buffer.from('51200000...', 'hex'), // 34 bytes: OP_1 + 32 bytes pubkey
    value: 546 // satoshis
}

// Para SegWit v0 (P2WPKH):
witnessUtxo: {
    script: Buffer.from('0014...', 'hex'), // 22 bytes: OP_0 + 20 bytes hash
    value: 10000
}
```

### 3. **tapInternalKey para Taproot**

```javascript
// DEVE estar presente para Taproot antes de assinar
tapInternalKey: Buffer.from('32_bytes_x_only_pubkey', 'hex')
```

### 4. **Assinaturas Taproot (Schnorr)**

```javascript
// tapKeySig para Taproot key path spend
// 64 ou 65 bytes (64 + optional sighash byte)
tapKeySig: Buffer.from('signature_64_bytes', 'hex')

// partialSig para inputs legacy/SegWit v0
partialSig: [{
    pubkey: Buffer.from('33_bytes', 'hex'),
    signature: Buffer.from('71_bytes', 'hex') // DER + sighash
}]
```

## 🔄 Atomic Swap - Fluxo Correto

### Cenário: Vendedor vende Inscription por Sats

```javascript
// ==========================================
// VENDEDOR CRIA PSBT INICIAL
// ==========================================
const sellerPsbt = new Psbt({ network });

// Input: Inscription UTXO
sellerPsbt.addInput({
    hash: inscriptionTxid,
    index: inscriptionVout,
    witnessUtxo: {
        script: sellerScriptPubKey, // P2TR do vendedor
        value: 546
    },
    tapInternalKey: sellerPubKey
});

// Output 0: Inscription vai para comprador (placeholder)
sellerPsbt.addOutput({
    address: sellerAddress, // Temporário!
    value: 546
});

// Output 1: Pagamento vai para vendedor
sellerPsbt.addOutput({
    address: sellerAddress,
    value: 10000 // Preço
});

// Vendedor ASSINA
await sellerPsbt.signInputAsync(0, sellerKeyPair);

// Salvar PSBT assinado
const sellerPsbtBase64 = sellerPsbt.toBase64();

// ==========================================
// COMPRADOR CRIA PSBT ATÔMICO
// ==========================================

// 1. Decodificar PSBT do vendedor
const sellerDecoded = Psbt.fromBase64(sellerPsbtBase64);

// 2. CRIAR NOVO PSBT DO ZERO
const atomicPsbt = new Psbt({ network });

// 3. Copiar input do vendedor SEM assinatura
atomicPsbt.addInput({
    hash: sellerDecoded.txInputs[0].hash,
    index: sellerDecoded.txInputs[0].index,
    witnessUtxo: sellerDecoded.data.inputs[0].witnessUtxo,
    tapInternalKey: sellerDecoded.data.inputs[0].tapInternalKey
    // NÃO copiar tapKeySig ainda!
});

// 4. Adicionar input(s) do comprador
atomicPsbt.addInput({
    hash: buyerUtxoTxid,
    index: buyerUtxoVout,
    witnessUtxo: {
        script: buyerScriptPubKey,
        value: 15000 // Tem que cobrir: 10000 (preço) + 546 (dust) + 500 (fee)
    },
    tapInternalKey: buyerPubKey
});

// 5. Adicionar outputs CORRETOS
// Output 0: Inscription para COMPRADOR (corrigido!)
atomicPsbt.addOutput({
    address: buyerAddress, // ← IMPORTANTE: Endereço do comprador!
    value: 546
});

// Output 1: Pagamento para VENDEDOR
atomicPsbt.addOutput({
    address: sellerAddress,
    value: 10000
});

// Output 2: Change para COMPRADOR
atomicPsbt.addOutput({
    address: buyerAddress,
    value: 4454 // 15000 - 546 - 10000 - 500(fee)
});

// 6. AGORA copiar assinatura do vendedor
atomicPsbt.data.inputs[0].tapKeySig = sellerDecoded.data.inputs[0].tapKeySig;

// 7. Comprador assina SEU input (índice 1)
await atomicPsbt.signInputAsync(1, buyerKeyPair);

// 8. Finalizar e broadcast
atomicPsbt.finalizeAllInputs();
const tx = atomicPsbt.extractTransaction();
const txHex = tx.toHex();

// Broadcast
await bitcoin.rpc.sendRawTransaction(txHex);
```

## ⚠️ Problemas Comuns

### Problema 1: "Can not modify transaction, signatures exist"

**Causa:** Tentando adicionar inputs/outputs após adicionar assinaturas

**Solução:** 
1. Construir estrutura completa (inputs + outputs)
2. Adicionar assinaturas por último

### Problema 2: "Invalid Signature"

**Causa:** 
- `witnessUtxo` incorreto
- `tapInternalKey` faltando
- Output errado (comprador não recebe inscription)

**Solução:**
- Verificar `witnessUtxo.script` está correto
- Verificar `witnessUtxo.value` está correto
- Garantir que Output 0 vai para o comprador

### Problema 3: "Non-final PSBT"

**Causa:** Nem todos inputs foram assinados

**Solução:**
```javascript
// Verificar quais inputs estão assinados
for (let i = 0; i < psbt.inputCount; i++) {
    const input = psbt.data.inputs[i];
    const signed = !!(input.tapKeySig || input.partialSig);
    console.log(`Input ${i} signed:`, signed);
}
```

### Problema 4: Fee Incorreta

**Causa:** 
- Inputs < Outputs (transação inválida)
- Fee muito baixa

**Solução:**
```javascript
// Calcular fee
const totalIn = inputs.reduce((sum, inp) => sum + inp.witnessUtxo.value, 0);
const totalOut = outputs.reduce((sum, out) => sum + out.value, 0);
const fee = totalIn - totalOut;

console.log('Fee:', fee, 'sats');
console.log('Fee rate:', fee / txSizeVBytes, 'sat/vB');

// Fee DEVE ser positiva!
if (fee <= 0) throw new Error('Invalid fee');
```

## 🔍 Debugging PSBT

```javascript
// Ver estrutura completa
const decoded = Psbt.fromBase64(psbtBase64);

console.log('=== PSBT DEBUG ===');
console.log('Inputs:', decoded.inputCount);
console.log('Outputs:', decoded.txOutputs.length);

// Analisar cada input
decoded.data.inputs.forEach((input, i) => {
    console.log(`\nInput ${i}:`);
    console.log('  witnessUtxo:', input.witnessUtxo);
    console.log('  tapInternalKey:', input.tapInternalKey?.toString('hex'));
    console.log('  tapKeySig:', input.tapKeySig?.toString('hex'));
    console.log('  Signed:', !!(input.tapKeySig || input.partialSig));
});

// Analisar outputs
decoded.txOutputs.forEach((output, i) => {
    console.log(`\nOutput ${i}:`);
    console.log('  value:', output.value);
    console.log('  script:', output.script.toString('hex'));
    console.log('  address:', output.address || 'N/A');
});

// Balance check
const totalIn = decoded.data.inputs.reduce((sum, inp) => 
    sum + (inp.witnessUtxo?.value || 0), 0
);
const totalOut = decoded.txOutputs.reduce((sum, out) => 
    sum + out.value, 0
);

console.log('\n=== BALANCE ===');
console.log('Total In:', totalIn);
console.log('Total Out:', totalOut);
console.log('Fee:', totalIn - totalOut);
```

## ✅ Checklist para Atomic Swap

Antes de finalizar, verificar:

- [ ] Todos inputs têm `witnessUtxo`
- [ ] Inputs Taproot têm `tapInternalKey`
- [ ] Input 0 (vendedor) tem `tapKeySig`
- [ ] Input 1 (comprador) tem `tapKeySig` ou será assinado
- [ ] Output 0 (inscription) vai para **comprador**
- [ ] Output 1 (pagamento) vai para **vendedor**
- [ ] Output 2 (change) vai para **comprador** (se existir)
- [ ] Total Inputs > Total Outputs (fee positiva)
- [ ] Fee rate razoável (1-20 sat/vB)

## 🎯 Nosso Código - Análise

### ✅ O que está CERTO:

1. Decodificar PSBT do vendedor ✓
2. Criar novo PSBT do zero ✓
3. Adicionar inputs sem assinaturas primeiro ✓
4. Guardar assinaturas para depois ✓
5. Adicionar inputs do comprador ✓
6. Adicionar outputs ✓
7. Copiar assinaturas do vendedor ✓

### ⚠️ O que pode estar ERRADO:

1. **Output 0 pode estar indo para endereço errado**
   - Precisa ir para `buyerAddress`, não `sellerAddress`

2. **`tapInternalKey` pode estar faltando nos inputs do comprador**
   - Unisat precisa disso para assinar

3. **`witnessUtxo.script` dos UTXOs do comprador pode estar incorreto**
   - Precisa ser derivado do endereço correto

## 🔧 Próximas Correções Necessárias

Vou verificar nosso código atual contra esta especificação e corrigir qualquer inconsistência.



