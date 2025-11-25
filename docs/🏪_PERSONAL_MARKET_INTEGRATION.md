# 🏪 PERSONAL MARKET - INTEGRAÇÃO COMPLETA

**Conceito:** Profile público acessível em 3 lugares diferentes

---

## 🎯 3 PONTOS DE ACESSO AO PROFILE

```
1️⃣ KRAY WALLET (Extension)
   └── chrome-extension://abc123/profile/bc1p...

2️⃣ KRAY STATION (Frontend localhost:3000)
   └── http://localhost:3000/profile/bc1p...
   └── http://localhost:3000/@username

3️⃣ KRAY STATION (Public domain)
   └── https://kraywallet.com/profile/bc1p...
   └── https://kraywallet.com/@username
```

**MESMO BACKEND, MESMAS OFFERS!** 📊

---

## 🏗️ ARQUITETURA UNIFICADA

### Backend (Shared):
```
/Volumes/D2/KRAY WALLET/server/
├── routes/
│   ├── profile.js         ← Profile API
│   └── market.js          ← Market API
├── db/
│   └── ordinals.db
│       ├── user_profiles
│       ├── user_offers
│       └── social_follows
```

### Frontend 1 - Extension:
```
kraywallet-extension/
├── popup/
│   ├── profile-page.html  ← View own profile
│   └── market-page.html   ← View others' profiles
```

### Frontend 2 - Kray Station:
```
/Volumes/D2/KRAY WALLET/
├── profile.html           ← Public profile page
├── market-browse.html     ← Browse all markets
└── js/
    └── profile.js         ← Profile logic
```

---

## 📦 O QUE APARECE NO PROFILE?

### 🖼️ ORDINALS / INSCRIPTIONS
```javascript
// Inscriptions listadas para venda
{
  "inscriptions": [
    {
      "id": "abc123i0",
      "number": 78630547,
      "contentType": "image/png",
      "contentUrl": "...",
      "price": 10000,
      "description": "Rare Bitcoin art"
    }
  ]
}
```

### 🪙 RUNES (Layer 1)
```javascript
// Runes listadas para venda
{
  "runes": [
    {
      "name": "UNCOMMON•GOODS",
      "runeId": "840000:3",
      "amount": 1000000,
      "pricePerUnit": 100,
      "totalPrice": 100000000,
      "description": "Bulk sale"
    }
  ]
}
```

### 📦 UTXO PACKAGES (Bundles)
```javascript
// Pacotes de UTXOs para venda
{
  "utxoPackages": [
    {
      "id": "pkg_001",
      "name": "10x 546 sat UTXOs",
      "utxos": [
        { txid: "...", vout: 0, value: 546 },
        { txid: "...", vout: 1, value: 546 },
        // ... 8 more
      ],
      "totalValue": 5460,
      "price": 10000,
      "description": "Perfect for Ordinals inscribing"
    }
  ]
}
```

### 💧 AMM POOLS (Liquidity Shares)
```javascript
// Pool shares para venda
{
  "poolShares": [
    {
      "poolId": "BTC-UNCOMMON",
      "poolName": "BTC/UNCOMMON•GOODS",
      "shareAmount": 100,
      "sharePercentage": 10,
      "currentValue": 50000,
      "price": 55000,
      "description": "10% of pool liquidity"
    }
  ]
}
```

---

## 🎨 LAYOUT DO PROFILE (Unified)

### HTML Structure:
```html
<!DOCTYPE html>
<html>
<head>
  <title>@username - Kray Market</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <!-- HEADER -->
  <header class="profile-header">
    <div class="profile-info">
      <img src="avatar.png" class="avatar" />
      <h1>@username ✅</h1>
      <p class="bio">Bitcoin artist 🎨 | Ordinals collector</p>
      <div class="stats">
        <span>📦 42 Items</span>
        <span>💰 15 Listed</span>
        <span>👥 234 Followers</span>
      </div>
      <code class="address">bc1p...3m36gx</code>
    </div>
  </header>

  <!-- TABS -->
  <nav class="tabs">
    <button class="tab active" data-tab="inscriptions">
      🖼️ Inscriptions (8)
    </button>
    <button class="tab" data-tab="runes">
      🪙 Runes (3)
    </button>
    <button class="tab" data-tab="utxos">
      📦 UTXO Packages (2)
    </button>
    <button class="tab" data-tab="pools">
      💧 AMM Pools (1)
    </button>
  </nav>

  <!-- TAB: INSCRIPTIONS -->
  <section id="tab-inscriptions" class="tab-content active">
    <div class="items-grid">
      <div class="item-card">
        <img src="inscription.png" />
        <p class="item-id">#78630547</p>
        <p class="item-price">10,000 sats</p>
        <button class="btn-buy">Buy Now</button>
      </div>
      <!-- More inscriptions... -->
    </div>
  </section>

  <!-- TAB: RUNES -->
  <section id="tab-runes" class="tab-content hidden">
    <div class="runes-list">
      <div class="rune-offer">
        <div class="rune-info">
          <h3>UNCOMMON•GOODS</h3>
          <p>Amount: 1,000,000 units</p>
          <p>Price: 100 sats/unit</p>
        </div>
        <div class="rune-actions">
          <p class="total-price">Total: 100,000,000 sats</p>
          <button class="btn-buy">Buy</button>
        </div>
      </div>
      <!-- More runes... -->
    </div>
  </section>

  <!-- TAB: UTXO PACKAGES -->
  <section id="tab-utxos" class="tab-content hidden">
    <div class="packages-list">
      <div class="package-card">
        <h3>10x 546 sat UTXOs</h3>
        <p>Perfect for Ordinals inscribing</p>
        <div class="package-details">
          <p>Total value: 5,460 sats</p>
          <p>Price: 10,000 sats</p>
          <p>Premium: +83%</p>
        </div>
        <button class="btn-buy">Buy Package</button>
      </div>
      <!-- More packages... -->
    </div>
  </section>

  <!-- TAB: AMM POOLS -->
  <section id="tab-pools" class="tab-content hidden">
    <div class="pools-list">
      <div class="pool-card">
        <h3>BTC/UNCOMMON•GOODS Pool</h3>
        <div class="pool-info">
          <p>Share: 10% (100 units)</p>
          <p>Current value: 50,000 sats</p>
          <p>Asking price: 55,000 sats</p>
        </div>
        <button class="btn-buy">Buy Shares</button>
      </div>
      <!-- More pools... -->
    </div>
  </section>

  <script src="/js/profile.js"></script>
</body>
</html>
```

---

## 🔌 API ENDPOINTS

### 1. Get Profile with All Offers
```javascript
GET /api/profile/:address/market

Response:
{
  "success": true,
  "profile": {
    "address": "bc1p...",
    "username": "@tomkray",
    "bio": "Bitcoin artist 🎨",
    "avatar": "abc123i0",
    "stats": {
      "totalItems": 42,
      "listedItems": 15,
      "followers": 234
    }
  },
  "offers": {
    "inscriptions": [
      {
        "id": "abc123i0",
        "number": 78630547,
        "contentType": "image/png",
        "contentUrl": "...",
        "price": 10000,
        "description": "..."
      }
    ],
    "runes": [
      {
        "name": "UNCOMMON•GOODS",
        "runeId": "840000:3",
        "amount": 1000000,
        "pricePerUnit": 100,
        "totalPrice": 100000000
      }
    ],
    "utxoPackages": [
      {
        "id": "pkg_001",
        "name": "10x 546 sat UTXOs",
        "utxos": [...],
        "price": 10000
      }
    ],
    "poolShares": [
      {
        "poolId": "BTC-UNCOMMON",
        "shareAmount": 100,
        "price": 55000
      }
    ]
  }
}
```

### 2. Create Inscription Offer
```javascript
POST /api/market/offer/inscription

Body:
{
  "sellerAddress": "bc1p...",
  "inscriptionId": "abc123i0",
  "price": 10000,
  "description": "Rare art",
  "psbtHex": "...",
  "signature": "..."
}
```

### 3. Create Rune Offer
```javascript
POST /api/market/offer/rune

Body:
{
  "sellerAddress": "bc1p...",
  "runeName": "UNCOMMON•GOODS",
  "amount": 1000000,
  "pricePerUnit": 100,
  "psbtHex": "...",
  "signature": "..."
}
```

### 4. Create UTXO Package Offer
```javascript
POST /api/market/offer/utxo-package

Body:
{
  "sellerAddress": "bc1p...",
  "packageName": "10x 546 sat UTXOs",
  "utxos": [
    { txid: "...", vout: 0, value: 546 },
    // ...
  ],
  "price": 10000,
  "psbtHex": "...",
  "signature": "..."
}
```

### 5. Create Pool Share Offer
```javascript
POST /api/market/offer/pool-share

Body:
{
  "sellerAddress": "bc1p...",
  "poolId": "BTC-UNCOMMON",
  "shareAmount": 100,
  "price": 55000,
  "psbtHex": "...",
  "signature": "..."
}
```

---

## 🖥️ INTEGRATION: EXTENSION

### A. Extension - "My Profile" Button
```html
<!-- In wallet main screen -->
<div class="wallet-header">
  <button id="my-profile-btn" class="header-btn">
    👤 My Profile
  </button>
</div>
```

### B. Extension - Profile Page
```javascript
// popup/profile-page.js

async function loadMyProfile() {
  const address = getCurrentAddress();
  
  // Fetch my offers
  const response = await fetch(
    `http://localhost:3000/api/profile/${address}/market`
  );
  
  const data = await response.json();
  
  // Display in extension popup
  displayProfile(data.profile);
  displayOffers(data.offers);
  
  // Add "List New Item" buttons
  addListItemButtons();
}
```

### C. Extension - Quick Actions
```html
<!-- In inscription card -->
<div class="inscription-card">
  <img src="..." />
  <p>Inscription #123456</p>
  
  <div class="actions">
    <button class="btn-send">📤 Send</button>
    <button class="btn-list-market">📋 List on Market</button>
  </div>
</div>
```

---

## 🌐 INTEGRATION: KRAY STATION

### A. Frontend - Profile Route
```javascript
// server/index.js

// Profile page
app.get('/profile/:address', (req, res) => {
  res.sendFile(path.join(__dirname, '../profile.html'));
});

// Username shortcut
app.get('/@:username', async (req, res) => {
  // Lookup address from username
  const address = await getAddressFromUsername(req.params.username);
  res.redirect(`/profile/${address}`);
});
```

### B. Frontend - Browse Markets
```html
<!-- market-browse.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Browse Markets - Kray Station</title>
</head>
<body>
  <header>
    <h1>🏪 Browse Personal Markets</h1>
    <input type="search" placeholder="Search profiles..." />
  </header>
  
  <!-- Filters -->
  <div class="filters">
    <button class="filter active">🔥 All</button>
    <button class="filter">🖼️ Inscriptions</button>
    <button class="filter">🪙 Runes</button>
    <button class="filter">📦 UTXOs</button>
    <button class="filter">💧 Pools</button>
  </div>
  
  <!-- Markets grid -->
  <div class="markets-grid">
    <a href="/profile/bc1p..." class="market-card">
      <img src="avatar.png" class="avatar" />
      <h3>@artist ✅</h3>
      <p>15 items for sale</p>
      <p class="address">bc1p...abc</p>
    </a>
    <!-- More markets... -->
  </div>
</body>
</html>
```

### C. Frontend - Profile Page JavaScript
```javascript
// js/profile.js

async function loadProfile() {
  // Get address from URL
  const address = window.location.pathname.split('/').pop();
  
  // Fetch profile data
  const response = await fetch(`/api/profile/${address}/market`);
  const data = await response.json();
  
  // Display profile
  document.getElementById('username').textContent = 
    data.profile.username || address.substring(0, 20) + '...';
  
  document.getElementById('bio').textContent = data.profile.bio;
  document.getElementById('avatar').src = 
    `/api/inscription/${data.profile.avatar}/content`;
  
  // Display offers by type
  displayInscriptions(data.offers.inscriptions);
  displayRunes(data.offers.runes);
  displayUTXOPackages(data.offers.utxoPackages);
  displayPoolShares(data.offers.poolShares);
  
  // Setup tabs
  setupTabs();
  
  // Setup buy buttons
  setupBuyButtons();
}

// Detect if user has KrayWallet extension
if (window.krayWallet) {
  // Enable one-click buy with popup
  enableQuickBuy();
} else {
  // Show PSBT for manual signing
  enableManualBuy();
}
```

---

## 💡 USE CASES

### 1️⃣ Artist Lists Art
```
Extension:
1. Open KrayWallet extension
2. Go to Inscriptions tab
3. Click "List on Market" on artwork
4. Set price: 10,000 sats
5. Click "Create Offer"
6. ✅ Listed!

Kray Station:
1. User visits localhost:3000/@artist
2. Sees artwork listed
3. Clicks "Buy Now"
4. If has extension: auto-popup!
5. Signs PSBT and done!
```

### 2️⃣ Trader Lists Runes
```
Extension:
1. Open KrayWallet
2. Go to Runes tab
3. Click "List on Market" on UNCOMMON•GOODS
4. Set: 1M units @ 100 sats each
5. ✅ Listed!

Kray Station:
1. Buyer visits localhost:3000/@trader
2. Goes to "Runes" tab
3. Sees UNCOMMON•GOODS offer
4. Clicks "Buy"
5. Transaction!
```

### 3️⃣ Inscriber Sells UTXO Package
```
Extension:
1. Open KrayWallet
2. Go to "UTXO Manager"
3. Select 10x 546 sat UTXOs
4. Click "Create Package & List"
5. Set price: 10,000 sats
6. ✅ Package listed!

Kray Station:
1. Inscriber visits profile
2. Goes to "UTXO Packages" tab
3. Sees package
4. Clicks "Buy Package"
5. Receives 10 perfect UTXOs!
```

### 4️⃣ LP Sells Pool Share
```
Extension:
1. Open KrayWallet
2. Go to Lightning tab
3. Click "AMM Pools"
4. Select your pool share
5. Click "List for Sale"
6. Set price: 55,000 sats
7. ✅ Share listed!

Kray Station:
1. Buyer visits profile
2. Goes to "AMM Pools" tab
3. Sees pool share offer
4. Reviews current value
5. Clicks "Buy Shares"
6. Owns part of the pool!
```

---

## 📊 DASHBOARD (Extension)

### My Profile Dashboard:
```html
<!-- Extension popup -->
<div class="my-profile-dashboard">
  <h2>📊 My Market Dashboard</h2>
  
  <div class="stats-grid">
    <div class="stat-card">
      <h3>15</h3>
      <p>Active Listings</p>
    </div>
    <div class="stat-card">
      <h3>8</h3>
      <p>Total Sales</p>
    </div>
    <div class="stat-card">
      <h3>150K</h3>
      <p>Total Revenue (sats)</p>
    </div>
  </div>
  
  <!-- Quick Actions -->
  <div class="quick-actions">
    <button id="view-my-profile-btn">
      🌐 View Public Profile
    </button>
    <button id="share-profile-btn">
      📋 Copy Profile URL
    </button>
    <button id="manage-offers-btn">
      ⚙️ Manage Offers
    </button>
  </div>
  
  <!-- Recent Activity -->
  <div class="recent-activity">
    <h3>Recent Activity</h3>
    <div class="activity-item">
      <p>🛒 Sold Inscription #123456</p>
      <p>10,000 sats • 2 hours ago</p>
    </div>
    <div class="activity-item">
      <p>📋 Listed Rune UNCOMMON•GOODS</p>
      <p>3 days ago</p>
    </div>
  </div>
</div>
```

---

## 🔗 CROSS-LINKING

### Extension → Frontend:
```javascript
// In extension
document.getElementById('view-my-profile-btn').onclick = () => {
  const address = getCurrentAddress();
  
  // Open Kray Station in new tab
  chrome.tabs.create({
    url: `http://localhost:3000/profile/${address}`
  });
};
```

### Frontend → Extension:
```javascript
// In Kray Station frontend
if (window.krayWallet) {
  // Add "Open in Extension" button
  const btn = document.createElement('button');
  btn.textContent = '🔌 Open in KrayWallet';
  btn.onclick = () => {
    // Message extension to open profile page
    window.krayWallet.openProfile(currentAddress);
  };
}
```

---

## 🎯 UNIFIED DATABASE

### Single Source of Truth:
```
/Volumes/D2/KRAY WALLET/database.sqlite

Tables:
├── user_profiles (username, bio, avatar)
├── user_offers_inscriptions
├── user_offers_runes
├── user_offers_utxo_packages
└── user_offers_pool_shares

Extension reads from: http://localhost:3000/api/*
Frontend reads from: http://localhost:3000/api/*

SAME DATA, SAME APIS!
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Basic Infrastructure
- [ ] Profile API endpoints
- [ ] Market API endpoints
- [ ] Database schema for all offer types
- [ ] Profile page HTML/CSS
- [ ] Basic JavaScript for rendering

### Phase 2: Extension Integration
- [ ] "My Profile" button in extension
- [ ] Profile dashboard in popup
- [ ] "List on Market" buttons everywhere
- [ ] Quick actions (share, manage)

### Phase 3: Frontend Integration
- [ ] Profile page route (/profile/:address)
- [ ] Username shortcuts (/@username)
- [ ] Browse markets page
- [ ] Search functionality

### Phase 4: All Offer Types
- [ ] Inscriptions listing/buying
- [ ] Runes listing/buying
- [ ] UTXO packages listing/buying
- [ ] Pool shares listing/buying

### Phase 5: Social Features
- [ ] Follow system
- [ ] Activity feed
- [ ] Profile discovery

---

## 🚀 RESULTADO FINAL

```
┌─────────────────────────────────────────────────────────┐
│  KRAY WALLET ECOSYSTEM                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Extension                  Frontend                    │
│  ┌──────────┐              ┌──────────┐                │
│  │ 👤 Profile│◄────────────►│  Profile │                │
│  │          │  Same Data   │   Page   │                │
│  │ • List   │              │          │                │
│  │ • Manage │              │ • View   │                │
│  │ • Stats  │              │ • Buy    │                │
│  └──────────┘              │ • Share  │                │
│       │                    └──────────┘                │
│       │                         │                       │
│       └─────────┬───────────────┘                       │
│                 │                                       │
│          ┌──────▼──────┐                               │
│          │   Backend   │                               │
│          │             │                               │
│          │ • Profiles  │                               │
│          │ • Offers    │                               │
│          │ • Database  │                               │
│          └─────────────┘                               │
│                                                         │
│  Offers tudo no mesmo lugar:                           │
│  • 🖼️ Inscriptions                                      │
│  • 🪙 Runes                                             │
│  • 📦 UTXO Packages                                     │
│  • 💧 AMM Pool Shares                                   │
└─────────────────────────────────────────────────────────┘
```

---

**🎉 PERFEITO!** Cada address vira uma loja completa, acessível de qualquer lugar!

---

**Criado por:** AI Assistant  
**Data:** 24/10/2024  
**Sistema:** KRAY WALLET - Personal Market Integration

