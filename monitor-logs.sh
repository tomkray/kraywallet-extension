#!/bin/bash

# Monitor de logs em tempo real para debug de Runes

echo "📊 ========== MONITOR DE LOGS - RUNES SEND =========="
echo ""
echo "✅ Monitorando servidor na porta 3000..."
echo "📡 Aguardando requisições de Send Runes..."
echo ""
echo "════════════════════════════════════════════════════"
echo ""

# Encontrar o PID do processo node rodando na porta 3000
PID=$(lsof -ti:3000 | head -1)

if [ -z "$PID" ]; then
    echo "❌ Nenhum servidor rodando na porta 3000"
    exit 1
fi

echo "✅ Servidor encontrado (PID: $PID)"
echo ""
echo "🔍 Logs ao vivo:"
echo "────────────────────────────────────────────────────"
echo ""

# Tail nos logs (se existir arquivo de log)
if [ -f "server.log" ]; then
    tail -f server.log
else
    echo "⚠️  Arquivo server.log não encontrado"
    echo "💡 Os logs devem aparecer no terminal onde você iniciou o servidor"
    echo ""
    echo "Para ver logs em tempo real, rode:"
    echo "   tail -f server.log"
fi

