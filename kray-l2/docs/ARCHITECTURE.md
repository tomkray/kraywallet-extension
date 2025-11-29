# KRAY SPACE L2 - Architecture

Technical architecture documentation for KRAY SPACE Layer 2.

## Overview

KRAY SPACE L2 is a Bitcoin-native Layer 2 solution optimized for the KRAY•SPACE Rune token.

## Core Principles

1. **Bitcoin Native** - Built on Bitcoin L1, not a sidechain
2. **KRAY as Gas** - All fees paid in KRAY Credits
3. **Decentralized** - Progressive decentralization from federated to PoS
4. **Secure** - PSBT multisig bridge with fraud proofs

## Components

### 1. Bridge Layer
- **Purpose**: L1↔L2 asset movement
- **Tech**: PSBT multisig (2-of-3 Taproot)
- **Security**: 24h challenge period, fraud proofs

### 2. State Layer
- **Purpose**: Account balances and nonces
- **Tech**: Merkle trees, SQLite/Supabase
- **Updates**: Instant (< 1s finality)

### 3. Validator Layer
- **Purpose**: Consensus and security
- **Tech**: Raft consensus (Phase 1)
- **Stake**: 10,000 KRAY minimum

### 4. Rollup Layer
- **Purpose**: L1 settlement
- **Tech**: Batch aggregation, OP_RETURN anchors
- **Frequency**: Every 1 hour

### 5. Application Layer
- **DeFi**: AMM, staking, lending
- **Marketplace**: Instant Ordinals/Runes trades
- **Gaming**: Rewards and loyalty points

## Token Flow

### Deposit (L1 → L2)
```
User Wallet (L1)
    ↓ Send KRAY to multisig
Bridge Multisig (L1)
    ↓ 6 confirmations
L2 State Update
    ↓ Mint credits
User Balance (L2) ✅
```

### Withdrawal (L2 → L1)
```
User Balance (L2)
    ↓ Burn credits
Withdrawal Queue
    ↓ 24h challenge period
    ↓ No fraud proof
PSBT Unlock
    ↓ Broadcast to L1
User Wallet (L1) ✅
```

## Gas Economics

### Fee Structure
- **Base**: 1 credit per transfer
- **Complex**: 2-10 credits per operation
- **Distribution**: 50% burn, 50% validators

### Example Transactions
```
Alice sends 100 KRAY to Bob:
- Amount: 100.000 KRAY
- Gas: 0.001 KRAY (1 credit)
- Bob receives: 100.000 KRAY
- Burned: 0.0005 KRAY
- Validators: 0.0005 KRAY
```

## Security Model

### Phase 1: Federated (Month 1-6)
- 3 trusted validators
- 2-of-3 multisig
- 24h challenge
- Manual fraud detection

### Phase 2: Semi-Decentralized (Month 7-12)
- 10+ staked validators
- Automatic fraud proofs
- 12h challenge
- Slashing enabled

### Phase 3: Fully Decentralized (Year 2+)
- 50+ validators
- ZK-proofs
- 6h challenge
- Full PoS

## Data Structures

### L2 Account
```javascript
{
  account_id: "kray_abc123",
  l1_address: "bc1p...",
  balance_credits: "1500000", // 1,500.000 KRAY
  staked_credits: "0",
  nonce: 42,
  merkle_index: 1234
}
```

### L2 Transaction
```javascript
{
  tx_hash: "hash...",
  from: "kray_abc123",
  to: "kray_xyz789",
  amount: "100000", // 100.000 KRAY
  gas_fee: "1", // 0.001 KRAY
  nonce: 42,
  signature: "sig...",
  status: "confirmed",
  batch_id: 567
}
```

### L2 Batch
```javascript
{
  batch_id: 567,
  prev_state_root: "root1...",
  new_state_root: "root2...",
  tx_count: 1543,
  total_gas: "1543", // 1.543 KRAY
  l1_anchor_txid: "txid...",
  l1_block_height: 850000
}
```

## Performance Targets

- **TPS**: 1,000+ transactions/second
- **Finality**: < 1 second (L2)
- **Settlement**: 1 hour (L1)
- **Gas cost**: < $0.01 per transaction

## Integration Points

### KrayWallet Extension
- Bridge UI (deposit/withdrawal)
- L2 balance display
- Instant transactions
- Gas estimation

### Backend API
- REST endpoints
- WebSocket streams
- Batch queries
- Analytics

### Marketplace
- Instant trades
- Zero confirmation risk
- Automated settlement

## Future Enhancements

- ZK-proofs for privacy
- Cross-chain bridges
- Faster L1 settlement
- More DeFi primitives

---

**Status:** 🚧 In Development  
**Last Updated:** November 28, 2025

