# KRAY SPACE L2 - Quick Start Guide

Get KRAY SPACE L2 running in 5 minutes!

## 📋 Prerequisites

- Node.js 24+
- npm or yarn
- QuickNode account (Bitcoin RPC)

## 🚀 Setup

### 1. Install Dependencies

```bash
cd kray-l2
npm install
```

### 2. Generate Validator Keys

```bash
# Generate 3 mnemonics for validators
npm run keys:generate
npm run keys:generate
npm run keys:generate

# Save these mnemonics securely!
```

### 3. Configure Environment

```bash
# Copy example env file
cp env.example .env

# Edit .env and add:
# - Validator mnemonics (from step 2)
# - QuickNode endpoint
# - Other settings
```

Example `.env`:
```
PORT=5000
NODE_ENV=development
BITCOIN_NETWORK=testnet

VALIDATOR_1_MNEMONIC=word1 word2 word3 ... word24
VALIDATOR_2_MNEMONIC=word1 word2 word3 ... word24
VALIDATOR_3_MNEMONIC=word1 word2 word3 ... word24

QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/your-key
```

### 4. Initialize Database

```bash
npm run db:init
```

### 5. Run Tests

```bash
npm test
```

You should see:
```
✅ ALL TESTS PASSED! 🎉
KRAY SPACE L2 is working perfectly! 🚀
```

### 6. Start Server

```bash
npm start
```

You should see:
```
✅ KRAY SPACE L2 is running!
   Port: 5000
   Bridge: bc1p...
   Network: kray-mainnet-1
```

## 🧪 Test API

### Health Check
```bash
curl http://localhost:5000/health
```

### Create Account
```bash
curl -X POST http://localhost:5000/api/account/create \
  -H "Content-Type: application/json" \
  -d '{
    "l1_address": "bc1pexampleaddress..."
  }'
```

### Get Balance
```bash
curl http://localhost:5000/api/account/kray_abc123.../balance
```

### List Pools
```bash
curl http://localhost:5000/api/defi/pools
```

### Get Bridge Info
```bash
curl http://localhost:5000/api/bridge/info
```

## 📚 API Endpoints

### Bridge
- `POST /api/bridge/deposit/initiate` - Start deposit
- `GET /api/bridge/deposit/:txid/:vout/status` - Check deposit
- `POST /api/bridge/withdrawal/request` - Request withdrawal
- `GET /api/bridge/withdrawal/:id/status` - Check withdrawal
- `GET /api/bridge/info` - Bridge information

### Account
- `POST /api/account/create` - Create account
- `GET /api/account/:address/balance` - Get balance
- `GET /api/account/:address/transactions` - Get transactions
- `GET /api/account/:address/stats` - Get statistics

### Transaction
- `POST /api/transaction/send` - Send transaction
- `GET /api/transaction/:hash` - Get transaction
- `POST /api/transaction/estimate-gas` - Estimate gas
- `GET /api/transaction/stats` - Get stats

### DeFi
- `GET /api/defi/pools` - List pools
- `POST /api/defi/pool/create` - Create pool
- `POST /api/defi/swap` - Execute swap
- `POST /api/defi/quote` - Get swap quote
- `GET /api/defi/pool/:id` - Get pool details

### Marketplace
- `GET /api/marketplace/listings` - List items
- `POST /api/marketplace/list` - List item
- `POST /api/marketplace/buy` - Buy item
- `POST /api/marketplace/cancel` - Cancel listing
- `GET /api/marketplace/stats` - Get stats

### Validator
- `GET /api/validator/list` - List validators
- `POST /api/validator/register` - Register validator
- `GET /api/validator/:id` - Get validator
- `POST /api/validator/:id/claim-rewards` - Claim rewards
- `GET /api/validator/stats` - Get stats

## 🎯 Next Steps

1. ✅ Server running locally
2. 🔜 Integrate with KrayWallet extension
3. 🔜 Deploy to testnet
4. 🔜 Security audit
5. 🔜 Mainnet launch

## 🐛 Troubleshooting

### Database Error
```bash
# Delete and reinitialize
rm -f data/kray-l2.db
npm run db:init
npm test
```

### Port Already in Use
```bash
# Change PORT in .env
PORT=5001
```

### Missing Dependencies
```bash
# Reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📖 Documentation

- [README.md](./README.md) - Overview
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Technical details
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - What's done

## 🎊 Success!

If all tests pass, you're ready to:
1. Start building on top of L2
2. Integrate with KrayWallet
3. Deploy to testnet
4. Launch to users!

**KRAY SPACE L2 is ready! 🚀**




















