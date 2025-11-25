#!/bin/bash

echo "🧹 LIMPANDO MEMÓRIA E PROCESSOS"
echo "================================"
echo ""

# 1. Parar processos Node duplicados
echo "1️⃣ Parando processos Node duplicados..."
pkill -9 node
sleep 2
echo "✅ Nodes parados"
echo ""

# 2. Liberar porta 3000
echo "2️⃣ Liberando porta 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
echo "✅ Porta 3000 livre"
echo ""

# 3. Fechar apps pesados (opcional - comente se não quiser)
echo "3️⃣ Sugestões para liberar memória:"
echo "   ⚠️  ORD Server está usando 7.3GB de RAM!"
echo "   💡 Considere fechar:"
echo "      - Discord (500MB)"
echo "      - Chrome tabs desnecessárias"
echo "      - Adobe apps se não estiver usando"
echo ""

# 4. Verificar memória
echo "4️⃣ Uso atual de memória:"
vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("%-16s % 16.2f MB\n", "$1:", $2 * $size / 1048576);'
echo ""

# 5. Load average
echo "5️⃣ Load Average:"
uptime
echo ""

echo "✅ Limpeza concluída!"
echo ""
echo "🚀 Agora você pode reiniciar o servidor:"
echo "   cd /Users/tomkray/Desktop/PSBT-Ordinals"
echo "   npm start"
echo ""


