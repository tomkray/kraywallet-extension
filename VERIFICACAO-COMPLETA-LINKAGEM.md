# 🔍 VERIFICAÇÃO COMPLETA DE LINKAGEM

## ✅ CHECKLIST DE COMPONENTES:

### 1️⃣ **BACKEND APIs**

**Servidor:** `server/index.js`

- [ ] `/api/lightning/pay` integrado?
- [ ] `/api/lightning/decode` integrado?
- [ ] `/api/lightning-defi/*` integrado?
- [ ] LND client funcionando?
- [ ] State Tracker inicializado?

### 2️⃣ **EXTENSION - BACKGROUND**

**Arquivo:** `kraywallet-extension/background/background-real.js`

- [ ] `case 'sendPayment'` existe?
- [ ] `case 'getPendingPayment'` existe?
- [ ] `async function sendPayment()` implementada?
- [ ] `pendingPaymentRequest` declarado?

### 3️⃣ **EXTENSION - INJECTED**

**Arquivo:** `kraywallet-extension/content/injected.js`

- [ ] `window.krayWallet.sendPayment()` existe?
- [ ] Envia mensagem para background?
- [ ] Retorna response corretamente?

### 4️⃣ **EXTENSION - POPUP HTML**

**Arquivo:** `kraywallet-extension/popup/popup.html`

- [ ] `#confirm-lightning-payment-screen` existe?
- [ ] `#lightning-amount` existe?
- [ ] `#lightning-description` existe?
- [ ] `#lightning-destination` existe?
- [ ] `#lightning-payment-hash` existe?
- [ ] `#lightning-expiry` existe?
- [ ] `#lightning-payment-password` existe?
- [ ] `#lightning-payment-status` existe?
- [ ] `#lightning-payment-confirm-btn` existe?
- [ ] `#lightning-payment-cancel-btn` existe?

### 5️⃣ **EXTENSION - POPUP JS**

**Arquivo:** `kraywallet-extension/popup/popup.js`

- [ ] `showLightningPaymentConfirmation()` existe?
- [ ] `handleLightningPaymentConfirm()` existe?
- [ ] `handleLightningPaymentCancel()` existe?
- [ ] Event listeners configurados?
- [ ] Verificação de pending payment no DOMContentLoaded?

### 6️⃣ **FRONTEND - DEFI**

**Arquivos:** `backups/defi-working-version/defi-swap.html` e `pool-create.html`

- [ ] `window.krayWallet.sendPayment()` sendo usado?
- [ ] `window.krayWallet.signPsbt()` sendo usado?
- [ ] `executeLightningSwap()` implementado?
- [ ] `createLightningPool()` implementado?

### 7️⃣ **FRONTEND - RUNES SWAP**

**Arquivo:** `runes-swap.html`

- [ ] Iframes carregando corretamente?
- [ ] Tabs funcionando?
- [ ] Wallet connection propagando?

---

## 🔧 VAMOS VERIFICAR AGORA:

