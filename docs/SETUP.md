# 🚀 Setup e Instalação - Ordinals Marketplace

Este guia explica como fazer o marketplace funcionar de verdade, com backend, banco de dados e integração com o protocolo Ordinals.

## 📋 Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  (HTML + CSS + JavaScript - Vanilla)                        │
│  - index.html (Marketplace)                                  │
│  - runes-swap.html (Swap)                                    │
│  - app.js / runes-swap.js                                    │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP/REST API
┌────────────────▼────────────────────────────────────────────┐
│                     Backend API                              │
│  (Node.js + Express)                                         │
│  - Routes: ordinals, runes, offers, wallet, psbt            │
│  - Gerenciamento de ofertas PSBT                            │
│  - Cálculos de swap e pools                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
┌────▼──────┐       ┌────────▼─────────┐
│  SQLite   │       │  ord CLI / RPC   │
│ Database  │       │  (Bitcoin Core)  │
│           │       │                  │
│- Inscrip. │       │- PSBT creation   │
│- Runes    │       │- Signing         │
│- Offers   │       │- Broadcasting    │
│- Pools    │       │- Indexing        │
└───────────┘       └──────────────────┘
```

## 🔧 Pré-requisitos

### 1. Node.js e npm
```bash
# Verificar instalação
node --version  # v18+ recomendado
npm --version   # v9+ recomendado

# Instalar se necessário
# macOS
brew install node

# Linux
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. ord CLI (Ordinals)
```bash
# Instalar Rust (necessário para compilar ord)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Instalar ord
cargo install ord

# Verificar instalação
ord --version  # Deve mostrar 0.23.3 ou superior
```

### 3. Bitcoin Core (Opcional mas recomendado)
```bash
# Download de bitcoin.org/download
# Ou via package manager:

# macOS
brew install bitcoin

# Linux
sudo apt-get install bitcoind
```

## 📦 Instalação

### 1. Instalar Dependências

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Instalar pacotes npm
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com seus dados
nano .env
```

Configuração mínima:
```env
PORT=3000
NODE_ENV=development
ORD_SERVER_URL=http://localhost:80
DB_PATH=./server/db/ordinals.db
DEFAULT_FEE_RATE=10
```

### 3. Inicializar Banco de Dados

```bash
npm run init-db
```

Isso vai:
- Criar o arquivo SQLite
- Criar todas as tabelas
- Inserir dados de exemplo
- Indexar para performance

### 4. Iniciar Servidor

```bash
# Modo desenvolvimento (com auto-reload)
npm run dev

# Ou modo produção
npm start
```

Você deve ver:
```
✅ Database initialized
🚀 Ordinals Marketplace Server running!
📍 URL: http://localhost:3000
🔧 Environment: development
⚡ Ordinals Protocol: v0.23.3
```

### 5. Acessar Aplicação

Abra no navegador:
```
http://localhost:3000
```

## 🔌 Integração com ord CLI

### Setup do ord Server

1. **Sincronizar Bitcoin Core** (se usando node local):
```bash
# Iniciar Bitcoin Core
bitcoind -txindex -daemon

# Aguardar sincronização (pode levar dias)
bitcoin-cli getblockchaininfo
```

2. **Iniciar ord server**:
```bash
# Criar diretório para dados
mkdir -p ~/.ord

# Iniciar servidor ord
ord server --http-port 80
```

3. **Testar conexão**:
```bash
# Listar inscriptions
curl http://localhost:80/inscriptions

# Buscar inscription específica
curl http://localhost:80/inscription/INSCRIPTION_ID
```

### Criar Ofertas Reais com PSBT

```bash
# Criar wallet
ord wallet create

# Ver endereço
ord wallet receive

# Criar oferta (novo na v0.23.3)
ord wallet offer create <INSCRIPTION_ID> \
  --amount 1000000 \
  --fee-rate 10

# Submeter oferta diretamente (novo na v0.23.3)
ord wallet offer create <INSCRIPTION_ID> \
  --amount 1000000 \
  --fee-rate 10 \
  --submit

# Sweep wallet (novo na v0.23.3)
ord wallet sweep <ADDRESS> --fee-rate 10
```

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

1. **inscriptions** - Ordinals/Inscriptions
   - id (TEXT, PRIMARY KEY)
   - inscription_number (INTEGER, UNIQUE)
   - content, content_type
   - price, listed, owner

2. **runes** - Runes tokens
   - id, name, symbol
   - total_supply, minted
   - decimals

3. **rune_balances** - Saldos de runes
   - address, rune_id, balance

4. **offers** - Ofertas PSBT
   - id, type (inscription/rune_swap)
   - psbt, status, creator_address
   - inscription_id, from_rune, to_rune

5. **liquidity_pools** - Pools para swap
   - rune_a, rune_b
   - reserve_a, reserve_b
   - total_liquidity, volume_24h

6. **trades** - Histórico de trades
   - from_rune, to_rune
   - amounts, price, txid

7. **wallet_sweeps** - Sweeps de wallet
   - from_address, to_address
   - amount, psbt, status

## 🔄 API Endpoints

### Ordinals
- `GET /api/ordinals` - Listar inscriptions
- `GET /api/ordinals/:id` - Buscar específica
- `POST /api/ordinals/:id/list` - Listar para venda
- `DELETE /api/ordinals/:id/unlist` - Remover da venda

### Runes
- `GET /api/runes` - Listar runes
- `GET /api/runes/:id` - Buscar rune
- `GET /api/runes/:id/balance/:address` - Balance
- `GET /api/runes/pools` - Pools de liquidez
- `POST /api/runes/quote` - Cotação de swap

### Offers
- `GET /api/offers` - Listar ofertas
- `POST /api/offers` - Criar oferta
- `PUT /api/offers/:id/submit` - Submeter oferta ⚡ NOVO v0.23.3
- `PUT /api/offers/:id/cancel` - Cancelar
- `PUT /api/offers/:id/complete` - Completar

### Wallet
- `POST /api/wallet/sweep` - Criar sweep ⚡ NOVO v0.23.3
- `GET /api/wallet/sweeps/:address` - Listar sweeps
- `PUT /api/wallet/sweeps/:id/broadcast` - Broadcast sweep
- `GET /api/wallet/balance/:address` - Balance

### PSBT
- `POST /api/psbt/create` - Criar PSBT
- `POST /api/psbt/decode` - Decodificar PSBT
- `POST /api/psbt/broadcast` - Broadcast

## 🔐 Integração com Wallets

### Wallets Suportadas

1. **Unisat** - Recomendado para Ordinals
2. **Xverse** - Suporte completo
3. **Leather (Hiro)** - Bitcoin + Stacks
4. **OKX Wallet** - Multi-chain

### Conectar Wallet (Frontend)

```javascript
// Unisat
async function connectUnisat() {
    if (typeof window.unisat !== 'undefined') {
        const accounts = await window.unisat.requestAccounts();
        return accounts[0];
    }
}

// Xverse
async function connectXverse() {
    const getAddressOptions = {
        payload: {
            purposes: ['ordinals', 'payment'],
            message: 'Connect to Ordinals Marketplace',
            network: { type: 'Mainnet' }
        },
        onFinish: (response) => {
            return response.addresses[0].address;
        }
    };
    await window.XverseProviders.BitcoinProvider.request('getAddresses', getAddressOptions);
}
```

## 🚀 Produção

### Deploy Recomendado

1. **Frontend**: Vercel, Netlify, GitHub Pages
2. **Backend**: Railway, Render, DigitalOcean
3. **Database**: SQLite (pequeno) ou PostgreSQL (grande escala)
4. **ord Server**: VPS dedicado com Bitcoin Core

### Variáveis de Ambiente - Produção

```env
NODE_ENV=production
PORT=3000

# Use serviços externos para não precisar rodar node
ORD_API_URL=https://api.hiro.so
# ou
ORD_API_URL=https://open-api.unisat.io

# PostgreSQL (se migrar de SQLite)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis para cache
REDIS_URL=redis://host:6379

# Sentry para erros
SENTRY_DSN=https://...
```

### Docker (Opcional)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build
docker build -t ordinals-marketplace .

# Run
docker run -p 3000:3000 ordinals-marketplace
```

## 📊 Monitoramento

### Logs
```bash
# Development
npm run dev

# Production com PM2
npm install -g pm2
pm2 start server/index.js --name ordinals-market
pm2 logs ordinals-market
pm2 monit
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

## 🐛 Troubleshooting

### Erro: Database locked
```bash
# SQLite em uso por outro processo
lsof server/db/ordinals.db
# Matar processo se necessário
```

### Erro: ord not found
```bash
# Adicionar ao PATH
export PATH="$HOME/.cargo/bin:$PATH"
```

### Erro: CORS
```javascript
// Adicionar domínio permitido em server/index.js
app.use(cors({
    origin: ['http://localhost:3000', 'https://seu-dominio.com']
}));
```

## 📚 Recursos Adicionais

- [Ordinals Handbook](https://docs.ordinals.com)
- [PSBT Specification (BIP 174)](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)
- [ord CLI Documentation](https://github.com/ordinals/ord)
- [Bitcoin Core RPC](https://developer.bitcoin.org/reference/rpc/)

## 🤝 Suporte

Se encontrar problemas:
1. Verifique os logs do servidor
2. Teste endpoints individualmente
3. Confirme que ord CLI está funcionando
4. Verifique permissões do banco de dados

---

**Pronto! Agora você tem um marketplace funcional de Ordinals com PSBT! 🎉**











