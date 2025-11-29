# 🔐 KrayWallet - Bitcoin Self-Custodial Wallet

**Your Keys, Your Bitcoin. Always.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security: Local Signing](https://img.shields.io/badge/Security-Local%20Signing-green.svg)](./SECURITY.md)
[![Bitcoin: Taproot](https://img.shields.io/badge/Bitcoin-Taproot%20Native-orange.svg)](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)

A modern, secure, self-custodial Bitcoin wallet with native support for **Taproot**, **Ordinals**, and **Runes**. Built with security-first architecture where **your mnemonic never leaves your device**.

---

## ✨ Features

### 🔒 Security First
- **100% Local Signing** - Your mnemonic, keys, and signatures never leave your device
- **Client-Side Cryptography** - All operations happen in your browser
- **Encrypted Storage** - AES-256-GCM encryption for wallet data
- **Open Source** - Fully auditable code
- **BIP Compliant** - Follows BIP39, BIP32, BIP86, BIP340, BIP341

### ⚡ Native Taproot Support
- **P2TR Addresses** - bc1p... addresses (BIP341)
- **Schnorr Signatures** - BIP340 signatures for lower fees
- **BIP86 Derivation** - m/86'/0'/0'/0/0 standard path
- **PSBT Support** - BIP174 partially signed transactions

### 🎨 Ordinals & Inscriptions
- **View Inscriptions** - See your Ordinals with thumbnails
- **Send Inscriptions** - Transfer your inscriptions securely
- **Inscription Protection** - UTXO filtering prevents accidental spending
- **Content Preview** - View images, text, and other content

### 🪙 Runes Protocol
- **Runes Balance** - View all your Runes tokens
- **Runes Transfers** - Send Runes to other addresses
- **UTXO Protection** - Prevents accidental burning of Runes
- **Multiple Runes** - Support for all Runes in one wallet

### 💎 Modern UX
- **Clean Interface** - Intuitive and beautiful design
- **Fast** - Optimized for speed and responsiveness
- **Mobile Ready** - Works on desktop and mobile browsers
- **Dark/Light Theme** - Comfortable viewing in any environment

---

## 🚀 Quick Start

### Installation

#### Option 1: Chrome Web Store (Recommended)
*Coming soon*

#### Option 2: Load from Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tomkray/kraywallet-extension.git
   cd kraywallet-extension-prod
   ```

2. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `kraywallet-extension-prod` folder

3. **Create your wallet:**
   - Click the KrayWallet icon
   - Create new wallet
   - Write down your 12-word mnemonic
   - Set a strong password
   - You're ready!

---

## 🔐 Security Architecture

### Zero-Trust Design

```
┌─────────────────────────────────────┐
│     YOUR DEVICE (100% Secure)       │
│                                     │
│  ┌───────────────────────────────┐ │
│  │   KrayWallet Extension        │ │
│  │                               │ │
│  │  ✅ Generate Mnemonic         │ │
│  │  ✅ Derive Keys               │ │
│  │  ✅ Sign Transactions         │ │
│  │  ✅ Encrypt Storage           │ │
│  │                               │ │
│  │  ❌ NEVER sends private keys  │ │
│  └───────────────────────────────┘ │
│              ⬇️                      │
│     Signed Transaction ONLY         │
└─────────────────────────────────────┘
              ⬇️
┌─────────────────────────────────────┐
│     Backend (Untrusted)             │
│                                     │
│  ✅ Creates unsigned PSBTs          │
│  ✅ Broadcasts transactions         │
│  ✅ Queries blockchain              │
│  ❌ NEVER sees your keys           │
└─────────────────────────────────────┘
```

### How Your Keys Are Protected

1. **Mnemonic Generation** - Created locally using secure randomness (BIP39)
2. **Encryption at Rest** - AES-256-GCM with PBKDF2 (100,000 iterations)
3. **Local Key Derivation** - BIP32/BIP86 derivation happens in your browser
4. **Local Signing** - Schnorr signatures (BIP340) created locally with tiny-secp256k1 (WebAssembly)
5. **Memory Cleanup** - Keys cleared from memory immediately after use
6. **No Network Exposure** - Private keys NEVER transmitted

**See [SECURITY.md](./SECURITY.md) for complete security documentation.**

---

## 📖 Usage Guide

### Creating a Wallet

1. Click "Create New Wallet"
2. **IMPORTANT:** Write down your 12 words
3. Store them in a safe place (never digital!)
4. Verify your backup
5. Set a strong password

### Receiving Bitcoin

1. Click "Receive"
2. Copy your address (starts with bc1p...)
3. Share with sender
4. Wait for confirmation

### Sending Bitcoin

1. Click "Send"
2. Enter recipient address
3. Enter amount
4. Set fee rate
5. Review transaction
6. Enter password
7. Confirm

### Sending Inscriptions

1. Go to "Ordinals" tab
2. Click inscription to send
3. Click "Send" button
4. Enter recipient address
5. Set fee rate (1 sat/vB recommended)
6. Review transaction
7. Enter password
8. Confirm

**Your inscription will be sent safely!**

### Sending Runes

1. Go to "Runes" tab
2. Select Rune to send
3. Enter recipient address
4. Enter amount
5. Set fee rate
6. Review transaction
7. Enter password
8. Confirm

---

## 🛠️ Technical Details

### Architecture

**Frontend (Extension):**
- Manifest V3 Service Worker
- Vanilla JavaScript (no frameworks)
- Webpack bundled Bitcoin libraries
- Local cryptography (Web Crypto API)

**Backend (API):**
- Node.js + Express
- QuickNode for blockchain data
- Mempool.space for broadcasting
- Zero-knowledge of private keys

### Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| bitcoinjs-lib | 6.1.5 | Bitcoin operations |
| tiny-secp256k1 | 2.2.3 | Schnorr signatures (WASM) |
| bip32 | 4.0.0 | HD key derivation |
| bip39 | 3.1.0 | Mnemonic generation |

**Bundle Size:** 548 KB (includes WebAssembly)

### Network Requests

**What gets sent to backend:**
- ✅ Public addresses
- ✅ UTXO references  
- ✅ Unsigned PSBTs
- ✅ Signed transactions
- ✅ Fee rates

**What NEVER gets sent:**
- ❌ Mnemonic
- ❌ Private keys
- ❌ Password
- ❌ Seed phrase

---

## 🔒 Security Best Practices

### For Users

**During Setup:**
- ✅ Use a strong, unique password (12+ characters)
- ✅ Write down mnemonic on paper (never digital!)
- ✅ Store backup in secure physical location
- ✅ Test restore before depositing large amounts

**During Usage:**
- ✅ Lock wallet when not in use
- ✅ Verify addresses before sending
- ✅ Check transaction details carefully
- ✅ Use small test amounts first

**Device Security:**
- ✅ Keep OS and browser updated
- ✅ Use antivirus software
- ✅ Avoid public WiFi for transactions
- ✅ Lock screen when away from device

**Phishing Protection:**
- ✅ Never share your mnemonic
- ✅ No support team will ask for it
- ✅ Verify URLs before clicking
- ✅ Bookmark official site

### For Developers

**Code Review:**
- All pull requests require review
- Security-critical code requires 2+ reviews
- Automated testing for regressions

**Security Audits:**
- Regular dependency updates
- Static analysis (npm audit)
- Manual code review
- Community bug bounties (coming soon)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

1. **Clone repository:**
   ```bash
   git clone https://github.com/tomkray/kraywallet-extension.git
   cd kraywallet-extension-prod
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build bundle:**
   ```bash
   npm run build
   ```

4. **Load in browser:**
   - Go to `chrome://extensions`
   - Enable Developer mode
   - Load unpacked: `kraywallet-extension-prod`

5. **Make changes and test**

### Code Style

- ES6+ JavaScript
- Semicolons required
- 2-space indentation
- Descriptive variable names
- Comments for complex logic

### Testing

```bash
# Run linter
npm run lint

# Run tests
npm test

# Build production bundle
npm run build
```

---

## 🐛 Bug Reports

Found a bug? Please check if it's already reported:
- [GitHub Issues](https://github.com/tomkray/kraywallet-extension/issues)

**Non-security bugs:** Open a public issue  
**Security vulnerabilities:** Report via [GitHub Security Advisories](https://github.com/tomkray/kraywallet-extension/security/advisories/new)

---

## 📜 License

MIT License - see [LICENSE](./LICENSE) file for details.

### Third-Party Licenses

- bitcoinjs-lib: MIT
- tiny-secp256k1: MIT
- bip32: MIT
- bip39: MIT

All dependencies are open source with permissive licenses.

---

## 🙏 Acknowledgments

### Built With

- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib) - Bitcoin library
- [tiny-secp256k1](https://github.com/bitcoinjs/tiny-secp256k1) - Schnorr signatures
- [QuickNode](https://www.quicknode.com/) - Blockchain API
- [Mempool.space](https://mempool.space/) - Bitcoin explorer

### Inspired By

- [MetaMask](https://metamask.io/) - Self-custodial wallet pattern
- [Phantom](https://phantom.app/) - Beautiful UX design
- [Unisat](https://unisat.io/) - Ordinals wallet pioneer
- [Sparrow Wallet](https://sparrowwallet.com/) - PSBT implementation

### Community

Special thanks to:
- Bitcoin developers
- BIP authors
- Ordinals community
- Runes protocol team
- Open source contributors

---

## 📞 Contact & Support

**Website:** https://kray.space  
**Explorer:** https://kray.space/krayscan.html  
**Marketplace:** https://kray.space/ordinals.html  
**GitHub:** https://github.com/tomkray/kraywallet-extension  

**Support:** Open an issue on [GitHub](https://github.com/tomkray/kraywallet-extension/issues)  
**Security:** Report vulnerabilities via [GitHub Security](https://github.com/tomkray/kraywallet-extension/security/advisories/new)

---

## ⚠️ Disclaimer

**KrayWallet is provided "as is" without warranty of any kind.**

Users are responsible for:
- ✅ Backing up their mnemonic safely
- ✅ Keeping their password secure
- ✅ Verifying transactions before signing
- ✅ Following security best practices

**We are NOT liable for:**
- User error (lost mnemonic, weak password)
- Device compromise (malware, theft)
- Phishing attacks
- Market volatility
- Regulatory changes

**Not financial advice:** KrayWallet is a tool for managing Bitcoin. It does not provide investment advice.

---

## 🎯 Roadmap

### v1.0.0 (Current) ✅
- ✅ Local mnemonic generation
- ✅ Taproot addresses (P2TR)
- ✅ Schnorr signatures
- ✅ Ordinals support
- ✅ Runes support
- ✅ Send/receive Bitcoin
- ✅ UTXO management
- ✅ Encrypted storage

### v1.1.0 (Next) 🔄
- 🔄 Hardware wallet support (Ledger, Trezor)
- 🔄 Multi-signature support
- 🔄 Watch-only wallet mode
- 🔄 Custom fee estimation
- 🔄 Transaction history export

### v2.0.0 (Future) 📋
- 📋 Lightning Network integration
- 📋 CoinJoin support
- 📋 Social recovery
- 📋 Timelock transactions
- 📋 Full node integration

---

## 💪 Why KrayWallet?

### Self-Custodial
✅ **You control your keys**  
✅ **No one can freeze your funds**  
✅ **No KYC required**  
✅ **True financial sovereignty**

### Secure
✅ **Local signing only**  
✅ **Encrypted storage**  
✅ **Open source & auditable**  
✅ **Industry-standard cryptography**

### Modern
✅ **Taproot native**  
✅ **Ordinals & Runes support**  
✅ **Clean, intuitive UI**  
✅ **Fast & responsive**

### Honest
✅ **No hidden fees**  
✅ **No data collection**  
✅ **No tracking**  
✅ **Transparent development**

---

## 🌟 Star History

If you find KrayWallet useful, please consider giving us a star on GitHub! ⭐

---

## 📊 Statistics

- **Lines of Code:** ~15,000
- **Dependencies:** 4 core libraries
- **Bundle Size:** 548 KB
- **Supported:** Bitcoin, Ordinals, Runes, Lightning (soon)
- **License:** MIT (100% open source)

---

**Made with ❤️ for the Bitcoin community**

**Your keys, your Bitcoin. Always. 🔐**

---

*Last updated: November 26, 2024*
