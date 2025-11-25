# ⚠️  PROBLEMA FUNDAMENTAL - Runes Send

## 📊 SITUAÇÃO ATUAL

Após múltiplas tentativas e correções:

1. ✅ SIGHASH corrigido (removido `SIGHASH_ALL` explícito)
2. ✅ `tapInternalKey` correto (verificado matematicamente)
3. ✅ PSBT construído corretamente
4. ✅ Assinaturas Schnorr de 64 bytes (DEFAULT)
5. ✅ Runestone válido (OP_RETURN + OP_13)
6. ❌ **AINDA FALHA** com `-26: scriptpubkey`

## 🔍 COMPARAÇÃO: Bitcoin Send vs Runes Send

### Bitcoin Send (FUNCIONA ✅)
```
Inputs: Pure Bitcoin UTXOs
Outputs:
  1. Destinatário (BTC)
  2. Change (BTC)
```

### Runes Send (FALHA ❌)
```
Inputs: UTXOs com Runes
Outputs:
  0. OP_RETURN (Runestone) ← DIFERENÇA CRÍTICA!
  1. Destinatário (Rune)
  2. Change (Rune/BTC)
```

## 🎯 HIPÓTESE FINAL

O problema pode estar em como **bitcoinjs-lib** calcula o sighash quando há um **OP_RETURN no output 0**.

Para Taproot (BIP 341), o sighash inclui **todos os outputs**. Se o OP_RETURN está malformado ou se bitcoinjs-lib não está lidando corretamente com ele, a assinatura será inválida.

## 🛠️ SOLUÇÕES POSSÍVEIS

### Opção 1: Usar Bitcoin Core para Assinar
Ao invés de usar bitcoinjs-lib, usar o Bitcoin Core RPC `walletprocesspsbt`:

```javascript
// Importar wallet no Bitcoin Core
const result = await bitcoinRpc.walletProcessPsbt(psbtBase64);
// Bitcoin Core lida com Taproot + Runes nativamente
```

### Opção 2: Usar Biblioteca Específica de Runes
Bibliotecas como `@magiceden/runestone` ou `ordinals` que foram testadas com Runes.

### Opção 3: Debugar Sighash Manualmente
Calcular o sighash manualmente e comparar com o que bitcoinjs-lib está gerando.

## 📋 RECOMENDAÇÃO IMEDIATA

**Vamos tentar usar o Bitcoin Core para assinar o PSBT!**

Bitcoin Core 30.0 suporta Runes nativamente e já demonstrou que consegue validar PSBTs de Runes (vimos nos logs anteriores).

### Implementação:

1. Build PSBT (já funciona)
2. **Import wallet no Bitcoin Core** com o mnemonic
3. **`walletprocesspsbt`** - Bitcoin Core assina
4. **Finalize** - Bitcoin Core finaliza
5. **Broadcast** - Bitcoin Core ou APIs

Isso elimina qualquer problema com bitcoinjs-lib e usa o código nativo do Bitcoin Core que **definitivamente** funciona com Runes.

---

**Status:** ⚠️  BLOQUEADO - bitcoinjs-lib pode não estar lidando corretamente com Runes  
**Próximo Passo:** Tentar assinatura via Bitcoin Core RPC  
**Alternativa:** Usar biblioteca específica de Runes

