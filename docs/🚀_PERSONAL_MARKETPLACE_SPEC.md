# 🚀 KRAY WALLET - PERSONAL MARKETPLACE (P2P)

**Status:** 📋 PLANEJAMENTO  
**Prioridade:** 🔥 ALTA  
**Tipo:** Marketplace Descentralizado Peer-to-Peer

---

## 🎯 VISÃO GERAL

Cada usuário da KrayWallet terá seu próprio **Personal Marketplace** - uma página única e compartilhável onde pode listar suas Inscriptions, Runes e Liquidity Pools para venda.

### 🌟 Diferenciais:

- ✅ **100% Descentralizado** - Sem intermediários
- ✅ **URL Única** - Cada address tem sua "loja"
- ✅ **Compartilhável** - Twitter, Discord, Telegram
- ✅ **PSBT Ready** - Tech já existe na wallet
- ✅ **Auto-detect** - Se comprador tem KrayWallet, popup automático
- ✅ **P2P Puro** - Vendedor ↔ Comprador direto

---

## 🏗️ ARQUITETURA TÉCNICA

### 1️⃣ FRONTEND

#### A. Botão "List on Market" (Wallet)
```javascript
// Em cada Inscription card
<button class="list-market-btn">
  📋 List on Market
</button>

// Click → Abre popup de pricing
showListOnMarketPopup(inscription);
```

#### B. Popup de Pricing
```html
<div id="list-market-popup" class="modal">
  <h3>List Inscription on Your Market</h3>
  
  <div class="inscription-preview">
    <img src="inscription.content" />
    <p>ID: {{inscription.id}}</p>
  </div>
  
  <div class="form-group">
    <label>Price (sats)</label>
    <input type="number" id="market-price" min="1000" />
  </div>
  
  <div class="form-group">
    <label>Description (optional)</label>
    <textarea id="market-description"></textarea>
  </div>
  
  <button id="create-market-offer-btn">
    Create Offer & List
  </button>
</div>
```

#### C. Personal Marketplace Page
```
URL: https://kraywallet.com/market/{address}
      ou
      http://localhost:3000/market/{address}

Exemplo:
https://kraywallet.com/market/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx
```

**Layout:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>{{address}} - Kray Market</title>
</head>
<body>
  <header>
    <h1>🏪 Personal Marketplace</h1>
    <p>Seller: <code>{{address}}</code></p>
    <button id="copy-market-url">📋 Copy Market URL</button>
  </header>
  
  <section id="inscriptions-for-sale">
    <h2>Inscriptions</h2>
    <div class="market-grid">
      <!-- Inscription cards -->
      <div class="market-item">
        <img src="..." />
        <p>Price: 10,000 sats</p>
        <button class="buy-now-btn">Buy Now</button>
      </div>
    </div>
  </section>
  
  <section id="runes-for-sale">
    <h2>Runes</h2>
    <!-- Rune offers -->
  </section>
  
  <section id="pools-for-sale">
    <h2>Liquidity Pools</h2>
    <!-- Pool offers -->
  </section>
</body>
</html>
```

---

### 2️⃣ BACKEND

#### A. Database Schema

**Tabela: `user_offers`**
```sql
CREATE TABLE user_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_address TEXT NOT NULL,
  item_type TEXT NOT NULL, -- 'inscription', 'rune', 'pool'
  item_id TEXT NOT NULL,
  price_sats INTEGER NOT NULL,
  description TEXT,
  psbt_hex TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'sold', 'cancelled'
  UNIQUE(seller_address, item_id)
);

CREATE INDEX idx_seller ON user_offers(seller_address, status);
CREATE INDEX idx_item ON user_offers(item_id, status);
```

**Exemplo de Registro:**
```json
{
  "id": 1,
  "seller_address": "bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx",
  "item_type": "inscription",
  "item_id": "0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831",
  "price_sats": 10000,
  "description": "Rare Bitcoin Ordinal",
  "psbt_hex": "70736274ff01007e...",
  "created_at": 1698264000,
  "status": "active"
}
```

#### B. API Endpoints

**1. Criar Offer**
```javascript
POST /api/market/create-offer

Body:
{
  "sellerAddress": "bc1p...",
  "itemType": "inscription",
  "itemId": "abc123i0",
  "priceSats": 10000,
  "description": "Cool NFT",
  "psbtHex": "70736274ff01007e..."
}

Response:
{
  "success": true,
  "offerId": 1,
  "marketUrl": "http://localhost:3000/market/bc1p..."
}
```

**2. Listar Offers de um Address**
```javascript
GET /api/market/offers/:address

Response:
{
  "success": true,
  "address": "bc1p...",
  "offers": [
    {
      "id": 1,
      "itemType": "inscription",
      "itemId": "abc123i0",
      "priceSats": 10000,
      "description": "Cool NFT",
      "createdAt": 1698264000,
      "status": "active"
    }
  ]
}
```

**3. Obter Detalhes de uma Offer**
```javascript
GET /api/market/offer/:offerId

Response:
{
  "success": true,
  "offer": {
    "id": 1,
    "sellerAddress": "bc1p...",
    "itemType": "inscription",
    "itemId": "abc123i0",
    "priceSats": 10000,
    "description": "Cool NFT",
    "psbtHex": "70736274ff01007e...",
    "inscriptionData": {
      "contentType": "image/png",
      "contentUrl": "...",
      "number": 78630547
    }
  }
}
```

**4. Cancelar Offer**
```javascript
DELETE /api/market/offer/:offerId

Headers:
Authorization: signature

Response:
{
  "success": true,
  "message": "Offer cancelled"
}
```

**5. Marcar como Vendido**
```javascript
POST /api/market/offer/:offerId/sold

Body:
{
  "txid": "abc123..."
}

Response:
{
  "success": true,
  "message": "Offer marked as sold"
}
```

---

### 3️⃣ FLUXO COMPLETO

#### 📤 VENDEDOR (Criar Offer)

```javascript
// 1. User clica "List on Market" na Inscription
async function listInscriptionOnMarket(inscription) {
  // Mostrar popup de pricing
  const modal = showListMarketModal(inscription);
  
  // User define preço
  const priceSats = await getPriceFromUser();
  const description = await getDescriptionFromUser();
  
  // Criar PSBT de venda (já temos essa tech!)
  const psbt = await createSellPSBT({
    inscription: inscription,
    price: priceSats,
    sellerAddress: currentAddress
  });
  
  // Salvar offer no backend
  const response = await fetch('/api/market/create-offer', {
    method: 'POST',
    body: JSON.stringify({
      sellerAddress: currentAddress,
      itemType: 'inscription',
      itemId: inscription.id,
      priceSats: priceSats,
      description: description,
      psbtHex: psbt.toHex()
    })
  });
  
  const data = await response.json();
  
  // Mostrar URL do marketplace
  showMarketUrlPopup(data.marketUrl);
  
  // User pode copiar e compartilhar!
}
```

#### 📥 COMPRADOR (Ver e Comprar)

**A. Visitante SEM KrayWallet:**
```javascript
// Na página do market
<button class="buy-now-btn" onclick="buyOffer(1)">
  Buy Now
</button>

async function buyOffer(offerId) {
  // Buscar PSBT da offer
  const offer = await fetch(`/api/market/offer/${offerId}`);
  const psbt = offer.psbtHex;
  
  // Mostrar PSBT para copiar
  showPSBTModal(psbt);
  
  // Instruções: "Open your wallet and paste this PSBT"
}
```

**B. Visitante COM KrayWallet (MÁGICO! ✨):**
```javascript
// Content script detecta KrayWallet instalada
if (window.krayWallet) {
  // Auto-inject botão especial
  document.querySelectorAll('.buy-now-btn').forEach(btn => {
    btn.innerHTML = '⚡ Buy with KrayWallet';
    btn.onclick = async (offerId) => {
      // Abre popup da wallet automaticamente!
      const offer = await fetch(`/api/market/offer/${offerId}`);
      
      // Wallet abre popup de confirmação
      await window.krayWallet.signAndBroadcastPSBT(offer.psbtHex);
      
      // Done! Transaction sent! 🎉
    };
  });
}
```

---

## 🎨 UI/UX DESIGN

### 1️⃣ Wallet Extension - "List on Market"

```
┌─────────────────────────────────────────┐
│  Your Inscriptions                      │
├─────────────────────────────────────────┤
│  ┌─────────────────┐                    │
│  │   [Image]       │                    │
│  │                 │                    │
│  │ #78630547       │                    │
│  └─────────────────┘                    │
│                                         │
│  [📤 Send] [📋 List on Market]         │
└─────────────────────────────────────────┘

Click "List on Market" →

┌─────────────────────────────────────────┐
│  📋 List on Your Market                 │
├─────────────────────────────────────────┤
│                                         │
│  Inscription: #78630547                 │
│  ID: 0f15190...i831                    │
│                                         │
│  Price (sats):                          │
│  [10000      ]                          │
│                                         │
│  Description (optional):                │
│  [Rare Bitcoin art...]                  │
│                                         │
│  [Cancel]  [Create Offer & List]       │
└─────────────────────────────────────────┘

After creating →

┌─────────────────────────────────────────┐
│  ✅ Listed Successfully!                │
├─────────────────────────────────────────┤
│                                         │
│  Your Personal Market:                  │
│  https://kraywallet.com/market/bc1p...  │
│                                         │
│  [📋 Copy URL] [🐦 Share on Twitter]   │
│                                         │
│  [View My Market] [Done]                │
└─────────────────────────────────────────┘
```

### 2️⃣ Personal Marketplace Page

```
┌─────────────────────────────────────────────────────────────┐
│  KRAY MARKET                                    [KrayWallet]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🏪 Personal Marketplace                                    │
│  Seller: bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd... │
│  [📋 Copy URL] [🐦 Share]                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📸 INSCRIPTIONS FOR SALE (3)                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │ [Image] │  │ [Image] │  │ [Image] │                    │
│  │         │  │         │  │         │                    │
│  │ #123456 │  │ #234567 │  │ #345678 │                    │
│  │ 10K sats│  │ 25K sats│  │ 50K sats│                    │
│  │ [Buy]   │  │ [Buy]   │  │ [Buy]   │                    │
│  └─────────┘  └─────────┘  └─────────┘                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  🪙 RUNES FOR SALE (1)                                      │
├─────────────────────────────────────────────────────────────┤
│  UNCOMMON•GOODS - 1M units - 100K sats [Buy]               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  💧 LIQUIDITY POOLS (0)                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 SEGURANÇA

### 1. Autenticação de Vendedor
```javascript
// Para criar/cancelar offers, precisa assinar mensagem
const message = `List offer for ${itemId} at ${priceSats} sats`;
const signature = await window.krayWallet.signMessage(message);

// Backend valida assinatura
if (!verifySignature(message, signature, sellerAddress)) {
  throw new Error('Invalid signature');
}
```

### 2. Validação de PSBT
```javascript
// Backend valida que PSBT:
- Está corretamente formado
- Preço corresponde ao declarado
- Seller address corresponde ao PSBT input
- Não tem outputs maliciosos
```

### 3. Anti-Spam
```javascript
// Limitar offers por address
const MAX_OFFERS_PER_ADDRESS = 100;

// Limitar criação de offers
const rateLimit = rateLimit({
  windowMs: 60000, // 1 minuto
  max: 10 // 10 offers por minuto
});
```

---

## 📊 FASES DE IMPLEMENTAÇÃO

### 🎯 FASE 1: MVP - Inscriptions Only
**Prazo:** 2-3 dias

- [ ] Database schema para `user_offers`
- [ ] API endpoints básicos (create, list, get)
- [ ] Botão "List on Market" na wallet
- [ ] Popup de pricing
- [ ] Criar PSBT de venda
- [ ] Personal marketplace page (básica)
- [ ] "Buy Now" button (copiar PSBT)

### 🎯 FASE 2: KrayWallet Auto-Detection
**Prazo:** 1 dia

- [ ] Content script para detectar wallet
- [ ] Auto-inject "Buy with KrayWallet" button
- [ ] Popup automático na compra
- [ ] Sign & broadcast direto

### 🎯 FASE 3: Runes Support
**Prazo:** 2 dias

- [ ] Adaptar para Runes
- [ ] PSBT para Runes trades
- [ ] UI para listar Runes
- [ ] Marketplace page mostra Runes

### 🎯 FASE 4: Pools Support
**Prazo:** 2 dias

- [ ] Adaptar para Liquidity Pools
- [ ] PSBT para pool shares
- [ ] UI para listar pools
- [ ] Marketplace page mostra pools

### 🎯 FASE 5: Social Features
**Prazo:** 1 dia

- [ ] Share buttons (Twitter, Telegram)
- [ ] QR code para market URL
- [ ] Seller profile (avatar, bio)
- [ ] Stats (views, sales)

---

## 🌐 COMPARTILHAMENTO SOCIAL

### Twitter Integration
```javascript
// Botão "Share on Twitter"
const tweetText = `Check out my Bitcoin Inscriptions for sale! 🎨\n\n` +
                  `View my Personal Market: ${marketUrl}\n\n` +
                  `#Bitcoin #Ordinals #KrayWallet`;

const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
window.open(twitterUrl, '_blank');
```

### QR Code
```javascript
// Gerar QR code do market URL
import QRCode from 'qrcode';

const qr = await QRCode.toDataURL(marketUrl);
// Mostrar QR code para compartilhar offline
```

---

## 💡 CASOS DE USO

### 1. Artist selling art
```
1. Cria inscriptions de suas artes
2. Lista no Personal Market com preços
3. Compartilha URL no Twitter
4. Seguidores veem e compram direto
5. P2P, sem taxas de marketplace!
```

### 2. NFT Collector selling collection
```
1. Tem 50 inscriptions
2. Lista 10 para venda
3. Compartilha market em Discord
4. Comunidade vê sua coleção
5. Negocia preços via DM
6. Fecha venda via PSBT
```

### 3. Rune Trader
```
1. Lista Runes para venda
2. Define preço em sats
3. Compartilha URL em Telegram
4. Traders veem offers
5. Compra instantânea via wallet
```

---

## 🚀 BENEFÍCIOS

### Para Usuários:
- ✅ **Grátis** - Sem taxas de listing
- ✅ **Peer-to-Peer** - Direto vendedor → comprador
- ✅ **Compartilhável** - URL único, fácil de divulgar
- ✅ **Descentralizado** - Sem intermediários
- ✅ **Flexível** - Define seus próprios preços

### Para KrayWallet:
- ✅ **Diferencial** - Feature única no mercado
- ✅ **Network Effect** - Mais users = mais markets = mais value
- ✅ **Viralidade** - URLs compartilhados = growth
- ✅ **Sticky** - Users voltam para ver seus markets

---

## 🔮 FUTURO

### V2 Features:
- [ ] Market analytics (views, clicks)
- [ ] Seller reputation/reviews
- [ ] Offer negotiations (buyer proposes price)
- [ ] Bundles (sell multiple items together)
- [ ] Auctions (time-limited offers)
- [ ] Wishlist (buyers save favorite offers)
- [ ] Market discovery (explore all markets)
- [ ] Search (find specific inscriptions across markets)

### V3 Features:
- [ ] Custom domains (myname.kray.market)
- [ ] Market themes/customization
- [ ] Multi-sig escrow (extra security)
- [ ] Fiat on-ramp integration
- [ ] Mobile app support

---

## 📝 NOTAS TÉCNICAS

### PSBT Storage:
```javascript
// Não armazenar PSBTs completos forever
// Depois de 30 dias inativo, limpar
const OFFER_EXPIRY_DAYS = 30;

// Cron job para limpar offers antigas
cron.schedule('0 0 * * *', cleanExpiredOffers);
```

### CDN para Inscriptions:
```javascript
// Cache inscription content
// Use IPFS ou CDN para servir imagens
const contentUrl = `https://cdn.kraywallet.com/inscription/${inscriptionId}`;
```

### SEO:
```html
<!-- Para cada market page -->
<meta property="og:title" content="{{address}} - Kray Market" />
<meta property="og:description" content="{{count}} items for sale" />
<meta property="og:image" content="{{firstInscriptionImage}}" />
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Backend:
- [ ] Database schema
- [ ] API routes
- [ ] PSBT validation
- [ ] Signature verification
- [ ] Rate limiting

### Frontend (Wallet):
- [ ] "List on Market" button
- [ ] Pricing popup
- [ ] Create offer flow
- [ ] Success modal with URL
- [ ] My offers management

### Frontend (Market Page):
- [ ] Public market page
- [ ] Offer listing
- [ ] Buy button
- [ ] PSBT display
- [ ] KrayWallet detection

### Integration:
- [ ] Content script
- [ ] Auto-detection
- [ ] Popup trigger
- [ ] Sign & broadcast

---

**Criado por:** AI Assistant  
**Data:** 24/10/2024  
**Versão:** 1.0.0  
**Sistema:** KRAY WALLET - Personal Marketplace

