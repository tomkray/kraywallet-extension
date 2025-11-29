# 🚀 KRAY WALLET - DEPLOYMENT GUIDE

Guia completo para deploy da KrayWallet em produção.

---

## 📚 Documentação

1. **DEPLOY_STEPS.md** - Passo a passo detalhado (COMECE AQUI!)
2. **backend/** - Configuração do backend para Vercel
3. **extension/** - Build da extensão Chrome
4. **database/** - Schema do Supabase

---

## 🎯 VISÃO RÁPIDA

### Componentes:

```
┌─────────────────────────────────────┐
│  EXTENSÃO CHROME (Público)          │
│  └─ Chrome Web Store                │
├─────────────────────────────────────┤
│  BACKEND API (Privado)              │
│  └─ Vercel Serverless               │
│  └─ api.kraywallet.com              │
├─────────────────────────────────────┤
│  FRONTEND (Público)                 │
│  └─ Vercel Static                   │
│  └─ kraywallet.com                  │
├─────────────────────────────────────┤
│  DATABASE                           │
│  └─ Supabase PostgreSQL             │
└─────────────────────────────────────┘
```

---

## ⚡ QUICK START

### 1. Setup Supabase (30 min)
```bash
# 1. Criar projeto em supabase.com
# 2. Executar database/schema.sql
# 3. Copiar credenciais
```

### 2. Deploy Backend (45 min)
```bash
# 1. Criar repo GitHub (privado)
# 2. Deploy na Vercel
# 3. Configurar env vars
# 4. Configurar domínio api.kraywallet.com
```

### 3. Build Extensão (30 min)
```bash
cd deployment/extension
./build.sh
# Upload para Chrome Web Store
```

### 4. Deploy Frontend (30 min)
```bash
# 1. Deploy na Vercel
# 2. Configurar domínio kraywallet.com
```

---

## 💰 CUSTOS

```
QuickNode:        $146/mês (já tem)
Supabase Free:    $0
Vercel Hobby:     $0
Domain:           $12/ano
Google Dev:       $5 (única vez)
─────────────────────────────
TOTAL INICIAL:    $146/mês + $17
```

---

## 🔐 SEGURANÇA

### ✅ Garantido:
- Nenhuma key no código
- .env apenas em Vercel (privado)
- RLS no Supabase
- HTTPS everywhere
- Rate limiting
- CORS configurado

---

## 📞 SUPORTE

Dúvidas? Leia `DEPLOY_STEPS.md` primeiro!

---

**Boa sorte com o deploy! 🚀**






