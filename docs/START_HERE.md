# 🚀 START HERE - Guia de Início Rápido

## ✅ Sua Configuração Atual

Você já tem os seguintes nodes configurados e rodando:

### Bitcoin Core
- **Host**: 127.0.0.1
- **Port**: 8332
- **Network**: mainnet
- **User**: Tomkray7
- **TxIndex**: ✅ Habilitado
- **Data Directory**: /Volumes/D1/bitcoin

### Ord Server
- **URL**: http://localhost:80
- **Network**: mainnet

---

## 📝 Passos para Configurar o Marketplace

### 1. Criar arquivo .env

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

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

# Optional: API Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Instalar Dependências

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm install
```

### 3. Inicializar Database

```bash
npm run init-db
```

### 4. Testar Conexões

```bash
npm test
```

Isso vai testar:
- ✅ Conexão com Bitcoin Core
- ✅ Conexão com Ord Server
- ✅ APIs do marketplace

### 5. Iniciar o Servidor

```bash
# Modo desenvolvimento (com auto-reload)
npm run dev

# Ou modo produção
npm start
```

O servidor vai iniciar em: **http://localhost:3000**

---

## 🔍 Verificar Status

### Abra no navegador:
```
http://localhost:3000/api/status
```

Você deve ver algo como:

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
      "sync": "100.00%"
    },
    "ord": {
      "connected": true,
      "status": "ok"
    }
  }
}
```

---

## 🧪 Testar APIs

### Obter Fees Recomendadas

```bash
curl http://localhost:3000/api/psbt/fees | jq
```

Resultado esperado:
```json
{
  "success": true,
  "fees": {
    "fast": 20,
    "medium": 10,
    "slow": 1
  }
}
```

### Buscar Inscription

```bash
curl http://localhost:3000/api/ordinals/1000 | jq
```

### Listar Runes

```bash
curl http://localhost:3000/api/runes | jq
```

### Verificar Balance de um Endereço

```bash
curl "http://localhost:3000/api/wallet/balance/bc1q..." | jq
```

---

## 🎨 Usar o Frontend

1. Abra o navegador em: **http://localhost:3000**

2. Você verá a interface do marketplace

3. Clique em "Connect Wallet" (se tiver uma wallet extension)

4. Navegue pelas tabs:
   - **Marketplace** - Ver e negociar inscriptions
   - **Runes** - Ver e trocar runes
   - **Create Offer** - Criar ofertas de venda
   - **My Offers** - Gerenciar suas ofertas

---

## 🚨 Troubleshooting

### Erro: Cannot connect to Bitcoin Core

**Verificar se está rodando:**
```bash
ps aux | grep bitcoind
```

**Se não estiver, iniciar:**
```bash
bitcoind -daemon
```

**Testar conexão manual:**
```bash
bitcoin-cli -rpcuser=Tomkray7 -rpcpassword='bobeternallove77$' getblockchaininfo
```

### Erro: Cannot connect to Ord Server

**Verificar se está rodando:**
```bash
ps aux | grep ord
lsof -i :80
```

**Se não estiver, iniciar:**
```bash
# Com sudo se necessário para porta 80
sudo ord --bitcoin-data-dir /Volumes/D1/bitcoin server --http-port 80

# Ou use porta diferente (8080) e atualize o .env
ord --bitcoin-data-dir /Volumes/D1/bitcoin server --http-port 8080
```

Se usar porta 8080, atualize o `.env`:
```env
ORD_SERVER_URL=http://localhost:8080
```

**Testar conexão manual:**
```bash
curl http://localhost:80/
```

### Erro: Module not found

```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Erro: Database initialization failed

```bash
# Recriar database
rm -rf server/db/marketplace.db
npm run init-db
```

---

## 📊 Monitoramento

### Ver logs do Bitcoin Core
```bash
tail -f /Volumes/D1/bitcoin/debug.log
```

### Ver logs do Marketplace
O servidor mostra logs no terminal onde foi iniciado.

### Ver status detalhado dos nodes
```bash
# Via terminal
npm test

# Via navegador
http://localhost:3000/api/status
```

---

## 🎯 Próximos Passos

1. ✅ Testar todas as APIs (ver API_REFERENCE.md)
2. ✅ Explorar o frontend
3. ✅ Criar ofertas de teste
4. ✅ Testar swaps de runes
5. 📚 Ler a documentação completa:
   - `NODE_SETUP.md` - Setup detalhado
   - `API_REFERENCE.md` - Referência completa da API
   - `ARCHITECTURE.md` - Arquitetura do sistema

---

## 💡 Dicas

- Use **Ctrl+C** para parar o servidor
- Use `npm run dev` para desenvolvimento (auto-reload)
- Use `npm start` para produção
- Sempre verifique `http://localhost:3000/api/status` antes de começar
- Mantenha o Bitcoin Core e Ord Server sempre rodando enquanto usa o marketplace

---

## 🆘 Precisa de Ajuda?

1. Verifique os logs no terminal
2. Teste as conexões: `npm test`
3. Verifique o status da API: `/api/status`
4. Consulte a documentação completa nos arquivos *.md
5. Verifique se ambos os nodes estão sincronizados

---

**🎉 Pronto! Seu marketplace está configurado e funcionando!**

Agora você pode usar todas as funcionalidades:
- ✅ Negociar Ordinals com PSBT
- ✅ Fazer swap de Runes
- ✅ Criar e gerenciar ofertas
- ✅ Consultar balances e UTXOs
- ✅ E muito mais!








