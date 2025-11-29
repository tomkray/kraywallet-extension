# 🔒 SECURITY ROADMAP - KrayWallet

## 🚨 PROBLEMA CRÍTICO ATUAL

**Status:** Extension envia mnemonic para backend para assinatura.  
**Risco:** Backend comprometido = fundos roubados  
**Aceitável?** NÃO! ❌

---

## ✅ SOLUÇÕES IMEDIATAS (Escolha 1)

### Opção 1: Bundle Libraries (RECOMENDADO)
**Tempo:** 2-4 horas  
**Segurança:** 100% local signing ✅

**Passos:**
1. Webpack/Rollup para bundle bitcoinjs-lib
2. Incluir no manifest.json
3. Implementar signing local
4. Remover endpoint sign-psbt

**Arquivos necessários:**
- `bitcoinjs-lib` (PSBT, Taproot)
- `tiny-secp256k1` (Schnorr)
- `bip32` (Derivação)
- `bip39` (Seed)

**Implementação:**
```javascript
// background/local-signer.js
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';

async function signPsbtLocal({ mnemonic, psbtBase64 }) {
    // Derivar seed
    const seed = await bip39.mnemonicToSeed(mnemonic);
    
    // Derivar chave BIP86
    const root = bip32.BIP32Factory(ecc).fromSeed(seed);
    const child = root.derivePath("m/86'/0'/0'/0/0");
    
    // Tweak para Taproot
    const xOnly = child.publicKey.slice(1, 33);
    const tapTweak = bitcoin.crypto.taggedHash('TapTweak', xOnly);
    let tweakedPriv = ecc.privateAdd(child.privateKey, tapTweak);
    
    // Garantir Y even
    const tweakedPub = ecc.pointFromScalar(tweakedPriv);
    if (tweakedPub[0] !== 0x02) {
        tweakedPriv = ecc.privateNegate(tweakedPriv);
    }
    
    // Assinar PSBT
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    const signer = {
        publicKey: ecc.pointFromScalar(tweakedPriv),
        privateKey: tweakedPriv,
        signSchnorr: (hash) => {
            return ecc.signSchnorr(hash, tweakedPriv, Buffer.alloc(32, 0));
        }
    };
    
    for (let i = 0; i < psbt.inputCount; i++) {
        psbt.signInput(i, signer);
    }
    
    psbt.finalizeAllInputs();
    return psbt.extractTransaction().toHex();
}
```

---

### Opção 2: Hardware Wallet Integration
**Tempo:** 1-2 dias  
**Segurança:** 100% hardware isolated ✅✅✅

**Vantagens:**
- Chaves NUNCA saem do hardware
- Padrão ouro de segurança
- Ledger, Trezor support

**Implementação:**
- Integrate `@ledgerhq/hw-app-btc`
- User approva TX no dispositivo físico
- Extension só coordena

---

### Opção 3: Isolated Signing Service (Interim)
**Tempo:** 30 minutos  
**Segurança:** Melhor que atual, mas não ideal ⚠️

**Implementação:**
1. Criar servidor signing ISOLADO (não Render)
2. Zero logs, zero storage
3. HTTPS only
4. Rate limiting por IP
5. Auto-destroy após signing

**Ainda não é ideal** mas é melhor que misturar com backend principal.

---

## 📊 COMPARAÇÃO

| Solução | Segurança | Tempo | Custo | Recomendado |
|---------|-----------|-------|-------|-------------|
| Bundle Libraries | ✅✅✅✅✅ | 2-4h | $0 | ⭐⭐⭐⭐⭐ |
| Hardware Wallet | ✅✅✅✅✅ | 1-2d | $0 | ⭐⭐⭐⭐⭐ |
| Isolated Service | ✅✅✅ | 30m | $5/mo | ⭐⭐ |
| Status Atual | ❌ | 0 | $0 | ⛔ |

---

## 🎯 RECOMENDAÇÃO

**FASE 1 (AGORA):** Bundle Libraries  
**FASE 2 (FUTURO):** Hardware Wallet Support  
**FASE 3 (OPCIONAL):** Multi-sig, Social Recovery

---

## 📋 CHECKLIST - Bundle Libraries

- [ ] Setup Webpack/Rollup
- [ ] Bundle bitcoinjs-lib + deps
- [ ] Update manifest.json
- [ ] Implement local signing
- [ ] Test with testnet
- [ ] Test with mainnet (small amount)
- [ ] Remove sign-psbt endpoint
- [ ] Audit code
- [ ] Deploy

---

## ⚡ START NOW

```bash
cd kraywallet-extension-prod

# Install bundler
npm init -y
npm install --save-dev webpack webpack-cli

# Install Bitcoin libs
npm install bitcoinjs-lib tiny-secp256k1 bip32 bip39

# Create webpack config
cat > webpack.config.js << 'EOF'
const path = require('path');

module.exports = {
  entry: './background/local-signer.js',
  output: {
    filename: 'local-signer.bundle.js',
    path: path.resolve(__dirname, 'background')
  },
  mode: 'production'
};
EOF

# Build
npx webpack

# Update manifest.json to use bundle
```

---

## 🔐 SECURITY PROMISE

**KrayWallet users deserve:**
- ✅ Private keys that NEVER leave device
- ✅ Open source, auditable code
- ✅ Industry standard security
- ✅ User control of funds

**Current status violates this.** Let's fix it NOW! 🚀

