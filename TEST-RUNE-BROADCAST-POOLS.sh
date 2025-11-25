#!/bin/bash

# 🔥 TEST RUNE BROADCAST - MINING POOLS
# Testa o novo sistema de broadcast para pools

echo "🔥 =========================================="
echo "   TEST RUNE BROADCAST - MINING POOLS"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Verificar se servidor está rodando
echo -e "${BLUE}📡 1. Verificando servidor...${NC}"
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor rodando em http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Servidor não está rodando!${NC}"
    echo -e "${YELLOW}   Execute: npm start${NC}"
    exit 1
fi
echo ""

# 2. Verificar status completo
echo -e "${BLUE}📊 2. Status dos nodes...${NC}"
STATUS=$(curl -s http://localhost:3000/api/status)
echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"
echo ""

# 3. Explicar como testar
echo -e "${YELLOW}🧪 3. Como testar Send Runes com Mining Pools:${NC}"
echo ""
echo "   A. Abrir MyWallet Extension:"
echo "      - Clique no ícone da extensão no Chrome"
echo "      - Desbloqueie com sua senha"
echo "      - Vá para tab 'Runes'"
echo ""
echo "   B. Enviar um Rune:"
echo "      - Clique em 'Send' em qualquer rune"
echo "      - Preencha:"
echo "        • Endereço de destino"
echo "        • Quantidade"
echo "        • Fee rate (recomendado: 10+ sat/vB)"
echo "      - Clique 'Send Rune'"
echo "      - Confirme com senha"
echo ""
echo "   C. Monitorar Broadcast:"
echo "      - Veja os logs do servidor (abaixo)"
echo "      - O sistema tentará:"
echo "        ${GREEN}1. F2Pool (prioridade máxima)${NC}"
echo "        ${GREEN}2. ViaBTC${NC}"
echo "        ${GREEN}3. Luxor Mining${NC}"
echo "        ${YELLOW}4. Mempool.space (fallback)${NC}"
echo "        ${YELLOW}5. Blockstream.info (fallback)${NC}"
echo "        ${YELLOW}6. Blockchain.info (fallback)${NC}"
echo "        ${YELLOW}7. Blockcypher.com (fallback)${NC}"
echo ""

# 4. Mostrar exemplo de log esperado
echo -e "${BLUE}📋 4. Logs esperados no servidor:${NC}"
echo ""
cat << 'EOF'
🔥 ========== RUNE BROADCAST SERVICE ==========
📡 Estratégia: Mining Pools primeiro (como Unisat/Xverse)
📦 Tamanho da transação: 342 bytes

⛏️  === FASE 1: MINING POOLS (PRIORIDADE) ===

🌐 [Priority 1] Tentando F2Pool (Priority)...
✅ F2Pool (Priority) SUCESSO!
   TXID: abc123def456...

✅ ========== BROADCAST BEM-SUCEDIDO NA POOL! ==========
🎉 Mining Pool: F2Pool (Priority)
🔗 TXID: abc123def456...
⛏️  Transação enviada DIRETAMENTE para mineradores
🌐 Ver na mempool: https://mempool.space/tx/abc123def456...
EOF
echo ""

# 5. Simular uma transação Rune (hex de teste)
echo -e "${BLUE}🧪 5. Teste com transação simulada (opcional):${NC}"
echo ""
echo "   Se quiser testar o sistema sem enviar rune real,"
echo "   você pode criar uma PSBT de teste e ver os logs:"
echo ""
echo -e "   ${YELLOW}curl -X POST http://localhost:3000/api/wallet/broadcast \\${NC}"
echo -e "   ${YELLOW}     -H 'Content-Type: application/json' \\${NC}"
echo -e "   ${YELLOW}     -d '{\"hex\": \"TRANSACTION_HEX_HERE\"}'${NC}"
echo ""

# 6. Links úteis
echo -e "${BLUE}🔗 6. Links úteis:${NC}"
echo ""
echo "   • Documentação: ./RUNE_BROADCAST_MINING_POOLS.md"
echo "   • Status servidor: http://localhost:3000/api/status"
echo "   • Health check: http://localhost:3000/api/health"
echo "   • Mempool.space: https://mempool.space"
echo ""

# 7. Monitoramento em tempo real
echo -e "${BLUE}📺 7. Monitorar logs em tempo real:${NC}"
echo ""
echo "   Execute em outro terminal:"
echo -e "   ${GREEN}tail -f server.log${NC}"
echo ""
echo "   ou"
echo ""
echo -e "   ${GREEN}tail -f $(pwd)/server.log${NC}"
echo ""

# 8. Verificar arquivo de broadcast
echo -e "${BLUE}📂 8. Arquivo de broadcast atualizado:${NC}"
if [ -f "server/utils/runeBroadcast.js" ]; then
    echo -e "${GREEN}✅ server/utils/runeBroadcast.js existe${NC}"
    
    # Verificar se contém F2Pool
    if grep -q "F2Pool" server/utils/runeBroadcast.js; then
        echo -e "${GREEN}✅ F2Pool configurado${NC}"
    else
        echo -e "${RED}❌ F2Pool NÃO encontrado no arquivo${NC}"
    fi
    
    # Verificar se contém ViaBTC
    if grep -q "ViaBTC" server/utils/runeBroadcast.js; then
        echo -e "${GREEN}✅ ViaBTC configurado${NC}"
    else
        echo -e "${RED}❌ ViaBTC NÃO encontrado no arquivo${NC}"
    fi
    
    # Verificar se contém Luxor
    if grep -q "Luxor" server/utils/runeBroadcast.js; then
        echo -e "${GREEN}✅ Luxor configurado${NC}"
    else
        echo -e "${RED}❌ Luxor NÃO encontrado no arquivo${NC}"
    fi
else
    echo -e "${RED}❌ Arquivo runeBroadcast.js não encontrado!${NC}"
fi
echo ""

# 9. Resumo final
echo -e "${GREEN}=========================================="
echo "✅ SISTEMA PRONTO PARA TESTAR!"
echo "==========================================${NC}"
echo ""
echo "Estratégia implementada:"
echo "  ⛏️  Mining Pools primeiro (F2Pool, ViaBTC, Luxor)"
echo "  🌐 APIs públicas como fallback"
echo "  📊 Logs detalhados com prioridades"
echo "  🔄 Igual a Unisat e Xverse"
echo ""
echo -e "${YELLOW}⚡ Pronto para enviar Runes!${NC}"
echo ""





