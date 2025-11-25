# 🚀 DEPLOY NO VERCEL - PASSO A PASSO

## 📋 ANTES DE COMEÇAR:

✅ Repositórios no GitHub (privados)
✅ Código limpo e seguro
✅ .env protegido

---

## 🎯 DEPLOY DO BACKEND

### PASSO 1: Importar Repositório

1. Acesse: https://vercel.com/new
2. Click em "Import Git Repository"
3. Selecione: **kray-station-backend**
4. Click "Import"

### PASSO 2: Configurar Projeto

**Framework Preset:** Other  
**Root Directory:** `./`  
**Build Command:** (deixe vazio)  
**Output Directory:** (deixe vazio)  
**Install Command:** `npm install`

### PASSO 3: Variáveis de Ambiente

Click em "Environment Variables" e adicione:

```
QUICKNODE_ENDPOINT = https://black-wider-sound.btc.quiknode.pro/e035aecc0a995c24e4ae490ab333bc6f4a2a08c5
QUICKNODE_ENABLED = true
PORT = 4000
NODE_ENV = production
```

**OPCIONAL (Turso Database):**
```
DATABASE_URL = libsql://your-db.turso.io
DATABASE_AUTH_TOKEN = your-token
```

### PASSO 4: Deploy

1. Click "Deploy"
2. Aguarde ~2 minutos
3. Anote a URL: `https://kray-station-backend.vercel.app`

---

## 🌐 DEPLOY DO FRONTEND

### PASSO 1: Criar Repositório para Frontend

No GitHub, crie:
- **Nome:** `kray-station-frontend`
- **Private:** Sim

### PASSO 2: Preparar Arquivos

Copiar para novo repositório:
```
- index.html
- krayscan.html
- ordinals.html
- config.js
- krayscan.js
- styles.css
- public/
```

### PASSO 3: Atualizar config.js

Mudar de:
```javascript
API_URL: 'http://localhost:4000/api'
```

Para:
```javascript
API_URL: 'https://kray-station-backend.vercel.app/api'
```

### PASSO 4: Deploy no Vercel

1. Import `kray-station-frontend`
2. Framework: Other
3. Build: (vazio)
4. Deploy
5. Anote URL: `https://kray-station.vercel.app`

---

## 🔧 ATUALIZAR EXTENSÃO

Após deploy, atualizar URLs na extensão:

**background-real.js e popup.js:**

Mudar de:
```javascript
http://localhost:4000
```

Para:
```javascript
https://kray-station-backend.vercel.app
```

Criar novo commit e push.

---

## ✅ VALIDAÇÃO

Após deploy:

1. Backend: https://kray-station-backend.vercel.app/api/health
2. Frontend: https://kray-station.vercel.app
3. Extensão: Recarregar e testar

---

## 🔒 SEGURANÇA

**Variáveis de Ambiente no Vercel:**
- ✅ Nunca expõem credenciais
- ✅ Apenas você vê os valores
- ✅ Automatic HTTPS
- ✅ Isolamento de secrets

**CORS:**
Adicionar domínio do frontend nas permissões.

---

## 📊 APÓS DEPLOY:

**URLs Finais:**
- Backend: `https://kray-station-backend.vercel.app`
- Frontend: `https://kray-station.vercel.app`
- Extension Download: Link para GitHub releases

---

**COMECE PELO BACKEND!** 🚀

1. https://vercel.com/new
2. Import: kray-station-backend
3. Add env vars
4. Deploy

**Me avise quando terminar para eu preparar o frontend!**

