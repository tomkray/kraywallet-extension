# 🚂 RAILWAY DEPLOY - PASSO A PASSO (10 MINUTOS)

**Hora de início:** 05:15  
**Tempo estimado:** 10 minutos  
**Garantia:** Vai funcionar igual ao local!

---

## 📋 PASSO 1: CRIAR CONTA RAILWAY (2 min)

### 1.1 Acessar:
```
https://railway.app
```

### 1.2 Sign Up:
- Click **"Start a New Project"**
- Click **"Login with GitHub"**
- Autorizar Railway (permissões de leitura apenas)
- Aguardar criar conta

---

## 📋 PASSO 2: DEPLOY DO PROJETO (3 min)

### 2.1 New Project:
Após login, você verá opções:
- Click **"Deploy from GitHub repo"**

### 2.2 Selecionar Repositório:
- Procurar: **"kray-station"**
- Click para selecionar
- Click **"Deploy Now"**

### 2.3 Railway vai:
```
✅ Clonar repositório
✅ Detectar Node.js
✅ Ler package.json
✅ Instalar dependências
✅ Executar: node index.js
✅ Deploy! 🎉
```

Aguardar ~2-3 minutos

---

## 📋 PASSO 3: CONFIGURAR VARIÁVEIS (3 min)

### 3.1 No dashboard do projeto:

Click na aba **"Variables"** (ou "Environment")

### 3.2 Adicionar TODAS estas 8 variáveis:

#### Clique em "+ Add Variable" para cada uma:

```
Variable: QUICKNODE_ENDPOINT
Value: https://black-wider-sound.btc.quiknode.pro/e035aecc0a995c24e4ae490ab333bc6f4a2a08c5

Variable: QUICKNODE_ENABLED
Value: true

Variable: SUPABASE_URL
Value: https://yspgufasgeyyyfatlegy.supabase.co

Variable: SUPABASE_SERVICE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcGd1ZmFzZ2V5eXlmYXRsZWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5MTI4NiwiZXhwIjoyMDc5MDY3Mjg2fQ.1rOMeoReHtOKHPzLtoNCd2B7a51LRo11XLBVJKBJVy8

Variable: USE_SUPABASE
Value: true

Variable: PORT
Value: 4000

Variable: NODE_ENV
Value: production

Variable: USE_LOCAL_DB
Value: false
```

### 3.3 Após adicionar:
Railway vai fazer **redeploy automático**

---

## 📋 PASSO 4: GERAR DOMÍNIO (1 min)

### 4.1 No Railway dashboard:
- Tab **"Settings"**
- Scroll até **"Networking"**
- Click **"Generate Domain"**

### 4.2 URL gerada:
```
https://kray-station-production.up.railway.app
```
(ou similar)

**COPIAR ESSA URL!**

---

## 📋 PASSO 5: TESTAR EM PRODUÇÃO (1 min)

### 5.1 Abrir no navegador:

```
https://xxx.railway.app/
https://xxx.railway.app/krayscan.html
https://xxx.railway.app/api/health
```

### 5.2 Deve mostrar:

✅ Landing page "Kray Station"  
✅ KrayScan funcionando  
✅ API respondendo  
✅ **TUDO FUNCIONANDO!** 🎉

---

## ✅ RESULTADO ESPERADO:

```
✅ Backend: xxx.railway.app
✅ Frontend: xxx.railway.app
✅ API: xxx.railway.app/api
✅ QuickNode: Ativo
✅ Supabase: Conectado
✅ Auto-deploy: Configurado
```

**Sistema completo em produção!** 🎊

---

## 🎯 DEPOIS:

1. Atualizar URLs na extensão (5 min)
2. Criar release v1.0.0 (5 min)
3. **PRONTO!** ✅

---

## 💰 CUSTO:

```
Railway Starter: $5/mês
QuickNode: $146/mês
Supabase: $0
Total: $151/mês
```

---

## 🚀 VANTAGENS:

- ✅ Funciona IGUAL ao local
- ✅ Zero mudanças no código
- ✅ Deploy confiável
- ✅ Auto-deploy funciona
- ✅ Logs em tempo real
- ✅ SSL automático

---

**SIGA OS 5 PASSOS E TERÁ SUCESSO GARANTIDO!** 🚂✨


