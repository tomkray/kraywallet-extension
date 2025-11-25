# 🔐 Wallet Compatibility Guide

## 📋 Summary

| Feature | Kray Wallet | Unisat | Xverse | Leather |
|---------|-------------|---------|---------|---------|
| **List for Sale** | ✅ Yes (0% fee) | ❌ No | ❌ No | ❌ No |
| **Buy Inscriptions** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Atomic Swaps** | ✅ Yes | ❌ No | ❌ No | ❌ No |

---

## 🎯 Why These Limitations?

### **The SIGHASH Problem**

Bitcoin transactions use **SIGHASH flags** to control what parts of a transaction are "locked" by a signature.

#### **SIGHASH_ALL (0x01)** - Used by Unisat, Xverse, Leather
```
When seller signs:
├─ Input 0: Inscription UTXO (LOCKED ✅)
├─ ALL outputs (LOCKED ✅)
└─ ALL inputs (LOCKED ✅)

Result: Transaction is 100% sealed
        → Buyer CANNOT add inputs
        → Buyer CANNOT add outputs
        → NO atomic swap possible ❌
```

#### **SIGHASH_SINGLE|ANYONECANPAY (0x83)** - Used by Kray Wallet
```
When seller signs:
├─ Input 0: Inscription UTXO (LOCKED ✅)
├─ Output 0: Inscription to buyer (LOCKED ✅)
└─ Output 1: Payment to seller (LOCKED ✅)

Buyer CAN freely add:
├─ Input 1+: Their UTXOs (FREE ✅)
├─ Output 2: Service fee (FREE ✅)
└─ Output 3: Change to buyer (FREE ✅)

Result: True atomic swap possible ✅
```

---

## 🚀 Kray Wallet Advantages

### **1. True Atomic Swaps**
- ✅ Instant, trustless exchange
- ✅ No counterparty risk
- ✅ No need for escrow or third party

### **2. Seller Flexibility**
- ✅ List inscriptions directly from wallet
- ✅ 0% service fee
- ✅ No manual ORD CLI commands needed

### **3. Buyer Security**
- ✅ PSBT is validated before signing
- ✅ Exact preview of transaction
- ✅ UTXO filter protects inscriptions/runes

---

## 📝 For Users of Other Wallets

### **As a Seller (Unisat/Xverse/Leather)**

**Option 1: Switch to Kray Wallet (Recommended)**
```bash
1. Install Kray Wallet extension
2. Import your seed phrase (or create new wallet)
3. List inscriptions with 0% fee
4. Enjoy instant atomic swaps
```

**Option 2: Use ORD CLI Manually (Advanced)**
```bash
# Not currently supported in marketplace
# Would require manual PSBT coordination
# Not recommended for most users
```

### **As a Buyer (Any Wallet)**

✅ **All wallets can buy!**

When you click "Buy Now":
1. Kray Station builds the atomic PSBT
2. Your wallet signs ONLY your inputs
3. Transaction is broadcast
4. You receive the inscription instantly

Your wallet only signs the parts it controls:
- ✅ Your Bitcoin inputs (to pay for inscription)
- ✅ Your change output (to receive leftover Bitcoin)

You do NOT sign the seller's parts (already signed by seller).

---

## 🔧 Technical Details

### **Atomic Swap PSBT Structure**

```
INPUT 0:  Inscription UTXO (seller signs with SIGHASH_SINGLE|ANYONECANPAY)
INPUT 1:  Buyer's UTXO (buyer signs with SIGHASH_ALL)
INPUT 2+: More buyer UTXOs if needed (buyer signs with SIGHASH_ALL)

OUTPUT 0: Inscription → Buyer address
OUTPUT 1: Payment → Seller address  
OUTPUT 2: Service Fee → Kray Station (if applicable)
OUTPUT 3: Change → Buyer address
```

### **Why Unisat/Xverse Can't Sell**

1. They create a PSBT and sign it with `SIGHASH_ALL`
2. `SIGHASH_ALL` locks ALL inputs and ALL outputs
3. When buyer tries to add their inputs → **ERROR: Can not modify transaction, signatures exist**
4. Transaction fails ❌

### **Why Unisat/Xverse CAN Buy**

1. Seller creates PSBT and signs with `SIGHASH_SINGLE|ANYONECANPAY`
2. Buyer adds their inputs and outputs (not locked by seller)
3. Buyer signs ONLY their inputs with `SIGHASH_ALL` (doesn't affect seller's signature)
4. Transaction succeeds ✅

---

## 📚 Further Reading

- [BIP 341: Taproot](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)
- [SIGHASH Flags Explained](https://wiki.bitcoinsv.io/index.php/SIGHASH_flags)
- [Ordinals Atomic Swaps](https://docs.ordinals.com/guides/atomic-swaps.html)

---

## 💡 FAQ

**Q: Will Unisat/Xverse ever support atomic swaps?**
A: They would need to add `SIGHASH_SINGLE|ANYONECANPAY` support to their signing interface. This is possible but not currently implemented.

**Q: Is it safe to import my seed phrase into Kray Wallet?**
A: Yes! Kray Wallet uses the same BIP39 standard as all other wallets. Your seed phrase works in any BIP39-compatible wallet.

**Q: Can I use Kray Wallet alongside my other wallet?**
A: Yes! You can have both wallets connected to the same address simultaneously. Just import the same seed phrase.

**Q: Why 0% fee for Kray Wallet?**
A: We want to incentivize adoption of true atomic swap technology. Kray Wallet users get the best experience and lowest fees.

---

## 🌟 Join the Atomic Swap Revolution

Download Kray Wallet today and experience the future of Ordinals trading:

🔗 **[Download Kray Wallet Extension](#)**

✨ True atomic swaps  
✨ 0% service fees  
✨ Instant settlement  
✨ Open source & secure

