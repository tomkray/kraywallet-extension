# 🚀 PLANO DE INTEGRAÇÃO: MARKETPLACE → KRAYWALLET

**Status:** Já temos 80% pronto no Kray Station! Só falta integrar na extensão.

---

## ✅ O QUE JÁ TEMOS FUNCIONANDO

### 1. **Backend APIs** ✅
```
✅ POST /api/offers - Criar oferta
✅ GET /api/offers - Listar ofertas
✅ GET /api/offers/:id - Buscar oferta específica
✅ DELETE /api/offers/:id - Deletar oferta (após venda)
✅ PUT /api/offers/:id/cancel - Cancelar oferta

✅ POST /api/sell/create-custom-psbt - Criar PSBT de venda
✅ Database: offers table, sales_history table
```

### 2. **Frontend (Kray Station)** ✅
```javascript
// app.js já tem:
✅ createOffer() - Linha 1071
✅ Buscar inscription da wallet
✅ Buscar UTXO real do ORD server
✅ Criar PSBT customizado
✅ Assinar com SIGHASH_NONE|ANYONECANPAY
✅ Salvar offer no banco
✅ Mostrar ofertas no marketplace
```

### 3. **PSBT Builder** ✅
```javascript
// server/utils/psbtBuilder.js
✅ Criar PSBT com SIGHASH_NONE|ANYONECANPAY
✅ Atomic swaps funcionando
✅ Buyer adiciona pagamento
✅ 2-way complete (seller + buyer)
```

---

## 🎯 O QUE FALTA: INTEGRAR NA KRAYWALLET

### **Objetivo:** Adicionar botão "📋 List on Market" em cada inscription

---

## 📋 FASE 1: UI - BOTÃO "LIST ON MARKET"

### A. Adicionar botão nas inscriptions cards

**Arquivo:** `kraywallet-extension/popup/popup.html`

**Localização:** Na seção de Inscriptions

```html
<!-- Inscription card já existe, adicionar botão -->
<div class="inscription-card">
  <img class="inscription-preview" />
  <div class="inscription-details">
    <p class="inscription-id">Inscription #123456</p>
    <p class="inscription-output">546 sats</p>
  </div>
  
  <!-- NOVO: Botões de ação -->
  <div class="inscription-actions">
    <button class="btn-action btn-send">
      📤 Send
    </button>
    <button class="btn-action btn-list-market" data-inscription-id="...">
      📋 List on Market
    </button>
  </div>
</div>
```

### B. CSS para os botões

**Arquivo:** `kraywallet-extension/popup/styles.css`

```css
.inscription-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-action {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-send {
  background: var(--primary-color);
  color: white;
}

.btn-send:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-list-market {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-list-market:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
```

---

## 🔧 FASE 2: POPUP - MODAL "LIST ON MARKET"

### A. HTML do modal (popup.html)

```html
<!-- Modal: List on Market -->
<div id="list-market-modal" class="modal hidden">
  <div class="modal-content">
    <div class="modal-header">
      <h2>📋 List Inscription on Market</h2>
      <button class="modal-close">&times;</button>
    </div>
    
    <div class="modal-body">
      <!-- Preview da inscription -->
      <div class="list-preview">
        <img id="list-inscription-preview" />
        <div class="list-inscription-info">
          <p id="list-inscription-number">Inscription #...</p>
          <p id="list-inscription-id">ID: ...</p>
        </div>
      </div>
      
      <!-- Form -->
      <div class="form-group">
        <label for="list-price">
          💰 Price (sats)
          <span class="form-hint">Minimum: 1,000 sats</span>
        </label>
        <input 
          type="number" 
          id="list-price" 
          placeholder="10000"
          min="1000"
          step="1000"
        />
      </div>
      
      <div class="form-group">
        <label for="list-fee-rate">
          ⚡ Fee Rate (sat/vB)
          <span class="form-hint">Recommended: 5-10</span>
        </label>
        <input 
          type="number" 
          id="list-fee-rate" 
          placeholder="10"
          value="10"
          min="1"
        />
      </div>
      
      <div class="form-group">
        <label for="list-description">
          📝 Description (optional)
        </label>
        <textarea 
          id="list-description" 
          rows="3"
          placeholder="Describe your inscription..."
        ></textarea>
      </div>
      
      <!-- Summary -->
      <div class="list-summary">
        <div class="summary-row">
          <span>Sale Price:</span>
          <span id="summary-price">0 sats</span>
        </div>
        <div class="summary-row">
          <span>Estimated Fee:</span>
          <span id="summary-fee">~0 sats</span>
        </div>
        <div class="summary-row total">
          <span>You will receive:</span>
          <span id="summary-total">0 sats</span>
        </div>
      </div>
      
      <!-- Info box -->
      <div class="info-box">
        <p>ℹ️ Your inscription will be listed on the marketplace</p>
        <p>✅ You can cancel anytime before someone buys it</p>
        <p>🔒 Your inscription stays in your wallet until sold</p>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" id="list-cancel-btn">
        Cancel
      </button>
      <button class="btn-primary" id="list-create-btn">
        📋 Create Listing
      </button>
    </div>
  </div>
</div>
```

### B. CSS do modal

```css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal.hidden {
  display: none;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 18px;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
}

.modal-body {
  padding: 20px;
}

.list-preview {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--hover-color);
  border-radius: 12px;
  margin-bottom: 20px;
}

.list-preview img {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
}

.list-inscription-info {
  flex: 1;
}

.list-inscription-info p {
  margin: 4px 0;
  font-size: 14px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
}

.form-hint {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
}

.list-summary {
  background: var(--hover-color);
  border-radius: 12px;
  padding: 16px;
  margin: 20px 0;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  font-size: 14px;
}

.summary-row.total {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 16px;
}

.info-box {
  background: rgba(102, 126, 234, 0.1);
  border-left: 4px solid var(--primary-color);
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
}

.info-box p {
  margin: 6px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--border-color);
}

.modal-footer button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--hover-color);
  color: var(--text-primary);
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover,
.btn-secondary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
```

---

## 💻 FASE 3: JAVASCRIPT - LÓGICA

### A. Event Listeners (popup.js)

```javascript
// Global variables
let currentInscriptionToList = null;

// Setup event listeners
function setupMarketListeners() {
  console.log('🎯 Setting up market listing listeners...');
  
  // Listener para botões "List on Market"
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-list-market')) {
      const btn = e.target.closest('.btn-list-market');
      const inscriptionId = btn.dataset.inscriptionId;
      const inscriptionNumber = btn.dataset.inscriptionNumber;
      const contentUrl = btn.dataset.contentUrl;
      
      console.log('📋 List on Market clicked:', inscriptionId);
      showListMarketModal(inscriptionId, inscriptionNumber, contentUrl);
    }
  });
  
  // Modal: Close
  document.getElementById('list-cancel-btn')?.addEventListener('click', hideListMarketModal);
  document.querySelector('.modal-close')?.addEventListener('click', hideListMarketModal);
  
  // Modal: Create Listing
  document.getElementById('list-create-btn')?.addEventListener('click', createMarketListing);
  
  // Update summary on price change
  document.getElementById('list-price')?.addEventListener('input', updateListingSummary);
  document.getElementById('list-fee-rate')?.addEventListener('input', updateListingSummary);
}

// Call setup in initialization
setupMarketListeners();
```

### B. Show Modal Function

```javascript
function showListMarketModal(inscriptionId, inscriptionNumber, contentUrl) {
  console.log('📋 Opening List on Market modal...');
  
  // Store current inscription
  currentInscriptionToList = {
    id: inscriptionId,
    number: inscriptionNumber,
    contentUrl: contentUrl
  };
  
  // Update modal content
  document.getElementById('list-inscription-preview').src = 
    `http://localhost:3000/api/inscription/${inscriptionId}/content`;
  
  document.getElementById('list-inscription-number').textContent = 
    `Inscription #${inscriptionNumber}`;
  
  document.getElementById('list-inscription-id').textContent = 
    `ID: ${inscriptionId.substring(0, 20)}...`;
  
  // Reset form
  document.getElementById('list-price').value = '';
  document.getElementById('list-fee-rate').value = '10';
  document.getElementById('list-description').value = '';
  
  // Update summary
  updateListingSummary();
  
  // Show modal
  document.getElementById('list-market-modal').classList.remove('hidden');
}

function hideListMarketModal() {
  document.getElementById('list-market-modal').classList.add('hidden');
  currentInscriptionToList = null;
}
```

### C. Update Summary Function

```javascript
function updateListingSummary() {
  const price = parseInt(document.getElementById('list-price').value) || 0;
  const feeRate = parseInt(document.getElementById('list-fee-rate').value) || 10;
  
  // Estimate fee (typical PSBT size ~200 vB)
  const estimatedFee = feeRate * 200;
  
  // You receive = price (buyer pays the fee)
  const youReceive = price;
  
  // Update UI
  document.getElementById('summary-price').textContent = 
    price.toLocaleString() + ' sats';
  
  document.getElementById('summary-fee').textContent = 
    '~' + estimatedFee.toLocaleString() + ' sats';
  
  document.getElementById('summary-total').textContent = 
    youReceive.toLocaleString() + ' sats';
}
```

### D. Create Listing Function (MAIN LOGIC)

```javascript
async function createMarketListing() {
  console.log('🚀 Creating market listing...');
  
  if (!currentInscriptionToList) {
    showNotification('❌ No inscription selected', 'error');
    return;
  }
  
  const price = parseInt(document.getElementById('list-price').value);
  const feeRate = parseInt(document.getElementById('list-fee-rate').value);
  const description = document.getElementById('list-description').value;
  
  // Validation
  if (!price || price < 1000) {
    showNotification('❌ Price must be at least 1,000 sats', 'error');
    return;
  }
  
  if (!feeRate || feeRate < 1) {
    showNotification('❌ Invalid fee rate', 'error');
    return;
  }
  
  try {
    // Show loading
    showLoadingOverlay('Creating listing...');
    
    // STEP 1: Get inscription details from background
    console.log('📊 Getting inscription details...');
    const inscriptionData = await chrome.runtime.sendMessage({
      action: 'getInscriptionDetails',
      inscriptionId: currentInscriptionToList.id
    });
    
    if (!inscriptionData.success) {
      throw new Error(inscriptionData.error || 'Failed to get inscription details');
    }
    
    const inscription = inscriptionData.inscription;
    console.log('✅ Inscription data:', inscription);
    
    // STEP 2: Create PSBT on backend
    console.log('🔨 Creating PSBT...');
    const psbtResponse = await fetch('http://localhost:3000/api/sell/create-custom-psbt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inscriptionId: currentInscriptionToList.id,
        inscriptionUtxo: {
          txid: inscription.utxo.txid,
          vout: inscription.utxo.vout,
          value: inscription.utxo.value,
          scriptPubKey: inscription.utxo.scriptPubKey
        },
        price: price,
        sellerAddress: inscription.address,
        feeRate: feeRate,
        walletType: 'kraywallet'
      })
    });
    
    const psbtData = await psbtResponse.json();
    
    if (!psbtData.success) {
      throw new Error(psbtData.error || 'Failed to create PSBT');
    }
    
    console.log('✅ PSBT created');
    
    // STEP 3: Sign PSBT with background script
    console.log('🔏 Signing PSBT with wallet...');
    const signResult = await chrome.runtime.sendMessage({
      action: 'signPsbt',
      psbt: psbtData.psbt,
      sighashType: 'NONE|ANYONECANPAY'  // ✅ CRITICAL!
    });
    
    if (!signResult.success) {
      throw new Error(signResult.error || 'Failed to sign PSBT');
    }
    
    console.log('✅ PSBT signed');
    
    // STEP 4: Save offer to database
    console.log('💾 Saving offer to database...');
    const offerResponse = await fetch('http://localhost:3000/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'inscription',
        inscriptionId: currentInscriptionToList.id,
        offerAmount: price,
        feeRate: feeRate,
        psbt: signResult.signedPsbt,
        creatorAddress: inscription.address,
        sighashType: 'NONE|ANYONECANPAY',
        description: description || null
      })
    });
    
    const offerData = await offerResponse.json();
    
    if (!offerData.success) {
      throw new Error(offerData.error || 'Failed to save offer');
    }
    
    console.log('✅ Offer created:', offerData.offer.id);
    
    // Success!
    hideLoadingOverlay();
    hideListMarketModal();
    
    showNotification('✅ Listing created successfully!', 'success');
    showNotification('🌐 View on Kray Station marketplace', 'info');
    
    // Optional: Open marketplace in new tab
    const marketUrl = `http://localhost:3000/ordinals.html`;
    chrome.tabs.create({ url: marketUrl });
    
  } catch (error) {
    console.error('❌ Error creating listing:', error);
    hideLoadingOverlay();
    showNotification('❌ Failed to create listing: ' + error.message, 'error');
  }
}
```

---

## 🔧 FASE 4: BACKGROUND SCRIPT

### A. New message handlers (background-real.js)

```javascript
// Handler: Get inscription details
case 'getInscriptionDetails':
  try {
    const { inscriptionId } = message;
    
    // Fetch from ORD server
    const utxoResponse = await fetch(
      `http://localhost:3000/api/ord/inscription/${inscriptionId}/utxo`
    );
    
    if (!utxoResponse.ok) {
      throw new Error('Failed to fetch inscription UTXO');
    }
    
    const utxoData = await utxoResponse.json();
    
    if (!utxoData.success) {
      throw new Error(utxoData.error || 'Invalid UTXO response');
    }
    
    // Get current address
    const address = walletState.address;
    
    sendResponse({
      success: true,
      inscription: {
        id: inscriptionId,
        address: address,
        utxo: {
          txid: utxoData.utxo.txid,
          vout: utxoData.utxo.vout,
          value: utxoData.utxo.value,
          scriptPubKey: utxoData.utxo.scriptPubKey
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting inscription details:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
  return true;

// Handler: Sign PSBT with custom SIGHASH
case 'signPsbt':
  try {
    const { psbt, sighashType } = message;
    
    if (!walletState.unlocked) {
      throw new Error('Wallet is locked');
    }
    
    // Decrypt wallet
    const result = await chrome.storage.local.get(['walletEncrypted']);
    if (!result.walletEncrypted) {
      throw new Error('No wallet found');
    }
    
    // Decrypt with cached password (if auto-lock)
    // Or prompt user for password
    const password = await promptForPassword();
    const decrypted = await decryptData(result.walletEncrypted, password);
    const mnemonic = decrypted.mnemonic;
    
    // Sign PSBT with custom SIGHASH
    const signedPsbt = await signPsbtWithSighash(
      psbt,
      mnemonic,
      sighashType || 'ALL'
    );
    
    sendResponse({
      success: true,
      signedPsbt: signedPsbt
    });
    
  } catch (error) {
    console.error('❌ Error signing PSBT:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
  return true;
```

### B. Sign PSBT with SIGHASH helper function

```javascript
async function signPsbtWithSighash(psbtBase64, mnemonic, sighashType) {
  const bitcoinLib = await import('bitcoinjs-lib');
  const bip39 = await import('bip39');
  const bip32 = await import('bip32');
  const ecc = await import('tiny-secp256k1');
  
  bitcoinLib.initEccLib(ecc);
  
  // Derive key from mnemonic
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.BIP32Factory(ecc).fromSeed(seed);
  
  // Taproot derivation path: m/86'/0'/0'/0/0
  const path = "m/86'/0'/0'/0/0";
  const child = root.derivePath(path);
  
  // Get internal key (x-only pubkey)
  const internalPubkey = child.publicKey.slice(1, 33); // Remove 0x02/0x03 prefix
  
  // Decode PSBT
  const psbt = bitcoinLib.Psbt.fromBase64(psbtBase64);
  
  // Map SIGHASH string to number
  let sighash = bitcoinLib.Transaction.SIGHASH_ALL;
  
  if (sighashType === 'NONE|ANYONECANPAY') {
    sighash = bitcoinLib.Transaction.SIGHASH_NONE | 
              bitcoinLib.Transaction.SIGHASH_ANYONECANPAY;
  } else if (sighashType === 'SINGLE|ANYONECANPAY') {
    sighash = bitcoinLib.Transaction.SIGHASH_SINGLE | 
              bitcoinLib.Transaction.SIGHASH_ANYONECANPAY;
  }
  
  // Sign input 0 with custom SIGHASH
  psbt.signInput(0, {
    publicKey: internalPubkey,
    sign: (hash) => {
      return child.sign(hash);
    }
  }, [sighash]);
  
  // Return signed PSBT (NOT finalized)
  return psbt.toBase64();
}
```

---

## 📊 FASE 5: MY OFFERS TAB

### A. HTML (popup.html)

```html
<!-- Tab: My Offers -->
<div id="my-offers-screen" class="screen hidden">
  <div class="screen-header">
    <button class="back-btn">←</button>
    <h2>📋 My Market Listings</h2>
  </div>
  
  <div class="my-offers-container">
    <!-- Will be populated dynamically -->
  </div>
  
  <div class="empty-state hidden" id="no-offers-state">
    <p>📭 No active listings</p>
    <p class="text-secondary">List inscriptions to start selling</p>
  </div>
</div>
```

### B. Load My Offers Function

```javascript
async function loadMyOffers() {
  console.log('📋 Loading my offers...');
  
  try {
    const address = walletState.address;
    
    // Fetch offers from backend
    const response = await fetch(
      `http://localhost:3000/api/offers?address=${address}&status=active`
    );
    
    const data = await response.json();
    
    if (!data.offers || data.offers.length === 0) {
      // Show empty state
      document.getElementById('no-offers-state').classList.remove('hidden');
      return;
    }
    
    // Hide empty state
    document.getElementById('no-offers-state').classList.add('hidden');
    
    // Render offers
    const container = document.querySelector('.my-offers-container');
    container.innerHTML = '';
    
    for (const offer of data.offers) {
      const offerCard = createOfferCard(offer);
      container.appendChild(offerCard);
    }
    
  } catch (error) {
    console.error('❌ Error loading offers:', error);
    showNotification('Failed to load offers', 'error');
  }
}

function createOfferCard(offer) {
  const card = document.createElement('div');
  card.className = 'offer-card';
  
  card.innerHTML = `
    <img 
      class="offer-preview" 
      src="http://localhost:3000/api/inscription/${offer.inscription_id}/content"
    />
    
    <div class="offer-details">
      <p class="offer-id">Inscription #${offer.inscription_id.substring(0, 10)}...</p>
      <p class="offer-price">💰 ${offer.offer_amount.toLocaleString()} sats</p>
      <p class="offer-status">Status: ${offer.status}</p>
      <p class="offer-date">Listed: ${new Date(offer.created_at).toLocaleDateString()}</p>
    </div>
    
    <div class="offer-actions">
      <button class="btn-cancel-offer" data-offer-id="${offer.id}">
        ❌ Cancel
      </button>
      <button class="btn-view-offer">
        👁️ View
      </button>
    </div>
  `;
  
  return card;
}

// Event listener for cancel offer
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-cancel-offer')) {
    const offerId = e.target.dataset.offerId;
    await cancelOffer(offerId);
  }
});

async function cancelOffer(offerId) {
  if (!confirm('Are you sure you want to cancel this listing?')) {
    return;
  }
  
  try {
    const response = await fetch(
      `http://localhost:3000/api/offers/${offerId}/cancel`,
      { method: 'PUT' }
    );
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('✅ Listing cancelled', 'success');
      loadMyOffers(); // Reload
    } else {
      throw new Error(data.error);
    }
    
  } catch (error) {
    console.error('❌ Error cancelling offer:', error);
    showNotification('Failed to cancel listing', 'error');
  }
}
```

---

## 🎨 FASE 6: PROFILE INTEGRATION (FUTURO)

### Quando implementarmos profiles públicos:

```javascript
// Cada offer terá link para profile do seller
<a href="http://localhost:3000/profile/${offer.creator_address}">
  View Seller Profile
</a>

// Profile mostrará todas as offers do seller
GET /api/profile/${address}/market
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: UI ✅
- [ ] Adicionar botão "List on Market" em inscription cards
- [ ] CSS para botões
- [ ] Testar clique

### Fase 2: Modal ✅
- [ ] HTML do modal
- [ ] CSS do modal
- [ ] Show/hide functions
- [ ] Update summary on input change

### Fase 3: Lógica ✅
- [ ] Event listeners
- [ ] Get inscription details from background
- [ ] Create PSBT on backend
- [ ] Sign PSBT with wallet
- [ ] Save offer to database
- [ ] Success/error handling

### Fase 4: Background ✅
- [ ] Message handler: getInscriptionDetails
- [ ] Message handler: signPsbt
- [ ] Helper: signPsbtWithSighash
- [ ] SIGHASH_NONE|ANYONECANPAY support

### Fase 5: My Offers ✅
- [ ] Load my offers function
- [ ] Render offers cards
- [ ] Cancel offer function
- [ ] Refresh after actions

---

## 🚀 RESULTADO FINAL

```
ANTES:
Extension → Ver inscriptions
           ❌ Não pode listar

Kray Station → Criar offers manual
               ❌ Complicado

DEPOIS:
Extension → Ver inscriptions
           ✅ Botão "List on Market"
           ✅ Modal rápido
           ✅ 1 clique = listado!

Kray Station → Ver todas offers
               ✅ Marketplace completo
               ✅ Buy com 1 clique
```

---

**🎯 TEMPO ESTIMADO:** 4-6 horas

**📦 ARQUIVOS A MODIFICAR:**
1. `kraywallet-extension/popup/popup.html` (UI)
2. `kraywallet-extension/popup/styles.css` (Styles)
3. `kraywallet-extension/popup/popup.js` (Logic)
4. `kraywallet-extension/background/background-real.js` (Handlers)

**🔌 BACKEND:** Já está 100% pronto! ✅

---

**Criado por:** AI Assistant  
**Data:** 24/10/2024  
**Sistema:** KRAY WALLET - Integration Plan

