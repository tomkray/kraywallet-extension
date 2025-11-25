# 🔍 CHECKLIST DE DEBUG - VERCEL

## 📋 VERIFICAR NO DASHBOARD

### 1️⃣ Status do Deployment

Na página que você abriu:
https://vercel.com/tomkray7/kray-station-backend/7rUkfzc98AUP8QgXwb9SD515aiWE

**Verificar:**
- [ ] Status: **Ready** ✅ ou **Error** ❌?
- [ ] Duration: Quanto tempo levou?
- [ ] Domains: Qual URL?

---

### 2️⃣ Runtime Logs

Click em **"Runtime Logs"**

**Procurar por:**
- ❌ `Error`
- ❌ `Cannot find module`
- ❌ `ECONNREFUSED`
- ❌ `Timeout`
- ✅ `Server listening on port`
- ✅ `Database initialized`

**Copie os erros se tiver!**

---

### 3️⃣ Environment Variables

**Settings** → **Environment Variables**

**Verificar se TEM:**
- [ ] `QUICKNODE_ENDPOINT`
- [ ] `QUICKNODE_ENABLED`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_KEY`
- [ ] `USE_SUPABASE`
- [ ] `NODE_ENV`

**Se faltar alguma → Adicionar!**

---

### 4️⃣ Build Logs

Na mesma página, scroll até **"Build Logs"**

**Procurar por:**
- ❌ `npm install failed`
- ❌ `Module not found`
- ❌ `Build failed`
- ✅ `Build completed`

---

## 🔧 PROBLEMAS COMUNS

### Erro 500:
- Falta variável de ambiente
- Código com erro
- Módulo faltando

### Timeout:
- Servidor não iniciou
- Porta errada
- Crash no startup

### Build Failed:
- Node version errada
- Dependência faltando
- Syntax error

---

## 📝 ME ENVIE:

1. **Status:** Ready ou Error?
2. **Runtime Logs:** (primeiras 20 linhas)
3. **Variáveis:** Todas configuradas?

**Com essas informações vou resolver!** 🔧

