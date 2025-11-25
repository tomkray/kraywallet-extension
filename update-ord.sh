#!/bin/bash

# 🔄 Script de Atualização Automática do Ord
# Atualiza de 0.23.2 para 0.23.3 com segurança

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ORD_DIR="/Volumes/D1/Ord"
ORD_BINARY="$ORD_DIR/ord"

echo -e "${CYAN}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        🔄 ATUALIZAÇÃO AUTOMÁTICA - ORD 0.23.3               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Verificar se está rodando como root/sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Este script precisa ser executado com sudo!${NC}"
    echo "   Execute: sudo bash update-ord.sh"
    exit 1
fi

# Passo 1: Verificar versão atual
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  1️⃣  Verificando versão atual...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ ! -f "$ORD_BINARY" ]; then
    echo -e "${RED}❌ Ord não encontrado em $ORD_BINARY${NC}"
    exit 1
fi

CURRENT_VERSION=$($ORD_BINARY --version 2>&1 || echo "unknown")
echo -e "   Versão atual: ${YELLOW}$CURRENT_VERSION${NC}"

# Passo 2: Parar Ord Server
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  2️⃣  Parando Ord Server...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

pkill -9 ord 2>/dev/null || true
sleep 2

# Verificar se parou
if pgrep -x ord > /dev/null; then
    echo -e "${RED}❌ Ord Server ainda está rodando!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Ord Server parado com sucesso${NC}"

# Passo 3: Backup
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  3️⃣  Fazendo backup...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

BACKUP_FILE="$ORD_DIR/ord.backup.$(date +%Y%m%d_%H%M%S)"
cp "$ORD_BINARY" "$BACKUP_FILE"

echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"

# Passo 4: Procurar novo binário
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  4️⃣  Localizando novo binário...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Procurar em locais comuns
SEARCH_PATHS=(
    "$HOME/Downloads/ord"
    "$HOME/Desktop/ord"
    "$ORD_DIR/ord-new"
    "$ORD_DIR/ord.0.23.3"
)

NEW_ORD=""
for path in "${SEARCH_PATHS[@]}"; do
    if [ -f "$path" ]; then
        NEW_ORD="$path"
        break
    fi
done

if [ -z "$NEW_ORD" ]; then
    echo -e "${YELLOW}⚠️  Novo binário não encontrado automaticamente${NC}"
    echo ""
    read -p "   Digite o caminho completo do novo ord: " NEW_ORD
    
    if [ ! -f "$NEW_ORD" ]; then
        echo -e "${RED}❌ Arquivo não encontrado: $NEW_ORD${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Novo binário encontrado: $NEW_ORD${NC}"

# Verificar versão do novo binário
NEW_VERSION=$($NEW_ORD --version 2>&1 || echo "unknown")
echo -e "   Nova versão: ${GREEN}$NEW_VERSION${NC}"

# Passo 5: Substituir
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  5️⃣  Substituindo binário...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cp "$NEW_ORD" "$ORD_BINARY"
chmod +x "$ORD_BINARY"

echo -e "${GREEN}✅ Binário substituído${NC}"

# Verificar nova versão instalada
INSTALLED_VERSION=$($ORD_BINARY --version 2>&1)
echo -e "   Versão instalada: ${GREEN}$INSTALLED_VERSION${NC}"

# Passo 6: Reiniciar
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  6️⃣  Reiniciando Ord Server...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verificar se existe script de start
if [ -f "$ORD_DIR/start_ord.sh" ]; then
    cd "$ORD_DIR"
    ./start_ord.sh
    echo -e "${GREEN}✅ Ord Server iniciado via script${NC}"
else
    # Iniciar manualmente
    nohup $ORD_BINARY \
        --data-dir /Volumes/D1/Ord/data \
        --bitcoin-rpc-username Tomkray7 \
        --bitcoin-rpc-password 'bobeternallove77$' \
        --commit-interval 50 \
        --bitcoin-rpc-limit 50 \
        --index-cache-size 8589934592 \
        --index-runes \
        --index-sats \
        --index-transactions \
        server --http-port 80 > /tmp/ord.log 2>&1 &
    
    echo -e "${GREEN}✅ Ord Server iniciado manualmente${NC}"
fi

# Aguardar inicialização
echo -e "${YELLOW}   Aguardando inicialização (30s)...${NC}"
sleep 30

# Passo 7: Testar
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  7️⃣  Testando conexão...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if curl -s http://127.0.0.1:80/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ord Server respondendo!${NC}"
else
    echo -e "${RED}❌ Ord Server não está respondendo${NC}"
    echo -e "${YELLOW}   Verificar logs: tail -f /tmp/ord.log${NC}"
    exit 1
fi

# Testar marketplace
echo ""
echo -e "${BLUE}  Testando integração com marketplace...${NC}"

if curl -s http://localhost:3000/api/status > /dev/null 2>&1; then
    STATUS=$(curl -s http://localhost:3000/api/status | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['nodes']['ord']['connected'])" 2>/dev/null || echo "false")
    
    if [ "$STATUS" = "True" ] || [ "$STATUS" = "true" ]; then
        echo -e "${GREEN}✅ Marketplace conectado ao Ord Server!${NC}"
    else
        echo -e "${YELLOW}⚠️  Marketplace não conectou ainda (aguarde alguns segundos)${NC}"
    fi
fi

# Resumo final
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "   Versão anterior: $CURRENT_VERSION"
echo "   Versão nova:     $INSTALLED_VERSION"
echo ""
echo "   Backup em: $BACKUP_FILE"
echo ""
echo -e "${GREEN}🎉 Ord 0.23.3 instalado e funcionando!${NC}"
echo ""
echo "📝 Próximos passos:"
echo "   1. Testar: curl http://127.0.0.1:80/"
echo "   2. Verificar marketplace: http://localhost:3000/api/status"
echo "   3. Executar testes: npm test"
echo ""








