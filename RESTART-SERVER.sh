#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║   🔄 REINICIANDO SERVIDOR KRAY WALLET 🚀                         ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Ir para o diretório do projeto
cd "/Volumes/D2/KRAY WALLET" || exit 1

# Parar processos na porta 3000
echo "🛑 Parando processos na porta 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 2

# Verificar se parou
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Erro: Processos ainda rodando na porta 3000"
    echo "   Por favor, pare manualmente com: kill -9 \$(lsof -ti:3000)"
    exit 1
fi

echo "✅ Porta 3000 liberada"
echo ""

# Iniciar servidor
echo "🚀 Iniciando servidor..."
echo ""
npm start

# Se falhar, mostrar erro
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro ao iniciar servidor!"
    echo "   Tente manualmente: cd /Volumes/D2/KRAY\\ WALLET && npm start"
    exit 1
fi

