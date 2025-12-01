# 🔧 Bitcoin OP_RETURN: Como Criar Seu Próprio Protocolo

> **Guia Completo sobre o Espaço de Dados do Bitcoin**
> 
> Entenda como protocolos como Runes, Ordinals, BRC-20 e outros funcionam,
> e como você pode criar o seu próprio protocolo sobre Bitcoin.

---

## 📚 Índice

1. [O que é OP_RETURN?](#o-que-é-op_return)
2. [Protocolos Existentes](#protocolos-existentes)
3. [Anatomia do OP_RETURN](#anatomia-do-op_return)
4. [Como Criar Seu Próprio Protocolo](#como-criar-seu-próprio-protocolo)
5. [Exemplo Prático: KRAY State Anchoring](#exemplo-prático-kray-state-anchoring)
6. [Comparação de Protocolos](#comparação-de-protocolos)
7. [Limitações e Considerações](#limitações-e-considerações)

---

## O que é OP_RETURN?

O **OP_RETURN** é um opcode do Bitcoin Script que permite armazenar dados arbitrários na blockchain de forma **provably unspendable** (comprovadamente não-gastável).

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OP_RETURN OUTPUT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Limite: 80 bytes de dados por output                             │
│  • Custo: Apenas a taxa de mineração (~300-500 sats)               │
│  • Imutável: Uma vez confirmado, nunca muda                        │
│  • Não-gastável: O output não pode ser "gasto" como BTC            │
│  • Universal: Qualquer um pode escrever, qualquer um pode ler      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Por que usar OP_RETURN?

| Vantagem | Descrição |
|----------|-----------|
| **Imutabilidade** | Dados ficam permanentes na blockchain |
| **Prova de Existência** | Timestamp criptográfico garantido pelo Bitcoin |
| **Descentralização** | Qualquer full node pode verificar |
| **Custo Baixo** | Apenas taxa de mineração (sem armazenamento extra) |
| **Interoperabilidade** | Qualquer software pode ler e interpretar |

---

## Protocolos Existentes

### 🔶 RUNES (Casey Rodarmor, 2024)

O protocolo de tokens fungíveis mais eficiente do Bitcoin.

```
┌─────────────────────────────────────────────────────────────────────┐
│  RUNES PROTOCOL                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Magic Byte: OP_13 (0x5d)                                          │
│  Encoding: LEB128 (Little Endian Base 128)                         │
│  Format: 6a 5d [tamanho] [payload LEB128]                          │
│                                                                     │
│  Exemplo de TX KRAY:                                                │
│  6a 5d 0a 02 03 00 cc be 38 8e 0c 0a 00                            │
│  │  │  │  │  │  │  └────────────────────── Edicts (transfers)      │
│  │  │  │  │  │  └──────────────────────── Body tag                 │
│  │  │  │  │  └─────────────────────────── Pointer (output 3)       │
│  │  │  │  └────────────────────────────── Pointer tag              │
│  │  │  └───────────────────────────────── Payload size (10 bytes)  │
│  │  └──────────────────────────────────── OP_13 (Rune magic)       │
│  └─────────────────────────────────────── OP_RETURN                │
│                                                                     │
│  Reconhecido por: ordinals.com, Unisat, Magic Eden, OKX, etc.      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 🟠 ORDINALS (Casey Rodarmor, 2023)

O protocolo de NFTs nativos do Bitcoin.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ORDINALS PROTOCOL                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Location: Witness data (não usa OP_RETURN!)                       │
│  Format: Envelope com OP_FALSE OP_IF ... OP_ENDIF                  │
│                                                                     │
│  Estrutura do Envelope:                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  OP_FALSE                                                    │   │
│  │  OP_IF                                                       │   │
│  │    OP_PUSH "ord"                                             │   │
│  │    OP_PUSH 01 (content-type tag)                             │   │
│  │    OP_PUSH "image/png"                                       │   │
│  │    OP_PUSH 00 (body separator)                               │   │
│  │    OP_PUSH [binary content...]                               │   │
│  │  OP_ENDIF                                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Reconhecido por: ordinals.com, Unisat, Magic Eden, etc.           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 🔵 BRC-20 (Domo, 2023)

Tokens fungíveis via inscriptions JSON.

```
┌─────────────────────────────────────────────────────────────────────┐
│  BRC-20 PROTOCOL                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Location: Inscription content (JSON dentro de Ordinal)            │
│                                                                     │
│  Operações:                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Deploy:                                                     │   │
│  │  {"p":"brc-20","op":"deploy","tick":"ordi","max":"21000000"} │   │
│  │                                                              │   │
│  │  Mint:                                                       │   │
│  │  {"p":"brc-20","op":"mint","tick":"ordi","amt":"1000"}       │   │
│  │                                                              │   │
│  │  Transfer:                                                   │   │
│  │  {"p":"brc-20","op":"transfer","tick":"ordi","amt":"100"}    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Reconhecido por: Unisat, OKX, etc.                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 🟢 OMNI LAYER (ex-Mastercoin, 2013)

O protocolo original de tokens no Bitcoin (USDT nasceu aqui!).

```
┌─────────────────────────────────────────────────────────────────────┐
│  OMNI LAYER PROTOCOL                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Magic: "omni" (0x6f6d6e69)                                        │
│  Format: 6a 04 6f6d6e69 [payload]                                  │
│                                                                     │
│  Exemplo:                                                           │
│  6a 14 6f6d6e69 00000000 0000001f 000000003b9aca00                 │
│  │  │  │        │        │        └── Amount (1 bilhão)            │
│  │  │  │        │        └── Property ID (31 = USDT)               │
│  │  │  │        └── Transaction type (0 = simple send)             │
│  │  │  └── "omni" magic                                            │
│  │  └── Push 20 bytes                                              │
│  └── OP_RETURN                                                     │
│                                                                     │
│  Reconhecido por: Omni wallet, exchanges (Bitfinex, etc.)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 🟣 COUNTERPARTY (2014)

Outro protocolo pioneiro de assets no Bitcoin.

```
┌─────────────────────────────────────────────────────────────────────┐
│  COUNTERPARTY PROTOCOL                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Magic: "CNTRPRTY" (encoded/encrypted)                             │
│  Format: OP_RETURN + XCP encoded data                              │
│                                                                     │
│  Características:                                                   │
│  • Suporta DEX on-chain                                            │
│  • Smart contracts simples                                         │
│  • Assets customizáveis                                            │
│                                                                     │
│  Reconhecido por: Counterparty wallet, Rare Pepe market            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Anatomia do OP_RETURN

### Estrutura Básica

```
6a [push opcode] [dados...]
│  │              └── Seus dados (até 80 bytes)
│  └── Opcode para push de dados (01-4b = 1-75 bytes, 4c = 76-255 bytes)
└── OP_RETURN (opcode 106 = 0x6a)
```

### Push Opcodes

| Opcode | Significado |
|--------|-------------|
| `01` - `4b` | Push direto (1-75 bytes) |
| `4c XX` | OP_PUSHDATA1: XX bytes (76-255) |
| `4d XXXX` | OP_PUSHDATA2: XXXX bytes (256-65535) |
| `4e XXXXXXXX` | OP_PUSHDATA4: XXXXXXXX bytes |

### Opcodes Especiais (usados como Magic Bytes)

| Opcode | Valor | Usado por |
|--------|-------|-----------|
| `OP_1` - `OP_16` | `51` - `60` | Reservados |
| `OP_13` | `5d` | **RUNES** ✅ |

---

## Como Criar Seu Próprio Protocolo

### Passo 1: Escolha seu Magic Byte/Identifier

O "magic byte" é como uma assinatura que identifica seu protocolo.

```
Opções:

1️⃣  Usar um Opcode reservado (OP_1 a OP_16)
    • Vantagem: Compacto (1 byte)
    • Desvantagem: Poucos disponíveis
    
2️⃣  Usar uma string ASCII
    • Exemplo: "KRAY" = 0x4b524159
    • Vantagem: Legível, infinitas opções
    • Desvantagem: Ocupa mais espaço

3️⃣  Usar hash parcial
    • Exemplo: SHA256("KRAY")[0:4]
    • Vantagem: Único, distribuído
    • Desvantagem: Não legível
```

### Passo 2: Defina sua Estrutura de Dados

Escolha um encoding eficiente:

```
┌─────────────────────────────────────────────────────────────────────┐
│  OPÇÕES DE ENCODING                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LEB128 (usado por Runes):                                         │
│  • Números pequenos = poucos bytes                                 │
│  • Números grandes = mais bytes                                    │
│  • Muito eficiente para IDs e amounts                              │
│                                                                     │
│  Fixed-size (usado por Omni):                                      │
│  • Cada campo tem tamanho fixo                                     │
│  • Fácil de parsear                                                │
│  • Pode desperdiçar espaço                                         │
│                                                                     │
│  TLV (Tag-Length-Value):                                           │
│  • Muito flexível                                                  │
│  • Permite campos opcionais                                        │
│  • Overhead de 2+ bytes por campo                                  │
│                                                                     │
│  JSON/CBOR:                                                        │
│  • Human-readable (JSON)                                           │
│  • Compact (CBOR)                                                  │
│  • Alto overhead                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Passo 3: Crie seu Indexer

O indexer é o software que monitora a blockchain e interpreta seus dados.

```javascript
// Pseudo-código de um Indexer

const MAGIC = Buffer.from('KRAY', 'ascii'); // 0x4b524159

async function indexBlock(block) {
  for (const tx of block.transactions) {
    for (const output of tx.vout) {
      const script = Buffer.from(output.scriptPubKey.hex, 'hex');
      
      // Verifica se é OP_RETURN
      if (script[0] !== 0x6a) continue;
      
      // Extrai o payload
      const payloadStart = 2; // Pula OP_RETURN + push opcode
      const payload = script.slice(payloadStart);
      
      // Verifica se tem nosso magic
      if (!payload.slice(0, 4).equals(MAGIC)) continue;
      
      // É uma TX do protocolo KRAY!
      const data = decodeKrayPayload(payload.slice(4));
      await processKrayTransaction(tx.txid, data);
    }
  }
}

function decodeKrayPayload(payload) {
  return {
    version: payload[0],
    batchId: payload.readUInt32BE(1),
    merkleRoot: payload.slice(5, 37).toString('hex'),
    txCount: payload.readUInt16BE(37)
  };
}
```

### Passo 4: Publique a Especificação

Para outros adotarem seu protocolo:

```markdown
# KRAY Protocol Specification v1.0

## Overview
O KRAY Protocol é um protocolo de ancoragem de estado L2 no Bitcoin.

## Magic Identifier
- Bytes: 0x4b524159
- ASCII: "KRAY"

## Transaction Format
| Field | Offset | Size | Description |
|-------|--------|------|-------------|
| Magic | 0 | 4 | "KRAY" identifier |
| Version | 4 | 1 | Protocol version |
| BatchID | 5 | 4 | L2 batch number |
| MerkleRoot | 9 | 32 | Root of L2 transactions |
| TxCount | 41 | 2 | Number of L2 txs in batch |

## Validation Rules
1. Magic must be exactly 0x4b524159
2. Version must be supported (currently only 1)
3. MerkleRoot must be valid SHA256 hash
4. TxCount must match actual batch size
```

---

## Exemplo Prático: KRAY State Anchoring

Veja como seria um protocolo KRAY para ancorar o estado da L2 no Bitcoin:

### Estrutura Proposta

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KRAY STATE ANCHORING                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   FORMATO DO OP_RETURN (43 bytes):                                              │
│                                                                                 │
│   6a 2b 4b 52 41 59 01 00 00 01 6d 7f 3a 9b 2c 4d 5e 6f 7a 8b 9c 0d 1e 2f 3a   │
│   4b 5c 6d 7e 8f 9a 0b 1c 2d 3e 4f 5a 6b 7c 8d 9e 0f 27 10                      │
│   │  │  └──────────┘ │  └──────────┘ └────────────────────────────────────┘ │   │
│   │  │       │       │       │                        │                     │   │
│   │  │       │       │       │                        │                     │   │
│   │  │       │       │       │                        └─ TX Count (10000)   │   │
│   │  │       │       │       └─ Merkle Root (32 bytes)                      │   │
│   │  │       │       └─ Batch ID (365)                                      │   │
│   │  │       └─ Version (1)                                                 │   │
│   │  │                                                                      │   │
│   │  └─ Push 43 bytes                                                       │   │
│   └─ OP_RETURN                                                              │   │
│                                                                                 │
│   Resultado: PROVA IMUTÁVEL de 10.000 transações L2 em uma única TX Bitcoin!   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Breakdown Detalhado

```
BYTE-BY-BYTE ANALYSIS:
═════════════════════

Offset 0:   6a                    = OP_RETURN
Offset 1:   2b                    = Push 43 bytes
Offset 2-5: 4b 52 41 59           = "KRAY" (magic identifier)
Offset 6:   01                    = Version 1
Offset 7-10: 00 00 01 6d          = Batch ID 365 (big-endian)
Offset 11-42: [32 bytes]          = Merkle Root (SHA256)
Offset 43-44: 27 10               = TX Count 10000 (big-endian)

Total: 45 bytes (bem abaixo do limite de 80!)
```

### Código de Criação

```javascript
function createKrayAnchorTx(batchId, merkleRoot, txCount) {
  const magic = Buffer.from('KRAY', 'ascii');
  const version = Buffer.from([0x01]);
  const batch = Buffer.alloc(4);
  batch.writeUInt32BE(batchId);
  const root = Buffer.from(merkleRoot, 'hex');
  const count = Buffer.alloc(2);
  count.writeUInt16BE(txCount);
  
  const payload = Buffer.concat([magic, version, batch, root, count]);
  
  // Cria o script OP_RETURN
  const script = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    payload
  ]);
  
  return script;
}
```

---

## Comparação de Protocolos

```
┌──────────────────────┬──────────────┬──────────────┬──────────────────────┐
│                      │    RUNES     │   ORDINALS   │   PROTOCOLO CUSTOM   │
├──────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ Localização          │ OP_RETURN    │ Witness      │ OP_RETURN            │
│ Magic Byte           │ OP_13 (5d)   │ "ord"        │ Você escolhe!        │
│ Encoding             │ LEB128       │ Envelope     │ Você define!         │
│ Limite de Dados      │ 80 bytes     │ ~400KB       │ 80 bytes             │
│ Indexers             │ Muitos       │ Muitos       │ Você cria            │
│ Adoção               │ Alta         │ Alta         │ Zero (início)        │
│ Exchanges            │ Listam       │ Listam       │ Precisam integrar    │
│ Flexibilidade        │ Spec fixa    │ Spec fixa    │ Total                │
│ Custo por TX         │ ~300 sats    │ ~5000+ sats  │ ~300 sats            │
└──────────────────────┴──────────────┴──────────────┴──────────────────────┘
```

---

## Limitações e Considerações

### Limitações Técnicas

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  LIMITAÇÕES DO OP_RETURN                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. TAMANHO MÁXIMO: 80 bytes por output                            │
│     • Para mais dados, use múltiplos outputs                       │
│     • Ou use Witness data (como Ordinals)                          │
│                                                                     │
│  2. CUSTO FIXO: Paga taxa como qualquer output                     │
│     • ~8 vbytes base + tamanho dos dados                           │
│     • ~330 sats a 10 sat/vB                                        │
│                                                                     │
│  3. NÃO-GASTÁVEL: O output não retorna valor                       │
│     • O "valor" do output é perdido (geralmente 0)                 │
│     • Não pode ser usado como UTXO                                 │
│                                                                     │
│  4. IRREVERSÍVEL: Uma vez confirmado, é permanente                 │
│     • Bom para imutabilidade                                       │
│     • Ruim se você errar                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Considerações de Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  💡 MELHORES PRÁTICAS                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ FAÇA:                                                           │
│     • Use magic bytes únicos (evite conflitos)                     │
│     • Documente a especificação publicamente                       │
│     • Use encoding eficiente (LEB128, varints)                     │
│     • Inclua versão no protocolo                                   │
│     • Valide inputs no indexer                                     │
│                                                                     │
│  ❌ NÃO FAÇA:                                                       │
│     • Armazenar dados sensíveis (blockchain é pública!)            │
│     • Usar encoding JSON (desperdiça espaço)                       │
│     • Ignorar erros de parsing                                     │
│     • Mudar formato sem versionar                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Conclusão

O **OP_RETURN** é a "tela em branco" do Bitcoin onde qualquer desenvolvedor pode criar seu próprio protocolo. Os grandes protocolos como Runes, Ordinals, BRC-20, Omni e Counterparty são apenas **convenções sociais** - acordos sobre como interpretar bytes específicos.

Para criar seu próprio protocolo, você precisa:

1. **Escolher um identificador único** (magic byte)
2. **Definir uma estrutura de dados eficiente**
3. **Criar um indexer** que monitore a blockchain
4. **Publicar a especificação** para adoção
5. **Convencer a comunidade** a usar seu protocolo

O custo é mínimo (apenas taxas de mineração), e os dados ficam **imutáveis para sempre** na blockchain do Bitcoin. 🔒

---

## Referências

- [Bitcoin Script Reference](https://en.bitcoin.it/wiki/Script)
- [Runes Protocol Specification](https://docs.ordinals.com/runes.html)
- [Ordinals Protocol](https://docs.ordinals.com/)
- [BRC-20 Standard](https://domo-2.gitbook.io/brc-20-experiment/)
- [Omni Layer Specification](https://github.com/OmniLayer/spec)
- [Bitcoin Core - OP_RETURN](https://github.com/bitcoin/bitcoin)

---

*Documento criado para KRAY•SPACE - Novembro 2025*

*"Origin. Honor. Bitcoin."* ⚓





