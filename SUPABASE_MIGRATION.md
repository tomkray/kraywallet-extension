# 🚀 MIGRAÇÃO PARA SUPABASE

**Data:** 18 de novembro de 2025  
**Status:** Em progresso

---

## ✅ POR QUE SUPABASE É MELHOR:

### vs SQLite local:
- ✅ **Na nuvem** (funciona no Vercel)
- ✅ **Backup automático**
- ✅ **Escalável**

### vs Turso:
- ✅ **Dashboard funciona** (sem bugs)
- ✅ **PostgreSQL** (mais recursos)
- ✅ **APIs automáticas** (REST + GraphQL)
- ✅ **Real-time** (websockets)

---

## 📋 PASSO A PASSO

### 1️⃣ Criar Projeto Supabase

**No Dashboard:**
1. https://supabase.com/dashboard
2. "New Project"
3. **Name:** `Kray Station`
4. **Database Password:** (senha forte)
5. **Region:** US East
6. "Create new project"
7. Aguardar ~2 minutos

### 2️⃣ Obter Credenciais

Após criar:
1. **Settings** → **API**
2. Copiar:
   ```
   Project URL: https://xxx.supabase.co
   Anon Key: eyJhbGc...
   Service Role Key: eyJhbGc...
   ```

### 3️⃣ Migrar Código

**Trocar:**
- `better-sqlite3` → `@supabase/supabase-js`
- SQL local → PostgreSQL
- Queries síncronas → async

### 4️⃣ Criar Tabelas

```sql
-- Inscriptions
CREATE TABLE inscriptions (
    id TEXT PRIMARY KEY,
    inscription_number BIGINT,
    content_type TEXT,
    address TEXT,
    output_value BIGINT,
    listed BOOLEAN DEFAULT FALSE,
    price BIGINT DEFAULT 0,
    owner TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Offers (Atomic Swap)
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    inscription_id TEXT,
    seller_address TEXT,
    price BIGINT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    psbt_hex TEXT,
    seller_signature TEXT,
    buyer_signature TEXT,
    likes_count INT DEFAULT 0
);

-- Users (Analytics)
CREATE TABLE users (
    address TEXT PRIMARY KEY,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    total_actions INT DEFAULT 0,
    reputation_score INT DEFAULT 0
);

-- Lightning Pools
CREATE TABLE lightning_pools (
    id SERIAL PRIMARY KEY,
    rune_id TEXT,
    pool_address TEXT,
    btc_balance BIGINT DEFAULT 0,
    rune_balance BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔧 CONFIGURAÇÃO

### Environment Variables (.env):
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
USE_SUPABASE=true
```

### Vercel Variables:
```
SUPABASE_URL = https://xxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_KEY = eyJhbGc...
USE_SUPABASE = true
```

---

## ⚡ TEMPO DE MIGRAÇÃO:

- **Criar projeto:** 2 minutos
- **Migrar código:** 30 minutos
- **Criar tabelas:** 5 minutos
- **Deploy:** 2 minutos

**Total:** ~40 minutos

---

## 🎊 RESULTADO:

Sistema COMPLETO funcionando:
- ✅ KrayWallet Extension
- ✅ KrayScan Explorer
- ✅ Atomic Swap Marketplace
- ✅ Lightning DeFi
- ✅ Analytics
- ✅ Real-time updates

**MELHOR que SQLite!** 🚀

---

**CRIE O PROJETO NO SUPABASE!** 📤
