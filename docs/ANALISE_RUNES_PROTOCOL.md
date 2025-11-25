# 🔍 ANÁLISE: Nossa Implementação vs Protocolo Runes Oficial

## 📚 Protocolo Runes (Ordinals.com)

### Estrutura de um Runestone:

1. **OP_RETURN** (0x6a) - Marca script como dados
2. **OP_13** (0x5d) - Identificador do protocolo Runes
3. **Dados LEB128** - Codificados em Little Endian Base 128

### Tags do Runestone:
- **Tag 0**: Body (edicts - transferências)
- **Tag 2**: Flags  
- **Tag 4**: Default output (output padrão para runes não especificadas)
- **Tag 6**: Deadline
- **Tag 8**: Limit
- **Tag 10**: Pointer (aponta para output que recebe runes)
- **Tag 12**: Refund

### Formato de um Edict:
- `rune_id_block` (LEB128)
- `rune_id_tx` (LEB128)  
- `amount` (LEB128)
- `output` (LEB128)

### Regras Importantes:

1. **Primeira Rune**: Usa valores ABSOLUTOS (block, tx)
2. **Runes Seguintes**: Usam DELTAS relativos à anterior
3. **Outputs**: Indexados a partir de 0 (0 = OP_RETURN, 1 = primeiro output real, etc)

---

## 🔧 NOSSA IMPLEMENTAÇÃO ATUAL

### Código: `server/utils/psbtBuilderRunes.js`

#### 1 Edict (SEM change):
```javascript
const values = [
    10,               // Tag 10 = Body
    0,                // Delimiter
    840000,           // Block height
    3,                // TX index
    1000,             // Amount
    1                 // Output index
];
```

**OP_RETURN gerado**: `6a5d0a00c0a23303e80701`

#### 2 Edicts (COM change):
```javascript
const values = [
    10,                // Tag 10 = Body
    0,                 // Delimiter
    840000,            // Edict 1: Block height
    3,                 // Edict 1: TX index
    500,               // Edict 1: Change amount
    1,                 // Edict 1: Change output
    0,                 // Edict 2: Block delta (mesma rune)
    0,                 // Edict 2: TX delta (mesma rune)
    500,               // Edict 2: Send amount
    2                  // Edict 2: Send output
];
```

**OP_RETURN gerado**: `6a5d0a00c0a23303f403010000f40302`

---

## ⚠️ PROBLEMA IDENTIFICADO

### Tag INCORRETA!

Estamos usando **Tag 10** quando deveríamos usar **Tag 0**!

Segundo a especificação:
- **Tag 0** = Body (contém edicts)
- **Tag 10** = Pointer (aponta para output específico)

### Transação Bem-Sucedida (referência):
```
6a5d0a00c0a2330380c2d72f02
```

Decodificado: `[10, 0, 840000, 3, 100000000, 2]`

**ANÁLISE**: Esta transação também usa Tag 10! 🤔

Mas espere... Se ela funciona com Tag 10, por que a nossa não funciona?

---

## 🔬 COMPARAÇÃO DETALHADA

### Transação que FUNCIONA:
- **Hex**: `6a5d0a00c0a2330380c2d72f02`
- **Decoded**: `[10, 0, 840000, 3, 100000000, 2]`
- **Estrutura**: Tag 10, Delimiter, Block, TX, Amount, Output
- **Outputs**: 4 outputs (OP_RETURN, change addr, recipient, BTC change)

### Nossa Transação (NÃO funciona):
- **Hex**: `6a5d0a00c0a23303e80701`
- **Decoded**: `[10, 0, 840000, 3, 1000, 1]`
- **Estrutura**: Tag 10, Delimiter, Block, TX, Amount, Output
- **Outputs**: 3 outputs (OP_RETURN, recipient, BTC change)

---

## 💡 HIPÓTESE

O problema pode não ser a Tag, mas sim:

1. **UTXO que contém as runes**: Estamos gastando um UTXO que NÃO CONTÉM as runes que estamos tentando enviar!

2. **Input inválido**: O UTXO que o ORD server diz que tem runes pode estar desatualizado ou incorreto.

3. **Protocolo Runes**: As runes só podem ser transferidas se o INPUT realmente as contiver!

---

## 🎯 PRÓXIMOS PASSOS

1. **Verificar se o UTXO realmente contém as runes** antes de construir a transação
2. **Consultar a blockchain** (não o ORD server) para confirmar
3. **Validar que o UTXO não foi gasto**
4. **Testar com um UTXO que SABEMOS que contém runes**

---

## 📋 CONCLUSÃO TEMPORÁRIA

Nossa implementação do Runestone PARECE correta (Tag 10 + Delimiter + Edicts).

O problema mais provável é:
- ❌ **UTXO inválido ou já gasto**
- ❌ **UTXO não contém as runes que estamos tentando enviar**
- ❌ **ORD server retornando dados desatualizados**

Precisamos focar na **validação de UTXOs** antes da construção do PSBT!

