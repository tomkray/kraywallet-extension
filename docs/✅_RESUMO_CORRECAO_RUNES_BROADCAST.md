# ✅ RESUMO: Correção do Broadcast de Runes

## 🎯 Problema Original

O envio de Runes na MyWallet estava **falhando no broadcast** com erro `-26: scriptpubkey`.

**Sintomas:**
- ✅ PSBT era construído corretamente
- ✅ PSBT era assinado com sucesso
- ✅ PSBT era finalizado sem erros
- ❌ Broadcast falhava em todas as APIs (Bitcoin Core, F2Pool, Mempool.space, etc)

## 🔍 Causa Raiz

O problema estava em **como o `tapInternalKey` era adicionado** aos inputs do PSBT.

### ❌ Código Antigo (ERRADO)
```javascript
// server/utils/psbtBuilderRunes.js - linha 794-797
if (vout.script.length === 34 && vout.script[0] === 0x51 && vout.script[1] === 0x20) {
    // ❌ ERRO: Tentava extrair Internal Key do script do UTXO
    const internalKey = vout.script.slice(2);
    inputData.tapInternalKey = internalKey;
}
```

**Por que estava errado?**
- O script do UTXO contém a **Output Key (tweaked)**, não a Internal Key
- Para assinar Taproot corretamente, precisamos da **Internal Key derivada da seed**
- Usar a Output Key como Internal Key resulta em assinatura inválida
- Bitcoin Core rejeita com `-26: scriptpubkey` (script inválido)

## ✅ Solução Implementada

### Mudança no Fluxo

**ANTES:**
```
buildRuneSendPSBT() → adiciona tapInternalKey ERRADO do script
      ↓
sign() → assina com chave errada
      ↓
❌ broadcast falha
```

**DEPOIS:**
```
buildRuneSendPSBT() → NÃO adiciona tapInternalKey
      ↓
sign() → deriva xOnlyInternal da seed e ADICIONA tapInternalKey CORRETO
      ↓
✅ broadcast funciona!
```

### ✅ Código Novo (CORRETO)
```javascript
// server/utils/psbtBuilderRunes.js - linha 783-796
// ✅ CRÍTICO: Usar o script EXATO do UTXO original
// O tapInternalKey será adicionado na hora da assinatura (em /api/mywallet/sign)
// pois só lá temos acesso ao mnemonic para derivar a chave correta
const inputData = {
    hash: input.txid,
    index: input.vout,
    witnessUtxo: {
        script: vout.script,  // Script EXATO do UTXO
        value: vout.value
    }
    // NÃO adicionar tapInternalKey aqui! Será adicionado em /api/mywallet/sign
};

psbt.addInput(inputData);
```

### Como o Sign Adiciona Corretamente
```javascript
// server/routes/mywallet.js - linha 209-277
// 1. Derivar Internal Key da seed
const xOnlyInternal = Buffer.from(childRaw.publicKey.subarray(1, 33));

// 2. Adicionar aos inputs que não têm
if (!input.tapInternalKey) {
    psbtObj.updateInput(i, {
        tapInternalKey: xOnlyInternal  // ✅ Internal Key derivada da seed
    });
}

// 3. Assinar com tweaked key
psbt.signInput(i, childSigner);
```

## 🔑 Conceitos Taproot (BIP 341)

### Internal Key vs Output Key

1. **Internal Key (x-only, 32 bytes)**
   - Derivada da seed: `derivePath("m/86'/0'/0'/0/0")`
   - Pública x-coordinate apenas (sem prefixo 02/03)
   - Usada como `tapInternalKey` no PSBT
   - **NÃO** aparece diretamente no blockchain

2. **Output Key (tweaked)**
   - `Output Key = Internal Key + TapTweak`
   - Esta é a que vai no scriptPubKey do UTXO
   - É o que aparece no blockchain
   - É o que está em `vout.script.slice(2)`

### Por Que Precisa do Internal Key?

Para assinar uma transação Taproot:
1. Pegar Internal Key da seed
2. Calcular tweak: `TapTweak = SHA256("TapTweak" || Internal Key)`
3. Calcular chave privada tweaked: `tweakedPrivKey = privKey + tweak`
4. Assinar mensagem com `tweakedPrivKey` (Schnorr)

Se usar a Output Key como Internal Key:
- O tweak será calculado errado
- A chave privada tweaked será errada
- A assinatura será inválida
- Bitcoin Core rejeita a transação

## 📊 Comparação com Bitcoin Send

O envio de **Bitcoin normal** já funcionava porque:

```javascript
// server/routes/mywallet.js - linha 515-603
// Deriva keys da seed
const xOnlyInternal = Buffer.from(childRaw.publicKey.subarray(1, 33));
const tweakedPrivateKey = ecc.privateAdd(childRaw.privateKey, tapTweak);

// Adiciona input com tapInternalKey CORRETO desde o início
psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
        script: Buffer.from(`5120${tweakedXOnlyPubkey.toString('hex')}`, 'hex'),
        value: utxo.value
    },
    tapInternalKey: xOnlyInternalPubkey  // ✅ Derivado da seed
});
```

O envio de **Runes** agora segue o mesmo padrão:
1. Build PSBT sem `tapInternalKey`
2. Sign adiciona `tapInternalKey` derivado da seed
3. Finalize e broadcast

## 📁 Arquivos Modificados

### 1. `/server/utils/psbtBuilderRunes.js`
**Linha 783-796:**
- ❌ Removida lógica incorreta que extraia `tapInternalKey` do script
- ✅ Agora deixa para ser adicionado em `/api/mywallet/sign`

## 🧪 Como Testar

Ver arquivo: `TEST_RUNES_SEND_NOW.md`

## 📚 Referências

- **BIP 86**: Key derivation for single key P2TR outputs
- **BIP 341**: Taproot: SegWit version 1 spending rules
- **BIP 340**: Schnorr Signatures for secp256k1
- **Runes Protocol**: https://docs.ordinals.com/runes.html

## 🎯 Resultado Esperado

### ✅ Agora Deve Funcionar

1. **PSBT construído** com script correto do UTXO
2. **PSBT assinado** com `tapInternalKey` derivado da seed
3. **PSBT finalizado** com assinatura válida
4. **Broadcast aceito** por Bitcoin Core / Mining Pools

### 🔗 Fluxo Completo

```
Frontend → /api/runes/build-send-psbt
              ↓ PSBT (sem tapInternalKey)
          /api/mywallet/sign (com mnemonic)
              ↓ Deriva xOnlyInternal da seed
              ↓ Adiciona tapInternalKey aos inputs
              ↓ Assina com tweaked key
              ↓ PSBT assinado
          /api/mywallet/finalize-psbt
              ↓ Finaliza inputs
              ↓ Extrai hex
          /api/wallet/broadcast
              ↓ Detecta Rune transaction
              ↓ Tenta Bitcoin Core primeiro
              ↓ Fallback para F2Pool/Mempool.space
              ✅ TXID retornado!
```

## 🚀 Status

- ✅ **Correção Aplicada**: `server/utils/psbtBuilderRunes.js`
- ✅ **Linting**: Sem erros
- ✅ **Documentação**: Completa
- ⏳ **Teste Real**: Aguardando usuário testar com rune real

---

**Data:** 2025-10-23  
**Autor:** AI Assistant  
**Próximo Passo:** Usuário testar envio de rune real no MyWallet

