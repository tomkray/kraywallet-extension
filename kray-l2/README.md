# KRAY SPACE L2

Layer 2 implementation for KRAY•SPACE token on Bitcoin.

## 🚧 Status

**In Development** - Active implementation phase

## 🎯 Overview

KRAY SPACE L2 is a Bitcoin Layer 2 solution that enables:
- ⚡ Instant transactions
- 💰 Low fees (paid in KRAY Credits)
- 🔄 DeFi operations (swaps, staking, lending)
- 🏪 Instant marketplace trades
- 🎮 Gaming rewards & loyalty points

## 📊 Token Economics

### L1 (Bitcoin)
- Token: KRAY•SPACE (indivisible)
- Etching: `4aae35965730540004765070df639d0dd0485ec5d33a7181facac970e9225449`
- Standard: Bitcoin Runes

### L2 (KRAY Network)
- Token: KRAY Credits
- Decimals: **3** (1 KRAY = 1,000 credits)
- Gas: Paid in KRAY Credits
- Examples:
  - 1 KRAY = 1,000 credits = 1.000 KRAY
  - 0.5 KRAY = 500 credits = 0.500 KRAY
  - 0.001 KRAY = 1 credit (minimum unit)

### Gas Fees (L2)
- Transfer: 1 credit (0.001 KRAY)
- Swap: 5 credits (0.005 KRAY)
- Stake: 2 credits (0.002 KRAY)
- Marketplace list: 10 credits (0.010 KRAY)

### Gas Distribution
- 50% burned (deflationary) ♨️
- 50% to validators (staking rewards) 💰

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         KRAY SPACE L2 Stack             │
├─────────────────────────────────────────┤
│                                         │
│  DeFi / Marketplace / Gaming (L2 Apps) │
│              ↓                          │
│  API / WebSocket (Interface)           │
│              ↓                          │
│  State Manager / Validators (L2 Core)  │
│              ↓                          │
│  Bridge (PSBT Multisig)                │
│              ↓                          │
│  Bitcoin L1 + KRAY•SPACE Rune          │
│                                         │
└─────────────────────────────────────────┘
```

## 📁 Project Structure

```
kray-l2/
├── core/           # Core L2 functionality
├── bridge/         # L1↔L2 bridge (deposits/withdrawals)
├── state/          # State management
├── validators/     # Validator network
├── defi/           # DeFi layer (AMM, staking, lending)
├── marketplace/    # L2 marketplace
├── docs/           # Technical documentation
└── README.md       # This file
```

## 🔄 Bridge Flow

### Deposit (L1 → L2)
```
1. User sends KRAY to multisig address (L1)
2. Wait 6 confirmations
3. Mint equivalent KRAY Credits on L2
4. Credits available instantly
```

### Withdrawal (L2 → L1)
```
1. User burns KRAY Credits on L2
2. Challenge period (24 hours)
3. If no fraud proof: unlock PSBT
4. Receive KRAY on L1
```

## 🔐 Security

### Phase 1: Federated (Launch)
- 3 trusted validators (2-of-3 threshold)
- 24-hour challenge period
- Fraud proofs enabled

### Phase 2: Semi-Decentralized
- 10+ staked validators
- Minimum stake: 10,000 KRAY
- 12-hour challenge period

### Phase 3: Fully Decentralized
- 50+ validators
- Dynamic staking
- 6-hour challenge period
- ZK-proofs (future)

## 🚀 Development Roadmap

### Month 1-2: Core Infrastructure
- [x] Bridge (PSBT multisig)
- [x] Account management
- [x] Transaction execution
- [x] Gas system

### Month 3-4: Validators & Rollup
- [ ] Validator network
- [ ] Consensus (Raft)
- [ ] Batch builder
- [ ] L1 anchoring

### Month 5: DeFi Layer
- [ ] AMM pools
- [ ] Swaps
- [ ] Staking
- [ ] Rewards

### Month 6: Integration
- [ ] Marketplace
- [ ] Gaming rewards
- [ ] KrayWallet integration
- [ ] API complete

### Month 7: Testing & Launch
- [ ] Testnet
- [ ] Security audit
- [ ] Mainnet launch

## 💻 Tech Stack

- **Runtime**: Node.js 24+
- **Database**: SQLite (local), Supabase (future)
- **Bitcoin**: QuickNode RPC
- **Consensus**: Raft
- **Crypto**: bitcoinjs-lib, @bitcoinerlab/secp256k1

## 🔧 Development

### Setup
```bash
cd kray-l2
npm install
```

### Run (when ready)
```bash
npm start
```

### Test
```bash
npm test
```

## 📖 Documentation

- [Architecture](./docs/ARCHITECTURE.md) - Technical architecture
- [Bridge](./docs/BRIDGE.md) - Bridge specification
- [Gas](./docs/GAS.md) - Gas system details
- [Validators](./docs/VALIDATORS.md) - Validator guide

## ⚠️ Important Notes

1. **L2 is in development** - Not production ready
2. **3 decimals** - KRAY Credits have 3 decimal places
3. **Gas in KRAY** - All fees paid in KRAY Credits
4. **Testnet first** - Will launch on testnet before mainnet

## 🤝 Contributing

This is part of the KRAY WALLET project. See main [README](../README.md) for contribution guidelines.

## 📝 License

Private project - All rights reserved.

---

**Last Updated:** November 28, 2025  
**Status:** 🚧 Active Development


