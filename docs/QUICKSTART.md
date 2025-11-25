# ⚡ Guia de Início Rápido - 5 Minutos

## 🚀 Rodando em 3 Passos

### 1️⃣ Instalar Dependências

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Instalar pacotes
npm install
```

### 2️⃣ Configurar

```bash
# Copiar arquivo de configuração
cp .env.example .env

# O arquivo .env já está configurado para desenvolvimento local
# Não precisa mudar nada!
```

### 3️⃣ Iniciar

```bash
# Inicializar banco de dados e iniciar servidor
npm start
```

Pronto! Acesse: **http://localhost:3000**

---

## 📱 Testando o Marketplace

### Passo 1: Ver Inscriptions
- Abra http://localhost:3000
- Veja as inscriptions de exemplo na grid
- Use os filtros e busca

### Passo 2: Conectar Wallet (Opcional)
Para testar recursos avançados, instale uma wallet:

- **Unisat**: https://unisat.io
- **Xverse**: https://xverse.app

Clique em "Connect Wallet" e autorize a conexão.

### Passo 3: Criar Oferta PSBT
1. Vá para tab "Create Offer"
2. Insira um Inscription ID (use um dos exemplos)
3. Defina valor da oferta em satoshis
4. Marque "Auto-submit offer" para testar feature v0.23.3
5. Clique em "Create Offer"

### Passo 4: Testar Runes Swap
1. Vá para "Runes Swap"
2. Selecione runes para trocar
3. Insira quantidade
4. Veja cotação em tempo real
5. Crie swap PSBT

### Passo 5: Wallet Sweep
1. Vá para tab "Wallet Sweep"
2. Insira endereço de destino (teste: bc1q...)
3. Configure fee rate
4. Gere PSBT de sweep

---

## 🗄️ Dados de Teste

O banco de dados já vem com dados de exemplo:

### Inscriptions:
- 6 inscriptions listadas para venda
- Preços variam de 0.00075 a 0.005 BTC
- IDs completos disponíveis

### Runes:
- UNCOMMON•GOODS (21M supply)
- EPIC•SATS (100M supply)
- RARE•VIBES (50M supply)
- LEGENDARY•ONES (1M supply)
- MYTHIC•RUNE (500K supply)

### Pools de Liquidez:
- 3 pools ativos
- Liquidez total: ~4.5M
- APR: 38% - 52%

---

## 🔧 Comandos Úteis

```bash
# Desenvolvimento com auto-reload
npm run dev

# Reiniciar banco de dados (apaga dados)
rm server/db/ordinals.db
npm run init-db

# Ver logs em tempo real
npm start

# Parar servidor
Ctrl + C
```

---

## 🌐 API Endpoints Disponíveis

Teste diretamente no browser ou com curl:

```bash
# Ver health
curl http://localhost:3000/api/health

# Listar inscriptions
curl http://localhost:3000/api/ordinals

# Listar runes
curl http://localhost:3000/api/runes

# Ver pools
curl http://localhost:3000/api/runes/pools

# Cotação de swap
curl -X POST http://localhost:3000/api/runes/quote \
  -H "Content-Type: application/json" \
  -d '{"fromRune":"rune_1","toRune":"rune_2","amount":1000000}'
```

---

## ⚙️ Próximos Passos

### Para Desenvolvimento:

1. **Integrar com ord CLI real**:
   ```bash
   # Instalar ord
   cargo install ord
   
   # Iniciar ord server
   ord server --http-port 80
   ```

2. **Conectar com Bitcoin Core** (opcional):
   ```bash
   # Editar .env
   BITCOIN_RPC_HOST=127.0.0.1
   BITCOIN_RPC_USER=seu_usuario
   BITCOIN_RPC_PASSWORD=sua_senha
   ```

3. **Usar indexadores externos**:
   ```bash
   # Editar .env
   ORD_API_URL=https://api.hiro.so
   # ou
   ORD_API_URL=https://open-api.unisat.io
   ```

### Para Produção:

1. **Deploy Backend**: Railway, Render, DigitalOcean
2. **Deploy Frontend**: Vercel, Netlify
3. **Banco de Dados**: Migrar para PostgreSQL
4. **Cache**: Adicionar Redis
5. **Monitoramento**: Sentry, LogRocket

---

## 📚 Documentação Completa

- **SETUP.md** - Instalação detalhada e produção
- **ARCHITECTURE.md** - Como o sistema funciona
- **README.md** - Visão geral e features

---

## 🐛 Problemas Comuns

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Port 3000 already in use"
```bash
# Mudar porta no .env
PORT=3001

# Ou matar processo
lsof -ti:3000 | xargs kill
```

### Erro: "Database is locked"
```bash
# Fechar outros processos do servidor
pkill -f "node server/index.js"
```

### Wallet não conecta
1. Instale extensão de wallet (Unisat ou Xverse)
2. Crie ou restaure uma wallet
3. Atualize a página
4. Clique em "Connect Wallet"

---

## ✅ Checklist de Funcionamento

- [ ] Servidor iniciou sem erros
- [ ] Página abre em http://localhost:3000
- [ ] Inscriptions aparecem na grid
- [ ] Busca funciona
- [ ] Ordenação funciona
- [ ] Página de Runes Swap carrega
- [ ] Pools aparecem
- [ ] Cotação calcula corretamente
- [ ] API responde em /api/health

Se todos os itens estão ✅, seu marketplace está funcionando!

---

## 🎉 Pronto para Usar!

O sistema está configurado com:
- ✅ Backend Node.js com Express
- ✅ Banco de dados SQLite
- ✅ API RESTful completa
- ✅ Frontend responsivo
- ✅ Suporte a PSBT v0.23.3
- ✅ Wallet integration
- ✅ Dados de exemplo

**Comece agora**: `npm start`

---

**Dúvidas?** Consulte SETUP.md ou ARCHITECTURE.md para detalhes técnicos.











