#!/bin/bash

# 🚀 Script de Setup Automático - PSBT Ordinals Marketplace
# Este script ajuda a configurar o ambiente e testar conexões

set -e

echo "🎨 =========================================="
echo "   PSBT Ordinals Marketplace - Setup"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Verificar dependências
echo "📋 Verificando dependências..."

if ! command_exists node; then
    echo -e "${RED}❌ Node.js não encontrado!${NC}"
    echo "   Instale Node.js 18+ de: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  Node.js versão $NODE_VERSION detectada. Recomendado: 18+${NC}"
fi

echo -e "${GREEN}✅ Node.js $(node -v) encontrado${NC}"

if ! command_exists npm; then
    echo -e "${RED}❌ npm não encontrado!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm $(npm -v) encontrado${NC}"

if ! command_exists bitcoin-cli; then
    echo -e "${YELLOW}⚠️  bitcoin-cli não encontrado no PATH${NC}"
    echo "   Bitcoin Core pode não estar instalado"
else
    echo -e "${GREEN}✅ Bitcoin Core encontrado${NC}"
fi

if ! command_exists ord; then
    echo -e "${YELLOW}⚠️  ord não encontrado no PATH${NC}"
    echo "   Ord pode não estar instalado"
else
    echo -e "${GREEN}✅ Ord encontrado${NC}"
fi

echo ""

# 2. Instalar dependências npm
echo "📦 Instalando dependências npm..."
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"
echo ""

# 3. Configurar .env
echo "⚙️  Configurando arquivo .env..."

if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env já existe${NC}"
    read -p "   Deseja sobrescrever? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "   Mantendo .env existente"
    else
        rm .env
    fi
fi

if [ ! -f ".env" ]; then
    echo "   Criando arquivo .env..."
    
    # Valores padrão
    PORT=3000
    BITCOIN_RPC_HOST="127.0.0.1"
    BITCOIN_RPC_PORT=8332
    BITCOIN_NETWORK="mainnet"
    ORD_SERVER_URL="http://localhost:80"
    
    # Perguntar credenciais RPC
    echo ""
    echo "   Digite suas credenciais do Bitcoin Core RPC:"
    read -p "   RPC User: " BITCOIN_RPC_USER
    read -sp "   RPC Password: " BITCOIN_RPC_PASSWORD
    echo ""
    
    # Perguntar porta do Ord
    read -p "   Porta do Ord Server [80]: " ORD_PORT
    ORD_PORT=${ORD_PORT:-80}
    ORD_SERVER_URL="http://localhost:${ORD_PORT}"
    
    # Criar arquivo .env
    cat > .env << EOF
# Server Configuration
PORT=${PORT}
NODE_ENV=development

# Bitcoin Core RPC Configuration
BITCOIN_RPC_HOST=${BITCOIN_RPC_HOST}
BITCOIN_RPC_PORT=${BITCOIN_RPC_PORT}
BITCOIN_RPC_USER=${BITCOIN_RPC_USER}
BITCOIN_RPC_PASSWORD=${BITCOIN_RPC_PASSWORD}
BITCOIN_NETWORK=${BITCOIN_NETWORK}

# Ord Server Configuration
ORD_SERVER_URL=${ORD_SERVER_URL}

# Database
DB_PATH=./server/db/marketplace.db

# Optional: API Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    
    echo -e "${GREEN}✅ Arquivo .env criado${NC}"
else
    echo -e "${GREEN}✅ Usando .env existente${NC}"
fi

echo ""

# 4. Inicializar database
echo "🗄️  Inicializando database..."
npm run init-db
echo -e "${GREEN}✅ Database inicializado${NC}"
echo ""

# 5. Testar conexões
echo "🔍 Testando conexões..."
echo ""

# Testar Bitcoin Core
echo "   Testando Bitcoin Core RPC..."
if command_exists bitcoin-cli; then
    source .env
    if bitcoin-cli -rpcuser="$BITCOIN_RPC_USER" -rpcpassword="$BITCOIN_RPC_PASSWORD" -rpcport="$BITCOIN_RPC_PORT" getblockchaininfo > /dev/null 2>&1; then
        BLOCKS=$(bitcoin-cli -rpcuser="$BITCOIN_RPC_USER" -rpcpassword="$BITCOIN_RPC_PASSWORD" -rpcport="$BITCOIN_RPC_PORT" getblockchaininfo | grep '"blocks"' | awk '{print $2}' | tr -d ',')
        echo -e "${GREEN}   ✅ Bitcoin Core conectado (Blocks: $BLOCKS)${NC}"
    else
        echo -e "${RED}   ❌ Erro ao conectar com Bitcoin Core${NC}"
        echo "      Verifique se o bitcoind está rodando"
        echo "      Verifique as credenciais no .env"
    fi
else
    echo -e "${YELLOW}   ⚠️  Não foi possível testar (bitcoin-cli não encontrado)${NC}"
fi

echo ""

# Testar Ord Server
echo "   Testando Ord Server..."
source .env
if curl -s "${ORD_SERVER_URL}/" > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Ord Server conectado${NC}"
else
    echo -e "${RED}   ❌ Erro ao conectar com Ord Server${NC}"
    echo "      Verifique se o ord server está rodando em ${ORD_SERVER_URL}"
fi

echo ""
echo ""

# 6. Resumo e próximos passos
echo "🎉 =========================================="
echo "   Setup Completo!"
echo "=========================================="
echo ""
echo "📝 Próximos passos:"
echo ""
echo "   1. Certifique-se que o Bitcoin Core está rodando:"
echo "      $ bitcoind -daemon"
echo ""
echo "   2. Certifique-se que o Ord Server está rodando:"
echo "      $ ord server --http-port 80"
echo ""
echo "   3. Inicie o marketplace:"
echo "      $ npm start"
echo ""
echo "   4. Acesse no navegador:"
echo "      http://localhost:3000"
echo ""
echo "   5. Verifique o status:"
echo "      http://localhost:3000/api/status"
echo ""
echo "📚 Documentação:"
echo "   - NODE_SETUP.md - Guia detalhado de configuração"
echo "   - API_REFERENCE.md - Referência completa da API"
echo "   - README.md - Visão geral do projeto"
echo ""
echo "=========================================="








