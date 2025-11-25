# 🔥 Solução de Broadcast para Runes

## 📊 Descoberta Importante

### ❌ Bitcoin Core NÃO Aceita `acceptnonstdtxn=1` na Mainnet

Tentamos adicionar a configuração `acceptnonstdtxn=1` ao `bitcoin.conf`, mas o Bitcoin Core retornou:

```
[error] acceptnonstdtxn is not currently supported for main chain
```

**Conclusão:** Bitcoin Core **propositalmente bloqueia** transações non-standard na mainnet, incluindo Runes (que usam `OP_RETURN OP_13`).

---

## 🎯 Solução Implementada

### Nova Arquitetura de Broadcast

Criamos um serviço especializado de broadcast que:

1. **Detecta transações Runes** automaticamente (procurando por `6a5dc0a2` - OP_RETURN OP_13)
2. **Usa múltiplos broadcast services em paralelo**
3. **Retorna assim que um serviço aceitar a transação**

### Arquivos Criados/Modificados

#### 1. `/server/utils/runeBroadcast.js` (NOVO)

Serviço especializado que tenta broadcast em 4 provedores simultaneamente:

- ✅ **Mempool.space** - API pública de broadcast
- ✅ **Blockstream.info** - Blockstream Explorer API
- ✅ **Blockchain.info** - Blockchain.com push API
- ✅ **Blockcypher.com** - BlockCypher broadcast API

**Funcionamento:**
```javascript
// Tenta todos em paralelo
const results = await Promise.all([
    tryMempool(hex),
    tryBlockstream(hex),
    tryBlockchain(hex),
    tryBlockcypher(hex)
]);

// Retorna o primeiro que funcionar
const success = results.find(r => r.success);
```

#### 2. `/server/routes/wallet.js` (MODIFICADO)

Rota `/api/wallet/broadcast` agora:

1. Detecta se é transação Rune
2. Se for Rune → usa `broadcastRuneTransaction()`
3. Se for Bitcoin normal → usa Bitcoin Core RPC

```javascript
// Detecta Rune
const isRuneTransaction = hex.includes('6a5dc0a2');

if (isRuneTransaction) {
    // Usa serviço especializado
    const result = await broadcastRuneTransaction(hex);
    // ...
} else {
    // Usa Bitcoin Core normal
    const txid = await bitcoinRpc.sendRawTransaction(hex);
    // ...
}
```

---

## 🔍 Por Que Funciona?

### Como Unisat/Xverse/Magic Eden Fazem

Eles NÃO usam Bitcoin Core diretamente. Eles usam:

**Estratégia 1: APIs Públicas**
```
[Wallet] → [Broadcast APIs] → [Mempool] → [Mineradores]
```

**Estratégia 2: Conexão Direta com Mining Pools**
```
[Wallet] → [Backend] → [F2Pool/Luxor] → [Bloco Direto]
```

**Estratégia 3: Relay Especializado**
```
[Wallet] → [Ordinals Relay Network] → [Mineradores que aceitam Runes]
```

### Nossa Solução

Implementamos a **Estratégia 1** - usar APIs públicas que não aplicam as mesmas restrições do Bitcoin Core.

**Vantagens:**
- ✅ Não depende de configurações especiais do Bitcoin Core
- ✅ Funciona na mainnet sem modificações
- ✅ Múltiplos fallbacks para maior confiabilidade
- ✅ Broadcast em paralelo para velocidade máxima

---

## 🧪 Como Testar

### 1. Verificar Bitcoin Core está rodando

```bash
/Volumes/D1/bitcoin/bitcoin-28.2/bin/bitcoin-cli -datadir=/Volumes/D1/bitcoin getblockchaininfo
```

### 2. Verificar servidor está rodando

```bash
curl http://localhost:3000/api/health
```

### 3. Tentar enviar Rune

1. Abrir MyWallet extension
2. Ir para tab "Runes"
3. Clicar em "Send" no rune
4. Preencher endereço e quantidade
5. Assinar com password
6. **Novo:** O broadcast agora vai tentar 4 serviços em paralelo!

### 4. Monitorar logs do servidor

```bash
tail -f /Users/tomkray/Desktop/PSBT-Ordinals/server.log
```

Você verá:
```
🔥 Rune transaction detected! Using specialized broadcast service...
📡 Tentando Mempool.space...
📡 Tentando Blockstream.info...
📡 Tentando Blockchain.info...
📡 Tentando Blockcypher.com...
✅ Mempool.space SUCESSO!
   TXID: abc123...
```

---

## 📈 Próximos Passos (Opcional)

### Opção 1: Integrar com Mining Pool Diretamente

Conectar direto com F2Pool, Luxor, ou outro pool que aceite transações via API.

**Vantagens:**
- ⚡ Garantia de inclusão no próximo bloco
- 🎯 Sem depender de propagação pela rede

**Desvantagens:**
- 💰 Pode ter custo adicional
- 🔐 Requer API keys e autenticação

### Opção 2: Implementar Transaction Accelerator

Usar serviços como ViaBTC Accelerator para forçar mineração.

**Vantagens:**
- 🚀 Alta taxa de sucesso
- 📊 Transparente para o usuário

**Desvantagens:**
- 💵 Geralmente cobram taxa
- ⏱️ Pode ter fila de espera

### Opção 3: Criar Relay Node Próprio

Configurar um node Bitcoin Core modificado que aceite Runes e tenha conexões diretas com mineradores.

**Vantagens:**
- 🎮 Controle total
- 🔒 Privacidade máxima

**Desvantagens:**
- 🛠️ Complexo de configurar
- 💻 Requer infraestrutura dedicada

---

## 🎓 O Que Aprendemos

1. **Bitcoin Core é conservador** - Bloqueia propositalmente transações "diferentes" na mainnet
2. **`acceptnonstdtxn` só funciona em testnet/regtest** - Proteção intencional da rede
3. **Wallets profissionais usam relay alternativo** - Não dependem do relay padrão do Bitcoin Core
4. **APIs públicas são mais flexíveis** - Mempool.space, Blockstream, etc aceitam transações non-standard
5. **Broadcast em paralelo é mais confiável** - Se um falhar, outros podem funcionar

---

## ✅ Status Atual

- ✅ Bitcoin Core rodando normalmente (sem `acceptnonstdtxn`)
- ✅ Servidor Node.js rodando com novo serviço de broadcast
- ✅ Detecção automática de transações Runes
- ✅ Broadcast multi-provider implementado
- ✅ Fallback para Bitcoin Core em transações normais
- ✅ Pronto para testar!

---

## 🔗 Links Úteis

- [Bitcoin Core Non-Standard Transactions](https://bitcoin.stackexchange.com/questions/tagged/non-standard-transactions)
- [Runes Protocol Specification](https://docs.ordinals.com/runes.html)
- [Mempool.space Broadcast API](https://mempool.space/docs/api)
- [Blockstream API Documentation](https://github.com/Blockstream/esplora/blob/master/API.md)

