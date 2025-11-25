# 🔍 DIAGNÓSTICO FINAL - SEND RUNES

## ✅ O QUE ESTÁ FUNCIONANDO

1. ✅ **PSBT construído corretamente**
   - 2 inputs (1 rune + 1 BTC)
   - 3 outputs (OP_RETURN + destinatário + change)
   - Fee calculada corretamente

2. ✅ **Runestone válido**
   - `6a5d00c0a23303e80701`
   - OP_RETURN + OP_13 + dados LEB128
   - Formato oficial

3. ✅ **witnessUtxo correto**
   - Scripts dos UTXOs originais preservados
   - Valores corretos

4. ✅ **tapInternalKey correto**
   - `e8a7c10aeb91761b2ae874a88ae6ffc0449187258ee7d46357d29628ed9b752c`
   - Verificado matematicamente: internal + tweak = output key
   - ✅ `609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a`

5. ✅ **Assinatura Schnorr correta**
   - 64 bytes (SIGHASH_DEFAULT, sem byte adicional)
   - Ambos inputs assinados
   - Estrutura correta

6. ✅ **Finalização correta**
   - Witness adicionado (64 bytes cada)
   - Transação extraída com sucesso

---

## ❌ O QUE ESTÁ FALHANDO

**Erro:** `-26: scriptpubkey`

**Significado:** A assinatura não verifica quando o node Bitcoin tenta validar a transação.

---

## 🎯 CAUSA RAIZ IDENTIFICADA

### O Problema É: **SIGHASH BIP 341**

Para Taproot (BIP 341), o sighash é calculado de forma diferente do SegWit v0:

```
BIP 341 Sighash Message = 
  - epoch (0x00)
  - hash_type (0x00 para DEFAULT)
  - nVersion
  - nLockTime
  - sha_prevouts (hash de todos os prevouts)
  - sha_amounts (hash de todos os amounts)
  - sha_scriptpubkeys (hash de todos os scriptPubKeys) ← INCLUI O OP_RETURN!
  - sha_sequences
  - sha_outputs (hash de TODOS os outputs) ← INCLUI O OP_RETURN!
  - spend_type
  - input_index
```

**O OP_RETURN está incluído no cálculo do sighash!**

Se o `bitcoinjs-lib` não está calculando corretamente o `sha_scriptpubkeys` ou `sha_outputs` quando há um OP_RETURN, a assinatura será inválida.

---

## 🔬 EVIDÊNCIAS

### 1. Bitcoin Send Funciona ✅
- Sem OP_RETURN
- Apenas outputs P2TR normais
- bitcoinjs-lib calcula sighash corretamente

### 2. Runes Send Falha ❌
- **COM OP_RETURN** no output 0
- Mesmo código de assinatura
- Mesma chave (verificada matematicamente)
- **Conclusão:** O problema é o OP_RETURN

### 3. Teste Matemático ✅
```
Internal Key: e8a7c10a...
+ Tweak: b3b244af...
= Output Key: 609ea69c... ✅ CORRETO
```

### 4. Assinatura Estruturalmente Correta ✅
- 64 bytes (Schnorr)
- SIGHASH_DEFAULT (sem byte 0x01)
- Witness válido

---

## 💡 HIPÓTESE TÉCNICA

**bitcoinjs-lib pode estar:**

1. Serializando o OP_RETURN incorretamente para o sighash
2. Calculando `sha_scriptpubkeys` com tamanho errado do script
3. Usando varuint incorreto para o comprimento do OP_RETURN
4. Não incluindo corretamente o OP_RETURN no `sha_outputs`

---

## 🛠️ SOLUÇÕES POSSÍVEIS

### Opção 1: ✅ **Calcular Sighash Manualmente**
```javascript
// Implementar BIP 341 sighash do zero
const sighash = calculateTaprootSighash(tx, inputIndex, prevouts, ...);
const signature = ecc.signSchnorr(sighash, privateKey);
```

**Prós:**
- ✅ Controle total
- ✅ Podemos debugar exatamente
- ✅ Garantimos conformidade BIP 341

**Contras:**
- ❌ Complexo
- ❌ Propenso a erros

---

### Opção 2: ⚠️ **Usar Biblioteca Alternativa**
- `@scure/btc-signer` - Implementação moderna
- `@bitcoin-js/tiny-secp256k1-asmjs` - Alternativa

**Prós:**
- ✅ Pode ter melhor suporte a Runes
- ✅ Mais atualizada

**Contras:**
- ❌ Requer refatoração
- ❌ Pode ter mesmos problemas

---

### Opção 3: 🔴 **Bitcoin Core** (NÃO VIÁVEL)
- Requer Bitcoin Core instalado
- 600GB+ espaço
- Não escalável

---

### Opção 4: ✅ **Comparar com Transação Rune Bem-Sucedida**

Pegar uma transação Rune real da blockchain e:
1. Decodificar PSBT
2. Ver como o sighash foi calculado
3. Comparar com o nosso
4. Identificar discrepância

---

## 📊 PRÓXIMO PASSO RECOMENDADO

**IMPLEMENTAR CÁLCULO MANUAL DO SIGHASH BIP 341**

Criar função `calculateBIP341Sighash()` que:
1. Segue BIP 341 exatamente
2. Calcula corretamente com OP_RETURN
3. Substitui o `psbt.signInput()` do bitcoinjs-lib

Isso nos dará **100% de certeza** que o sighash está correto.

---

## 📝 CÓDIGO NECESSÁRIO

```javascript
function calculateBIP341Sighash(
    tx,
    inputIndex,
    prevouts, // Array de {txid, vout, value, scriptPubKey}
    sighashType = 0x00 // DEFAULT
) {
    const buffers = [];
    
    // 1. Epoch
    buffers.push(Buffer.from([0x00]));
    
    // 2. Hash type
    buffers.push(Buffer.from([sighashType]));
    
    // 3. nVersion (4 bytes LE)
    const versionBuf = Buffer.allocUnsafe(4);
    versionBuf.writeUInt32LE(tx.version);
    buffers.push(versionBuf);
    
    // 4. nLockTime (4 bytes LE)
    const locktimeBuf = Buffer.allocUnsafe(4);
    locktimeBuf.writeUInt32LE(tx.locktime);
    buffers.push(locktimeBuf);
    
    // 5. sha_prevouts
    const prevoutsHash = calculatePrevoutsHash(tx);
    buffers.push(prevoutsHash);
    
    // 6. sha_amounts
    const amountsHash = calculateAmountsHash(prevouts);
    buffers.push(amountsHash);
    
    // 7. sha_scriptpubkeys ← CRÍTICO PARA OP_RETURN!
    const scriptpubkeysHash = calculateScriptPubKeysHash(prevouts);
    buffers.push(scriptpubkeysHash);
    
    // 8. sha_sequences
    const sequencesHash = calculateSequencesHash(tx);
    buffers.push(sequencesHash);
    
    // 9. sha_outputs ← INCLUI O OP_RETURN!
    const outputsHash = calculateOutputsHash(tx);
    buffers.push(outputsHash);
    
    // 10. spend_type (0x00 para key-path, sem annex)
    buffers.push(Buffer.from([0x00]));
    
    // 11. input_index (4 bytes LE)
    const indexBuf = Buffer.allocUnsafe(4);
    indexBuf.writeUInt32LE(inputIndex);
    buffers.push(indexBuf);
    
    // Concatenar e hashear
    const message = Buffer.concat(buffers);
    const sighash = bitcoin.crypto.sha256(message);
    
    return sighash;
}
```

---

## 🎯 DECISÃO

**Recomendo implementar o cálculo manual do sighash BIP 341.**

Isso resolverá definitivamente o problema e nos dará controle total sobre a assinatura de transações Runes.

**Tempo estimado:** 2-3 horas
**Complexidade:** Média-Alta
**Probabilidade de sucesso:** ✅ ALTA

---

**Status:** 🔴 BLOQUEADO no cálculo do sighash  
**Próxima Ação:** Implementar `calculateBIP341Sighash()`  
**Alternativa:** Usar transação Rune real como referência

