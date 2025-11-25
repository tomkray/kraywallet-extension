#!/bin/bash

# Script para reiniciar o servidor com as correções de Runes

echo "🔄 Reiniciando servidor com correções de Runes..."
echo ""

# Parar servidor antigo
echo "⏹️  Parando servidor antigo..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "   Nenhum servidor rodando na porta 3000"

# Aguardar porta liberar
sleep 2

# Iniciar novo servidor (ARQUIVO CORRETO!)
echo ""
echo "🚀 Iniciando servidor com correções..."
cd /Users/tomkray/Desktop/PSBT-Ordinals
node server/index.js

# O servidor vai rodar em foreground e mostrar logs
