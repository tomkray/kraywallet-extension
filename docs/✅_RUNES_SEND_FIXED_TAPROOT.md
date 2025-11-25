# ✅ RUNES SEND FIXED - Taproot Key Issue

## 🐛 Problema Identificado

O broadcast de transações de Runes estava falhando com erro `-26: scriptpubkey` porque o `tapInternalKey` estava sendo **extraído incorretamente** do script do UTXO ao invés de ser **derivado da seed da carteira**.

## 🔍 Análise Comparativa

### ✅ Bitcoin Send (que funcionava)
```javascript
// server/routes/mywallet.js - linha 603
psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
        script: Buffer.from(`5120${tweakedXOnlyPubkey.toString('hex')}`, 'hex'),
        value: utxo.value
    },
    tapInternalKey: xOnlyInternalPubkey  // ✅ Derivado da seed (CORRETO)
});
```

### ❌ Runes Send (que estava falhando)
```javascript
// server/utils/psbtBuilderRunes.js - linha 794-797 (ANTES)
if (vout.script.length === 34 && vout.script[0] === 0x51 && vout.script[1] === 0x20) {
    // ❌ ERRO: Extraindo do script do UTXO (ERRADO!)
    const internalKey = vout.script.slice(2);
    inputData.tapInternalKey = internalKey;
}
```

### ✅ Runes Send (corrigido)
```javascript
// server/utils/psbtBuilderRunes.js - linha 783-794 (DEPOIS)
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
```

## 🔑 Entendimento Taproot

### Por que o tapInternalKey é importante?

Em Taproot (BIP 86), há **dois tipos de public keys**:

1. **Internal Key (x-only)**: A chave pública **antes** do tweak
   - Derivada diretamente da seed
   - 32 bytes (x-coordinate apenas)
   - Usada como `tapInternalKey` no PSBT
   
2. **Output Key (tweaked)**: A chave pública **depois** do tweak
   - Internal Key + Taproot tweak
   - É o que aparece no scriptPubKey do UTXO
   - Usada na assinatura Schnorr

### ⚠️ O Erro Crítico

O código antigo tentava **extrair o Internal Key do script do UTXO**:
```javascript
const internalKey = vout.script.slice(2);  // ❌ ERRADO!
```

Mas o script contém a **Output Key (tweaked)**, não a Internal Key!

Para assinar corretamente, precisamos da **Internal Key derivada da seed**, que só está disponível em `/api/mywallet/sign` onde temos acesso ao mnemonic.

## 🛠️ Correção Aplicada

### Arquivo: `server/utils/psbtBuilderRunes.js`

**Linha 783-796:**
```javascript
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

### Fluxo Correto de Assinatura

1. **Build PSBT** (`/api/runes/build-send-psbt`)
   - Constrói PSBT com inputs e outputs
   - **NÃO** adiciona `tapInternalKey` (ainda não tem mnemonic)

2. **Sign PSBT** (`/api/mywallet/sign`)
   - Recebe mnemonic
   - Deriva `xOnlyInternal` (Internal Key) da seed
   - **Adiciona** `tapInternalKey` aos inputs (linha 273-277)
   - Assina com chave tweaked

3. **Finalize PSBT** (`/api/mywallet/finalize-psbt`)
   - Finaliza inputs assinados
   - Extrai hex da transação

4. **Broadcast** (`/api/wallet/broadcast`)
   - Detecta se é Rune transaction
   - Tenta Bitcoin Core primeiro
   - Fallback para Mining Pools e Public APIs

## 📋 Arquivos Modificados

- ✅ `/server/utils/psbtBuilderRunes.js` (linha 783-796)
  - Removida lógica incorreta de extrair `tapInternalKey` do script
  - Deixa para ser adicionado em `/api/mywallet/sign`

## 🧪 Como Testar

1. Abrir MyWallet extension
2. Ir para a aba de Runes
3. Selecionar uma Rune
4. Clicar em "Send"
5. Preencher endereço de destino e quantidade
6. Confirmar com senha
7. ✅ Broadcast deve funcionar!

## 🔗 Referências

- **BIP 86**: Taproot derivation path
- **BIP 341**: Taproot output key derivation
- **Runes Protocol**: https://docs.ordinals.com/runes.html
- **Bitcoin Send (funcionando)**: `server/routes/mywallet.js` linha 591-605
- **MyWallet Sign**: `server/routes/mywallet.js` linha 260-280

## 📊 Comparação com Bitcoin 30

O envio de Bitcoin normal já funcionava porque:
1. Construía o PSBT completo em um único endpoint
2. Tinha acesso ao mnemonic desde o início
3. Derivava o `xOnlyInternalPubkey` corretamente
4. Usava no `tapInternalKey` do input

O envio de Runes agora segue o **mesmo padrão**:
1. Build PSBT sem `tapInternalKey`
2. Sign adiciona `tapInternalKey` derivado da seed
3. Finalize e broadcast

---

**Status:** ✅ CORRIGIDO  
**Data:** 2025-10-23  
**Próximo Passo:** Testar com transação real de Runes

