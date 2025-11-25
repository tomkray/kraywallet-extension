# 🎨 Visual Guide: Why Kray Wallet is the Only Wallet That Can Sell

## 🔐 The SIGHASH Signature Problem

### ❌ **Unisat/Xverse/Leather: SIGHASH_ALL (0x01)**

```
┌─────────────────────────────────────────────────────────────┐
│                    SELLER CREATES PSBT                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📥 INPUTS:                                                  │
│     [0] Inscription UTXO (1 sat)  ← Seller signs with       │
│                                      SIGHASH_ALL 🔒          │
│                                                              │
│  📤 OUTPUTS:                                                 │
│     [0] Inscription → Buyer        ← Locked by signature 🔒 │
│     [1] Payment → Seller (1077)    ← Locked by signature 🔒 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────┐
│                    BUYER TRIES TO COMPLETE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ❌ ERROR: Cannot add input!                                │
│     Trying to add: [1] Buyer UTXO (16650 sats)             │
│     ❌ "Can not modify transaction, signatures exist"       │
│                                                              │
│  ❌ ERROR: Cannot add output!                               │
│     Trying to add: [2] Change → Buyer (15073 sats)         │
│     ❌ "Can not modify transaction, signatures exist"       │
│                                                              │
│  ⛔ ATOMIC SWAP IMPOSSIBLE!                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why it fails:**
- 🔒 `SIGHASH_ALL` locks **ALL inputs** and **ALL outputs**
- 🚫 Buyer cannot add their payment inputs
- 🚫 Buyer cannot add their change output
- ❌ Transaction is "sealed" by seller's signature

---

### ✅ **Kray Wallet: SIGHASH_SINGLE|ANYONECANPAY (0x83)**

```
┌─────────────────────────────────────────────────────────────┐
│                    SELLER CREATES PSBT                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📥 INPUTS:                                                  │
│     [0] Inscription UTXO (1 sat)  ← Seller signs with       │
│                                      SIGHASH_SINGLE|         │
│                                      ANYONECANPAY 🔓         │
│                                                              │
│  📤 OUTPUTS:                                                 │
│     [0] Inscription → Buyer        ← Locked 🔒               │
│     [1] Payment → Seller (1077)    ← Locked 🔒               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────┐
│                    BUYER COMPLETES PSBT                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📥 INPUTS:                                                  │
│     [0] Inscription UTXO (1)       ← Seller's sig 🔒         │
│     [1] Buyer UTXO (16650) ✅      ← Buyer can add! 🔓       │
│                                                              │
│  📤 OUTPUTS:                                                 │
│     [0] Inscription → Buyer 🔒     ← Seller's sig locks     │
│     [1] Payment → Seller (1077) 🔒 ← Seller's sig locks     │
│     [2] Service Fee (10) ✅        ← Buyer can add! 🔓       │
│     [3] Change → Buyer (15563) ✅  ← Buyer can add! 🔓       │
│                                                              │
│  ✅ ATOMIC SWAP COMPLETE!                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why it works:**
- 🔓 `SIGHASH_SINGLE` locks ONLY **Input 0** with **Output 0**
- 🔓 `ANYONECANPAY` allows adding more inputs
- ✅ Buyer can freely add payment inputs
- ✅ Buyer can freely add change output
- ✅ Seller's inscription and payment are still protected

---

## 🎯 Side-by-Side Comparison

| Feature | SIGHASH_ALL<br>(Unisat/Xverse) | SIGHASH_SINGLE\|ANYONECANPAY<br>(Kray Wallet) |
|---------|--------------------------------|------------------------------------------------|
| **Locks seller's input** | ✅ Yes | ✅ Yes |
| **Locks seller's outputs** | ✅ All outputs | ✅ Only Output 0 & 1 |
| **Buyer can add inputs** | ❌ No | ✅ Yes |
| **Buyer can add outputs** | ❌ No | ✅ Yes |
| **Atomic swap possible** | ❌ No | ✅ Yes |
| **Security for seller** | ✅ High (but useless) | ✅ High & functional |

---

## 🔬 Technical Deep Dive

### **SIGHASH_ALL (0x01)**
```
Signature covers:
├─ All inputs (txid, vout, scriptPubKey, value)
├─ All outputs (scriptPubKey, value)
├─ Transaction version
├─ Transaction locktime
└─ Input sequence numbers

Result: ENTIRE transaction is immutable
```

### **SIGHASH_SINGLE|ANYONECANPAY (0x83)**
```
Signature covers:
├─ ONLY Input 0 (current input)
├─ ONLY Output 0 (corresponding output)
├─ Transaction version
└─ Current input sequence

Result: Other inputs/outputs can be added
```

---

## 🚀 Real-World Flow

### **Seller (Using Kray Wallet)**
```
1. 🖼️  Select inscription to sell
2. 💰 Enter price: 1077 sats
3. 🔐 Sign with SIGHASH_SINGLE|ANYONECANPAY
4. 📤 PSBT published to marketplace
5. ⏳ Wait for buyer...
```

### **Buyer (Using ANY Wallet)**
```
1. 🛒 Click "Buy Now"
2. 💳 Kray Station adds buyer's inputs/outputs
3. 🔐 Buyer signs ONLY their inputs
4. 📡 Transaction broadcast
5. ✅ Inscription transferred instantly!
```

### **The Magic Moment**
```
┌─────────────────────────────────────────────┐
│   SELLER'S PARTIAL PSBT (already signed)    │
│   + BUYER'S ADDITIONS (newly signed)        │
│   = COMPLETE ATOMIC SWAP TRANSACTION ✅     │
└─────────────────────────────────────────────┘
```

---

## 💡 Why This Matters

### **For Sellers:**
- 🎯 List once, sell instantly
- 🔒 No risk of losing inscription
- 💰 Guaranteed payment on sale
- ⚡ No escrow or intermediary needed

### **For Buyers:**
- 👀 See exact transaction before signing
- 🛡️ Protected by UTXO filter
- ⚡ Instant settlement
- 🎁 Get inscription immediately

### **For the Ecosystem:**
- 🌐 Truly decentralized marketplace
- 🔓 No centralized order book
- 💪 Censorship-resistant
- 🚀 Scales infinitely

---

## 🎓 Learn More

Want to understand the Bitcoin Script behind this?

```bash
# Taproot key-path spend with SIGHASH_SINGLE|ANYONECANPAY
Witness: <signature> <sighash_type>

Where:
  signature = Schnorr signature (64 bytes)
  sighash_type = 0x83 (1 byte)
                 = SIGHASH_SINGLE (0x03)
                 | ANYONECANPAY (0x80)
```

### **Resources:**
- 📖 [BIP 341: Taproot](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)
- 📖 [BIP 340: Schnorr Signatures](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)
- 📖 [SIGHASH Flags Explained](https://bitcoin.stackexchange.com/questions/3374/what-are-the-sighash-types)

---

## 🏆 Kray Wallet: The Atomic Swap Pioneer

By supporting `SIGHASH_SINGLE|ANYONECANPAY`, Kray Wallet enables:
- ✨ True peer-to-peer trading
- ✨ Instant settlement
- ✨ Zero counterparty risk
- ✨ Maximum security

**This is the future of Ordinals trading.** 🚀

