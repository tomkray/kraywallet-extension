# 🔧 VARIÁVEIS DE AMBIENTE - VERCEL

## 📋 Backend (kray-station-backend)

### Obrigatórias:

```
QUICKNODE_ENDPOINT
Valor: https://black-wider-sound.btc.quiknode.pro/e035aecc0a995c24e4ae490ab333bc6f4a2a08c5

QUICKNODE_ENABLED
Valor: true

NODE_ENV
Valor: production
```

### Opcional (se não configurar, APIs relacionadas não funcionam):

```
USE_LOCAL_DB
Valor: false
(SQLite não funciona no Vercel)

LND_ENABLED
Valor: false
(Lightning apenas em servidor dedicado)
```

---

## 📊 O Que Funciona SEM Database:

✅ **Explorer API:**
- `/api/explorer/tx/:txid`
- `/api/explorer/address/:address`

✅ **Wallet API:**
- `/api/wallet/:address/runes` (via QuickNode)
- `/api/wallet/:address/inscriptions` (via QuickNode)
- `/api/wallet/:address/balance` (via Mempool.space)

✅ **Runes API:**
- `/api/runes/build-send-psbt`
- `/api/rune/:runeId`

✅ **Output API:**
- `/api/output/:outpoint` (via QuickNode)

✅ **Thumbnail Proxy:**
- `/api/rune-thumbnail/:id`

---

## ❌ O Que NÃO Funciona SEM Database:

❌ **Atomic Swap** (precisa SQLite)
❌ **Lightning DeFi** (precisa SQLite + LND)
❌ **Marketplace** (precisa SQLite)
❌ **Likes/Analytics** (precisa SQLite)

---

## 💡 SOLUÇÃO FUTURA:

Para funcionalidades completas no Vercel:
1. Migrar SQLite → Turso (SQLite na nuvem)
2. Ou usar Vercel Postgres
3. Ou Railway/Render para backend completo

---

## 🎯 PARA AGORA:

**Funcionalidade CORE (sem database):**
- ✅ KrayWallet extension funciona 100%
- ✅ KrayScan funciona 100%
- ✅ Envio de runes/inscriptions funciona
- ✅ Balance e UTXOs funcionam

**Marketplace/DeFi:**
- Requer servidor dedicado OU
- Migração para Turso

---

## ✅ DEPLOY MÍNIMO VIÁVEL:

Com as 3 variáveis acima, o backend:
- ✅ Suporta KrayWallet extension
- ✅ Suporta KrayScan
- ✅ APIs core funcionando

**Suficiente para lançamento inicial!** 🚀

