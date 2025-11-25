# 🗄️ SETUP TURSO DATABASE

## 📋 PASSO A PASSO

### 1️⃣ Criar Database

**No Turso Dashboard:**
1. Click **"Create Database"**
2. **Name:** `kray-station` (ou `kraywallet-db`)
3. **Location:** Primary (região mais próxima)
4. **Plan:** Starter (gratuito)
5. Click **"Create"**

### 2️⃣ Obter Credenciais

Após criar, click no database e:
1. Click **"Connect"**
2. Selecione **"Environment Variables"**
3. Copie:
   ```
   DATABASE_URL=libsql://xxx.turso.io
   DATABASE_AUTH_TOKEN=xxx_xxx
   ```

### 3️⃣ Estrutura das Tabelas

O Kray Station precisa dessas tabelas:

```sql
-- Inscriptions (para cache local)
CREATE TABLE inscriptions (
    id TEXT PRIMARY KEY,
    inscription_number INTEGER,
    content_type TEXT,
    address TEXT,
    output_value INTEGER,
    listed INTEGER DEFAULT 0,
    price INTEGER DEFAULT 0,
    owner TEXT,
    metadata TEXT
);

-- Offers (atomic swap marketplace)
CREATE TABLE offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inscription_id TEXT,
    seller_address TEXT,
    price INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    psbt_hex TEXT,
    seller_signature TEXT,
    buyer_signature TEXT,
    likes_count INTEGER DEFAULT 0
);

-- Users (analytics)
CREATE TABLE users (
    address TEXT PRIMARY KEY,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_actions INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0
);
```

### 4️⃣ Configuração

**Variáveis de Ambiente (.env):**
```
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your-token-here
USE_TURSO=true
```

**Vercel Environment Variables:**
```
DATABASE_URL = libsql://your-db.turso.io
DATABASE_AUTH_TOKEN = your-token-here
USE_TURSO = true
```

---

## ✅ Vantagens do Turso:

- 🌍 **Edge Database** (latência baixa)
- 💰 **Gratuito** até 9GB
- ⚡ **Serverless** (funciona no Vercel)
- 🔄 **SQLite compatível** (zero mudanças no SQL)
- 🔒 **Seguro** (HTTPS + auth token)

---

## 🚀 Após Configurar:

1. Me envie as credenciais
2. Farei a migração (30 min)
3. Deploy no Vercel
4. Sistema completo funcionando!

---

**Crie o database e me envie as credenciais!** 📤
