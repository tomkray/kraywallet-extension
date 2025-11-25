#!/bin/bash

echo ""
echo "🔍 ====================================="
echo "   VERIFICAÇÃO COMPLETA - RUNES SYSTEM"
echo "====================================="
echo ""

# 1. Verificar se backend está rodando
echo "1️⃣  Verificando Backend..."
BACKEND_PID=$(ps aux | grep "node server/index.js" | grep -v grep | awk '{print $2}')
if [ -z "$BACKEND_PID" ]; then
    echo "   ❌ Backend NÃO está rodando"
    echo "   💡 Iniciando backend..."
    cd /Users/tomkray/Desktop/PSBT-Ordinals
    node server/index.js > backend-verify.log 2>&1 &
    sleep 5
    echo "   ✅ Backend iniciado!"
else
    echo "   ✅ Backend está rodando (PID: $BACKEND_PID)"
fi

echo ""

# 2. Verificar se ORD server está rodando
echo "2️⃣  Verificando ORD Server..."
if curl -s "http://127.0.0.1:80" > /dev/null 2>&1; then
    echo "   ✅ ORD Server está rodando (porta 80)"
else
    echo "   ❌ ORD Server NÃO está respondendo na porta 80"
    echo "   💡 Certifique-se de iniciar o ord server!"
fi

echo ""

# 3. Testar API de Runes
echo "3️⃣  Testando API de Runes..."
sleep 2
RESPONSE=$(curl -s "http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx")

if echo "$RESPONSE" | grep -q "DOG"; then
    echo "   ✅ API está funcionando!"
    echo "   ✅ Rune encontrada: DOG•GO•TO•THE•MOON"
    
    # Extrair detalhes
    AMOUNT=$(echo "$RESPONSE" | grep -o '"amount":"[^"]*"' | head -1 | cut -d'"' -f4)
    SYMBOL=$(echo "$RESPONSE" | grep -o '"symbol":"[^"]*"' | head -1)
    PARENT=$(echo "$RESPONSE" | grep -o '"parent":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    echo "   📊 Amount: $AMOUNT"
    echo "   🐕 Symbol: $SYMBOL"
    
    if [ ! -z "$PARENT" ]; then
        echo "   ✅ Parent inscription encontrado!"
    else
        echo "   ⚠️  Parent não encontrado (pode ser problema no parser)"
    fi
else
    echo "   ❌ API não retornou runes"
    echo "   Response: $RESPONSE"
fi

echo ""

# 4. Verificar arquivos críticos
echo "4️⃣  Verificando arquivos críticos..."

FILES=(
    "/Users/tomkray/Desktop/PSBT-Ordinals/server/utils/runesDecoder.js"
    "/Users/tomkray/Desktop/PSBT-Ordinals/server/routes/runes.js"
    "/Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension/background/background-real.js"
    "/Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension/popup/popup.js"
)

ALL_OK=true
for FILE in "${FILES[@]}"; do
    if [ -f "$FILE" ]; then
        echo "   ✅ $(basename $FILE)"
    else
        echo "   ❌ FALTANDO: $(basename $FILE)"
        ALL_OK=false
    fi
done

echo ""

# 5. Resumo
echo "🎯 ====================================="
echo "   RESUMO"
echo "====================================="
echo ""

if [ ! -z "$BACKEND_PID" ] && echo "$RESPONSE" | grep -q "DOG"; then
    echo "✅ SISTEMA PRONTO PARA TESTAR!"
    echo ""
    echo "📋 Próximo passo:"
    echo "   1. Abra o Chrome: chrome://extensions/"
    echo "   2. Ative 'Developer mode'"
    echo "   3. Clique 'Load unpacked'"
    echo "   4. Selecione: /Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension/"
    echo "   5. Abra a extensão e vá na tab 'Runes'"
    echo ""
    echo "📖 Guia completo: TESTAR_AGORA.md"
else
    echo "⚠️  ATENÇÃO: Sistema com problemas"
    echo ""
    if [ -z "$BACKEND_PID" ]; then
        echo "   ❌ Backend não está rodando"
    fi
    if ! echo "$RESPONSE" | grep -q "DOG"; then
        echo "   ❌ API não está retornando runes"
    fi
    echo ""
    echo "📖 Veja TESTAR_AGORA.md para debug"
fi

echo ""
echo "====================================="


