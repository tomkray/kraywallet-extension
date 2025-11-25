# 🚀 Guia de Configuração dos Nodes

Este guia explica como configurar e conectar o Bitcoin Core e Ord Server ao marketplace.

## 📋 Pré-requisitos

- Bitcoin Core instalado e sincronizado
- Ord (Ordinals) instalado
- Node.js 18+ instalado
- Espaço em disco suficiente (Bitcoin mainnet requer ~600GB)

---

## 🔧 1. Configurar Bitcoin Core

### Arquivo `bitcoin.conf`

Crie ou edite seu arquivo `bitcoin.conf` com as seguintes configurações:

```conf
# Diretório de dados
datadir=/Volumes/D1/bitcoin

# Conexões
maxconnections=50
disablewallet=1

# Rede
testnet=0
server=1

# Mempool e transações
blocksonly=0
maxmempool=300
paytxfee=0.00001

# Limites de banda
maxuploadtarget=137
maxdownloadtarget=200

# Importante: necessário para ordinals
txindex=1

# RPC Configuration
rpcallowip=127.0.0.1
rpcbind=127.0.0.1:8332
rpcport=8332
rpcthreads=8
rpcuser=seu_usuario
rpcpassword=sua_senha_segura

# Otimizações de Performance
par=0
checkblocks=1000
checklevel=0
dbcache=8192
maxorphantx=100
checkmempool=0
maxsendbuffer=10000
maxreceivebuffer=10000
priority=high
```

### Iniciar Bitcoin Core

```bash
# MacOS/Linux
bitcoind -daemon

# Verificar status
bitcoin-cli getblockchaininfo
```

### Aguardar Sincronização

```bash
# Verificar progresso
bitcoin-cli getblockchaininfo | grep verificationprogress

# Deve estar próximo de 1.0 (100%)
```

---

## 🎨 2. Configurar Ord Server

### Instalação do Ord

```bash
# Via cargo (Rust)
cargo install ord

# Ou download do binário
# https://github.com/ordinals/ord/releases
```

### Criar Índice de Ordinals

⚠️ **IMPORTANTE**: Este processo pode levar várias horas ou dias!

```bash
# Criar índice com Bitcoin Core
ord --bitcoin-data-dir /Volumes/D1/bitcoin index

# Verificar progresso
ord --bitcoin-data-dir /Volumes/D1/bitcoin index --height
```

### Iniciar Ord Server

```bash
# Iniciar servidor HTTP na porta 80
ord --bitcoin-data-dir /Volumes/D1/bitcoin server --http-port 80

# Ou usar porta diferente (ex: 8080)
ord --bitcoin-data-dir /Volumes/D1/bitcoin server --http-port 8080

# Testar conexão
curl http://localhost:80/
```

### Executar em Background

```bash
# Usando nohup
nohup ord --bitcoin-data-dir /Volumes/D1/bitcoin server --http-port 80 > ord.log 2>&1 &

# Ou criar serviço systemd (Linux)
# Ou usar launchd (MacOS)
```

---

## ⚙️ 3. Configurar o Marketplace

### Criar arquivo `.env`

Copie o arquivo de exemplo e edite com suas credenciais:

```bash
cp .env.example .env
nano .env
```

### Configuração `.env`

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Bitcoin Core RPC Configuration
BITCOIN_RPC_HOST=127.0.0.1
BITCOIN_RPC_PORT=8332
BITCOIN_RPC_USER=Tomkray7
BITCOIN_RPC_PASSWORD=bobeternallove77$
BITCOIN_NETWORK=mainnet

# Ord Server Configuration
ORD_SERVER_URL=http://localhost:80

# Database
DB_PATH=./server/db/marketplace.db
```

### Instalar Dependências

```bash
npm install
```

### Inicializar Database

```bash
npm run init-db
```

### Iniciar Servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

---

## ✅ 4. Verificar Conexões

### Testar API do Marketplace

```bash
# Health check básico
curl http://localhost:3000/api/health

# Status completo dos nodes
curl http://localhost:3000/api/status
```

Resposta esperada:

```json
{
  "status": "ok",
  "version": "0.23.3",
  "timestamp": "2025-10-09T...",
  "nodes": {
    "bitcoin": {
      "connected": true,
      "chain": "main",
      "blocks": 867234,
      "headers": 867234,
      "sync": "100.00%",
      "error": null
    },
    "ord": {
      "connected": true,
      "status": "ok",
      "error": null
    }
  }
}
```

### Testar Endpoints

```bash
# Obter fees recomendadas
curl http://localhost:3000/api/psbt/fees

# Buscar inscription
curl http://localhost:3000/api/ordinals/1000

# Listar runes
curl http://localhost:3000/api/runes

# Verificar balance de endereço
curl http://localhost:3000/api/wallet/balance/bc1q...
```

---

## 🔍 5. Troubleshooting

### Bitcoin Core não conecta

```bash
# Verificar se está rodando
ps aux | grep bitcoind

# Verificar logs
tail -f /Volumes/D1/bitcoin/debug.log

# Testar RPC diretamente
bitcoin-cli -rpcuser=Tomkray7 -rpcpassword=bobeternallove77$ getblockchaininfo
```

### Ord Server não conecta

```bash
# Verificar se está rodando
ps aux | grep ord

# Verificar porta
lsof -i :80

# Testar diretamente
curl http://localhost:80/

# Verificar logs
tail -f ord.log
```

### Marketplace retorna erros

```bash
# Verificar logs do servidor
npm run dev

# Verificar variáveis de ambiente
cat .env

# Testar conexões individualmente
node -e "import('./server/utils/bitcoinRpc.js').then(m => m.default.testConnection().then(console.log))"
```

### Problemas de permissão (porta 80)

```bash
# Usar porta diferente (ex: 8080)
ord --bitcoin-data-dir /Volumes/D1/bitcoin server --http-port 8080

# Atualizar .env
ORD_SERVER_URL=http://localhost:8080

# Ou usar sudo (não recomendado)
sudo ord server --http-port 80
```

---

## 📊 6. Monitoramento

### Scripts úteis

```bash
# Verificar status Bitcoin
watch -n 5 'bitcoin-cli getblockchaininfo'

# Verificar mempool
bitcoin-cli getmempoolinfo

# Verificar ord
curl http://localhost:80/ | jq

# Verificar marketplace
curl http://localhost:3000/api/status | jq
```

### Logs importantes

```bash
# Bitcoin Core
tail -f /Volumes/D1/bitcoin/debug.log

# Ord Server
tail -f ord.log

# Marketplace
tail -f npm-debug.log
```

---

## 🚀 7. Performance

### Otimização Bitcoin Core

- Use SSD para melhor I/O
- Aumente `dbcache` se tiver RAM disponível (recomendado: 8192MB)
- Use `txindex=1` para queries mais rápidas
- Ajuste `maxconnections` baseado na sua banda

### Otimização Ord

- Índice completo pode ocupar ~100GB adicionais
- Use `--index-sats` apenas se necessário
- Considere usar `--first-inscription-height` para pular blocos antigos

### Otimização Marketplace

- Use PostgreSQL em vez de SQLite para alta carga
- Implemente cache Redis para queries frequentes
- Configure rate limiting para prevenir abuse
- Use CDN para servir conteúdo de inscriptions

---

## 📚 Recursos Adicionais

- [Bitcoin Core Documentation](https://bitcoin.org/en/bitcoin-core/)
- [Ord Documentation](https://docs.ordinals.com/)
- [Ordinals Theory Handbook](https://docs.ordinals.com/guides.html)
- [BIP-0174: PSBT](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)

---

## 🆘 Suporte

Se encontrar problemas:

1. Verifique todos os logs
2. Confirme que ambos os nodes estão sincronizados
3. Teste conexões individuais
4. Verifique as credenciais no `.env`
5. Consulte a documentação oficial

---

**✨ Seu marketplace está pronto para funcionar!**








