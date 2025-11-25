# 🏗️ Kray Station - Backend API

Backend API for KrayWallet and Kray Station frontend.

## ✨ Features

- 🔍 **Bitcoin Explorer** (Transactions, addresses, blocks)
- 🖼️ **Ordinals API** (Inscriptions indexing and search)
- 🪙 **Runes API** (Dynamic parent detection)
- 💱 **Atomic Swap** (P2P trustless marketplace)
- ⚡ **Lightning Integration** (Payments and channels)
- 🎨 **Thumbnail Proxy** (Secure content delivery)

## 🚀 Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Turso (SQLite)
- **Bitcoin**: QuickNode (100% cloud)
- **Deployment**: Vercel

## 📦 Installation

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

## 🔧 Environment Variables

See `.env.example` for required variables.

## 🌐 Endpoints

### Explorer:
- `GET /api/explorer/tx/:txid` - Transaction details
- `GET /api/explorer/address/:address` - Address info

### Wallet:
- `GET /api/wallet/:address/inscriptions` - List inscriptions
- `GET /api/wallet/:address/runes` - List runes

### Runes:
- `POST /api/runes/build-send-psbt` - Build send transaction

## 🛡️ Security

- ✅ Rate limiting
- ✅ CORS protection
- ✅ Input validation
- ✅ QuickNode authentication

## 📝 License

MIT

---

**Powered by QuickNode** 🚀

