# 🌟 KRAY WALLET - SOCIAL PROFILE CONCEPT

**Conceito:** Cada Bitcoin Address = Conta Social Descentralizada

---

## 💡 VISÃO: ADDRESS COMO IDENTIDADE SOCIAL

```
Bitcoin Address = Profile + Market + Social Feed

bc1p...3m36gx
├── 👤 Profile (username, avatar, bio)
├── 🏪 Market (items for sale)
├── 📊 Activity (transactions, listings)
├── 🎨 Collection (owned items)
└── 🤝 Social (followers, following)
```

---

## 🎯 COMPARAÇÃO COM WEB2

### Instagram / Twitter:
```
@username
├── Profile pic
├── Bio
├── Posts/tweets
├── Followers/following
└── Shop (Instagram Shop)
```

### KrayWallet (Web3):
```
bc1p...3m36gx (ou @customname)
├── Avatar (Inscription NFT)
├── Bio (signed message)
├── Market (Inscriptions/Runes for sale)
├── Collection (owned NFTs)
└── Followers (on-chain or off-chain)
```

---

## 🏗️ SOCIAL PROFILE - ESTRUTURA COMPLETA

### 📍 URL Structure:
```
https://kraywallet.com/@username
    ou
https://kraywallet.com/profile/bc1p...3m36gx

Exemplo:
https://kraywallet.com/@tomkray
https://kraywallet.com/@artist_btc
```

### 🎨 Profile Page Layout:

```html
<!DOCTYPE html>
<html>
<head>
  <title>@tomkray - Kray Wallet</title>
</head>
<body>
  <!-- HEADER / PROFILE INFO -->
  <header class="profile-header">
    <div class="cover-image">
      <!-- Optional cover NFT -->
    </div>
    
    <div class="profile-info">
      <img src="avatar.png" class="profile-avatar" />
      
      <div class="profile-details">
        <h1>@tomkray</h1>
        <p class="bio">Bitcoin artist 🎨 | Ordinals collector | Building on-chain</p>
        
        <div class="profile-stats">
          <span>📦 42 Items</span>
          <span>💰 15 Listed</span>
          <span>✅ 8 Sales</span>
          <span>👥 234 Followers</span>
        </div>
        
        <p class="address">
          Address: <code>bc1pvz02d8z6c4d7r2m...3m36gx</code>
          <button>📋 Copy</button>
          <button>✅ Verified</button>
        </p>
        
        <div class="social-links">
          <a href="twitter.com/tomkray">🐦 Twitter</a>
          <a href="github.com/tomkray">💻 GitHub</a>
          <a href="tomkray.com">🌐 Website</a>
        </div>
        
        <div class="action-buttons">
          <button>💸 Send Sats</button>
          <button>💌 Message</button>
          <button>⭐ Follow</button>
          <button>🔔 Subscribe</button>
        </div>
      </div>
    </div>
  </header>
  
  <!-- NAVIGATION TABS -->
  <nav class="profile-tabs">
    <button class="active">🏪 Market</button>
    <button>🎨 Collection</button>
    <button>📊 Activity</button>
    <button>💧 Pools</button>
    <button>👥 Social</button>
  </nav>
  
  <!-- TAB: MARKET -->
  <section id="market-tab" class="tab-content">
    <h2>🏪 Items for Sale</h2>
    
    <!-- Inscriptions -->
    <div class="items-grid">
      <div class="item-card">
        <img src="inscription1.png" />
        <p>Inscription #123456</p>
        <p class="price">10,000 sats</p>
        <button>Buy Now</button>
      </div>
      <!-- More items... -->
    </div>
    
    <!-- Runes -->
    <h3>Runes for Sale</h3>
    <div class="runes-list">
      <div class="rune-offer">
        <span>UNCOMMON•GOODS</span>
        <span>1M units - 100K sats</span>
        <button>Buy</button>
      </div>
    </div>
  </section>
  
  <!-- TAB: COLLECTION -->
  <section id="collection-tab" class="tab-content hidden">
    <h2>🎨 My Collection</h2>
    
    <div class="collection-stats">
      <p>Total Items: 42</p>
      <p>Total Value: ~500K sats</p>
      <p>Rarest: Inscription #12345</p>
    </div>
    
    <div class="items-grid">
      <!-- All owned items -->
    </div>
  </section>
  
  <!-- TAB: ACTIVITY -->
  <section id="activity-tab" class="tab-content hidden">
    <h2>📊 Recent Activity</h2>
    
    <div class="activity-feed">
      <div class="activity-item">
        <span>🛒 Sold Inscription #123456 for 10K sats</span>
        <span>2 hours ago</span>
      </div>
      <div class="activity-item">
        <span>📥 Received 5K sats</span>
        <span>1 day ago</span>
      </div>
      <div class="activity-item">
        <span>📋 Listed Inscription #234567</span>
        <span>3 days ago</span>
      </div>
    </div>
  </section>
  
  <!-- TAB: POOLS -->
  <section id="pools-tab" class="tab-content hidden">
    <h2>💧 My Liquidity Pools</h2>
    <!-- Pool shares for sale -->
  </section>
  
  <!-- TAB: SOCIAL -->
  <section id="social-tab" class="tab-content hidden">
    <h2>👥 Social</h2>
    
    <div class="social-stats">
      <div>
        <h3>234</h3>
        <p>Followers</p>
      </div>
      <div>
        <h3>156</h3>
        <p>Following</p>
      </div>
      <div>
        <h3>42</h3>
        <p>Mutual</p>
      </div>
    </div>
    
    <div class="followers-list">
      <!-- List of followers -->
    </div>
  </section>
</body>
</html>
```

---

## 🗃️ DATABASE SCHEMA

### Tabela: `user_profiles`
```sql
CREATE TABLE user_profiles (
  address TEXT PRIMARY KEY,
  username TEXT UNIQUE, -- @tomkray
  display_name TEXT,
  bio TEXT,
  avatar_inscription_id TEXT, -- NFT como avatar
  cover_inscription_id TEXT, -- NFT como cover
  twitter TEXT,
  github TEXT,
  website TEXT,
  verified BOOLEAN DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_username ON user_profiles(username);
```

### Tabela: `social_follows`
```sql
CREATE TABLE social_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_address TEXT NOT NULL,
  following_address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(follower_address, following_address)
);

CREATE INDEX idx_follower ON social_follows(follower_address);
CREATE INDEX idx_following ON social_follows(following_address);
```

### Tabela: `profile_activity`
```sql
CREATE TABLE profile_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'sale', 'purchase', 'list', 'delist'
  item_type TEXT, -- 'inscription', 'rune', 'pool'
  item_id TEXT,
  amount_sats INTEGER,
  txid TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_address_activity ON profile_activity(address, created_at DESC);
```

---

## 🎨 FEATURES SOCIAIS

### 1️⃣ USERNAME SYSTEM
```javascript
// Registrar username
POST /api/profile/claim-username

Body:
{
  "address": "bc1p...",
  "username": "tomkray",
  "signature": "..." // Prova de ownership
}

// Verificar disponibilidade
GET /api/profile/username-available/tomkray

Response:
{
  "available": true
}
```

### 2️⃣ AVATAR (NFT como Profile Pic)
```javascript
// Definir Inscription como avatar
POST /api/profile/set-avatar

Body:
{
  "address": "bc1p...",
  "inscriptionId": "abc123i0",
  "signature": "..."
}

// Sistema valida que user possui a inscription
// Avatar aparece no perfil
```

### 3️⃣ BIO & LINKS
```javascript
// Atualizar profile
PUT /api/profile/update

Body:
{
  "address": "bc1p...",
  "bio": "Bitcoin artist 🎨",
  "twitter": "@tomkray",
  "website": "tomkray.com",
  "signature": "..."
}
```

### 4️⃣ FOLLOW SYSTEM
```javascript
// Seguir alguém
POST /api/social/follow

Body:
{
  "follower": "bc1p...AAA",
  "following": "bc1p...BBB",
  "signature": "..."
}

// Buscar seguidores
GET /api/social/followers/bc1p...AAA

Response:
{
  "count": 234,
  "followers": [
    {
      "address": "bc1p...BBB",
      "username": "@artist",
      "avatar": "inscription123i0",
      "followedAt": 1698264000
    }
  ]
}

// Buscar quem está seguindo
GET /api/social/following/bc1p...AAA
```

### 5️⃣ ACTIVITY FEED
```javascript
// Feed de atividades
GET /api/profile/activity/bc1p...AAA

Response:
{
  "activities": [
    {
      "type": "sale",
      "itemType": "inscription",
      "itemId": "abc123i0",
      "amountSats": 10000,
      "txid": "def456...",
      "timestamp": 1698264000
    },
    {
      "type": "list",
      "itemType": "rune",
      "itemId": "UNCOMMON•GOODS",
      "amountSats": 100000,
      "timestamp": 1698250000
    }
  ]
}
```

---

## 🌐 SOCIAL SHARING

### Share Profile:
```javascript
// Botões de share no perfil
const profileUrl = `https://kraywallet.com/@tomkray`;

// Twitter
const tweetText = `Check out my Bitcoin profile on @KrayWallet! 🚀\n\n` +
                  `${profileUrl}\n\n` +
                  `#Bitcoin #Ordinals`;

// Telegram
const telegramUrl = `https://t.me/share/url?url=${profileUrl}`;

// QR Code
const qr = generateQR(profileUrl);
```

### Embeddable Profile Widget:
```html
<!-- Embed profile em outros sites -->
<iframe 
  src="https://kraywallet.com/embed/@tomkray"
  width="300"
  height="400"
  frameborder="0">
</iframe>

<!-- Widget mostra: avatar, username, bio, stats, follow button -->
```

---

## 💬 MESSAGING (Futuro)

### Concept: On-chain Messages
```javascript
// Enviar mensagem encriptada
POST /api/social/send-message

Body:
{
  "from": "bc1p...AAA",
  "to": "bc1p...BBB",
  "encryptedMessage": "...", // Encrypted with recipient's pubkey
  "signature": "..."
}

// Inbox
GET /api/social/messages/bc1p...AAA

Response:
{
  "messages": [
    {
      "from": "bc1p...CCC",
      "fromUsername": "@artist",
      "encryptedMessage": "...",
      "timestamp": 1698264000
    }
  ]
}

// Decrypt no client com private key
const decrypted = decryptMessage(encryptedMessage, privateKey);
```

---

## 🏆 VERIFICATION SYSTEM

### Verified Badge ✅

**Critérios para Verificação:**
```javascript
const verificationCriteria = {
  // Automatic verification
  hasOldAddress: age > 1 year,
  hasTransactions: txCount > 100,
  hasValue: balance > 0.01 BTC,
  
  // Manual verification
  knownArtist: true,
  socialProof: {
    twitter: verified,
    github: verified
  }
};

// Se passou, adiciona badge ✅
```

**Database:**
```sql
ALTER TABLE user_profiles ADD COLUMN verified BOOLEAN DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN verification_type TEXT; -- 'auto', 'manual', 'social'
```

---

## 🎨 ARTIST SHOWCASE

### Special Features for Verified Artists:

```html
<!-- Artist Profile tem features extras -->
<div class="artist-showcase">
  <div class="featured-collection">
    <h2>Featured Collection</h2>
    <!-- Pin favorite pieces -->
  </div>
  
  <div class="artist-story">
    <h2>About the Artist</h2>
    <p>Long-form bio...</p>
  </div>
  
  <div class="artist-sales">
    <h2>Recent Sales</h2>
    <p>Total Sales: 1.5 BTC</p>
    <p>Items Sold: 42</p>
  </div>
</div>
```

---

## 📊 ANALYTICS (Private)

### For Profile Owner Only:
```javascript
GET /api/profile/analytics/bc1p...AAA
Authorization: signature

Response:
{
  "views": {
    "total": 1234,
    "last7days": 89,
    "last30days": 456
  },
  "engagement": {
    "profileClicks": 567,
    "itemClicks": 234,
    "copyAddress": 45,
    "shareProfile": 23
  },
  "followers": {
    "total": 234,
    "newThisWeek": 12
  },
  "sales": {
    "totalVolume": 150000,
    "avgPrice": 10000,
    "itemsSold": 15
  }
}
```

---

## 🔍 DISCOVERY

### Explore Profiles:
```html
<!-- Page: /explore -->
<div class="explore-page">
  <h1>Discover Creators</h1>
  
  <!-- Filters -->
  <div class="filters">
    <button>🔥 Trending</button>
    <button>🆕 New</button>
    <button>✅ Verified</button>
    <button>🎨 Artists</button>
    <button>💎 Collectors</button>
  </div>
  
  <!-- Grid of profiles -->
  <div class="profiles-grid">
    <div class="profile-card">
      <img src="avatar.png" />
      <h3>@artist_btc ✅</h3>
      <p>Bitcoin artist 🎨</p>
      <p>42 items | 234 followers</p>
      <button>Follow</button>
    </div>
    <!-- More profiles... -->
  </div>
</div>
```

### Search:
```javascript
GET /api/search?q=artist&type=profile

Response:
{
  "results": [
    {
      "address": "bc1p...",
      "username": "@artist_btc",
      "displayName": "Bitcoin Artist",
      "avatar": "abc123i0",
      "verified": true,
      "followers": 234,
      "itemsCount": 42
    }
  ]
}
```

---

## 🎯 USO CASES

### 1. Bitcoin Artist
```
1. Cria profile: @artist_btc
2. Define avatar (sua melhor arte)
3. Escreve bio: "On-chain artist since 2023"
4. Lista suas inscriptions para venda
5. Compartilha profile no Twitter
6. Ganha followers
7. Vende direto P2P
```

### 2. NFT Collector
```
1. Cria profile: @collector_pro
2. Mostra coleção de Ordinals
3. Lista alguns para venda
4. Segue outros collectors
5. Descobre novas artes
6. Negocia via messages
```

### 3. Rune Trader
```
1. Profile: @rune_master
2. Lista Runes para trade
3. Mostra histórico de trades (activity)
4. Ganha reputação
5. Followers confiam nele
6. Volume de trades aumenta
```

---

## 🚀 VIRAL GROWTH

### Network Effects:
```
1 user cria profile
  → Compartilha no Twitter
    → 10 amigos veem
      → 3 criam profiles
        → Compartilham também
          → Crescimento exponencial!
```

### SEO:
```html
<!-- Meta tags para cada profile -->
<meta property="og:title" content="@tomkray - Kray Wallet" />
<meta property="og:description" content="Bitcoin artist 🎨 | 42 items | 234 followers" />
<meta property="og:image" content="avatar-url" />
<meta name="twitter:card" content="summary_large_image" />
```

---

## 💎 PREMIUM FEATURES (Futuro)

### Profile Customization:
- [ ] Custom themes/colors
- [ ] Custom layout
- [ ] Featured items pinned
- [ ] Video avatar
- [ ] Music on profile
- [ ] Custom domain (@name.kray.market)

### Advanced Analytics:
- [ ] Detailed visitor stats
- [ ] Conversion tracking
- [ ] A/B testing
- [ ] Email notifications

---

## ✅ COMPARAÇÃO: KRAY vs OUTROS

| Feature | KrayWallet | OpenSea | Magic Eden | Twitter |
|---------|-----------|---------|------------|---------|
| Bitcoin Native | ✅ | ❌ | Partial | ❌ |
| Self-custody | ✅ | ❌ | ❌ | N/A |
| P2P Trading | ✅ | ❌ | ❌ | ❌ |
| Social Profile | ✅ | Partial | Partial | ✅ |
| Username | ✅ | ✅ | ✅ | ✅ |
| Follow System | ✅ | ❌ | ❌ | ✅ |
| On-chain ID | ✅ | ❌ | ❌ | ❌ |
| No Fees | ✅ | ❌ (2.5%) | ❌ (2%) | ✅ |

**KrayWallet = Twitter + OpenSea + Self-custody + Bitcoin**

---

## 🎉 RESULTADO FINAL

```
Cada Bitcoin Address vira:
├── 💳 Carteira (send/receive)
├── 👤 Perfil Social (username, avatar, bio)
├── 🏪 Loja Pessoal (marketplace)
├── 🎨 Galeria (collection showcase)
├── 📊 Portfólio (activity history)
└── 🤝 Rede Social (follow, message)

TUDO DESCENTRALIZADO!
TUDO ON-CHAIN!
TUDO P2P!
```

---

**🔮 VISÃO:** KrayWallet não é só uma wallet. É uma **identidade social descentralizada** no Bitcoin.

---

**Criado por:** AI Assistant  
**Data:** 24/10/2024  
**Sistema:** KRAY WALLET - Social Profile Concept

