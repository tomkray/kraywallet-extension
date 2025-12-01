# 🚀 KRAY SPACE L2 - Evolution Roadmap

> **Documento de Evolução Técnica**  
> Última atualização: 30 de Novembro de 2025  
> Versão: 1.0.0

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Fase Atual: Bootstrap Federado](#2-fase-atual-bootstrap-federado)
3. [Sistema de Segurança Implementado](#3-sistema-de-segurança-implementado)
4. [Roadmap de Evolução](#4-roadmap-de-evolução)
5. [State Anchoring (Próxima Fase)](#5-state-anchoring-próxima-fase)
6. [Caminho para Descentralização](#6-caminho-para-descentralização)
7. [Checklist de Testes](#7-checklist-de-testes)
8. [Arquivos Importantes](#8-arquivos-importantes)

---

## 1. Visão Geral da Arquitetura

### 1.1 O Que É a KRAY SPACE L2?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                         BITCOIN L1 (Base Layer)                         │
│                    ════════════════════════════════                     │
│                    │  Segurança: 700 EH/s          │                    │
│                    │  Imutabilidade: Absoluta      │                    │
│                    │  Velocidade: ~10 min/bloco    │                    │
│                    ════════════════════════════════                     │
│                                   │                                     │
│                                   │ Bridge (2-of-3 Taproot Multisig)   │
│                                   │                                     │
│                                   ▼                                     │
│                    ════════════════════════════════                     │
│                    │     KRAY SPACE L2             │                    │
│                    │  ─────────────────────────    │                    │
│                    │  • Optimistic Rollup          │                    │
│                    │  • Consenso Raft (Federado)   │                    │
│                    │  • State Channels             │                    │
│                    │  • ~1000 TPS                  │                    │
│                    │  • Finalidade < 1 segundo     │                    │
│                    ════════════════════════════════                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Componentes Principais

| Componente | Descrição | Arquivo |
|------------|-----------|---------|
| **Bridge** | Ponte 2-of-3 Taproot Multisig | `l2/bridge/taprootMultisig.js` |
| **Accounts** | Contas L2 com saldos | `l2/core/database.js` |
| **Transactions** | Transferências internas L2 | `l2/core/transactionExecutor.js` |
| **Withdrawals** | Saques para L1 | `l2/bridge/userFundedWithdrawal.js` |
| **Deposits** | Depósitos da L1 | `l2/bridge/psbtBridge.js` |
| **Consensus** | Raft para ordenação | `l2/validators/consensusRaft.js` |
| **Rollup** | Agregação de batches | `l2/state/rollupAggregator.js` |

---

## 2. Fase Atual: Bootstrap Federado

### 2.1 Status: ATIVO ✅

```
┌─────────────────────────────────────────────────────────────────┐
│                     FASE 1: BOOTSTRAP                           │
│                                                                 │
│   ✅ Consenso Raft (3 validadores controlados)                 │
│   ✅ Bridge 2-of-3 Taproot Multisig                            │
│   ✅ Deposits funcionando                                       │
│   ⏳ Withdrawals (testando)                                     │
│   ✅ Transfers L2                                               │
│   ✅ KRAY Credits como gas token                                │
│   ✅ Circuit Breaker (Solvency Guard)                          │
│                                                                 │
│   Capacidade: ~1000 TPS                                        │
│   Finalidade: < 1 segundo                                      │
│   Segurança: Federada (confiança nos validadores)              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Limitações Conhecidas

| Limitação | Impacto | Solução Futura |
|-----------|---------|----------------|
| Consenso Federado | Confiança em 3 validadores | PoS com mais validadores |
| Sem State Anchoring | Transações não ancoradas no BTC | Implementar Merkle Root |
| Bridge Centralizada | 2-of-3 pode ser comprometida | 5-of-9 ou mais |
| Sem Fraud Proofs Públicos | Só validadores verificam | Proofs públicos |

---

## 3. Sistema de Segurança Implementado

### 3.1 Solvency Guard (Proof of Reserves)

```
REGRA DE OURO: Σ(saldos L2) ≤ Saldo da Bridge L1

┌─────────────────────────────────────────────────────────────────┐
│                    🛡️ SOLVENCY GUARD                           │
│                                                                 │
│   Verificação a cada 60 segundos:                              │
│                                                                 │
│   📊 Total L2: 100 KRAY                                        │
│   🏦 Bridge L1: 100 KRAY                                       │
│   📈 Ratio: 100%                                               │
│   ✅ Status: SOLVENT                                           │
│                                                                 │
│   Se L2 > Bridge:                                              │
│   🚨 CIRCUIT BREAKER ATIVADO!                                  │
│   ❌ Todas operações bloqueadas                                │
│   🔒 Requer intervenção manual                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Arquivo:** `l2/core/solvencyGuard.js`

**Endpoints:**
- `GET /l2/bridge/solvency` - Verificar solvência
- `GET /l2/bridge/lockdown/status` - Status do lockdown
- `POST /l2/bridge/lockdown/activate` - Ativar lockdown (requer operator_key)
- `POST /l2/bridge/lockdown/deactivate` - Desativar lockdown (requer operator_key)

### 3.2 Proteções de PSBT

| Ataque | Proteção | Status |
|--------|----------|--------|
| PSBT Tampering | Comparação byte-a-byte | ✅ |
| Amount Manipulation | BigInt validation | ✅ |
| Replay Attack | Nonce tracking | ✅ |
| Double Withdrawal | Pending check | ✅ |
| Invalid Signature | Schnorr verification | ✅ |
| Fee Manipulation | Dynamic fee + minimum | ✅ |

**Arquivo:** `l2/bridge/userFundedWithdrawal.js`

### 3.3 Runestone Encoding (CRÍTICO!)

```javascript
// FORMATO CORRETO DO OP_RETURN:
// 6a = OP_RETURN
// 5d = OP_13 (Runestone magic) - DEVE SER OPCODE, NÃO BUFFER!
// XX = tamanho do payload
// ... = payload LEB128

// CORRETO ✅
bitcoin.script.compile([
  bitcoin.opcodes.OP_RETURN,
  bitcoin.opcodes.OP_13,  // Opcode direto!
  runestoneData           // Buffer com LEB128
]);

// ERRADO ❌ (causa CENOTAPH!)
bitcoin.script.compile([
  bitcoin.opcodes.OP_RETURN,
  Buffer.from([0x5d]),    // Isso adiciona OP_PUSHBYTES_1!
  runestoneData
]);
```

**Formato do Runestone:**
```
Tag 2 (Pointer) ANTES de Tag 0 (Body)!

values = [
  2,              // Tag 2 = Pointer
  changeOutput,   // Output para change (bridge)
  0,              // Tag 0 = Body (edicts)
  block,          // Rune ID block
  tx,             // Rune ID tx
  amount,         // Quantidade
  output          // Output destino (user)
];
```

---

## 4. Roadmap de Evolução

### 4.1 Fases de Desenvolvimento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   FASE 1: BOOTSTRAP (ATUAL)                                            │
│   ═════════════════════════                                             │
│   ✅ Raft Consensus                                                     │
│   ✅ Bridge 2-of-3                                                      │
│   ✅ Circuit Breaker                                                    │
│   ⏳ Testes de Withdrawal                                               │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                                                                         │
│   FASE 2: STATE ANCHORING                                              │
│   ════════════════════════                                              │
│   ⬚ Merkle Tree de transações                                          │
│   ⬚ OP_RETURN diário no Bitcoin                                        │
│   ⬚ Fraud Proofs verificáveis                                          │
│   ⬚ Qualquer um pode auditar                                           │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                                                                         │
│   FASE 3: EXPANSÃO DE VALIDADORES                                      │
│   ═══════════════════════════════                                       │
│   ⬚ 10-50 validadores                                                  │
│   ⬚ Staking para participar                                            │
│   ⬚ Bridge 5-of-9                                                      │
│   ⬚ Rotação de validadores                                             │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                                                                         │
│   FASE 4: CONSENSO DESCENTRALIZADO                                     │
│   ═════════════════════════════════                                     │
│   ⬚ Trocar Raft por PoS/BFT                                            │
│   ⬚ Resistência a validadores maliciosos                               │
│   ⬚ Governança on-chain                                                │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                                                                         │
│   FASE 5: ZK-ROLLUP (FUTURO)                                           │
│   ══════════════════════════                                            │
│   ⬚ Zero-Knowledge Proofs                                              │
│   ⬚ Validação matemática (não confiança)                               │
│   ⬚ Trust-minimized bridge                                             │
│   ⬚ Estado comprovado criptograficamente                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Timeline Estimado

| Fase | Duração | Dependências |
|------|---------|--------------|
| Fase 1 | ✅ Completa | - |
| Fase 2 | 2-4 semanas | Testes OK |
| Fase 3 | 2-3 meses | Fase 2 |
| Fase 4 | 3-6 meses | Fase 3 |
| Fase 5 | 6-12 meses | Fase 4 |

---

## 5. State Anchoring (Próxima Fase)

### 5.1 Conceito

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        STATE ANCHORING                                  │
│                                                                         │
│   L2 Transactions (24 horas):                                          │
│   TX1 → TX2 → TX3 → ... → TX10000                                      │
│                    │                                                    │
│                    ▼                                                    │
│            ┌──────────────┐                                            │
│            │ MERKLE TREE  │                                            │
│            │              │                                            │
│            │    ROOT      │ = SHA256 de todas as TXs                   │
│            │   /    \     │                                            │
│            │  H12   H34   │                                            │
│            │  /\     /\   │                                            │
│            │ H1 H2 H3 H4  │                                            │
│            └──────────────┘                                            │
│                    │                                                    │
│                    ▼                                                    │
│   ┌────────────────────────────────────────────────────────────┐       │
│   │  BITCOIN OP_RETURN (80 bytes)                              │       │
│   │                                                             │       │
│   │  KRAY | v1 | batch:365 | root:7f3a9b... | txs:10000        │       │
│   │                                                             │       │
│   │  Custo: ~300-500 sats/dia (~$0.30)                         │       │
│   └────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   ⚡ UMA VEZ NO BITCOIN = IMUTÁVEL PARA SEMPRE!                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Benefícios

| Antes do Anchoring | Depois do Anchoring |
|--------------------|---------------------|
| Dados podem ser alterados (teoricamente) | **IMUTÁVEL** |
| Só validadores verificam | **Qualquer pessoa verifica** |
| Confiança nos operadores | **Confiança matemática** |
| Sem prova pública | **Merkle Proofs** |

### 5.3 Estrutura do Batch

```javascript
{
  batch_id: 365,
  start_height: 870000,           // Bloco Bitcoin de início
  end_height: 870144,             // Bloco Bitcoin de fim (~24h)
  
  transactions: [
    { hash: "tx1...", from: "acc_1", to: "acc_2", amount: 100 },
    { hash: "tx2...", from: "acc_3", to: "acc_4", amount: 50 },
    // ... até 10.000 transações
  ],
  
  merkle_root: "7f3a9b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
  
  // Prova no Bitcoin
  bitcoin_txid: "abc123def456...",
  bitcoin_block: 870145,
  
  // Metadados
  total_transactions: 10000,
  total_volume: 1500000,          // KRAY movimentados
  timestamp: "2025-12-01T00:00:00Z"
}
```

### 5.4 Como Verificar (Fraud Proof)

```
Usuário: "Prove que TX #5432 existiu"

1. Buscar TX #5432 no banco L2
2. Gerar Merkle Proof (hashes irmãos)
3. Recalcular até o ROOT
4. Comparar com ROOT no Bitcoin

┌─────────────────────────────────────────┐
│                ROOT (no BTC)            │
│                  │                      │
│            ┌─────┴─────┐               │
│            │           │               │
│         H(AB)       H(CD) ← proof[1]   │
│          /\           /\               │
│         /  \         /  \              │
│       H(A) H(B)    H(C) H(D)           │
│        │    ↑       │    │             │
│       TX1  proof[0] TX3  TX4           │
│             │                          │
│            TX2 ← transação a provar    │
└─────────────────────────────────────────┘

Se recalcular e bater com Bitcoin = VÁLIDO ✅
Se não bater = FRAUDE! 🚨
```

### 5.5 Implementação

**Arquivos a criar/modificar:**
- `l2/state/merkleTree.js` - Construção da árvore
- `l2/state/stateAnchoring.js` - Ancoragem no Bitcoin
- `l2/state/rollupAggregator.js` - Integração com batches
- `l2/api/routes/proofs.js` - API para Merkle Proofs

**Endpoints novos:**
- `GET /l2/batch/:id` - Informações do batch
- `GET /l2/batch/:id/proof/:txHash` - Merkle Proof de uma TX
- `GET /l2/batch/latest` - Último batch ancorado
- `GET /l2/verify/:txHash` - Verificar se TX está ancorada

---

## 6. Caminho para Descentralização

### 6.1 Níveis de Descentralização

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   NÍVEL 1: FEDERADO (ATUAL)                                            │
│   ══════════════════════════                                            │
│   • 3 validadores controlados                                          │
│   • Confiança: ALTA (nos operadores)                                   │
│   • Velocidade: MÁXIMA                                                 │
│   • Segurança: Depende da honestidade                                  │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                                                                         │
│   NÍVEL 2: SEMI-DESCENTRALIZADO                                        │
│   ══════════════════════════════                                        │
│   • 10-50 validadores independentes                                    │
│   • Staking para participar                                            │
│   • Slashing para mau comportamento                                    │
│   • Confiança: MÉDIA                                                   │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                                                                         │
│   NÍVEL 3: DESCENTRALIZADO                                             │
│   ═════════════════════════                                             │
│   • Qualquer um pode ser validador                                     │
│   • Consenso BFT resistente a ataques                                  │
│   • Governança on-chain                                                │
│   • Confiança: BAIXA (no código)                                       │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                                                                         │
│   NÍVEL 4: TRUSTLESS (ZK)                                              │
│   ════════════════════════                                              │
│   • Zero-Knowledge Proofs                                              │
│   • Validação matemática                                               │
│   • Confiança: ZERO (só matemática)                                    │
│   • Segurança: Igual ao Bitcoin!                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Requisitos por Nível

| Nível | Validadores | Staking | Provas | Complexidade |
|-------|-------------|---------|--------|--------------|
| 1 | 3 (controlados) | Não | Não | Baixa |
| 2 | 10-50 | Sim | State Anchoring | Média |
| 3 | 100+ | Sim | Fraud Proofs | Alta |
| 4 | Qualquer | Opcional | ZK-Proofs | Muito Alta |

---

## 7. Checklist de Testes

### 7.1 Antes do State Anchoring

| Teste | Status | Descrição |
|-------|--------|-----------|
| Deposit L1→L2 | ✅ | Enviar KRAY para bridge, créditos aparecem |
| Withdrawal L2→L1 | ⏳ | Pedir saque, KRAY chega na L1 |
| Transfer L2 | ✅ | Transferir entre contas L2 |
| Solvency Check | ✅ | L2 total ≤ Bridge L1 |
| Circuit Breaker | ✅ | Lockdown se insolvente |
| Runestone Format | ✅ | Indexers reconhecem |
| Fee Estimation | ✅ | Dinâmico via mempool.space |
| Refund on Failure | ✅ | Auto-refund se falhar |

### 7.2 Teste de Withdrawal (ATUAL)

```bash
# 1. Verificar deploy
curl https://kraywallet-backend.onrender.com/l2/health

# 2. Verificar solvência
curl https://kraywallet-backend.onrender.com/l2/bridge/solvency

# 3. Verificar saldo
curl https://kraywallet-backend.onrender.com/l2/account/ACC_ID/balance

# 4. Fazer withdrawal via frontend
# https://kraywallet-backend.onrender.com/kray-l2.html
```

### 7.3 Validação de Sucesso

```
✅ Withdrawal criado no L2
✅ PSBT gerado corretamente
✅ Usuário assina
✅ Challenge period passa (1 min para testes)
✅ Validadores assinam
✅ TX broadcast para Bitcoin
✅ TX confirmada (6+ blocos)
✅ KRAY aparece na wallet L1
✅ Saldo L2 debitado
✅ Indexers reconhecem (ordinals.com, Unisat)
```

---

## 8. Arquivos Importantes

### 8.1 Estrutura do Projeto

```
backend-render/
├── l2/
│   ├── api/
│   │   └── routes/
│   │       ├── bridge.js          # Endpoints de bridge
│   │       ├── account.js         # Endpoints de conta
│   │       └── transaction.js     # Endpoints de TX
│   │
│   ├── bridge/
│   │   ├── taprootMultisig.js     # Multisig 2-of-3
│   │   ├── userFundedWithdrawal.js # Withdrawals
│   │   ├── withdrawalProcessor.js  # Processador automático
│   │   ├── psbtBridge.js          # Deposits
│   │   └── keyManager.js          # Gerenciamento de chaves
│   │
│   ├── core/
│   │   ├── database.js            # Supabase connection
│   │   ├── constants.js           # Configurações
│   │   ├── solvencyGuard.js       # Circuit Breaker
│   │   └── transactionExecutor.js # Executor de TXs
│   │
│   ├── state/
│   │   └── rollupAggregator.js    # Agregador de batches
│   │
│   └── validators/
│       └── consensusRaft.js       # Consenso Raft
│
├── utils/
│   ├── quicknode.js               # QuickNode API
│   ├── psbtBuilderRunes.js        # Construtor de Runestones
│   └── bitcoinRpcQuickNode.js     # Bitcoin RPC
│
└── Arquivos-importantes/
    ├── KRAY-L2-IDEIA.md           # Conceito original
    ├── KRAY-L2-FUTURE-BLUEPRINT.md # Roadmap ZK
    └── KRAY-L2-EVOLUTION-ROADMAP.md # Este documento
```

### 8.2 Configurações Críticas

```javascript
// l2/core/constants.js

// Bridge
BRIDGE: {
  MULTISIG_THRESHOLD: 2,              // 2-of-3
  DEPOSIT_CONFIRMATIONS: 6,           // 6 blocos
  WITHDRAWAL_CHALLENGE_PERIOD: 60,    // 1 min (testes) / 86400 (prod)
  DUST_LIMIT: 546,                    // Limite de dust
}

// Token
TOKEN: {
  name: 'KRAY•SPACE',
  rune_id_short: '925516:1550',
  divisibility: 0,                    // Inteiro apenas
}
```

### 8.3 Variáveis de Ambiente

```bash
# .env (Render)
QUICKNODE_ENDPOINT=https://xxx.btc.quiknode.pro/xxx/
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
L2_OPERATOR_KEY=KRAY_EMERGENCY_KEY_2025
BITCOIN_NETWORK=mainnet
```

---

## 📝 Notas Finais

### Princípios de Desenvolvimento

1. **Segurança Primeiro**: Qualquer mudança deve passar por revisão de segurança
2. **Testes Antes de Produção**: Nunca ancorar dados sem testes completos
3. **Transparência**: Código aberto, provas verificáveis
4. **Gradualismo**: Evoluir em fases, não pular etapas

### Contatos

- **Repositório**: github.com/tomkray/kraywallet-backend
- **Deploy**: kraywallet-backend.onrender.com
- **Database**: Supabase

---

> **"A bridge is only as strong as its weakest link.  
> The L2 is only as secure as its anchoring to L1."**

---

*Documento gerado em 30/11/2025*  
*KRAY SPACE - Self-Custodial Bitcoin*





