# 🚀 DEPLOY PARA PRODUÇÃO - KRAY WALLET

**Data:** 17 de novembro de 2025  
**Status:** Pronto para deploy

---

## 📋 CHECKLIST PRÉ-DEPLOY

### ✅ Sistema Funcionando:
- ✅ Extensão KrayWallet (100% QuickNode)
- ✅ Backend Kray Station (100% QuickNode)
- ✅ Frontend (HTML/CSS/JS)
- ✅ Send Runes (testado ✅)
- ✅ Send Inscriptions (testado ✅)
- ✅ Explorer KrayScan (completo)

---

## 🎯 PLANO DE DEPLOY

### 1️⃣ KRAYWALLET EXTENSION (Chrome Web Store)

**Repositório:** `kraywallet-extension`

**Arquivos necessários:**
```
kraywallet-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/
│   └── background-real.js
├── content/
│   └── injected.js
└── icons/
    └── icon-*.png
```

**Passos:**
1. Criar repositório no GitHub
2. Limpar arquivos de desenvolvimento
3. Minificar código (opcional)
4. Criar ZIP para Chrome Web Store
5. Upload no developer dashboard

---

### 2️⃣ KRAY STATION (Backend - Vercel)

**Repositório:** `kray-station-backend`

**Configuração Vercel:**
```json
{
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

**Variáveis de Ambiente (.env):**
```
QUICKNODE_ENDPOINT=https://black-wider-sound.btc.quiknode.pro/...
QUICKNODE_ENABLED=true
DATABASE_URL=... (Turso)
NODE_ENV=production
```

---

### 3️⃣ KRAY STATION (Frontend - Vercel)

**Repositório:** `kray-station-frontend`

**Arquivos:**
```
├── krayscan.html
├── ordinals.html
├── pool-create.html
├── config.js (atualizar API_URL para produção)
├── public/
└── styles.css
```

---

## 🗄️ BANCO DE DADOS

### Turso (SQLite na nuvem):

**Tabelas necessárias:**
```sql
-- inscriptions
CREATE TABLE inscriptions (
  id TEXT PRIMARY KEY,
  inscription_number INTEGER,
  content_type TEXT,
  address TEXT,
  output_value INTEGER,
  listed INTEGER DEFAULT 0,
  price INTEGER DEFAULT 0
);

-- offers (atomic swap)
CREATE TABLE offers (...);

-- users (analytics)
CREATE TABLE users (...);
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

### Produção:

```bash
# QuickNode
QUICKNODE_ENDPOINT=https://your-endpoint.btc.quiknode.pro/xxx
QUICKNODE_ENABLED=true

# Database
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=xxx

# App
NODE_ENV=production
PORT=4000
```

---

## 🚀 DEPLOY STEPS

### PASSO 1: Criar Repositórios

```bash
# 1. KrayWallet Extension
cd kraywallet-extension
git init
git add .
git commit -m "Initial commit - QuickNode integration"
git remote add origin https://github.com/tomkray/kraywallet-extension
git push -u origin main

# 2. Kray Station Backend
cd server
git init
git add .
git commit -m "Initial commit - QuickNode 100%"
git remote add origin https://github.com/tomkray/kray-station-backend
git push -u origin main

# 3. Kray Station Frontend
cd ..
git init
git add krayscan.* ordinals.* config.js public/
git commit -m "Initial commit - Frontend"
git remote add origin https://github.com/tomkray/kray-station-frontend
git push -u origin main
```

---

### PASSO 2: Deploy no Vercel

```bash
# Backend
cd server
vercel --prod

# Frontend
cd ..
vercel --prod
```

---

### PASSO 3: Chrome Web Store

1. Criar ZIP da extensão
2. Upload em: https://chrome.google.com/webstore/devconsole
3. Preencher detalhes
4. Submeter para review

---

## 📊 CUSTOS MENSAIS

```
QuickNode: $146/mês ✅
Vercel: $0 (Hobby) ou $20 (Pro)
Turso: $0 (até 9GB) ou $29 (Scaler)
GitHub: $0 (público)

Total: ~$146-195/mês
```

---

## ✅ PRÓXIMOS PASSOS

Deseja que eu:
1. Crie os repositórios agora?
2. Prepare os arquivos para deploy?
3. Configure o Vercel?
4. Prepare o ZIP da extensão?

**Me diga por onde começar!** 🚀

