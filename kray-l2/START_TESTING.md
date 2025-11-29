# 🧪 START TESTING - Step by Step Guide

**Follow these steps to start testing your KRAY SPACE L2!**

---

## Step 1: Configure .env File

```bash
cd "/Volumes/D2/KRAY WALLET- V1/kray-l2"
cp env.example .env
```

**Edit .env and add these values:**

```bash
# Copy and paste this into your .env file:

PORT=5000
NODE_ENV=development
BITCOIN_NETWORK=testnet
DB_PATH=./data/kray-l2.db

# Validator Keys (Already Generated!)
VALIDATOR_1_MNEMONIC=vibrant winter bright else mixture cattle hard custom police pumpkin crime wage
VALIDATOR_2_MNEMONIC=put era fly flame artist double trip border dream fruit flee tumble
VALIDATOR_3_MNEMONIC=bean cotton number thought razor stick note lunch cancel connect arm candy

# QuickNode - Add your testnet endpoint here:
QUICKNODE_ENDPOINT=https://your-testnet-endpoint.quiknode.pro/your-key
QUICKNODE_ENABLED=true

# Security
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
WITHDRAWAL_CHALLENGE_PERIOD=86400

LOG_LEVEL=info
```

**⚠️ IMPORTANT:** Replace `QUICKNODE_ENDPOINT` with your REAL testnet endpoint!

---

## Step 2: Create Data Folder

```bash
mkdir -p data
```

---

## Step 3: Start L2 Server

```bash
npm start
```

**You should see:**
```
╔══════════════════════════════════════════════════════════════╗
║           KRAY SPACE L2 - Layer 2 Network                   ║
╚══════════════════════════════════════════════════════════════╝

🗄️  Initializing KRAY L2 database...
✅ Database initialized successfully

🔑 Initializing bridge key manager...
✅ Loaded validator keys from environment
   🔐 Validator 1 pubkey: 02a1b2c3d4e5f6...
   🔐 Validator 2 pubkey: 03f9e8d7c6b5a4...
   🔐 Validator 3 pubkey: 02c4d5e6f7a8b9...

🔐 Generating TRUE 2-of-3 Taproot multisig...
✅ TRUE multisig address generated: bc1p...

⚡ Initializing Raft consensus...
✅ Consensus started as FOLLOWER

📦 Starting batch builder...
✅ Batch builder started

✅ KRAY SPACE L2 is running!
   Port: 5000
   Bridge: bc1p...
   Network: kray-mainnet-1

📡 API Endpoints:
   GET  /health
   POST /api/bridge/deposit
   ...

🚀 Ready to process transactions!
```

**If you see this, SUCCESS! ✅**

---

## Step 4: Test API

**Open another terminal:**

```bash
# Test health endpoint
curl http://localhost:5000/health
```

**You should see:**
```json
{
  "status": "healthy",
  "timestamp": 1701234567890,
  "network": "kray-mainnet-1",
  "version": "0.1.0",
  "stats": {
    "accounts": 0,
    "transactions": 0,
    "deposits": 0,
    ...
  }
}
```

**If you see this JSON, L2 server is WORKING! ✅**

---

## Step 5: Load Extension

**In Chrome:**

```
1. Open: chrome://extensions/
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Navigate to: /Volumes/D2/KRAY WALLET- V1/extension-prod/
5. Click "Select"
```

**Extension should load! ✅**

---

## Step 6: Test Extension → L2 Connection

**Open extension:**
```
1. Click extension icon in Chrome
2. Unlock wallet (or restore if needed)
3. Default: Shows Mainnet
```

**Switch to KRAY L2:**
```
1. Click network selector (top-left dropdown)
2. You should see:
   🔗 Mainnet
   ⚡ KRAY L2 ← Click this!
   🧪 Testnet

3. Click "KRAY L2"
```

**What you should see:**
```
✅ Network changes to "⚡ KRAY L2"
✅ KRAY SPACE logo appears
✅ Balance shows: 0.000 KRAY / 0 credits
✅ Status: Connected (green dot)
✅ No Bitcoin stuff (no Ordinals, Runes, etc)
✅ Only L2 features:
   - Deposit/Withdraw buttons
   - Transfer/Swap/Marketplace/Rewards cards
   - Transaction history (empty)
```

**Open Chrome DevTools:**
```
1. Right-click extension → Inspect
2. Go to Console tab
3. Look for:
   ✅ "KRAY L2 module loaded"
   ✅ "Initializing KRAY L2..."
   ✅ "L2 API connected"
   ✅ "L2 account created: kray_xxxxx"
   ✅ "L2 Balance: 0.000 KRAY (0 credits)"
```

**If you see these messages, PERFECT! ✅**

---

## Step 7: Create Test Account (Manually)

**Since you don't have KRAY on L2 yet, let's add some test credits:**

### Option A: Via API (Easy)

**In terminal:**
```bash
# Create account via API
curl -X POST http://localhost:5000/api/account/create \
  -H "Content-Type: application/json" \
  -d '{"l1_address":"bc1pexampleaddress1234567890abcdefghijklmnopqrstuvwxyz123456"}'

# Note the account_id in response
```

**Add test balance directly to database:**
```bash
# Stop server (Ctrl+C)

# Open SQLite
sqlite3 data/kray-l2.db

# Add balance
UPDATE l2_accounts SET balance_credits = '100000' WHERE account_id = 'kray_xxxxx';

# Check
SELECT account_id, balance_credits FROM l2_accounts;

# Exit
.quit

# Restart server
npm start
```

### Option B: Via Extension (When Deposit is Implemented)

Will need to:
1. Deposit KRAY to multisig
2. Wait confirmations
3. Claim on L2

---

## Step 8: Test Features

**Once you have balance:**

### Test Transfer:
```
1. Click "Instant Transfer"
2. Enter recipient address
3. Enter amount
4. Sign transaction
5. Should execute < 1 second!
```

### Test Swap:
```
1. Click "DeFi Swap"
2. Select pool
3. Enter amount
4. Execute swap
5. Instant!
```

---

## 🐛 Common Issues & Solutions

### "Cannot connect to L2 API"
```
Solution:
- Check L2 server is running (npm start)
- Check http://localhost:5000/health works
- Check no firewall blocking
```

### "L2 account not created"
```
Solution:
- Check console for errors
- Manually create via API:
  curl -X POST http://localhost:5000/api/account/create \
    -H "Content-Type: application/json" \
    -d '{"l1_address":"YOUR_WALLET_ADDRESS"}'
```

### "Balance shows 0.000"
```
This is NORMAL initially!
You need to deposit KRAY to L2 first.

For testing, add balance manually in database (see Step 7)
```

### "npm install fails"
```
Solution:
- Run: sudo chown -R 501:20 "/Users/tomkray/.npm"
- Or: npm install --no-fund --no-audit
- Or: rm -rf node_modules && npm install
```

---

## ✅ Success Criteria

You know it's working when:

1. ✅ L2 server running on port 5000
2. ✅ /health endpoint returns JSON
3. ✅ Extension loads without errors
4. ✅ Can switch to KRAY L2 network
5. ✅ L2 content appears
6. ✅ No Bitcoin/Ordinals showing
7. ✅ Status: Connected (green)
8. ✅ Account auto-created
9. ✅ No errors in console

---

## 🎯 What to Test First

### Phase 1: Infrastructure (NOW)
- [x] npm install
- [x] Generate keys
- [ ] Configure .env
- [ ] Start server
- [ ] Test /health endpoint

### Phase 2: Extension (NEXT)
- [ ] Load extension
- [ ] Switch to KRAY L2
- [ ] Verify UI correct
- [ ] Check API connection
- [ ] Verify account created

### Phase 3: Features (LATER)
- [ ] Add test balance
- [ ] Test transfers
- [ ] Test swaps
- [ ] Test marketplace

---

## 📝 Current Status

```
✅ Dependencies installed (165 packages)
✅ Validator keys generated
⏳ .env file needs configuration
⏳ Server ready to start
⏳ Extension ready to load
```

---

## 🚀 Next Command

**Configure .env then:**
```bash
npm start
```

**That's it! Your L2 will be running! ⚡**

---

**You're 95% there! Just configure .env and start! 🎉**

