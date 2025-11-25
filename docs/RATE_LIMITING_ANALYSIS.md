# 🚦 **ANÁLISE DE RATE LIMITING PARA KRAY STATION**

## 📊 **CONFIGURAÇÃO ATUAL**

### **❌ PROBLEMA IDENTIFICADO:**

```javascript
// ⚠️ MUITO RESTRITIVO PARA USO REAL
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // ← 100 requests por IP em 15 minutos
});
```

**100 requests em 15 minutos = 6.67 requests por minuto**

---

## 🎯 **ANÁLISE POR CENÁRIO DE USO**

### **CENÁRIO 1: USUÁRIO NAVEGANDO NO MARKETPLACE**

```
Ações típicas em uma sessão de 5 minutos:

1. Abrir página inicial: 5 requests
   GET / (HTML)
   GET /app.js
   GET /config.js
   GET /api/offers (lista de ofertas)
   GET /api/ordinals (lista de ordinals)

2. Navegar para "Browse Ordinals": 10 requests
   GET /ordinals.html
   GET /api/ordinals?page=1 (40 cards)
   GET /api/ordinals/by-address/:addr (se conectou wallet)
   10x GET /content/:inscriptionId (thumbnails)

3. Conectar Kray Wallet: 5 requests
   POST /api/kraywallet/...
   GET /api/ordinals/by-address/:addr
   GET /api/runes/by-address/:addr
   GET /api/wallet/balance/:addr
   GET /api/wallet/utxos/:addr

4. Ver detalhes de 3 inscriptions: 15 requests
   3x GET /inscription/:id (ORD server)
   3x GET /content/:id (imagens)
   3x GET /api/offers?inscriptionId=:id
   3x Outros metadados

5. Criar 1 offer (listar inscription): 10 requests
   POST /api/psbt/sell (criar PSBT)
   POST /api/kraywallet/sign (assinar)
   POST /api/offers (publicar)
   GET /api/offers (verificar listagem)
   GET /api/ordinals (atualizar lista)
   5x Outros refreshes

6. Comprar 1 inscription: 15 requests
   POST /api/offers/:id/get-seller-psbt
   POST /api/purchase/build-atomic-psbt
   POST /api/kraywallet/sign (assinar)
   POST /api/psbt/broadcast-atomic (broadcast)
   GET /api/offers (verificar remoção)
   GET /api/ordinals (atualizar)
   5x Activity/confirmations checks
   4x Outros refreshes

TOTAL: 60 requests em 5 minutos
```

**✅ Conclusão:** Usuário normal usa ~60 requests em 5 minutos  
**❌ Problema:** Com 100 req/15min, se o usuário fizer 2 compras/vendas, **atinge o limite!**

---

### **CENÁRIO 2: BOT MALICIOSO (ATAQUE)**

```
Bot scraping marketplace agressivamente:

1. GET /api/offers (lista completa): 1 request/segundo
   → 60 requests/minuto
   → 900 requests em 15 minutos

2. GET /api/ordinals (todas inscriptions): 1 request/segundo
   → 60 requests/minuto
   → 900 requests em 15 minutos

3. GET /content/:id (baixar todas imagens): 5 requests/segundo
   → 300 requests/minuto
   → 4500 requests em 15 minutos

TOTAL: 6300 requests em 15 minutos (bot agressivo)
```

**✅ Conclusão:** Bot malicioso faz **6300+ requests**  
**✅ Proteção:** Rate limit de 100 req/15min **BLOQUEIA** bot malicioso

---

## 💡 **RECOMENDAÇÕES**

### **OPÇÃO 1: RATE LIMITING INTELIGENTE POR ENDPOINT**

```javascript
// 🎯 ESTRATÉGIA: Limites diferentes por tipo de endpoint

// 1. Endpoints de LEITURA (GET) - Mais permissivos
const readLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // 30 requests por minuto
    message: 'Too many requests, please slow down',
    skip: (req) => {
        // Permitir ilimitado para arquivos estáticos
        return req.url.includes('/content/') || req.url.includes('/static/');
    }
});

// 2. Endpoints de ESCRITA (POST/PUT/DELETE) - Mais restritivos
const writeLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 20, // 20 requests em 5 minutos (4 por minuto)
    message: 'Too many write operations, please wait'
});

// 3. Endpoints CRÍTICOS (broadcast, sign) - Muito restritivos
const criticalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 requests em 15 minutos
    message: 'Too many critical operations, please wait'
});

// Aplicar por rota:
app.use('/api/offers', readLimiter);          // GET offers
app.use('/api/ordinals', readLimiter);        // GET ordinals
app.use('/api/psbt/sell', writeLimiter);      // POST criar PSBT
app.use('/api/psbt/broadcast-atomic', criticalLimiter); // POST broadcast
app.use('/api/kraywallet/sign', criticalLimiter);       // POST sign
```

**✅ Vantagens:**
- Usuário normal: **NÃO afetado** (pode navegar livremente)
- Bot de scraping: **BLOQUEADO** (atinge limite rapidamente)
- Operações críticas: **PROTEGIDAS** (limite baixo)

---

### **OPÇÃO 2: RATE LIMITING PROGRESSIVO**

```javascript
// 🎯 ESTRATÉGIA: Punir apenas abusadores

const smartLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: async (req) => {
        // Usar histórico do IP para determinar limite dinâmico
        const ipHistory = await getIPHistory(req.ip);
        
        if (ipHistory.violations > 5) {
            return 5;  // IP com histórico ruim: 5 req/min
        } else if (ipHistory.requests > 100) {
            return 20; // IP com muitas requests: 20 req/min
        } else {
            return 50; // IP normal: 50 req/min
        }
    },
    skip: (req) => {
        // Nunca limitar arquivos estáticos
        return req.url.startsWith('/content/') || 
               req.url.startsWith('/static/');
    }
});
```

**✅ Vantagens:**
- Usuário normal: **ILIMITADO** (quase)
- Usuário power: **ALTO LIMITE** (50 req/min)
- Bot detectado: **BANIDO** (5 req/min)

---

### **OPÇÃO 3: WHITELIST + RATE LIMITING**

```javascript
// 🎯 ESTRATÉGIA: Wallets autenticadas = sem limite

const authAwareLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100, // 100 req/min
    skip: (req) => {
        // Se wallet autenticada (via signature), sem limite
        const walletAddress = req.headers['x-wallet-address'];
        const signature = req.headers['x-wallet-signature'];
        
        if (walletAddress && signature) {
            // Verificar assinatura válida
            if (verifySignature(walletAddress, signature)) {
                return true; // Skip rate limit
            }
        }
        
        // Arquivos estáticos sempre permitidos
        return req.url.startsWith('/content/');
    }
});
```

**✅ Vantagens:**
- Usuário **AUTENTICADO** com wallet: **SEM LIMITE**
- Usuário **NÃO AUTENTICADO**: Limite de 100 req/min
- Bot sem wallet: **BLOQUEADO**

---

## 🎯 **RECOMENDAÇÃO FINAL**

### **CONFIGURAÇÃO RECOMENDADA PARA PRODUÇÃO:**

```javascript
// ═══════════════════════════════════════════════════════════════
// 🚦 RATE LIMITING OTIMIZADO PARA MARKETPLACE
// ═══════════════════════════════════════════════════════════════

// 1. Leitura geral (GET) - Permissivo
const readLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60, // 60 requests/min (1 por segundo)
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    skip: (req) => {
        // Sem limite para: imagens, CSS, JS
        return req.url.includes('/content/') || 
               req.url.includes('/static/') ||
               req.url.includes('.css') ||
               req.url.includes('.js') ||
               req.url.includes('.png');
    }
});

// 2. Escrita geral (POST) - Moderado
const writeLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 30, // 30 requests em 5 minutos (6 por minuto)
    message: 'Too many operations, please wait'
});

// 3. Operações críticas (broadcast, sign) - Restritivo
const criticalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 10, // 10 requests em 5 minutos (2 por minuto)
    message: 'Too many critical operations, please wait'
});

// Aplicar por tipo de operação:
app.use('/api/offers', readLimiter);
app.use('/api/ordinals', readLimiter);
app.use('/api/runes', readLimiter);

app.use('/api/psbt/sell', writeLimiter);
app.use('/api/offers', writeLimiter); // POST criar offer

app.use('/api/psbt/broadcast-atomic', criticalLimiter);
app.use('/api/kraywallet/sign', criticalLimiter);
```

### **✅ RESULTADO ESPERADO:**

| **Ação** | **Limite** | **Usuário Normal** | **Bot Malicioso** |
|----------|------------|-------------------|-------------------|
| **Navegar marketplace** | 60 req/min | ✅ OK (usa ~20/min) | ❌ BLOQUEADO (usa 900/min) |
| **Ver imagens** | ♾️ Ilimitado | ✅ OK | ✅ OK (mas lento) |
| **Criar offer** | 6 req/min | ✅ OK (1-2/min) | ❌ BLOQUEADO (tenta 100/min) |
| **Comprar** | 2 req/min | ✅ OK (1 compra) | ❌ BLOQUEADO (tenta mass buy) |
| **Broadcast** | 2 req/min | ✅ OK | ❌ BLOQUEADO |

---

## 📈 **MONITORAMENTO RECOMENDADO**

```javascript
// Adicionar logs de rate limiting:

const limiterWithLogs = rateLimit({
    // ... config ...
    handler: (req, res) => {
        console.log(`🚨 RATE LIMIT HIT: ${req.ip} - ${req.url}`);
        res.status(429).json({ error: 'Too many requests' });
    },
    onLimitReached: (req, res, options) => {
        console.log(`⚠️  IP ${req.ip} reached limit on ${req.url}`);
        // Opcional: Salvar em DB para análise
    }
});
```

---

## 🎯 **CONCLUSÃO**

### **PARA TESTES (AGORA):**
✅ **Rate limiting DESABILITADO** (já feito)

### **PARA PRODUÇÃO (DEPOIS):**
✅ **Usar configuração recomendada acima:**
- 60 req/min para leitura (GET)
- 6 req/min para escrita (POST)
- 2 req/min para operações críticas (broadcast/sign)
- ♾️ Ilimitado para arquivos estáticos

### **IMPACTO NO USUÁRIO:**
✅ **ZERO** - Usuário normal nunca atinge limites  
✅ **BOT BLOQUEADO** - Scraper/atacante é detectado e bloqueado  
✅ **UX MANTIDO** - Navegação fluida sem delays

---

**Recomendação:** Implementar **OPÇÃO 1** (Rate Limiting Inteligente por Endpoint) após testes finalizados.

