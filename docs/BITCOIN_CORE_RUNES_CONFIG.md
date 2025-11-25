# 🔧 Como Fazer Bitcoin Core Aceitar Transações Runes

## 📊 Problema Identificado

O Bitcoin Core v28.2.0 rejeita transações Runes com erro `-26: scriptpubkey` porque:
- Identifica `OP_RETURN OP_13` como script não-padrão
- Por padrão, só aceita relay de transações "standard"

## ✅ Solução: Configurar Bitcoin Core

### Passo 1: Localizar bitcoin.conf

Seu Bitcoin Core deve ter um arquivo de configuração em:
```bash
~/Library/Application Support/Bitcoin/bitcoin.conf
```

### Passo 2: Adicionar Configurações

Adicione estas linhas ao `bitcoin.conf`:

```conf
# Aceitar transações não-padrão (Ordinals/Runes)
acceptnonstdtxn=1

# Permitir OP_RETURN maior
datacarriersize=80

# Permitir mais outputs
limitdescendantcount=1000
limitdescendantsize=1000

# Aumentar limites de mempool
maxmempool=1000
```

### Passo 3: Reiniciar Bitcoin Core

```bash
# Parar Bitcoin Core
bitcoin-cli stop

# Ou forçar parar
pkill -9 bitcoind

# Iniciar novamente (vai ler o novo bitcoin.conf)
bitcoind -daemon
```

### Passo 4: Verificar Se Foi Aplicado

```bash
bitcoin-cli getnetworkinfo | grep "localrelay"
```

## ⚠️ Importante

**ATENÇÃO:** Mesmo com `acceptnonstdtxn=1`, sua transação pode:
1. ✅ Ser aceita pelo SEU node
2. ❌ Ser rejeitada por OUTROS nodes da rede
3. ⚠️ Ficar presa sem propagar

Isso porque a maioria dos nodes NÃO tem essa configuração.

## 🎯 Solução Alternativa (Melhor)

Em vez de confiar apenas no Bitcoin Core, use um **relay direto para mineradores**:

### Opção 1: ViaBTC Transaction Accelerator

```
URL: https://www.viabtc.com/tools/txaccelerator
Método: Cole o TXID ou hex da transação
Custo: Gratuito (limitado) ou pago
```

### Opção 2: F2Pool

```
Contato direto: @f2pool_official
Submeta transações non-standard diretamente
```

### Opção 3: Adicionar Peer Node Especializado

Adicione ao `bitcoin.conf`:

```conf
# Conectar a nodes que aceitam Ordinals/Runes
addnode=ordinals-node1.example.com:8333
addnode=ordinals-node2.example.com:8333
```

(Você precisaria encontrar IPs de nodes especializados na comunidade Ordinals)

## 🔍 Como Unisat/Xverse Fazem

Essas wallets provavelmente usam:

1. **Backend próprio** com Bitcoin Core configurado para aceitar non-standard
2. **Conexões diretas com mining pools** que aceitam Runes
3. **Relay services especializados** que fazem bridge para mineradores
4. **Network de nodes próprios** otimizados para Ordinals/Runes

## 💡 Recomendação Final

Para a MyWallet funcionar com Runes via Bitcoin Core:

### Opção A: Configurar Seu Node (Temporário)
1. Adicionar `acceptnonstdtxn=1` ao bitcoin.conf
2. Reiniciar Bitcoin Core
3. Testar broadcast novamente

**Problema:** Transação pode não propagar pela rede

### Opção B: Usar Mining Pool Accelerator (Recomendado)
1. Fazer broadcast via Bitcoin Core (vai falhar)
2. Pegar o hex da transação
3. Submeter manualmente via ViaBTC accelerator
4. Minerador vai incluir mesmo sendo "non-standard"

### Opção C: Implementar Relay Service
1. Criar endpoint que recebe hex
2. Backend conecta direto com mining pools
3. Submeter transação via API de pool
4. Pool inclui na próxima block template

## 📝 Teste Rápido

Hex da última transação tentada:
```
020000000001033e74f661214c384c30bab02629eee685b53494030df719f22fa3caab7715e6420000000000ffffffffeda29df3ec972c2a05f13fe30b39d096e8007571bd1cf036300e3a3fd5f5c8b10200000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff040000000000000000096a5dc0a23303f4030122020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce2202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a1d23000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a0141bb7a384c6c4a309493a32c11d39685cae57d2c0c6fe133da59bffd3646fdde116f731ea405f01ed4e4af391e8c0fe4343d29132d882fe676cd1f0faa9215a66a010141ebee33415815f8066bc1c77c03a73c1627c140966d5d0e165c3f0dc9bc44031060e645e2901098cab8a5b087460ff86f8c104311880d19438e7310b0c9ae923d010141289d72802474fa5f92354b69d66e95c7cc574ad0b46eab1eb66f3159189c84cd4613812c44108b99008b769c8aaf0698e603fc7f111226bfcf32a88b4a0aeac90100000000
```

TXID: `4d4d759e1e40acca1b8e1d5159f322ceb191fdbdca9cfff3185aaccd6bfb6bbf`

Você pode tentar submeter este hex via:
- ViaBTC: https://www.viabtc.com/tools/txaccelerator
- Mempool Accelerator: https://mempool.space/tx/push

---

## 🎯 Próximos Passos

**Quer que eu:**
1. Crie script para adicionar a configuração ao bitcoin.conf automaticamente?
2. Implemente integração com ViaBTC accelerator API?
3. Crie endpoint para submeter via mining pool?

Escolha a abordagem e continuamos! 🚀

