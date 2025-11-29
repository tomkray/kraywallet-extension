# 🔄 BACKEND MIGRATION GUIDE - Express → Vercel Serverless

## 📋 OVERVIEW

Migrar de Express local para Vercel Serverless Functions.

---

## 🏗️ ARQUITETURA ATUAL vs NOVA

### Atual (Local):
```
server/index.js (Express)
├── app.use('/api/wallet', walletRoutes)
├── app.use('/api/runes', runesRoutes)
└── app.listen(4000)
```

### Nova (Vercel):
```
api/
├── health.js                      → GET /api/health
├── wallet/
│   ├── balance.js                 → GET /api/wallet/[address]/balance
│   ├── inscriptions.js            → GET /api/wallet/[address]/inscriptions
│   └── runes.js                   → GET /api/wallet/[address]/runes
├── runes/
│   ├── fast.js                    → GET /api/runes/fast/[address]
│   └── [runeId].js                → GET /api/runes/[runeId]
└── explorer/
    └── tx.js                      → GET /api/explorer/tx/[txid]
```

---

## 🔄 CONVERSÃO DE ROTAS

### Exemplo 1: Health Check

#### Antes (server/index.js):
```javascript
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

#### Depois (api/health.js):
```javascript
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  return res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}
```

### Exemplo 2: Wallet Balance (com QuickNode)

#### Antes (server/routes/balance.js):
```javascript
router.get('/:address/balance', async (req, res) => {
  const { address } = req.params;
  const balance = await quicknode.getBalance(address);
  res.json({ success: true, balance });
});
```

#### Depois (api/wallet/balance.js):
```javascript
import quicknode from '../../utils/quicknode.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({
      success: false,
      error: 'Address required'
    });
  }
  
  try {
    // Buscar via QuickNode
    const utxosResponse = await fetch(
      `https://mempool.space/api/address/${address}/utxo`
    );
    const utxos = await utxosResponse.json();
    
    const balance = utxos.reduce((sum, u) => sum + u.value, 0);
    
    return res.status(200).json({
      success: true,
      address,
      balance,
      utxos: utxos.length
    });
  } catch (error) {
    console.error('Balance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

---

## 🗄️ DATABASE: SQLite → Supabase

### Mudanças Necessárias:

#### Antes (SQLite):
```javascript
import { db } from '../db/init.js';

const inscriptions = db.prepare(
  'SELECT * FROM inscriptions WHERE address = ?'
).all(address);
```

#### Depois (Supabase):
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { data: inscriptions, error } = await supabase
  .from('inscriptions')
  .select('*')
  .eq('address', address);

if (error) throw error;
```

---

## 📦 UTILS COMPARTILHADOS

Alguns arquivos precisam estar disponíveis para todas as functions:

### utils/quicknode.js
```javascript
// api/utils/quicknode.js (mesmo código atual)
class QuickNodeClient {
  constructor() {
    this.endpoint = process.env.QUICKNODE_ENDPOINT;
  }
  
  async call(method, params) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now()
      })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }
  
  // ... outros métodos
}

export default new QuickNodeClient();
```

### utils/supabase.js
```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default supabase;
```

---

## 🚀 DEPLOY WORKFLOW

### 1. Desenvolvimento Local:
```bash
# Testar com Vercel CLI
cd backend
vercel dev

# Acessa em: http://localhost:3000
```

### 2. Deploy Preview:
```bash
# Deploy de teste
vercel

# Testa em: https://kraywallet-api-xxx.vercel.app
```

### 3. Deploy Produção:
```bash
# Deploy final
vercel --prod

# Vai para: https://api.kraywallet.com
```

---

## ⚠️ LIMITAÇÕES DO VERCEL

### Serverless Constraints:

1. **Timeout**: 10 segundos (Hobby) / 60s (Pro)
   - ✅ OK: Nossas APIs são rápidas (<2s)

2. **Memory**: 1024 MB
   - ✅ OK: Não processamos dados pesados

3. **Payload**: 4.5 MB request/response
   - ✅ OK: Retornamos JSON pequeno

4. **Concurrent**: 100 (Hobby) / 1000 (Pro)
   - ⚠️  Pode precisar Pro se tiver muito tráfego

5. **Cold Start**: ~1-2 segundos
   - ✅ OK: Aceitável para API

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ Criar utils/quicknode.js para Vercel
2. ✅ Criar utils/supabase.js
3. ✅ Converter cada rota para function
4. ✅ Testar localmente com `vercel dev`
5. ✅ Deploy preview
6. ✅ Testar preview
7. ✅ Deploy produção
8. ✅ Configurar domínio

---

**Quer que eu crie os arquivos de migração agora?** 🚀






