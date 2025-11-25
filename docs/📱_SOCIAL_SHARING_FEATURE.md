# 📱 SOCIAL SHARING - COMPARTILHAMENTO DE OFERTAS

**Conceito:** Cada oferta tem URL única para compartilhar em redes sociais com preview bonito

---

## 🎯 DOIS TIPOS DE COMPARTILHAMENTO

### 1️⃣ **PROFILE COMPLETO** (todas ofertas do user)
```
https://kraywallet.com/@username
ou
https://kraywallet.com/profile/bc1p...3m36gx

Mostra:
• Avatar
• Bio
• Todas ofertas ativas
• Collection
• Stats
```

### 2️⃣ **OFERTA INDIVIDUAL** (1 inscription específica)
```
https://kraywallet.com/offer/abc123xyz

Mostra:
• Inscription preview (imagem grande!)
• Preço
• Descrição
• Seller info (username + avatar)
• Botão "Buy Now"
```

---

## 🔗 URL STRUCTURE

### Profile URL:
```javascript
const profileUrl = `https://kraywallet.com/@${username}`;
// ou
const profileUrl = `https://kraywallet.com/profile/${address}`;

// Exemplo:
// https://kraywallet.com/@artist_btc
// https://kraywallet.com/profile/bc1pvz02d8z6c4d...
```

### Offer URL:
```javascript
const offerUrl = `https://kraywallet.com/offer/${offerId}`;

// Exemplo:
// https://kraywallet.com/offer/off_abc123xyz456
```

---

## 🎨 OFERTA INDIVIDUAL - PAGE LAYOUT

### HTML Structure:
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Inscription #123456 - For Sale on Kray Wallet</title>
  
  <!-- 🎯 META TAGS PARA REDES SOCIAIS -->
  
  <!-- Open Graph (Facebook, LinkedIn) -->
  <meta property="og:type" content="product" />
  <meta property="og:title" content="Inscription #123456 - 10,000 sats" />
  <meta property="og:description" content="Rare Bitcoin Ordinal inscription for sale. Buy now with atomic swap!" />
  <meta property="og:image" content="https://kraywallet.com/api/inscription/abc123i0/content" />
  <meta property="og:url" content="https://kraywallet.com/offer/off_abc123" />
  <meta property="og:site_name" content="Kray Wallet" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Inscription #123456 - 10,000 sats" />
  <meta name="twitter:description" content="Rare Bitcoin Ordinal inscription for sale" />
  <meta name="twitter:image" content="https://kraywallet.com/api/inscription/abc123i0/content" />
  <meta name="twitter:creator" content="@artist_btc" />
  
  <!-- Product Schema (Google) -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Inscription #123456",
    "image": "https://kraywallet.com/api/inscription/abc123i0/content",
    "description": "Rare Bitcoin Ordinal inscription",
    "offers": {
      "@type": "Offer",
      "price": "0.0001",
      "priceCurrency": "BTC",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>
</head>

<body>
  <!-- NAVBAR -->
  <nav class="navbar">
    <div class="nav-brand">
      <img src="/logo.png" alt="Kray Wallet" />
      <span>KRAY WALLET</span>
    </div>
    <div class="nav-actions">
      <a href="/" class="nav-link">Marketplace</a>
      <button class="btn-connect-wallet">Connect Wallet</button>
    </div>
  </nav>

  <!-- MAIN CONTENT -->
  <main class="offer-page">
    <div class="offer-container">
      <!-- LEFT: IMAGE -->
      <div class="offer-preview">
        <img 
          id="inscription-image" 
          src="https://kraywallet.com/api/inscription/abc123i0/content"
          alt="Inscription #123456"
          class="inscription-large"
        />
        
        <!-- Badges -->
        <div class="badges">
          <span class="badge badge-verified">✅ Verified</span>
          <span class="badge badge-ordinal">🎨 Ordinal</span>
        </div>
      </div>

      <!-- RIGHT: DETAILS -->
      <div class="offer-details">
        <h1>Inscription #123456</h1>
        
        <div class="price-section">
          <div class="price-label">Price</div>
          <div class="price-value">
            <span class="price-sats">10,000 sats</span>
            <span class="price-btc">~0.0001 BTC</span>
            <span class="price-usd">~$4.20 USD</span>
          </div>
        </div>

        <!-- Seller Info -->
        <div class="seller-section">
          <div class="seller-label">Seller</div>
          <a href="/profile/bc1p..." class="seller-info">
            <img src="/avatar/abc123i0" class="seller-avatar" />
            <div class="seller-details">
              <span class="seller-username">@artist_btc ✅</span>
              <span class="seller-stats">42 sales • 4.9★</span>
            </div>
          </a>
        </div>

        <!-- Description -->
        <div class="description-section">
          <div class="description-label">Description</div>
          <p class="description-text">
            Rare Bitcoin Ordinal inscription. 
            Hand-crafted digital art inscribed on-chain.
            Limited edition 1/1.
          </p>
        </div>

        <!-- Inscription Details -->
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Inscription ID</span>
            <span class="detail-value">
              abc123...xyz
              <button class="btn-copy">📋</button>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Content Type</span>
            <span class="detail-value">image/png</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Size</span>
            <span class="detail-value">12.4 KB</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Genesis Block</span>
            <span class="detail-value">#812345</span>
          </div>
        </div>

        <!-- ACTION BUTTONS -->
        <div class="action-buttons">
          <button class="btn-buy-now" id="buy-now-btn">
            💰 Buy Now - 10,000 sats
          </button>
          
          <button class="btn-make-offer" id="make-offer-btn">
            💬 Make an Offer
          </button>
        </div>

        <!-- Share Buttons -->
        <div class="share-section">
          <div class="share-label">Share this inscription</div>
          <div class="share-buttons">
            <button class="btn-share twitter" data-network="twitter">
              🐦 Twitter
            </button>
            <button class="btn-share telegram" data-network="telegram">
              ✈️ Telegram
            </button>
            <button class="btn-share whatsapp" data-network="whatsapp">
              💬 WhatsApp
            </button>
            <button class="btn-share copy" data-network="copy">
              📋 Copy Link
            </button>
          </div>
        </div>

        <!-- Trust Indicators -->
        <div class="trust-section">
          <div class="trust-item">
            <span class="trust-icon">🔒</span>
            <span class="trust-text">Atomic Swap - No Middleman</span>
          </div>
          <div class="trust-item">
            <span class="trust-icon">⚡</span>
            <span class="trust-text">Instant Settlement</span>
          </div>
          <div class="trust-item">
            <span class="trust-icon">💎</span>
            <span class="trust-text">Verified On-Chain</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SIMILAR ITEMS -->
    <section class="similar-items">
      <h2>More from this seller</h2>
      <div class="items-grid">
        <!-- Other offers from same seller -->
      </div>
    </section>
  </main>

  <!-- FOOTER -->
  <footer>
    <p>Powered by Kray Wallet - Bitcoin Ordinals & Runes</p>
  </footer>
</body>
</html>
```

---

## 🎨 CSS - DESIGN BONITO

```css
/* Offer Page Styles */
.offer-page {
  max-width: 1200px;
  margin: 40px auto;
  padding: 0 20px;
}

.offer-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  margin-bottom: 80px;
}

/* LEFT SIDE - IMAGE */
.offer-preview {
  position: sticky;
  top: 100px;
  height: fit-content;
}

.inscription-large {
  width: 100%;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  aspect-ratio: 1;
  object-fit: cover;
}

.badges {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.badge {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.badge-verified {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.badge-ordinal {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
}

/* RIGHT SIDE - DETAILS */
.offer-details {
  padding: 20px 0;
}

.offer-details h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 32px;
}

/* PRICE SECTION */
.price-section {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border: 2px solid rgba(102, 126, 234, 0.3);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 32px;
}

.price-label {
  font-size: 14px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.price-value {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.price-sats {
  font-size: 42px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.price-btc,
.price-usd {
  font-size: 16px;
  color: var(--text-secondary);
}

/* SELLER SECTION */
.seller-section {
  margin-bottom: 32px;
}

.seller-label {
  font-size: 14px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.seller-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--card-bg);
  border-radius: 16px;
  text-decoration: none;
  transition: all 0.2s;
}

.seller-info:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
}

.seller-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid var(--primary-color);
}

.seller-details {
  display: flex;
  flex-direction: column;
}

.seller-username {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.seller-stats {
  font-size: 14px;
  color: var(--text-secondary);
}

/* DESCRIPTION */
.description-section {
  margin-bottom: 32px;
}

.description-label {
  font-size: 14px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.description-text {
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-primary);
}

/* DETAILS GRID */
.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 32px;
}

.detail-item {
  padding: 16px;
  background: var(--card-bg);
  border-radius: 12px;
}

.detail-label {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.detail-value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

/* ACTION BUTTONS */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

.btn-buy-now {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-buy-now:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.btn-make-offer {
  padding: 16px;
  background: var(--card-bg);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-make-offer:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

/* SHARE SECTION */
.share-section {
  padding: 24px;
  background: var(--card-bg);
  border-radius: 16px;
  margin-bottom: 32px;
}

.share-label {
  font-size: 14px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.share-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.btn-share {
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-share:hover {
  transform: translateY(-2px);
}

.btn-share.twitter {
  background: #1da1f2;
  color: white;
  border-color: #1da1f2;
}

.btn-share.telegram {
  background: #0088cc;
  color: white;
  border-color: #0088cc;
}

.btn-share.whatsapp {
  background: #25d366;
  color: white;
  border-color: #25d366;
}

.btn-share.copy {
  background: var(--card-bg);
  color: var(--text-primary);
}

/* TRUST SECTION */
.trust-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.trust-icon {
  font-size: 20px;
}

/* RESPONSIVE */
@media (max-width: 768px) {
  .offer-container {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  
  .offer-preview {
    position: static;
  }
  
  .share-buttons {
    grid-template-columns: 1fr;
  }
}
```

---

## 🔧 BACKEND - API ENDPOINTS

### 1. Get Offer Details
```javascript
// server/routes/offers.js

// GET /api/offer/:id/details - Buscar detalhes completos da oferta
router.get('/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscar oferta
        const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);
        
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }
        
        // Buscar dados da inscription
        const inscription = db.prepare(`
            SELECT * FROM inscriptions WHERE id = ?
        `).get(offer.inscription_id);
        
        // Buscar dados do seller (profile)
        const seller = db.prepare(`
            SELECT username, bio, avatar_inscription_id, verified
            FROM user_profiles
            WHERE address = ?
        `).get(offer.creator_address);
        
        // Buscar outras ofertas do seller
        const otherOffers = db.prepare(`
            SELECT * FROM offers 
            WHERE creator_address = ? 
            AND status = 'active'
            AND id != ?
            LIMIT 6
        `).all(offer.creator_address, id);
        
        // Resposta completa
        res.json({
            success: true,
            offer: {
                id: offer.id,
                inscriptionId: offer.inscription_id,
                inscriptionNumber: inscription?.inscription_number,
                contentType: inscription?.content_type,
                price: offer.offer_amount,
                feeRate: offer.fee_rate,
                description: offer.description,
                createdAt: offer.created_at,
                status: offer.status
            },
            seller: {
                address: offer.creator_address,
                username: seller?.username || null,
                bio: seller?.bio || null,
                avatar: seller?.avatar_inscription_id || null,
                verified: seller?.verified || false
            },
            otherOffers: otherOffers.map(o => ({
                id: o.id,
                inscriptionId: o.inscription_id,
                price: o.offer_amount
            }))
        });
        
    } catch (error) {
        console.error('Error fetching offer details:', error);
        res.status(500).json({ error: error.message });
    }
});
```

### 2. Generate Share URLs
```javascript
// server/routes/share.js

import express from 'express';
const router = express.Router();

// POST /api/share/offer - Gerar URLs de compartilhamento
router.post('/offer', async (req, res) => {
    try {
        const { offerId, inscriptionNumber, price } = req.body;
        
        const baseUrl = process.env.PUBLIC_URL || 'https://kraywallet.com';
        const offerUrl = `${baseUrl}/offer/${offerId}`;
        
        // Twitter
        const twitterText = encodeURIComponent(
            `🎨 Inscription #${inscriptionNumber} for sale!\n\n` +
            `💰 Price: ${price.toLocaleString()} sats\n\n` +
            `Buy now with atomic swap on @KrayWallet 🚀`
        );
        const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(offerUrl)}`;
        
        // Telegram
        const telegramText = encodeURIComponent(
            `🎨 Inscription #${inscriptionNumber} for sale! ${price.toLocaleString()} sats`
        );
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(offerUrl)}&text=${telegramText}`;
        
        // WhatsApp
        const whatsappText = encodeURIComponent(
            `🎨 Check out this Bitcoin Ordinal inscription for sale!\n` +
            `Inscription #${inscriptionNumber}\n` +
            `Price: ${price.toLocaleString()} sats\n` +
            `${offerUrl}`
        );
        const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
        
        res.json({
            success: true,
            urls: {
                direct: offerUrl,
                twitter: twitterUrl,
                telegram: telegramUrl,
                whatsapp: whatsappUrl
            }
        });
        
    } catch (error) {
        console.error('Error generating share URLs:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
```

---

## 💻 EXTENSION - SHARE BUTTON

### A. Adicionar botão "Share" no modal de listing

```html
<!-- Em popup.html, no modal de My Offers -->
<div class="offer-card">
  <img class="offer-preview" />
  
  <div class="offer-details">
    <p class="offer-id">Inscription #123456</p>
    <p class="offer-price">💰 10,000 sats</p>
  </div>
  
  <div class="offer-actions">
    <button class="btn-share-offer" data-offer-id="...">
      📱 Share
    </button>
    <button class="btn-cancel-offer">
      ❌ Cancel
    </button>
  </div>
</div>
```

### B. JavaScript - Share Modal

```javascript
// popup.js

// Show share modal
async function showShareModal(offerId, inscriptionNumber, price) {
  console.log('📱 Opening share modal...');
  
  // Generate share URLs
  const response = await fetch('http://localhost:3000/api/share/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offerId: offerId,
      inscriptionNumber: inscriptionNumber,
      price: price
    })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    showNotification('Failed to generate share links', 'error');
    return;
  }
  
  // Show modal with share options
  const modal = document.createElement('div');
  modal.className = 'modal share-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>📱 Share Your Listing</h2>
        <button class="modal-close">&times;</button>
      </div>
      
      <div class="modal-body">
        <p class="share-description">
          Share your inscription listing on social media!
        </p>
        
        <div class="share-preview">
          <img src="http://localhost:3000/api/inscription/${inscriptionId}/content" />
          <div class="share-preview-info">
            <p>Inscription #${inscriptionNumber}</p>
            <p class="price">${price.toLocaleString()} sats</p>
          </div>
        </div>
        
        <div class="share-options">
          <a href="${data.urls.twitter}" target="_blank" class="share-btn twitter">
            🐦 Share on Twitter
          </a>
          
          <a href="${data.urls.telegram}" target="_blank" class="share-btn telegram">
            ✈️ Share on Telegram
          </a>
          
          <a href="${data.urls.whatsapp}" target="_blank" class="share-btn whatsapp">
            💬 Share on WhatsApp
          </a>
          
          <button class="share-btn copy" data-url="${data.urls.direct}">
            📋 Copy Link
          </button>
        </div>
        
        <div class="share-qr">
          <p>Or scan QR code:</p>
          <div id="qr-code"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Generate QR code
  generateQRCode(data.urls.direct, document.getElementById('qr-code'));
  
  // Copy link handler
  modal.querySelector('.copy').addEventListener('click', () => {
    const url = modal.querySelector('.copy').dataset.url;
    navigator.clipboard.writeText(url);
    showNotification('✅ Link copied!', 'success');
  });
  
  // Close modal
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
}

// Generate QR Code
function generateQRCode(text, container) {
  // Use QRCode.js library
  new QRCode(container, {
    text: text,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff'
  });
}
```

---

## 🎨 PREVIEW CARDS - COMO APARECE NAS REDES SOCIAIS

### Twitter Preview:
```
┌──────────────────────────────────────────┐
│ [LARGE IMAGE OF INSCRIPTION]             │
│                                          │
│ kraywallet.com                           │
│ Inscription #123456 - 10,000 sats        │
│ Rare Bitcoin Ordinal inscription for ... │
└──────────────────────────────────────────┘
```

### Telegram Preview:
```
┌──────────────────────────────────────────┐
│ Kray Wallet                              │
│ Inscription #123456 - 10,000 sats        │
│                                          │
│ [LARGE IMAGE OF INSCRIPTION]             │
│                                          │
│ Rare Bitcoin Ordinal inscription for ... │
│                                          │
│ 🔗 kraywallet.com/offer/abc123           │
└──────────────────────────────────────────┘
```

---

## 📊 ANALYTICS (Futuro)

### Track Share Performance:
```javascript
// Quando alguém compartilha
POST /api/analytics/share
{
  "offerId": "off_abc123",
  "network": "twitter",
  "userId": "bc1p..."
}

// Quando alguém clica no link compartilhado
GET /offer/abc123?ref=twitter&from=user123

// Dashboard do seller mostra:
• Total shares: 42
• Twitter: 25
• Telegram: 12
• WhatsApp: 5
• Views from shares: 234
• Purchases from shares: 3
```

---

## ✅ RESULTADO FINAL

### USER FLOW:

1. **User cria listing na extension**
   - Clica "📋 List on Market"
   - Define preço: 10,000 sats
   - ✅ Listado!

2. **User vai em "My Offers"**
   - Vê listing ativo
   - Clica "📱 Share"

3. **Share Modal abre**
   - Preview da inscription (bonito!)
   - Botões: Twitter, Telegram, WhatsApp, Copy
   - QR Code para compartilhar offline

4. **User compartilha no Twitter**
   - Tweet automático com imagem linda
   - Link: `kraywallet.com/offer/abc123`
   - Preview card aparece automaticamente

5. **Amigos clicam no link**
   - Página linda com inscription grande
   - Botão "Buy Now" bem visível
   - Podem comprar direto!

6. **Alguém compra**
   - Atomic swap P2P
   - Seller recebe sats automaticamente
   - Offer é removida
   - Seller é notificado: "✅ Sold!"

---

## 🎯 DUAS ESTRATÉGIAS DE COMPARTILHAMENTO

### Estratégia 1: **Profile Completo** (para artists estabelecidos)
```
"Check out my Bitcoin art collection! 🎨

42 inscriptions available on Kray Wallet

https://kraywallet.com/@artist_btc"

→ Mostra todo portfólio
→ Bom para construir marca
→ Múltiplas chances de venda
```

### Estratégia 2: **Oferta Individual** (para venda específica)
```
"🎨 Rare inscription for sale!

Inscription #123456
💰 10,000 sats only

Buy now with atomic swap 🚀
https://kraywallet.com/offer/abc123"

→ Foco em 1 item
→ Call-to-action direto
→ Preview bonito no Twitter
```

---

**🚀 IMPLEMENTAÇÃO:** Incluir na Fase 5 do plano de integração

**⏱️ TEMPO EXTRA:** +2 horas (6-8 horas total)

---

**Criado por:** AI Assistant  
**Data:** 24/10/2024  
**Sistema:** KRAY WALLET - Social Sharing Feature

