# ⚡ INTEGRAÇÃO LND (Lightning Network) COM DEFI RUNES

## 🎯 VISÃO GERAL

**Ideia Revolucionária:** Usar **LND (Lightning Network Daemon)** ao invés de **ICP Chain Key** para gerenciar as chaves dos pools DeFi!

### Por que LND é MELHOR que ICP para nosso caso?

| Aspecto | ICP Chain Key | LND (Lightning) | Vantagem |
|---------|---------------|-----------------|----------|
| **Custos** | Ciclos ICP ($$) | Grátis (local) | ✅ LND |
| **Velocidade** | Chamadas async cross-chain | Local instantâneo | ✅ LND |
| **Controle** | Threshold ECDSA remoto | Full control local | ✅ LND |
| **Bitcoin Native** | Bridge necessário | Nativo Bitcoin | ✅ LND |
| **Integração** | Complexa (ICP + BTC) | Já temos instalado! | ✅ LND |
| **Descentralização** | Depende de ICP subnet | Self-hosted | ✅ LND |

---

## 🔥 ARQUITETURA: LND COMO KEY MANAGER

### **Modelo Atual (sem LND):**
```
User PSBT (signed) 
    → Backend Policy Engine
        → Pool Signer (HD Wallet local)
            → Schnorr Signature
                → Broadcast
```

### **Modelo Proposto (com LND):**
```
User PSBT (signed)
    → Backend Policy Engine
        → LND gRPC (SignMessage/DeriveKey)
            → Schnorr Signature (Lightning native)
                → Broadcast
```

---

## 💡 COMO FUNCIONA

### **1. Derivação de Chaves via LND**

LND tem suporte nativo para derivação hierárquica (BIP32/BIP84) e pode gerar chaves Taproot!

```javascript
// server/defi/lndPoolSigner.js

import { LndClient } from '../lightning/lndClient.js';

/**
 * Derivar chave do pool usando LND
 * 
 * Path: m/86'/0'/0'/pool_index
 */
export async function derivePoolKeyViaLND(poolId) {
    const lnd = new LndClient();
    
    // Hash pool ID para obter índice
    const poolHash = crypto.createHash('sha256').update(poolId).digest();
    const poolIndex = poolHash.readUInt32LE(0) & 0x7FFFFFFF;
    
    // Derivar chave via LND
    const derivePath = `m/86'/0'/0'/${poolIndex}`;
    const response = await lnd.deriveKey({
        keyFamily: 6, // Custom key family for pools
        keyIndex: poolIndex
    });
    
    const pubkey = Buffer.from(response.raw_key_bytes);
    
    return {
        publicKey: pubkey,
        keyLocator: {
            keyFamily: 6,
            keyIndex: poolIndex
        }
    };
}
```

### **2. Assinatura Schnorr via LND**

LND suporta assinaturas Schnorr nativamente (usado no Lightning!)

```javascript
/**
 * Assinar PSBT input usando LND
 */
export async function signPoolInputViaLND(psbtBase64, poolId, inputIndex = 0) {
    const lnd = new LndClient();
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    
    // 1. Derivar chave do pool
    const poolKey = await derivePoolKeyViaLND(poolId);
    
    // 2. Obter sighash para assinar
    const input = psbt.data.inputs[inputIndex];
    const sighash = psbt.__CACHE.__TX.hashForWitnessV1(
        inputIndex,
        [input.witnessUtxo.script],
        [input.witnessUtxo.value],
        bitcoin.Transaction.SIGHASH_DEFAULT
    );
    
    // 3. Assinar com LND (Schnorr signature)
    const signResponse = await lnd.signMessage({
        msg: sighash,
        key_loc: poolKey.keyLocator,
        schnorr_sig: true,  // ✅ Schnorr nativo!
        tag: Buffer.from('TapTweak') // BIP341 tweak
    });
    
    const signature = Buffer.from(signResponse.signature, 'base64');
    
    // 4. Adicionar ao PSBT
    psbt.updateInput(inputIndex, {
        tapKeySig: signature
    });
    
    psbt.finalizeInput(inputIndex);
    
    return {
        psbtSigned: psbt.toBase64(),
        psbtHex: psbt.toHex()
    };
}
```

---

## 🚀 VANTAGENS ESPECÍFICAS

### **1. Lightning-Fast Swaps ⚡**

Com LND, podemos implementar **Instant Swaps** usando Lightning channels como escrow temporário!

```javascript
/**
 * SWAP INSTANTÂNEO via Lightning
 * 
 * Flow:
 * 1. User abre canal Lightning com pool
 * 2. Pool co-assina PSBT off-chain
 * 3. Broadcast apenas quando canal fecha
 * 4. Zero confirmations necessárias!
 */
export async function instantSwapViaLightning({
    poolId,
    userChannelId,
    btcAmount,
    runeAmountOut
}) {
    const lnd = new LndClient();
    
    // 1. Criar invoice Lightning para lock de fundos
    const invoice = await lnd.addInvoice({
        value_msat: btcAmount * 1000,
        memo: `Pool ${poolId} swap lock`,
        expiry: 300 // 5 min
    });
    
    // 2. User paga invoice (lock instantâneo)
    // ... aguardar pagamento
    
    // 3. Pool co-assina PSBT off-chain
    const signedPsbt = await signPoolInputViaLND(psbt, poolId);
    
    // 4. Retornar Rune instantaneamente (sem wait confirmations!)
    return {
        success: true,
        txid: 'pending',
        runeAmount: runeAmountOut,
        instant: true
    };
}
```

### **2. Multi-Sig Pools com LND**

LND suporta MuSig2 nativo! Podemos criar pools **multi-signature** para segurança extra:

```javascript
/**
 * Pool 2-de-3: Owner + Guardian + LND
 */
export async function createMultiSigPool(poolId) {
    const lnd = new LndClient();
    
    // Pubkeys dos signatários
    const ownerPubkey = process.env.OWNER_PUBKEY;
    const guardianPubkey = process.env.GUARDIAN_PUBKEY;
    const lndPoolKey = await derivePoolKeyViaLND(poolId);
    
    // Criar MuSig2 aggregate key
    const muSigSession = await lnd.muSig2CombineKeys({
        all_signer_pubkeys: [
            Buffer.from(ownerPubkey, 'hex'),
            Buffer.from(guardianPubkey, 'hex'),
            lndPoolKey.publicKey
        ],
        taproot_tweak: {
            key_spend_only: true
        }
    });
    
    const combinedPubkey = muSigSession.combined_key;
    const poolAddress = bitcoin.payments.p2tr({
        internalPubkey: combinedPubkey,
        network: bitcoin.networks.bitcoin
    }).address;
    
    return {
        poolAddress,
        requiredSigs: 2,
        signers: ['owner', 'guardian', 'lnd']
    };
}
```

### **3. Backup & Recovery Automático**

LND já tem sistema robusto de backup (SCB - Static Channel Backup):

```javascript
/**
 * Backup automático de pool keys
 */
export async function backupPoolKeys() {
    const lnd = new LndClient();
    
    // LND já mantém backup de TODAS as keys derivadas
    const channelBackup = await lnd.exportAllChannelBackups();
    
    // Salvar em múltiplos locais
    await Promise.all([
        fs.writeFile('./backups/lnd-pool-keys.dat', channelBackup.multi_chan_backup),
        uploadToS3(channelBackup), // Cloud backup
        sendToWebhook(channelBackup) // External service
    ]);
    
    console.log('✅ Pool keys backed up automatically');
}
```

---

## 🏗️ IMPLEMENTAÇÃO PRÁTICA

### **Passo 1: Verificar LND instalado**

```bash
# Você já tem LND instalado!
ls /Volumes/D2/KRAY\ WALLET-\ V1/lnd-darwin-arm64-v0.18.0-beta/

# Verificar se está rodando
lncli getinfo
```

### **Passo 2: Criar LND Pool Client**

```javascript
// server/lightning/lndPoolClient.js

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import fs from 'fs';

export class LNDPoolClient {
    constructor() {
        // Carregar macaroon e cert
        this.macaroon = fs.readFileSync(process.env.LND_MACAROON_PATH);
        this.cert = fs.readFileSync(process.env.LND_TLS_CERT_PATH);
        
        // Carregar proto definitions
        const packageDefinition = protoLoader.loadSync(
            'lnrpc/lightning.proto',
            { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
        );
        
        const lnrpc = grpc.loadPackageDefinition(packageDefinition).lnrpc;
        
        // Criar client
        const sslCreds = grpc.credentials.createSsl(this.cert);
        const macaroonCreds = grpc.credentials.createFromMetadataGenerator((args, callback) => {
            const metadata = new grpc.Metadata();
            metadata.add('macaroon', this.macaroon.toString('hex'));
            callback(null, metadata);
        });
        
        const credentials = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds);
        
        this.lightning = new lnrpc.Lightning(process.env.LND_HOST || 'localhost:10009', credentials);
    }
    
    /**
     * Derivar chave customizada
     */
    async deriveKey(keyFamily, keyIndex) {
        return new Promise((resolve, reject) => {
            this.lightning.DeriveKey({
                key_family: keyFamily,
                key_index: keyIndex
            }, (err, response) => {
                if (err) reject(err);
                else resolve(response);
            });
        });
    }
    
    /**
     * Assinar mensagem com Schnorr
     */
    async signMessageSchnorr(message, keyLocator) {
        return new Promise((resolve, reject) => {
            this.lightning.SignMessage({
                msg: message,
                key_loc: keyLocator,
                schnorr_sig: true
            }, (err, response) => {
                if (err) reject(err);
                else resolve(response);
            });
        });
    }
}
```

### **Passo 3: Atualizar poolSigner.js para usar LND**

```javascript
// server/defi/poolSigner.js

import { LNDPoolClient } from '../lightning/lndPoolClient.js';

const USE_LND = process.env.USE_LND_FOR_POOLS === 'true';

export async function signPoolInput(psbtBase64, poolId, poolInputIndex = 0) {
    if (USE_LND) {
        // 🔥 Usar LND para assinar!
        return signPoolInputViaLND(psbtBase64, poolId, poolInputIndex);
    } else {
        // Fallback: HD Wallet local
        return signPoolInputLocal(psbtBase64, poolId, poolInputIndex);
    }
}

async function signPoolInputViaLND(psbtBase64, poolId, poolInputIndex) {
    const lnd = new LNDPoolClient();
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    
    // ... (código de assinatura via LND)
}

function signPoolInputLocal(psbtBase64, poolId, poolInputIndex) {
    // ... (código atual HD wallet)
}
```

---

## 🎯 ROADMAP DE IMPLEMENTAÇÃO

### **Fase 1: Básico (Próxima Sprint)**
- [x] Ajustar fees (0.7% LP + 0.2% Protocol)
- [x] Aumentar price impact (50%)
- [ ] Criar LNDPoolClient
- [ ] Implementar deriveKeyViaLND()
- [ ] Implementar signMessageSchnorr()
- [ ] Testar com 1 pool real

### **Fase 2: Add/Remove Liquidity (2-3 semanas)**
- [ ] Implementar validateAddLiquidity()
- [ ] Implementar validateRemoveLiquidity()
- [ ] Cálculo de LP shares (√(x*y))
- [ ] UI para Add/Remove Liquidity
- [ ] LP earnings tracking

### **Fase 3: Lightning Integration (1 mês)**
- [ ] Instant swaps via Lightning channels
- [ ] Invoice-based escrow
- [ ] Channel liquidity management
- [ ] Multi-hop swaps (Rune → BTC → Lightning → BTC → Rune)

### **Fase 4: Advanced (2 meses)**
- [ ] MuSig2 multi-sig pools
- [ ] Liquidity locking (anti-rug pull)
- [ ] Fee extraction automation
- [ ] Donation feature
- [ ] Cross-pool routing

---

## 📊 COMPARAÇÃO: LND vs ICP vs HD Wallet

| Feature | HD Wallet (Atual) | ICP Chain Key | LND (Proposto) |
|---------|-------------------|---------------|----------------|
| **Custo** | Grátis | $$ ciclos ICP | Grátis |
| **Velocidade** | Rápido (local) | Lento (cross-chain) | Muito rápido (local) |
| **Segurança** | Boa | Excelente | Excelente |
| **Backup** | Manual | Automático (subnet) | Automático (SCB) |
| **Multi-sig** | Não | Threshold ECDSA | MuSig2 nativo |
| **Lightning** | Não | Não | ✅ Sim! |
| **Instant swaps** | Não | Não | ✅ Sim! |
| **Já instalado** | ✅ Sim | ❌ Não | ✅ Sim! |

---

## 🚨 CONSIDERAÇÕES IMPORTANTES

### **Segurança:**
- LND deve rodar em servidor seguro (não expor porta 10009 publicamente)
- Usar macaroon com permissões limitadas (somente signing, não admin)
- Backup SCB em múltiplos locais (S3, local, cold storage)

### **Performance:**
- LND é single-threaded (pode ser bottleneck com muitos pools)
- Considerar múltiplas instâncias LND para escalar
- Cache de pubkeys derivadas em Redis

### **Fallback:**
- Sempre manter HD Wallet como fallback
- Se LND cair, usar HD Wallet automaticamente
- Monitor de health check contínuo

---

## 🎉 CONCLUSÃO

**LND é a escolha PERFEITA para Kray Station DeFi!**

✅ **Vantagens:**
- Já temos instalado
- Zero custos extras
- Lightning-fast swaps possíveis
- Multi-sig nativo (MuSig2)
- Backup automático robusto
- Bitcoin-native (sem bridges)

⚠️ **Trade-offs:**
- Precisa rodar 24/7 (já está rodando)
- Configuração inicial necessária
- Monitoramento de health crítico

**Próximo passo:** Implementar `LNDPoolClient` e testar derivação de chaves!

---

**Data:** 03/11/2025  
**Versão:** 1.0.0  
**Status:** 🔄 **PROPOSTA - READY TO IMPLEMENT**

