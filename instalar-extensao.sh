#!/bin/bash

# 🔥 Script de Instalação da MyWallet Extension

echo ""
echo "🔥 =========================================="
echo "   INSTALANDO MYWALLET EXTENSION"
echo "=========================================="
echo ""

# Verificar se a pasta existe
EXTENSION_PATH="/Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension"

if [ ! -d "$EXTENSION_PATH" ]; then
    echo "❌ Erro: Pasta da extensão não encontrada!"
    exit 1
fi

echo "✅ Pasta da extensão encontrada!"
echo "📁 Path: $EXTENSION_PATH"
echo ""

# Verificar arquivos necessários
echo "📋 Verificando arquivos..."

if [ ! -f "$EXTENSION_PATH/manifest.json" ]; then
    echo "❌ manifest.json não encontrado!"
    exit 1
fi

if [ ! -d "$EXTENSION_PATH/popup" ]; then
    echo "❌ Pasta popup/ não encontrada!"
    exit 1
fi

if [ ! -d "$EXTENSION_PATH/background" ]; then
    echo "❌ Pasta background/ não encontrada!"
    exit 1
fi

if [ ! -d "$EXTENSION_PATH/content" ]; then
    echo "❌ Pasta content/ não encontrada!"
    exit 1
fi

echo "✅ Todos os arquivos necessários presentes!"
echo ""

# Mostrar estrutura
echo "📦 Estrutura da extensão:"
ls -la "$EXTENSION_PATH" | grep -v "^total" | tail -n +2
echo ""

# Abrir Chrome na página de extensões
echo "🚀 Abrindo Chrome Extensions..."
echo ""
echo "⚠️  INSTRUÇÕES:"
echo ""
echo "1. O Chrome vai abrir em chrome://extensions/"
echo "2. Ative o 'Modo do desenvolvedor' (canto superior direito)"
echo "3. Clique em 'Carregar sem compactação'"
echo "4. A pasta já estará selecionada! Clique 'Selecionar'"
echo "5. ✅ Pronto!"
echo ""

# Aguardar confirmação
read -p "Pressione ENTER para abrir o Chrome..."

# Abrir Chrome na página de extensões
if command -v google-chrome &> /dev/null; then
    google-chrome "chrome://extensions/" &
elif command -v chromium &> /dev/null; then
    chromium "chrome://extensions/" &
elif [ -d "/Applications/Google Chrome.app" ]; then
    open -a "Google Chrome" "chrome://extensions/"
elif [ -d "/Applications/Brave Browser.app" ]; then
    open -a "Brave Browser" "brave://extensions/"
else
    echo "⚠️  Chrome não encontrado automaticamente."
    echo "Por favor, abra manualmente: chrome://extensions/"
fi

echo ""
echo "📂 Caminho para copiar (se necessário):"
echo "$EXTENSION_PATH"
echo ""

# Copiar para área de transferência (macOS)
if command -v pbcopy &> /dev/null; then
    echo "$EXTENSION_PATH" | pbcopy
    echo "✅ Caminho copiado para área de transferência!"
    echo ""
fi

echo "🎉 Quando a extensão estiver instalada, teste:"
echo ""
echo "1. Abra: http://localhost:3000"
echo "2. Console (F12): console.log(window.myWallet)"
echo "3. Deve mostrar o objeto com os métodos"
echo ""
echo "=========================================="
echo "🔥 MyWallet Extension - Pronta!"
echo "=========================================="
echo ""



