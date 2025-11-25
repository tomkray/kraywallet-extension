# 🔬 ANÁLISE FINAL: Protocolo Runes vs Nossa Implementação

## 📊 TRANSAÇÃO DE REFERÊNCIA (BEM-SUCEDIDA)

**TXID:** `0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28`

### Estrutura da Transação:

```
Inputs: 2 UTXOs (contêm as runes)

Outputs:
  0: 0 sats       → OP_RETURN: 6a5d0a00c0a2330380c2d72f02
  1: 546 sats     → bc1prw82lkl…  (sender - change)
  2: 546 sats     → bc1pvz02d8z…  (recipient)
  3: 53115 sats   → bc1prw82lkl…  (BTC change)
```

### Runestone Decodificado:

```
Hex: 6a5d0a00c0a2330380c2d72f02
     │ │ │              │      │
     │ │ └─ Tag         │      └─ Output index
     │ └─── OP_13       │
     └───── OP_RETURN   └─────── Edict data

Decoded (LEB128): [10, 0, 840000, 3, 100000000, 2]

Estrutura:
  [0] Tag: 10          (BODY - contém edicts)
  [1] Delimiter: 0     (separa tag do corpo)
  [2] Block: 840000    (altura do bloco da rune)
  [3] TX: 3            (índice da tx que criou a rune)
  [4] Amount: 100M     (quantidade de runes a transferir)
  [5] Output: 2        (índice do output que recebe as runes)
```

---

## 🔍 ESTRUTURA DO PROTOCOLO RUNES

### Tags do Runestone:

Baseado na análise de transações reais e no código do `ord`:

- **Tag 0**: Body (contém edicts - transferências)
- **Tag 2**: Flags (marca características especiais)
- **Tag 4**: Default output
- **Tag 6**: Deadline (prazo para mint)
- **Tag 8**: Limit (limite de mint)
- **Tag 10**: Pointer (aponta para output específico)
- **Tag 12**: Refund

### ⚠️ IMPORTANTE: Tag 10 vs Tag 0

**Nossa análise revelou:**
- A transação bem-sucedida usa **Tag 10** (não Tag 0!)
- Tag 10 = **Pointer** (aponta para qual output recebe as runes)
- Tag 0 = **Body** (usado quando há múltiplos edicts complexos)

**Para envios simples:**
- Use **Tag 10** com formato: `[10, 0, block, tx, amount, output_index]`
- Mais eficiente e direto

**Para envios com múltiplos destinatários:**
- Use **Tag 0** com edicts: `[0, edict1, edict2, ...]`

---

## ✅ NOSSA IMPLEMENTAÇÃO CORRIGIDA

### Código Atual (psbtBuilderRunes.js):

```javascript
// SEMPRE criar 2 edicts (mesmo com change=0)
buildRunestoneWith2Edicts({
    runeId: { block: 840000, tx: 3 },
    changeAmount: 0,     // Pode ser 0
    changeOutput: 1,     // Output do sender
    sendAmount: 1000,
    sendOutput: 2        // Output do recipient
})

// Estrutura dos Outputs (SEMPRE 4!):
Output 0: OP_RETURN (Runestone)
Output 1: 546 sats → Sender (rune change, pode ser 0)
Output 2: 546 sats → Recipient (rune send)
Output 3: BTC change
```

### Runestone Gerado (com 2 edicts):

```
Tag 10, Delimiter 0:
  Edict 1: [840000, 3, 0, 1]        (change=0 para output 1)
  Edict 2: [0, 0, 1000, 2]          (send=1000 para output 2)
```

---

## 🎯 POSSÍVEL PROBLEMA REMANESCENTE

### Hipótese: Usar 1 Edict em vez de 2

A transação de referência usa **1 ÚNICO EDICT** (com Tag 10):
```
[10, 0, 840000, 3, 100000000, 2]
```

Talvez quando não há change, devemos usar **1 edict simples** em vez de 2 edicts!

### Proposta de Correção:

```javascript
// QUANDO NÃO HÁ CHANGE:
if (change === 0n) {
    // Usar Tag 10 (Pointer) com 1 edict simples
    runestone = buildSimpleRunestone({
        runeId: { block, tx },
        amount: amount,
        output: 2  // SEMPRE output 2 (recipient)
    });
}

// QUANDO HÁ CHANGE:
else {
    // Usar 2 edicts
    runestone = buildRunestoneWith2Edicts({...});
}

// MAS SEMPRE 4 OUTPUTS!
```

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ **FEITO**: Corrigir estrutura para SEMPRE ter 4 outputs
2. ⏳ **TESTAR**: Verificar se funciona com 2 edicts
3. 🔄 **ALTERNATIVA**: Se falhar, tentar com 1 edict simples (Tag 10)

---

## 📋 RESUMO

| Aspecto | Transação Real | Nossa Impl (Antes) | Nossa Impl (Agora) |
|---------|----------------|-------------------|-------------------|
| Outputs | 4 | 3 ❌ | 4 ✅ |
| Tag | 10 (Pointer) | 10 ✅ | 10 ✅ |
| Edict Count | 1 | 1 ✅ | 2 ⚠️ |
| Output Index | 2 | 1 ❌ | 2 ✅ |
| Dust Limits | 546 sats | 546 sats ✅ | 546 sats ✅ |

**Conclusão:**
- Estrutura de outputs: ✅ CORRIGIDA
- Índice de output: ✅ CORRIGIDO
- Número de edicts: ⚠️ PODE SER O PROBLEMA!

**Próximo teste:**
- Se falhar com 2 edicts, mudar para 1 edict simples

