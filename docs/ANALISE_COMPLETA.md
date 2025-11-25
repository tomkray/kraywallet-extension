# 🔍 ANÁLISE COMPLETA - Runes Send Transaction

## 📊 O QUE ACONTECEU

### ✅ Etapa 1: Build PSBT - SUCESSO
```
📦 PSBT construído corretamente:
- 2 inputs (Taproot P2TR)
- 3 outputs:
  • Output 0: OP_RETURN com Runestone (0 sats)
  • Output 1: Rune para destinatário (546 sats)
  • Output 2: Change para remetente (9080 sats)
- Fee: 974 sats (3.90 sat/vB)
- ✅ Runestone correto: OP_RETURN + OP_13 + data
- ✅ Inputs SEM tapInternalKey (esperado nesta fase)
```

### ⏳ Etapa 2: Sign PSBT - EM ANÁLISE
```
Você clicou em "Sign & Send" e inseriu sua senha.
O PSBT foi enviado para /api/mywallet/sign com o mnemonic.
```

**O que deveria acontecer:**
1. Derivar xOnlyInternal da seed
2. Adicionar tapInternalKey aos 2 inputs
3. Criar tweaked private key
4. Assinar com Schnorr cada input
5. Retornar PSBT assinado

### ⏳ Etapa 3: Finalize PSBT - EM ANÁLISE
```
PSBT assinado foi enviado para /api/mywallet/finalize-psbt
```

**O que deveria acontecer:**
1. Finalizar cada input (adicionar witness)
2. Extrair hex da transação
3. Retornar hex

### ❌ Etapa 4: Broadcast - FALHOU
```
Erro: -26: scriptpubkey

Tentativas:
- F2Pool: erro
- ViaBTC: erro  
- Luxor: no healthy upstream
- Mempool.space: -26 scriptpubkey
- Blockstream.info: -26 scriptpubkey
```

## 🔍 POSSÍVEIS CAUSAS

### 1. ❌ Assinatura Inválida
**Sintoma:** Erro `-26: scriptpubkey` geralmente indica que a assinatura não bate com o scriptPubKey

**Causas possíveis:**
- tapInternalKey não foi adicionado corretamente
- tweaked private key calculada errada
- Assinatura Schnorr com chave errada

### 2. ❌ Witness Incorreto
**Sintoma:** Transaction finalizada tem witness malformado

**Causas possíveis:**
- finalizeInput() usando chave errada
- Witness format incorreto para Taproot

### 3. ❌ Runestone Inválido
**Sintoma:** Nodes rejeitam por causa do OP_RETURN

**Status:** ✅ Runestone está correto (verificado)

## 🛠️ PRÓXIMO PASSO - DEBUGAR TRANSAÇÃO ASSINADA

Precisamos ver:
1. **PSBT ASSINADO** (após /api/mywallet/sign)
   - tapInternalKey foi adicionado?
   - tapKeySig (assinatura) está presente?
   - Assinatura é válida?

2. **TRANSACTION HEX FINAL** (após /api/mywallet/finalize-psbt)
   - Witness está correto?
   - Assinaturas estão no lugar certo?

## 📋 LOGS NECESSÁRIOS

Para dar o veredito final, preciso ver:

### Do Console da Extension:
```javascript
console.log('✅ PSBT signed:', signResult.signedPsbt);  // PSBT em base64
console.log('✅ PSBT finalized');
console.log('   Hex length:', finalizeData.hex?.length);
console.log('   Hex:', finalizeData.hex);  // PRECISO DESTE!
```

### Do Terminal do Servidor:
```
🔏 Signing PSBT...
  📝 Input 0: Adding OUR tapInternalKey (...)
  ✅ Input 0 signed
  📝 Input 1: Adding OUR tapInternalKey (...)
  ✅ Input 1 signed
  ✅ PSBT signed (not finalized)

🔨 Finalizing PSBT...
  ✅ Input 0 finalized
  ✅ Input 1 finalized
  Hex: 02000000...  # PRECISO DESTE!
```

## 🎯 HIPÓTESE PRINCIPAL

Acredito que o problema está em **um dos seguintes**:

1. **tapInternalKey sendo adicionado ERRADO** no /api/mywallet/sign
   - Pode estar usando a Output Key ao invés da Internal Key
   
2. **Tweaked private key calculada ERRADA**
   - Y-coordinate não está sendo negada quando necessário
   
3. **Witness final malformado**
   - finalizeInput() não está gerando witness correto para Taproot

## 🔧 SOLUÇÃO TEMPORÁRIA - ADICIONAR MAIS LOGS

Vou modificar o código para logar mais detalhes!

