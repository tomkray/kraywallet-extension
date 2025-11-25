# 📊 Sistema de Analytics & Ranking de Usuários

**Data:** 24 de outubro de 2025  
**Objetivo:** Criar banco de dados completo para rastrear atividades dos usuários e dashboard admin

---

## 🎯 Visão Geral

### Sistema Centralizado de User Analytics

Um banco de dados **indexado por Bitcoin address** que registra **TODAS** as atividades do usuário:

- 💝 Likes dados/recebidos
- 🛒 Compras realizadas
- 🏪 Ofertas criadas
- 📊 Vendas completadas
- 💬 Comentários/posts
- 🔄 Swaps de Runes
- 💧 Operações de Liquidity Pool
- ⚡ Transações Lightning
- 📈 Histórico de saldo
- 🕐 Timestamps de todas as ações

### API Dedicada

- **Porta:** `3001` (separada do backend principal na 3000)
- **Nome:** `analytics-api`
- **Função:** Processar e servir dados de analytics
- **Dashboard Admin:** Interface para visualizar rankings e estatísticas

---

## 🗄️ Estrutura do Banco de Dados

### 1. Tabela: `users` (Perfil do Usuário)

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT UNIQUE NOT NULL,
    first_seen INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    
    -- Estatísticas agregadas
    total_likes_given INTEGER DEFAULT 0,
    total_likes_received INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_offers_created INTEGER DEFAULT 0,
    total_volume_bought_sats INTEGER DEFAULT 0,
    total_volume_sold_sats INTEGER DEFAULT 0,
    
    -- Rankings
    reputation_score INTEGER DEFAULT 0,
    rank_position INTEGER,
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_address ON users(address);
CREATE INDEX idx_users_reputation ON users(reputation_score DESC);
CREATE INDEX idx_users_last_activity ON users(last_activity DESC);
```

### 2. Tabela: `user_likes` (Histórico de Likes)

```sql
CREATE TABLE IF NOT EXISTS user_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    offer_owner_address TEXT NOT NULL,
    signature TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (user_address) REFERENCES users(address),
    UNIQUE(user_address, offer_id)
);

CREATE INDEX idx_user_likes_user ON user_likes(user_address);
CREATE INDEX idx_user_likes_offer ON user_likes(offer_id);
CREATE INDEX idx_user_likes_owner ON user_likes(offer_owner_address);
```

### 3. Tabela: `user_purchases` (Compras)

```sql
CREATE TABLE IF NOT EXISTS user_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_address TEXT NOT NULL,
    seller_address TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    inscription_id TEXT,
    rune_id TEXT,
    pool_id TEXT,
    type TEXT NOT NULL, -- 'inscription', 'rune_swap', 'liquidity_pool'
    amount_sats INTEGER NOT NULL,
    txid TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    
    FOREIGN KEY (buyer_address) REFERENCES users(address),
    FOREIGN KEY (seller_address) REFERENCES users(address)
);

CREATE INDEX idx_purchases_buyer ON user_purchases(buyer_address);
CREATE INDEX idx_purchases_seller ON user_purchases(seller_address);
CREATE INDEX idx_purchases_status ON user_purchases(status);
CREATE INDEX idx_purchases_type ON user_purchases(type);
```

### 4. Tabela: `user_offers` (Ofertas Criadas)

```sql
CREATE TABLE IF NOT EXISTS user_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id TEXT UNIQUE NOT NULL,
    seller_address TEXT NOT NULL,
    inscription_id TEXT,
    rune_id TEXT,
    pool_id TEXT,
    type TEXT NOT NULL,
    offer_amount INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'sold', 'cancelled'
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    sold_at INTEGER,
    
    FOREIGN KEY (seller_address) REFERENCES users(address)
);

CREATE INDEX idx_offers_seller ON user_offers(seller_address);
CREATE INDEX idx_offers_status ON user_offers(status);
CREATE INDEX idx_offers_likes ON user_offers(likes_count DESC);
```

### 5. Tabela: `user_comments` (Comentários/Posts)

```sql
CREATE TABLE IF NOT EXISTS user_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    offer_id TEXT,
    content TEXT NOT NULL,
    parent_comment_id INTEGER, -- Para threads
    likes_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    
    FOREIGN KEY (user_address) REFERENCES users(address),
    FOREIGN KEY (parent_comment_id) REFERENCES user_comments(id)
);

CREATE INDEX idx_comments_user ON user_comments(user_address);
CREATE INDEX idx_comments_offer ON user_comments(offer_id);
```

### 6. Tabela: `user_transactions` (Histórico de Transações)

```sql
CREATE TABLE IF NOT EXISTS user_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    type TEXT NOT NULL, -- 'send', 'receive', 'swap', 'pool_add', 'pool_remove'
    txid TEXT NOT NULL,
    amount_sats INTEGER,
    inscription_id TEXT,
    rune_id TEXT,
    from_address TEXT,
    to_address TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    confirmed_at INTEGER,
    
    FOREIGN KEY (user_address) REFERENCES users(address)
);

CREATE INDEX idx_transactions_user ON user_transactions(user_address);
CREATE INDEX idx_transactions_txid ON user_transactions(txid);
CREATE INDEX idx_transactions_type ON user_transactions(type);
```

### 7. Tabela: `user_sessions` (Sessões de Uso)

```sql
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    session_start INTEGER NOT NULL,
    session_end INTEGER,
    duration_seconds INTEGER,
    actions_count INTEGER DEFAULT 0,
    user_agent TEXT,
    
    FOREIGN KEY (user_address) REFERENCES users(address)
);

CREATE INDEX idx_sessions_user ON user_sessions(user_address);
CREATE INDEX idx_sessions_start ON user_sessions(session_start DESC);
```

### 8. Tabela: `user_actions` (Log Detalhado de Ações)

```sql
CREATE TABLE IF NOT EXISTS user_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'like', 'purchase', 'sell', 'comment', 'view', 'swap', etc
    target_id TEXT, -- ID do item afetado
    metadata TEXT, -- JSON com dados extras
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (user_address) REFERENCES users(address)
);

CREATE INDEX idx_actions_user ON user_actions(user_address);
CREATE INDEX idx_actions_type ON user_actions(action_type);
CREATE INDEX idx_actions_created ON user_actions(created_at DESC);
```

---

## 🏗️ Estrutura de Diretórios

```
/Volumes/D2/KRAY WALLET/
├── analytics-api/              # Nova API dedicada
│   ├── index.js               # Servidor principal (porta 3001)
│   ├── routes/
│   │   ├── users.js           # Endpoints de usuários
│   │   ├── rankings.js        # Rankings e leaderboards
│   │   ├── analytics.js       # Estatísticas agregadas
│   │   └── admin.js           # Dashboard admin
│   ├── db/
│   │   ├── init.js            # Inicialização do banco
│   │   └── analytics.db       # SQLite database
│   ├── services/
│   │   ├── userService.js     # Lógica de usuários
│   │   ├── rankingService.js  # Cálculo de rankings
│   │   └── reputationService.js # Sistema de reputação
│   ├── middleware/
│   │   ├── auth.js            # Autenticação admin
│   │   └── rateLimit.js       # Rate limiting
│   └── package.json
│
├── admin-dashboard/            # Dashboard web para admin
│   ├── index.html
│   ├── css/
│   │   └── dashboard.css
│   └── js/
│       ├── dashboard.js
│       ├── charts.js          # Chart.js para gráficos
│       └── rankings.js
│
└── server/
    └── routes/
        └── analytics-webhook.js  # Envia eventos para analytics-api
```

---

## 📡 API Endpoints (Porta 3001)

### Públicos (Frontend)

```javascript
// User Profile
GET  /api/users/:address                  // Perfil do usuário
GET  /api/users/:address/stats            // Estatísticas do usuário
GET  /api/users/:address/activity         // Feed de atividades
GET  /api/users/:address/likes            // Likes dados
GET  /api/users/:address/offers           // Ofertas do usuário
GET  /api/users/:address/purchases        // Compras do usuário
GET  /api/users/:address/sales            // Vendas do usuário

// Rankings
GET  /api/rankings/top-sellers            // Top vendedores
GET  /api/rankings/top-buyers             // Top compradores
GET  /api/rankings/most-liked             // Mais curtidos
GET  /api/rankings/most-active            // Mais ativos
GET  /api/rankings/reputation             // Por reputação

// Analytics
GET  /api/analytics/market-stats          // Estatísticas do mercado
GET  /api/analytics/trending-offers       // Ofertas em alta
GET  /api/analytics/volume-24h            // Volume 24h
```

### Admin (Protegidos)

```javascript
// Dashboard Data
GET  /api/admin/overview                  // Overview geral
GET  /api/admin/users                     // Lista todos usuários
GET  /api/admin/users/:address/details    // Detalhes completos do user
GET  /api/admin/analytics/daily           // Dados diários
GET  /api/admin/analytics/weekly          // Dados semanais
GET  /api/admin/analytics/monthly         // Dados mensais

// User Management
PUT  /api/admin/users/:address/reputation // Ajustar reputação
PUT  /api/admin/users/:address/rank       // Ajustar ranking
POST /api/admin/users/:address/ban        // Banir usuário
DELETE /api/admin/users/:address/ban      // Desbanir

// System
GET  /api/admin/health                    // Health check
GET  /api/admin/logs                      // Logs do sistema
```

---

## 🔄 Webhooks para Analytics

### Modificar Backend Principal (porta 3000)

Adicionar webhook para enviar eventos para analytics-api:

```javascript
// server/services/analyticsWebhook.js
import fetch from 'node-fetch';

const ANALYTICS_API = 'http://localhost:3001/api/events';

export async function trackEvent(eventType, data) {
    try {
        await fetch(ANALYTICS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: eventType,
                data: data,
                timestamp: Date.now()
            })
        });
    } catch (error) {
        console.error('Analytics webhook error:', error);
        // Não bloqueia operação principal se analytics falhar
    }
}

// Eventos rastreados:
// - 'user.like' → Quando usuário dá like
// - 'user.purchase' → Quando compra é realizada
// - 'user.offer.created' → Quando cria oferta
// - 'user.offer.sold' → Quando oferta é vendida
// - 'user.offer.cancelled' → Quando cancela oferta
// - 'user.comment' → Quando comenta
// - 'user.view.offer' → Quando visualiza oferta
```

### Exemplo de Uso:

```javascript
// Em routes/likes.js (linha 234)
router.post('/:offerId', async (req, res) => {
    // ... (código existente)
    
    // ✅ Após adicionar like com sucesso:
    await trackEvent('user.like', {
        user_address: address,
        offer_id: offerId,
        offer_owner: offer.seller_address
    });
    
    res.json({ success: true, likes_count });
});

// Em routes/purchase.js
router.post('/complete', async (req, res) => {
    // ... (código existente)
    
    // ✅ Após compra bem-sucedida:
    await trackEvent('user.purchase', {
        buyer_address: buyerAddress,
        seller_address: sellerAddress,
        offer_id: offerId,
        amount_sats: offer.offer_amount,
        type: offer.type,
        txid: txid
    });
    
    res.json({ success: true });
});
```

---

## 📊 Sistema de Reputação

### Fórmula de Cálculo

```javascript
// analytics-api/services/reputationService.js

function calculateReputation(userStats) {
    let score = 0;
    
    // Likes recebidos (1 ponto por like)
    score += userStats.total_likes_received * 1;
    
    // Vendas completadas (10 pontos por venda)
    score += userStats.total_sales * 10;
    
    // Compras (5 pontos por compra - incentiva atividade)
    score += userStats.total_purchases * 5;
    
    // Ofertas ativas (2 pontos por oferta)
    score += userStats.active_offers_count * 2;
    
    // Volume transacionado (0.01 ponto por 1000 sats)
    score += (userStats.total_volume_sold_sats / 1000) * 0.01;
    
    // Tempo na plataforma (1 ponto por dia)
    const daysSinceFirstSeen = (Date.now() - userStats.first_seen) / (1000 * 60 * 60 * 24);
    score += Math.floor(daysSinceFirstSeen) * 1;
    
    // Penalidades
    score -= userStats.cancelled_offers_count * 5; // -5 por oferta cancelada
    score -= userStats.disputes_count * 20; // -20 por disputa
    
    return Math.max(0, Math.floor(score));
}
```

---

## 🏆 Rankings Disponíveis

### 1. Top Sellers (Vendedores)
- Ordenado por: `total_sales DESC, total_volume_sold_sats DESC`
- Exibe: Nome, avatar, vendas, volume, reputação

### 2. Top Buyers (Compradores)
- Ordenado por: `total_purchases DESC, total_volume_bought_sats DESC`
- Exibe: Nome, avatar, compras, volume gasto

### 3. Most Liked (Mais Curtidos)
- Ordenado por: `total_likes_received DESC`
- Exibe: Ofertas com mais likes, perfis mais curtidos

### 4. Most Active (Mais Ativos)
- Ordenado por: `last_activity DESC, actions_count DESC`
- Exibe: Usuários com mais atividade recente

### 5. Reputation Leaders (Líderes de Reputação)
- Ordenado por: `reputation_score DESC`
- Exibe: Top usuários por reputação calculada

---

## 🎨 Dashboard Admin

### Visão Geral (Overview)

```javascript
// Métricas principais
{
    total_users: 1523,
    active_users_24h: 342,
    total_transactions_24h: 89,
    total_volume_24h_sats: 12450000,
    total_likes_24h: 234,
    total_offers_active: 456
}
```

### Gráficos

1. **Usuários Ativos** (Linha do tempo)
   - Últimos 30 dias
   - Comparação com mês anterior

2. **Volume de Transações** (Barras)
   - Volume diário em sats
   - Volume em USD

3. **Distribuição de Atividades** (Pizza)
   - Likes, Compras, Vendas, Comentários

4. **Top 10 Usuários** (Tabela)
   - Nome, Reputação, Vendas, Compras, Volume

### Filtros

- **Período:** Hoje, 7 dias, 30 dias, Custom
- **Tipo de Atividade:** Todas, Likes, Vendas, Compras
- **Status:** Ativos, Inativos, Banidos

---

## 🚀 Implementação Passo a Passo

### Fase 1: Banco de Dados ✅
1. Criar estrutura SQLite
2. Tabelas de users, likes, purchases, offers
3. Índices para performance

### Fase 2: Analytics API (Porta 3001) ✅
1. Servidor Express
2. Endpoints públicos (rankings, stats)
3. Endpoints admin (protegidos)

### Fase 3: Webhooks ✅
1. Integrar com backend principal (porta 3000)
2. Enviar eventos para analytics-api
3. Tracking de todas as ações

### Fase 4: Sistema de Reputação ✅
1. Fórmula de cálculo
2. Atualização automática
3. Rankings dinâmicos

### Fase 5: Dashboard Admin ✅
1. Interface web
2. Gráficos com Chart.js
3. Tabelas de usuários
4. Controles de administração

### Fase 6: Integração Frontend ✅
1. Exibir reputação nos perfis
2. Badges de ranking
3. Leaderboards no site

---

## 🔐 Segurança

### Autenticação Admin

```javascript
// analytics-api/middleware/auth.js
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'generate-secure-key-here';

export function requireAdmin(req, res, next) {
    const apiKey = req.headers['x-admin-key'];
    
    if (!apiKey || apiKey !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
}

// Uso:
app.use('/api/admin', requireAdmin);
```

### Rate Limiting

```javascript
// analytics-api/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requests por IP
    message: 'Too many requests, please try again later'
});

// Uso:
app.use('/api', limiter);
```

---

## 📈 Métricas de Performance

### Monitoramento

- **Response Time:** < 100ms para queries simples
- **Database Size:** Estimar 1MB por 1000 usuários
- **API Calls:** Suportar 1000 req/min
- **Uptime:** 99.9%

### Otimizações

- Índices em todas as queries frequentes
- Cache de rankings (atualizar a cada 5 minutos)
- Aggregação de stats (calcular uma vez por hora)
- Paginação em todas as listas

---

## 🎯 Próximos Passos

Quer que eu implemente agora:
1. **📦 Criar estrutura completa do analytics-api?**
2. **🗄️ Gerar SQL para todas as tabelas?**
3. **📡 Implementar webhooks no backend atual?**
4. **🎨 Criar dashboard admin HTML/CSS/JS?**
5. **🏆 Implementar sistema de rankings?**

**Qual você quer que eu faça primeiro?** 🚀

