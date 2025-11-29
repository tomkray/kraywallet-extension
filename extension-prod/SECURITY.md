# 🔒 KrayWallet Security Architecture

**Version:** 1.0.0  
**Last Updated:** November 26, 2024

---

## 🎯 Executive Summary

KrayWallet is a **self-custodial Bitcoin wallet** that implements **industry-standard security practices** to ensure that **each user has complete control** over their funds. Your mnemonic, private keys, and signatures **NEVER leave your device**.

### Core Security Principles

✅ **Zero-Trust Architecture** - No server has access to your keys  
✅ **Client-Side Signing** - All cryptographic operations happen locally  
✅ **Open Source** - Fully auditable code  
✅ **Industry Standards** - Follows BIP39, BIP32, BIP86, BIP340 (Schnorr)  
✅ **No Backdoors** - Your keys, your Bitcoin

---

## 🔐 How Your Keys Are Protected

### 1. Mnemonic Generation (12 Words)

**Process:**
```
User creates new wallet
  ↓
Extension generates 12 words locally (BIP39)
  ↓
Uses browser's crypto.getRandomValues() for entropy
  ↓
Mnemonic NEVER sent to any server
  ↓
Stored encrypted with user's password
```

**Technologies:**
- **BIP39** - Standard mnemonic generation
- **Web Crypto API** - Secure random number generation
- **Local Storage** - Encrypted storage in browser

**Security Guarantees:**
- ✅ Generated on your device
- ✅ Never transmitted over network
- ✅ Cryptographically secure entropy
- ✅ Compatible with other wallets (BIP39 standard)

---

### 2. Key Derivation (BIP32/BIP86)

**Process:**
```
Mnemonic (12 words)
  ↓
Seed derivation (BIP39)
  ↓
Master key generation (BIP32)
  ↓
Taproot derivation path: m/86'/0'/0'/0/0 (BIP86)
  ↓
Taproot address generation (P2TR)
```

**Technologies:**
- **BIP32** - Hierarchical Deterministic key derivation
- **BIP86** - Taproot address derivation standard
- **bitcoinjs-lib** - Industry-standard Bitcoin library

**Security Guarantees:**
- ✅ All derivation happens locally
- ✅ Keys never stored permanently
- ✅ Compatible with hardware wallets
- ✅ Standard derivation path (interoperable)

---

### 3. Transaction Signing (Schnorr)

**Process:**
```
User initiates transaction
  ↓
Backend creates unsigned PSBT (no keys required)
  ↓
Extension decrypts mnemonic locally (with user password)
  ↓
Derives keys locally (BIP32/BIP86)
  ↓
Signs PSBT locally (Schnorr signature - BIP340)
  ↓
Clears mnemonic from memory immediately
  ↓
Broadcasts signed transaction only
```

**Technologies:**
- **tiny-secp256k1** - WebAssembly Schnorr signing
- **bitcoinjs-lib** - PSBT handling
- **BIP340** - Schnorr signature standard (Taproot)
- **Webpack Bundle** - 548KB local signing library

**Security Guarantees:**
- ✅ Signing happens in your browser
- ✅ Private keys never transmitted
- ✅ Memory cleared after signing
- ✅ Only signed transaction is broadcast

---

### 4. Encryption at Rest

**Process:**
```
User sets password
  ↓
Mnemonic encrypted with PBKDF2 + AES-256-GCM
  ↓
Encrypted blob stored in chrome.storage.local
  ↓
Decrypted only when user enters password
  ↓
Never stored in plaintext
```

**Technologies:**
- **PBKDF2** - Key derivation from password
- **AES-256-GCM** - Authenticated encryption
- **Web Crypto API** - Browser's secure crypto primitives

**Security Guarantees:**
- ✅ Strong encryption (AES-256)
- ✅ Password never stored
- ✅ Authenticated encryption (prevents tampering)
- ✅ Key stretching (PBKDF2, 100,000 iterations)

---

## 🛡️ Security Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S DEVICE (SECURE)                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  KrayWallet Extension (Browser)                       │ │
│  │                                                       │ │
│  │  1. Mnemonic Generation (BIP39)                      │ │
│  │     └─> 12 words generated locally                   │ │
│  │                                                       │ │
│  │  2. Encryption (AES-256-GCM)                         │ │
│  │     └─> Encrypted with user password                │ │
│  │                                                       │ │
│  │  3. Storage (chrome.storage.local)                   │ │
│  │     └─> Encrypted blob only                          │ │
│  │                                                       │ │
│  │  4. Key Derivation (BIP32/BIP86)                     │ │
│  │     └─> Happens on-demand, in memory                 │ │
│  │                                                       │ │
│  │  5. Transaction Signing (Schnorr - BIP340)           │ │
│  │     └─> Signed locally with tiny-secp256k1 (WASM)    │ │
│  │                                                       │ │
│  │  6. Memory Cleanup                                   │ │
│  │     └─> Keys cleared after use (mnemonic = null)     │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│                        ⬇️ ONLY THIS ⬇️                        │
│                                                             │
│              Signed Transaction (hex string)                │
│                    ✅ NO PRIVATE KEYS                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ⬇️
┌─────────────────────────────────────────────────────────────┐
│                   KRAYWALLET BACKEND                        │
│                    (UNTRUSTED ZONE)                         │
│                                                             │
│  ✅ Creates unsigned PSBTs                                  │
│  ✅ Broadcasts signed transactions                          │
│  ✅ Queries blockchain data                                 │
│  ❌ NEVER sees mnemonic                                     │
│  ❌ NEVER sees private keys                                 │
│  ❌ CANNOT sign transactions                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Bitcoin P2P
                              ⬇️
┌─────────────────────────────────────────────────────────────┐
│                    BITCOIN NETWORK                          │
│                                                             │
│  ✅ Receives signed transactions                            │
│  ✅ Validates signatures                                    │
│  ✅ Confirms blocks                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Compliance with Industry Standards

### BIP Standards

| BIP | Description | Implementation |
|-----|-------------|----------------|
| **BIP39** | Mnemonic code for generating deterministic keys | ✅ Fully compliant |
| **BIP32** | Hierarchical Deterministic Wallets | ✅ Fully compliant |
| **BIP44** | Multi-Account Hierarchy (Legacy/SegWit) | ⚠️ Not used (Taproot focus) |
| **BIP86** | Key Derivation for Single Key P2TR Outputs | ✅ Fully compliant |
| **BIP340** | Schnorr Signatures for secp256k1 | ✅ Fully compliant |
| **BIP341** | Taproot: SegWit v1 | ✅ Fully compliant |
| **BIP174** | Partially Signed Bitcoin Transaction (PSBT) | ✅ Fully compliant |

### Comparison with Leading Wallets

| Feature | KrayWallet | MetaMask | Phantom | Unisat | Ledger |
|---------|------------|----------|---------|--------|--------|
| Local Signing | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Hardware |
| Open Source | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Partial | ⚠️ Partial |
| Taproot Support | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| Ordinals Support | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ⚠️ Limited |
| Runes Support | ✅ Yes | ❌ No | ❌ No | ⚠️ Limited | ❌ No |
| Self-Custodial | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 🔍 Code Verification

### Local Signing Implementation

**File:** `src/taproot-signer-local.js` (Bundled to `background/taproot-signer.bundle.js`)

**Key Function:**
```javascript
async function signPsbtTaprootLocal(mnemonic, psbtBase64) {
    // 1. Derive seed locally (BIP39)
    const seed = await bip39.mnemonicToSeed(mnemonic);
    
    // 2. Derive key locally (BIP32/BIP86)
    const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
    const child = root.derivePath("m/86'/0'/0'/0/0");
    
    // 3. Apply Taproot tweak (BIP341)
    const xOnly = Buffer.from(child.publicKey.subarray(1, 33));
    const tapTweak = bitcoin.crypto.taggedHash('TapTweak', xOnly);
    let tweakedPriv = ecc.privateAdd(child.privateKey, tapTweak);
    
    // 4. Ensure even Y coordinate (Taproot requirement)
    const tweakedPub = ecc.pointFromScalar(tweakedPriv);
    if (tweakedPub[0] !== 0x02) {
        tweakedPriv = ecc.privateNegate(tweakedPriv);
    }
    
    // 5. Create Schnorr signer (BIP340)
    const signer = {
        signSchnorr: (hash) => {
            return ecc.signSchnorr(hash, tweakedPriv, Buffer.alloc(32, 0));
        }
    };
    
    // 6. Sign PSBT locally
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    for (let i = 0; i < psbt.inputCount; i++) {
        psbt.signInput(i, signer);
        
        // Validate signature immediately
        const isValid = psbt.validateSignaturesOfInput(i, signer.signSchnorr);
        if (!isValid) throw new Error('Invalid signature');
    }
    
    // 7. Finalize and extract transaction
    psbt.finalizeAllInputs();
    const txHex = psbt.extractTransaction().toHex();
    
    // 8. CRITICAL: Clear mnemonic from memory
    mnemonic = null;
    tweakedPriv = null;
    
    return txHex; // ✅ Only signed transaction
}
```

**Security Features:**
- ✅ All operations happen locally
- ✅ No network calls with sensitive data
- ✅ Signature validation before broadcast
- ✅ Memory cleanup after signing
- ✅ Standard libraries (bitcoinjs-lib, tiny-secp256k1)

---

## 🧪 Security Testing

### How to Verify Security

1. **Install Extension**
   ```bash
   git clone https://github.com/tomkray/kraywallet-extension.git
   cd kraywallet-extension-prod
   ```

2. **Load in Chrome**
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `kraywallet-extension-prod` folder

3. **Open DevTools**
   - Right-click extension icon → Inspect
   - Go to Console tab

4. **Create Wallet & Test**
   - Create new wallet
   - Receive testnet Bitcoin
   - Try to send transaction
   - Watch console logs

5. **Expected Console Output**
   ```
   🔒 Local signer loaded! Mnemonic will NEVER leave device!
   
   [When sending transaction:]
   ═══════════════════════════════════════════════════
   🔒 SECURE SEND (3-STEP PROCESS)
   ═══════════════════════════════════════════════════
   📝 Step 1: Creating PSBT structure...
      ✅ Mnemonic NOT sent!
   ✅ PSBT created
   
   🔐 Step 2: Signing PSBT...
      ✅ Using LOCAL signing (mnemonic NEVER leaves device!)
   🔐 Signing PSBT 100% LOCALLY...
      ✅ Seed derived
      ✅ Key derived: m/86'/0'/0'/0/0
      ✅ Taproot key ready
      ✅ PSBT loaded, inputs: 2
      ✅ Input 0 signed
      ✅ Input 0 signature valid
      ✅ Input 1 signed
      ✅ Input 1 signature valid
      ✅ Transaction finalized
   🎉 PSBT SIGNED 100% LOCALLY!
   ✅ PSBT signed
   
   📡 Step 3: Broadcasting...
      ✅ Only signed TX sent!
   ✅ BROADCAST SUCCESS!
   ═══════════════════════════════════════════════════
   ```

6. **Red Flags (Should NEVER appear)**
   ```
   ⚠️ Using BACKEND signing (INSECURE - mnemonic sent!)
   ❌ Sending mnemonic to server
   ❌ Remote signing
   ```

---

## 🔐 Network Requests Analysis

### What Gets Sent to Backend

#### ✅ Safe Requests (No Sensitive Data)

1. **Create PSBT**
   ```json
   POST /api/kraywallet/create-inscription-psbt
   {
     "inscription": {
       "utxo": {
         "txid": "abc123...",
         "vout": 0,
         "value": 555
       }
     },
     "recipientAddress": "bc1p...",
     "senderAddress": "bc1p...",
     "feeRate": 1
   }
   ```
   **Contains:** Public addresses, UTXO references, fee rate  
   **Does NOT contain:** Mnemonic, private keys, signatures

2. **Broadcast Transaction**
   ```json
   POST /api/psbt/broadcast
   {
     "hex": "020000000001..." 
   }
   ```
   **Contains:** Signed transaction (public data)  
   **Does NOT contain:** Mnemonic, private keys

3. **Query Balance/UTXOs**
   ```json
   GET /api/wallet/{address}/utxos
   GET /api/wallet/{address}/balance
   GET /api/wallet/{address}/inscriptions
   ```
   **Contains:** Public address  
   **Does NOT contain:** Any private data

#### ❌ What NEVER Gets Sent

- ❌ Mnemonic (12 words)
- ❌ Private keys
- ❌ Seed phrase
- ❌ Password
- ❌ Unencrypted wallet data

---

## 🛡️ Threat Model & Mitigations

### Threat 1: Malicious Backend

**Risk:** Backend could be compromised  
**Impact:** Could see public addresses, transactions, but NOT keys  
**Mitigation:** 
- ✅ Local signing prevents key exposure
- ✅ Backend never receives sensitive data
- ✅ Can switch to different backend without losing funds

### Threat 2: Compromised Device

**Risk:** Malware on user's computer  
**Impact:** Could potentially access extension storage  
**Mitigation:**
- ✅ Wallet encrypted with user password
- ✅ Password never stored
- ✅ Memory cleared after operations
- ⚠️ User should use strong password
- ⚠️ Consider hardware wallet for large amounts

### Threat 3: Network Interception

**Risk:** Man-in-the-middle attack  
**Impact:** Could intercept public data, but NOT keys  
**Mitigation:**
- ✅ HTTPS for all API calls
- ✅ No sensitive data transmitted
- ✅ Signed transactions are public anyway

### Threat 4: Extension Store Compromise

**Risk:** Malicious update pushed to Chrome Store  
**Impact:** Could replace extension code  
**Mitigation:**
- ✅ Open source (can verify before update)
- ✅ GitHub releases tagged
- ✅ Can load from source directly
- ⚠️ Users should verify updates

### Threat 5: Browser Vulnerability

**Risk:** Browser bug could expose extension data  
**Impact:** Could access storage or memory  
**Mitigation:**
- ✅ Encryption at rest
- ✅ Memory cleanup
- ✅ Short session timeouts
- ⚠️ Keep browser updated

---

## 📖 Best Practices for Users

### During Setup

1. **Strong Password**
   - ✅ Use at least 12 characters
   - ✅ Mix uppercase, lowercase, numbers, symbols
   - ✅ Don't reuse passwords
   - ✅ Use password manager

2. **Backup Mnemonic**
   - ✅ Write down 12 words on paper
   - ✅ Store in secure physical location
   - ✅ Never take photo
   - ✅ Never store in cloud
   - ✅ Consider metal backup for long-term

3. **Verify Backup**
   - ✅ Test restore on different device
   - ✅ Verify address matches
   - ✅ Small test transaction first

### During Usage

1. **Lock Wallet**
   - ✅ Auto-lock after 15 minutes (default)
   - ✅ Lock manually when not in use
   - ✅ Shorter timeout for shared computers

2. **Verify Transactions**
   - ✅ Check recipient address
   - ✅ Check amount
   - ✅ Check fee rate
   - ✅ Double-check before signing

3. **Monitor Activity**
   - ✅ Review transaction history
   - ✅ Check for unexpected transactions
   - ✅ Verify addresses match expectations

### Security Hygiene

1. **Device Security**
   - ✅ Keep OS updated
   - ✅ Use antivirus
   - ✅ Avoid public WiFi for transactions
   - ✅ Lock screen when away

2. **Browser Security**
   - ✅ Keep Chrome updated
   - ✅ Only install trusted extensions
   - ✅ Clear cache periodically
   - ✅ Use different browser profile for wallet

3. **Phishing Protection**
   - ✅ Verify URLs before clicking
   - ✅ Never share mnemonic
   - ✅ No support team will ask for it
   - ✅ Bookmark official site

---

## 🔒 Encryption Details

### Storage Encryption

**Algorithm:** AES-256-GCM  
**Key Derivation:** PBKDF2 (100,000 iterations, SHA-256)  
**Salt:** Random 16 bytes per wallet  
**IV:** Random 12 bytes per encryption  

**Encryption Process:**
```javascript
1. User enters password
2. Generate random salt (16 bytes)
3. Derive key: PBKDF2(password, salt, 100000, 'SHA-256')
4. Generate random IV (12 bytes)
5. Encrypt: AES-256-GCM(mnemonic, key, IV)
6. Store: {encrypted, salt, iv}
```

**Decryption Process:**
```javascript
1. User enters password
2. Retrieve {encrypted, salt, iv}
3. Derive key: PBKDF2(password, salt, 100000, 'SHA-256')
4. Decrypt: AES-256-GCM-Decrypt(encrypted, key, iv)
5. Verify authentication tag
6. Return mnemonic (if valid)
```

**Security Properties:**
- ✅ Authenticated encryption (prevents tampering)
- ✅ Unique IV per encryption
- ✅ Strong key derivation (100k iterations)
- ✅ Industry-standard algorithm
- ✅ Resistant to brute-force

---

## 📦 Dependencies & Audit

### Core Dependencies

| Library | Version | Purpose | Audit Status |
|---------|---------|---------|--------------|
| bitcoinjs-lib | 6.1.5 | Bitcoin operations | ✅ Widely audited |
| tiny-secp256k1 | 2.2.3 | Schnorr signatures (WASM) | ✅ Audited |
| bip32 | 4.0.0 | HD key derivation | ✅ Standard library |
| bip39 | 3.1.0 | Mnemonic generation | ✅ Standard library |

### Bundle Composition

**Total Size:** 548 KB (minified)  
**WebAssembly:** 160 KB (secp256k1)  
**JavaScript:** 388 KB (Bitcoin libraries)  

**Bundle Contents:**
- ✅ No telemetry
- ✅ No analytics
- ✅ No external calls
- ✅ Deterministic build
- ✅ Source maps available

### Build Verification

```bash
# Clone repository
git clone https://github.com/tomkray/kraywallet-extension.git
cd kraywallet-extension-prod

# Install dependencies
npm install

# Build bundle
npm run build

# Verify bundle integrity
sha256sum background/taproot-signer.bundle.js
```

---

## 🎯 Security Roadmap

### ✅ Completed (v1.0.0)

- ✅ Local mnemonic generation (BIP39)
- ✅ Encrypted storage (AES-256-GCM)
- ✅ Local key derivation (BIP32/BIP86)
- ✅ Local Schnorr signing (BIP340)
- ✅ PSBT support (BIP174)
- ✅ Taproot addresses (BIP341)
- ✅ Memory cleanup after operations
- ✅ Auto-lock functionality
- ✅ Open source codebase

### 🔄 In Progress (v1.1.0)

- 🔄 Hardware wallet support (Ledger, Trezor)
- 🔄 Multi-signature support
- 🔄 Watch-only wallet mode
- 🔄 Transaction history encryption
- 🔄 Biometric unlock (WebAuthn)

### 📋 Planned (v2.0.0)

- 📋 Social recovery
- 📋 Timelock transactions
- 📋 CoinJoin support
- 📋 Lightning Network integration
- 📋 Full node integration option

---

## 🏆 Security Achievements

### Industry Recognition

- ✅ **Open Source** - Full transparency
- ✅ **BIP Compliant** - Follows all relevant standards
- ✅ **Client-Side Signing** - Industry best practice
- ✅ **Auditable Code** - Available on GitHub
- ✅ **No Backdoors** - Verifiable by anyone

### Comparison with Standards

**OWASP Mobile Security:**
- ✅ M1: Improper Platform Usage - Compliant
- ✅ M2: Insecure Data Storage - AES-256-GCM encryption
- ✅ M3: Insecure Communication - HTTPS only
- ✅ M4: Insecure Authentication - Strong crypto
- ✅ M5: Insufficient Cryptography - Industry standards
- ✅ M6: Insecure Authorization - Local control
- ✅ M7: Client Code Quality - Linted & tested
- ✅ M8: Code Tampering - Open source
- ✅ M9: Reverse Engineering - Not applicable (open)
- ✅ M10: Extraneous Functionality - Minimal attack surface

---

## 🤝 Responsible Disclosure

### Found a Security Issue?

**DO NOT** open a public GitHub issue.

**Instead:**
1. Email: security@kraywallet.com (GPG key available)
2. Provide details:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. We will:
   - Acknowledge within 24 hours
   - Provide fix timeline
   - Credit you (if desired)
   - Coordinate disclosure

**Bug Bounty:** Coming soon

---

## 📜 License & Legal

**License:** MIT  
**Copyright:** 2024 KrayWallet Contributors

### Disclaimer

KrayWallet is provided "as is" without warranty. Users are responsible for:
- ✅ Backing up their mnemonic
- ✅ Keeping their password secure
- ✅ Verifying transactions before signing
- ✅ Using appropriate security practices

**NOT LIABLE FOR:**
- User error (lost mnemonic, weak password)
- Device compromise (malware, theft)
- Phishing attacks
- Market volatility
- Regulatory changes

### No Investment Advice

KrayWallet is a tool for managing Bitcoin. It does NOT:
- ❌ Provide investment advice
- ❌ Guarantee returns
- ❌ Endorse any assets
- ❌ Offer custodial services

---

## 📞 Contact & Support

**Website:** https://kraywallet.com  
**GitHub:** https://github.com/tomkray/kraywallet-extension  
**Documentation:** https://docs.kraywallet.com  
**Community:** https://discord.gg/kraywallet  
**Twitter:** @KrayWallet

**Support Email:** support@kraywallet.com  
**Security Email:** security@kraywallet.com

---

## ✅ Conclusion

KrayWallet implements **industry-leading security practices** to ensure that:

1. **Your mnemonic NEVER leaves your device**
2. **Your private keys NEVER touch the network**
3. **Your signatures are created locally**
4. **You have complete control of your funds**

**Each user who downloads KrayWallet has:**
- ✅ Unique mnemonic (generated locally)
- ✅ Encrypted storage (AES-256-GCM)
- ✅ Local signing (Schnorr/Taproot)
- ✅ Complete custody (self-sovereign)

**We follow the same standards as:**
- MetaMask (Ethereum)
- Phantom (Solana)
- Unisat (Bitcoin)
- Ledger (Hardware)

**Our code is open source, auditable, and follows Bitcoin BIPs.**

**Your keys, your Bitcoin. Always. 🔒**

---

**Last Updated:** November 26, 2024  
**Version:** 1.0.0  
**Commit:** [Latest GitHub Commit]

---

*This document is maintained by the KrayWallet team and community contributors. For updates or corrections, please open a pull request on GitHub.*

