# 🚂 DEPLOY VIA RAILWAY - GUIA COMPLETO

**POR QUE RAILWAY AO INVÉS DE VERCEL:**
- ✅ Node.js completo (não serverless)
- ✅ Funciona IGUAL ao local
- ✅ ZERO mudanças no código
- ✅ $5/mês
- ✅ Deploy em 10 minutos

---

## 📋 PASSO 1: CRIAR REPO GITHUB (2 min)

### 1.1 Criar repositório:
```
https://github.com/new
```

### 1.2 Configurar:
- Repository name: `kray-station`
- Description: `Bitcoin Ordinals & Runes Platform - QuickNode + Supabase`
- Private: ✅
- NÃO adicionar README
- Create repository

---

## 📋 PASSO 2: PUSH DO CÓDIGO (2 min)

```bash
cd "/Volumes/D2/KRAY WALLET- V1/server"
git remote add origin https://github.com/tomkray/kray-station.git
git push -u origin main
```

**Aguardar aparecer no GitHub!**

---

## 📋 PASSO 3: CRIAR CONTA RAILWAY (3 min)

### 3.1 Acessar:
```
https://railway.app
```

### 3.2 Sign Up:
- Click "Start a New Project"
- Login with GitHub
- Autorizar Railway

---

## 📋 PASSO 4: DEPLOY NO RAILWAY (10 min)

### 4.1 New Project:
- Click "+ New Project"
- "Deploy from GitHub repo"
- Procurar: `kray-station`
- Selecionar
- Click "Deploy"

### 4.2 Railway vai detectar automaticamente:
```
✅ Node.js project
✅ package.json encontrado
✅ Start command: node index.js
```

### 4.3 Aguardar build (~2-3 minutos):
```
Installing dependencies...
Building...
Deploying...
✅ Deployed!
```

---

## 📋 PASSO 5: CONFIGURAR VARIÁVEIS (5 min)

### 5.1 No dashboard do projeto Railway:

Click na aba **"Variables"**

### 5.2 Adicionar cada variável:

```
QUICKNODE_ENDPOINT
https://black-wider-sound.btc.quiknode.pro/e035aecc0a995c24e4ae490ab333bc6f4a2a08c5

QUICKNODE_ENABLED
true

SUPABASE_URL
https://yspgufasgeyyyfatlegy.supabase.co

SUPABASE_SERVICE_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcGd1ZmFzZ2V5eXlmYXRsZWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5MTI4NiwiZXhwIjoyMDc5MDY3Mjg2fQ.1rOMeoReHtOKHPzLtoNCd2B7a51LRo11XLBVJKBJVy8

USE_SUPABASE
true

PORT
4000

NODE_ENV
production

USE_LOCAL_DB
false
```

### 5.3 Após adicionar:
- Click "Redeploy" (ou aguardar auto-deploy)

---

## 📋 PASSO 6: GERAR DOMÍNIO (2 min)

### 6.1 No Railway:
- Tab "Settings"
- Section "Domains"
- Click "Generate Domain"

### 6.2 URL gerada:
```
https://kray-station-production.up.railway.app
```
(ou similar)

**COPIAR ESSA URL!**

---

## 📋 PASSO 7: TESTAR EM PRODUÇÃO (2 min)

### URLs para testar:

```
https://xxx.railway.app/
https://xxx.railway.app/krayscan.html
https://xxx.railway.app/api/health
```

**DEVE FUNCIONAR PERFEITAMENTE!** ✅

---

## 🎉 RESULTADO ESPERADO:

```
✅ Landing page funcionando
✅ KrayScan funcionando
✅ API funcionando
✅ QuickNode ativo
✅ Supabase conectado
✅ TUDO igual ao local!
```

---

## 💰 CUSTO:

```
Railway: $5/mês (Starter plan)
QuickNode: $146/mês
Supabase: $0
Total: $151/mês
```

---

## 🚀 VANTAGENS DO RAILWAY:

1. ✅ **Funciona igual ao local**
2. ✅ **Zero mudanças no código**
3. ✅ **Node.js completo**
4. ✅ **Auto-deploy do GitHub**
5. ✅ **SSL automático**
6. ✅ **Logs em tempo real**
7. ✅ **Fácil de usar**

---

**SIGA OS 7 PASSOS E TERÁ O SISTEMA EM PRODUÇÃO!** 🚀

Tempo total: ~25 minutos


