# 🎯 IMPLEMENTAÇÃO SIGHASH_ANYONECANPAY | SIGHASH_SINGLE

## 📋 O QUE É SIGHASH?

SIGHASH define **o que é assinado** em uma transação Bitcoin:

- `SIGHASH_ALL` (padrão): Assina **TODOS** inputs e **TODOS** outputs
- `SIGHASH_SINGLE`: Assina **1 input** → **1 output** (mesmo índice)
- `SIGHASH_ANYONECANPAY`: Permite **adicionar inputs** depois

## 🔥 COMBINAÇÃO PARA ATOMIC SWAPS

**SIGHASH_SINGLE | SIGHASH_ANYONECANPAY** = `0x83` (131)

### O que isso permite:
✅ Vendedor assina: `Input 0 (inscription) → Output 0 (payment para vendedor)`
✅ Comprador PODE ADICIONAR: `Input 1, 2, 3... (seus UTXOs)`
✅ Comprador PODE ADICIONAR: `Output 1 (inscription para ele), Output 2 (change)`

## 🏗️ IMPLEMENTAÇÃO

### 1. Backend: Vendedor assina com SIGHASH_SINGLE | ANYONECANPAY

**Problema:** Unisat wallet **NÃO suporta** especificar `sighashType` customizado!

**Solução:** Usar Bitcoin Core RPC para assinar:
```javascript
bitcoinRpc.walletprocesspsbt(psbt, true, "ALL|ANYONECANPAY")
```

### 2. Estrutura do PSBT do Vendedor

```
Input 0: inscription UTXO (vendedor)
Output 0: payment → vendedor (1000 sats)
```

**Assinatura:** SIGHASH_SINGLE | ANYONECANPAY (0x83)

### 3. Comprador Adiciona

```
Input 0: [JÁ ASSINADO] inscription UTXO (vendedor)
Input 1: UTXO do comprador (pagamento)
Input 2: UTXO do comprador (se necessário)

Output 0: [JÁ DEFINIDO] payment → vendedor (1000 sats)
Output 1: inscription → comprador (546 sats)
Output 2: change → comprador
```

**Comprador assina:** Input 1 e 2 com `SIGHASH_ALL` (padrão)

## ⚠️ LIMITAÇÃO DESCOBERTA

**Unisat wallet NÃO permite especificar `sighashType`!**

Método disponível:
```javascript
unisat.signPsbt(psbt, options)
```

`options` NÃO tem campo `sighashType`!

## 🎯 DUAS SOLUÇÕES

### A) Usar Bitcoin Core para vendedor assinar

```javascript
// Backend assina com sighashType correto
const signed = await bitcoinRpc.walletprocesspsbt(psbt, true, "SINGLE|ANYONECANPAY");
```

**Problema:** Requer Bitcoin Core com wallet do vendedor

### B) Usar Ordinais Protocol (ord)

```bash
ord wallet inscribe --sign-sighash=SINGLE|ANYONECANPAY
```

**Problema:** Mais complexo

## 🚀 IMPLEMENTAÇÃO FINAL ESCOLHIDA

Vamos usar **Bitcoin Core RPC** para:
1. Importar chave privada do vendedor (temporariamente)
2. Assinar PSBT com `SIGHASH_SINGLE | ANYONECANPAY`
3. Exportar PSBT assinado

**IMPORTANTE:** Isso requer Bitcoin Core rodando localmente!

---

## 📝 PRÓXIMOS PASSOS

1. Criar endpoint `/api/sell/sign-with-sighash`
2. Usar Bitcoin Core RPC para assinar com sighashType correto
3. Testar atomic swap completo

**Status:** Implementando...



