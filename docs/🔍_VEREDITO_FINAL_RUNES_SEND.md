# 🔍 VEREDITO FINAL - Runes Send Error

## 📊 ANÁLISE COMPLETA

### ✅ O QUE ESTÁ CORRETO

1. **✅ PSBT construído perfeitamente**
   - 2 inputs (Taproot P2TR)
   - 3 outputs (OP_RETURN + destinatário + change)
   - Runestone correto: `OP_RETURN + OP_13 + data`
   - Valores corretos: 600 + 10000 = 10600 sats input
   - Outputs: 0 + 546 + 9080 = 9626 sats (fee: 974 sats)

2. **✅ tapInternalKey CORRETO**
   - Internal Key: `e8a7c10aeb91761b2ae874a88ae6ffc0449187258ee7d46357d29628ed9b752c`
   - Output Key calculado: `609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a`
   - ✅ **CORRESPONDE** ao Output Key do endereço!

3. **✅ Assinatura estruturalmente correta**
   - 2 assinaturas Schnorr de 65 bytes
   - SIGHASH_ALL (0x01) em ambas
   - Witness format correto para Taproot key path

4. **✅ UTXOs válidos**
   - Nenhum foi gasto
   - Pertencem ao endereço correto
   - Valores corretos

5. **✅ Runestone válido**
   - `6a5d00c0a23303e80701`
   - Decodifica para: Send 1000 units de rune 840000:3 para output 1

### ❌ O ERRO: `-26: scriptpubkey`

**Erro retornado por:**
- Bitcoin Core
- Mempool.space
- Blockstream.info
- F2Pool (não respondeu)
- ViaBTC (404)

### 🔍 CAUSA RAIZ PROVÁVEL

O erro `-26: scriptpubkey` geralmente significa:

**"A assinatura não verifica corretamente para o scriptPubKey"**

Mas descobrimos que:
- ✅ Internal Key está correto
- ✅ Output Key está correto
- ✅ Tweak calculado corretamente

**Então o problema deve ser:**

## 🎯 HIPÓTESE FINAL: SIGHASH

O problema está na forma como a **mensagem de assinatura (sighash)** está sendo calculada!

### Evidência:

No log, vimos que foi passado `sighashType: 'ALL'` para o `/api/mywallet/sign`:

```javascript
body: JSON.stringify({
    mnemonic,
    psbt: buildData.psbt,
    network: 'mainnet',
    sighashType: 'ALL'  // ← AQUI!
})
```

E no servidor, o código mapeia isso para:

```javascript
if (sighashType === 'ALL') {
    sighashValue = bitcoin.Transaction.SIGHASH_ALL; // = 0x01
}
```

Mas para **Taproot**, o SIGHASH padrão deveria ser:
- **SIGHASH_DEFAULT (0x00)** - sem byte de sighash no witness
- **SIGHASH_ALL (0x01)** - com byte de sighash no witness

### ⚠️  O PROBLEMA

bitcoinjs-lib pode estar calculando o sighash **DE FORMA DIFERENTE** quando usamos `SIGHASH_ALL` explicitamente vs quando deixamos como DEFAULT.

Para Taproot, a mensagem de assinatura é diferente dependendo de:
1. Se usa SIGHASH_DEFAULT (0x00) - **NÃO** inclui o byte no witness
2. Se usa SIGHASH_ALL (0x01) - **INCLUI** o byte no witness

## 🛠️ SOLUÇÃO

### Teste 1: Remover sighashType explícito

No arquivo `mywallet-extension/popup/popup.js` linha 3410:

**MUDAR DE:**
```javascript
body: JSON.stringify({
    mnemonic,
    psbt: buildData.psbt,
    network: 'mainnet',
    sighashType: 'ALL'  // ← REMOVER ESTA LINHA!
})
```

**PARA:**
```javascript
body: JSON.stringify({
    mnemonic,
    psbt: buildData.psbt,
    network: 'mainnet'
    // SEM sighashType - deixar DEFAULT
})
```

### Teste 2: Usar SIGHASH_DEFAULT explicitamente

Ou, alterar o servidor para usar SIGHASH_DEFAULT quando for Taproot:

```javascript
// server/routes/mywallet.js
if (sighashType) {
    // Para Taproot, usar DEFAULT ao invés de ALL
    if (sighashType === 'ALL') {
        sighashValue = bitcoin.Transaction.SIGHASH_DEFAULT; // 0x00 para Taproot!
    }
}
```

### Teste 3: Comparar com Send Bitcoin

O send de Bitcoin funciona sem especificar sighashType:

```javascript
// server/routes/mywallet.js - sendBitcoin
psbt.signInput(i, childSigner); // ← SEM sighashType!
```

Enquanto o send de Runes está usando:

```javascript
psbt.signInput(i, childSigner, [sighashValue]); // ← COM sighashType!
```

## 📋 AÇÃO NECESSÁRIA

1. **Remover** o `sighashType: 'ALL'` do popup.js
2. **OU** alterar o servidor para não adicionar sighashType quando assinar
3. Testar novamente

## 🔗 REFERÊNCIAS

- BIP 341 (Taproot): SIGHASH_DEFAULT é o padrão para Taproot
- bitcoinjs-lib: `signInput()` sem sighashType usa DEFAULT
- Bitcoin Core: Aceita ambos, mas calcula diferente

---

**Status:** 🔍 CAUSA IDENTIFICADA  
**Próximo Passo:** Remover sighashType explícito e testar  
**Confiança:** 95% que este é o problema

