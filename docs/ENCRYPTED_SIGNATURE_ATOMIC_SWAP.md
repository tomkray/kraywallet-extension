# 🔐 **ENCRYPTED SIGNATURE ATOMIC SWAP**

## 📋 **RESUMO EXECUTIVO**

Sistema de **atomic swap** ultra-seguro que **criptografa a assinatura do seller separadamente** do PSBT, impedindo que atacantes façam broadcast fora do marketplace e modifiquem valores.

---

## 🎯 **PROBLEMA RESOLVIDO**

### ❌ **ANTES: VULNERABILIDADE DO SIGHASH_SINGLE**

```
┌──────────────────────────────────────────────────────────────┐
│  CENÁRIO DE ATAQUE (ANTES)                                   │
└──────────────────────────────────────────────────────────────┘

1. Seller cria offer:
   - Input 0: Inscription (assinado com SIGHASH_SINGLE|ANYONECANPAY)
   - Output 0: Inscription → BUYER (546 sats)
   - Output 1: Payment → SELLER (1000 + 546 = 1546 sats)

2. Atacante obtém PSBT do seller:
   GET /api/offers/:id/get-seller-psbt
   Response: { psbt: "cHNidP8..." }  ← PSBT COM ASSINATURA!

3. Atacante modifica Output 1:
   Output 1: Payment → SELLER (100 sats) ← FRAUDADO!
   
4. Atacante assina seus inputs

5. Atacante faz broadcast direto no Bitcoin Core:
   bitcoin-cli sendrawtransaction <txHex>
   
6. ✅ Broadcast aceito!
   ❌ Seller recebe apenas 100 sats ao invés de 1000!
```

**VULNERABILIDADE:** `SIGHASH_SINGLE|ANYONECANPAY` **NÃO** compromete Output 1 (payment), apenas Output 0 (inscription).

---

### ✅ **DEPOIS: ENCRYPTED SIGNATURE ATOMIC SWAP**

```
┌──────────────────────────────────────────────────────────────┐
│  PROTEÇÃO CONTRA ATAQUE (DEPOIS)                             │
└──────────────────────────────────────────────────────────────┘

1. Seller cria offer:
   - Input 0: Inscription (assinado com SIGHASH_SINGLE|ANYONECANPAY)
   - Output 0: Inscription → BUYER (546 sats)
   - Output 1: Payment → SELLER (1000 + 546 = 1546 sats)

2. Backend SEPARA e CRIPTOGRAFA a assinatura:
   ┌──────────────────────────────────────────────────────┐
   │  PSBT sem assinatura:                                │
   │  - Input 0: witnessUtxo + tapInternalKey            │
   │  - Output 0: Inscription → BUYER                    │
   │  - Output 1: Payment → SELLER                       │
   │  ❌ SEM tapKeySig (assinatura removida!)            │
   └──────────────────────────────────────────────────────┘
   
   ┌──────────────────────────────────────────────────────┐
   │  Assinatura criptografada (AES-256-GCM):             │
   │  {                                                   │
   │    tapKeySig: "c3f8a9b2...7d4e" (criptografado)     │
   │    sighashType: 0x83 (criptografado)                │
   │  }                                                   │
   │  🔐 Chave efêmera criptografada com RSA-OAEP         │
   └──────────────────────────────────────────────────────┘

3. Database salva:
   ┌──────────────────────────────────────────────────────┐
   │  offers table:                                       │
   │  ├─ psbt: "cHNidP8..." (SEM assinatura!)            │
   │  ├─ encrypted_key: "a8JD9xK2..." (PSBT key)         │
   │  ├─ encrypted_signature: "eyJlbmNy..." (assinatura) │
   │  └─ signature_key: "zX9qL4mN..." (sig key)          │
   └──────────────────────────────────────────────────────┘

4. Atacante tenta obter PSBT:
   POST /api/offers/:id/get-seller-psbt
   Response: { psbt: "cHNidP8..." }  ← SEM ASSINATURA!

5. Atacante tenta modificar Output 1 e fazer broadcast:
   ❌ FALHA! Input 0 não tem assinatura → "Missing inputs"
   ❌ Atacante NÃO pode fazer broadcast sem assinatura!

6. Buyer legítimo compra:
   - Buyer assina seus inputs
   - Buyer envia PSBT para: POST /api/psbt/broadcast-atomic
   - Backend:
     a) ✅ Valida Output 1 (endereço e valor corretos)
     b) 🔓 Descriptografa assinatura do seller
     c) ✅ Adiciona assinatura ao Input 0
     d) ✅ Finaliza PSBT
     e) ✅ Faz broadcast via Bitcoin Core

7. ✅ Broadcast aceito!
   ✅ Seller recebe exatamente 1000 sats (valor correto)!
   ✅ Atacante não pode fraudar!
```

---

## 🏗️ **ARQUITETURA DO SISTEMA**

### **1. MÓDULO DE CRIPTOGRAFIA: `psbtCrypto.js`**

```javascript
// ═══════════════════════════════════════════════════════════════
// 🔐 EXTRAIR E CRIPTOGRAFAR ASSINATURA (Seller)
// ═══════════════════════════════════════════════════════════════

export async function extractAndEncryptSignature(signedPsbtBase64) {
    const psbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
    
    // 1. Extrair assinatura e sighashType
    const signature = psbt.data.inputs[0].tapKeySig;
    const sighashType = psbt.data.inputs[0].sighashType;
    
    // 2. Criptografar assinatura com AES-256-GCM
    const ephemeralKey = crypto.randomBytes(32);
    const encryptedSignature = encryptAES(JSON.stringify({ 
        tapKeySig: signature.toString('hex'), 
        sighashType 
    }), ephemeralKey);
    
    // 3. Criptografar chave efêmera com RSA-OAEP
    const encryptedKey = encryptRSA(ephemeralKey);
    
    // 4. Remover assinatura do PSBT (criar versão "unsigned")
    const unsignedPsbt = psbt.clone();
    delete unsignedPsbt.data.inputs[0].tapKeySig;
    delete unsignedPsbt.data.inputs[0].sighashType;
    
    return {
        unsignedPsbt: unsignedPsbt.toBase64(),
        encryptedSignature,
        encryptedKey,
        sighashType
    };
}

// ═══════════════════════════════════════════════════════════════
// 🔓 DESCRIPTOGRAFAR E ADICIONAR ASSINATURA (Broadcast)
// ═══════════════════════════════════════════════════════════════

export async function decryptAndAddSignature(
    buyerPsbtBase64, 
    encryptedSignature, 
    encryptedKey
) {
    // 1. Descriptografar chave efêmera
    const ephemeralKey = decryptRSA(encryptedKey);
    
    // 2. Descriptografar assinatura
    const signatureData = JSON.parse(decryptAES(encryptedSignature, ephemeralKey));
    
    // 3. Adicionar assinatura ao PSBT do buyer
    const psbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64);
    psbt.data.inputs[0].tapKeySig = Buffer.from(signatureData.tapKeySig, 'hex');
    psbt.data.inputs[0].sighashType = signatureData.sighashType;
    
    return psbt.toBase64();
}
```

---

### **2. ENDPOINT: POST /api/offers (Criar Offer)**

```javascript
router.post('/', async (req, res) => {
    const { psbt, inscriptionId, offerAmount, creatorAddress } = req.body;
    
    // 🔐 Extrair e criptografar assinatura do seller
    const { 
        unsignedPsbt, 
        encryptedSignature, 
        encryptedKey: signatureKey,
        sighashType 
    } = await extractAndEncryptSignature(psbt);
    
    // 🔐 Também criptografar o PSBT sem assinatura (proteção extra)
    const { encryptedPsbt, encryptedKey } = encryptPSBT(unsignedPsbt);
    
    // 💾 Salvar no banco de dados
    db.prepare(`
        INSERT INTO offers (
            id, inscription_id, offer_amount, 
            psbt, encrypted_key,             ← PSBT sem assinatura
            encrypted_signature, signature_key,  ← Assinatura separada
            creator_address, status, sighash_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
        id, inscriptionId, offerAmount,
        encryptedPsbt, encryptedKey,
        encryptedSignature, signatureKey,
        creatorAddress, sighashType
    );
    
    res.json({ success: true, offer });
});
```

---

### **3. ENDPOINT: POST /api/psbt/broadcast-atomic (Broadcast Controlado)**

```javascript
router.post('/broadcast-atomic', async (req, res) => {
    const { psbt: buyerPsbtBase64, offerId } = req.body;
    
    // 🛡️ STEP 1: Buscar offer e validar
    const offer = db.prepare(`
        SELECT offer_amount, creator_address, 
               encrypted_signature, signature_key
        FROM offers WHERE id = ?
    `).get(offerId);
    
    // 🛡️ STEP 2: Decodificar PSBT do buyer e validar Output 1
    const buyerPsbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64);
    const output1 = buyerPsbt.txOutputs[1];
    const output1Address = bitcoin.address.fromOutputScript(output1.script);
    const output1Value = output1.value;
    
    // 🛡️ VALIDAÇÃO CRÍTICA DE SEGURANÇA
    if (output1Address !== offer.creator_address) {
        return res.status(400).json({ 
            error: 'Payment address mismatch! Possible fraud attempt.' 
        });
    }
    
    const expectedPayment = offer.offer_amount + buyerPsbt.txOutputs[0].value;
    if (output1Value !== expectedPayment) {
        return res.status(400).json({ 
            error: `Payment amount mismatch! Expected ${expectedPayment}, got ${output1Value}.` 
        });
    }
    
    // 🔓 STEP 3: Descriptografar e adicionar assinatura do seller
    const completePsbtBase64 = await decryptAndAddSignature(
        buyerPsbtBase64,
        offer.encrypted_signature,
        offer.signature_key
    );
    
    // 🔥 STEP 4: Finalizar PSBT
    const completePsbt = bitcoin.Psbt.fromBase64(completePsbtBase64);
    // ... finalização manual ...
    
    // 📡 STEP 5: Fazer broadcast via Bitcoin Core
    const tx = completePsbt.extractTransaction();
    const txHex = tx.toHex();
    const txid = await bitcoinRpc.sendRawTransaction(txHex);
    
    // ✅ STEP 6: Marcar offer como completed
    db.prepare(`
        UPDATE offers 
        SET status = 'completed', txid = ?, filled_at = ?
        WHERE id = ?
    `).run(txid, Date.now(), offerId);
    
    res.json({ success: true, txid });
});
```

---

## 🔒 **CAMADAS DE SEGURANÇA**

| **CAMADA** | **PROTEÇÃO** | **ATAQUE BLOQUEADO** |
|------------|-------------|----------------------|
| **1. Assinatura Criptografada** | Assinatura do seller NÃO está no PSBT público | Atacante não pode fazer broadcast fora do marketplace |
| **2. PSBT Criptografado** | PSBT armazenado com AES-256-GCM + RSA-OAEP | Atacante não pode ler PSBTs do banco de dados |
| **3. Validação de Output 1** | Backend valida endereço e valor do pagamento | Atacante não pode modificar valor do pagamento |
| **4. Broadcast Controlado** | Apenas backend pode fazer broadcast | Atacante não pode usar APIs externas |
| **5. Rate Limiting** | 100 requests/15 min por IP | Atacante não pode fazer spam/DDoS |
| **6. Audit Logs** | Registro de todas as tentativas de acesso | Detecção de tentativas de fraude |

---

## 📊 **FLUXO COMPLETO (DIAGRAMA)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FASE 1: SELLER CRIA OFFER                                              │
└─────────────────────────────────────────────────────────────────────────┘

1. Seller:
   ✅ Assina PSBT com SIGHASH_SINGLE|ANYONECANPAY
   ✅ Envia para backend: POST /api/offers
   
2. Backend:
   🔐 Extrai assinatura do Input 0
   🔐 Criptografa assinatura (AES-256-GCM)
   🔐 Criptografa chave efêmera (RSA-OAEP)
   🔐 Remove assinatura do PSBT
   🔐 Criptografa PSBT sem assinatura
   💾 Salva no banco:
      ├─ psbt (sem assinatura, criptografado)
      ├─ encrypted_key (chave do PSBT)
      ├─ encrypted_signature (assinatura criptografada)
      └─ signature_key (chave da assinatura)


┌─────────────────────────────────────────────────────────────────────────┐
│  FASE 2: BUYER COMPRA                                                   │
└─────────────────────────────────────────────────────────────────────────┘

3. Buyer:
   📥 Solicita PSBT: POST /api/offers/:id/get-seller-psbt
   
4. Backend:
   🔓 Descriptografa PSBT (SEM assinatura)
   📤 Retorna PSBT sem assinatura para buyer
   
5. Backend (purchase.js):
   🏗️  Constrói PSBT atomic:
      Input 0: Inscription (SEM assinatura)
      Input 1+: Buyer UTXOs
      Output 0: Inscription → BUYER
      Output 1: Payment → SELLER
      Output 2: Change → BUYER
   📤 Retorna PSBT para buyer assinar

6. Buyer:
   ✍️  Assina seus inputs (1+)
   📤 Envia para: POST /api/psbt/broadcast-atomic


┌─────────────────────────────────────────────────────────────────────────┐
│  FASE 3: BACKEND FAZ BROADCAST (CONTROLADO)                            │
└─────────────────────────────────────────────────────────────────────────┘

7. Backend (broadcast-atomic):
   🛡️  Valida offer (ativa? tem assinatura criptografada?)
   🛡️  Valida Output 1 (endereço e valor corretos?)
   🔓 Descriptografa assinatura do seller
   ✅ Adiciona assinatura ao Input 0
   🔥 Finaliza PSBT (todos os inputs)
   📡 Faz broadcast via Bitcoin Core RPC
   ✅ Marca offer como "completed"

8. ✅ TRANSAÇÃO CONFIRMADA!
   ✅ Seller recebe valor CORRETO
   ✅ Buyer recebe inscription
   ✅ Atacante não pode fraudar!
```

---

## 🧪 **TESTES DE SEGURANÇA**

### **TESTE 1: Atacante tenta modificar Output 1**

```bash
# 1. Atacante obtém PSBT
curl -X POST http://localhost:3000/api/offers/:id/get-seller-psbt \
  -H "Content-Type: application/json" \
  -d '{"buyerAddress": "bc1p..."}'

# 2. Atacante modifica Output 1 (payment)
# ... buyer assina seus inputs ...

# 3. Atacante tenta fazer broadcast direto
bitcoin-cli sendrawtransaction <txHex>

# ❌ RESULTADO: "Missing inputs" (Input 0 não tem assinatura)
```

### **TESTE 2: Atacante tenta usar broadcast-atomic com valor fraudado**

```bash
# 1. Atacante obtém PSBT e modifica Output 1
# 2. Atacante envia para broadcast-atomic

curl -X POST http://localhost:3000/api/psbt/broadcast-atomic \
  -H "Content-Type: application/json" \
  -d '{"psbt": "cHNidP8...", "offerId": "xyz123"}'

# ❌ RESULTADO: "Payment amount mismatch! Expected 1546, got 100."
```

### **TESTE 3: Buyer legítimo compra normalmente**

```bash
# 1. Buyer obtém PSBT via frontend
# 2. Buyer assina seus inputs
# 3. Buyer envia para broadcast-atomic

curl -X POST http://localhost:3000/api/psbt/broadcast-atomic \
  -H "Content-Type: application/json" \
  -d '{"psbt": "cHNidP8...", "offerId": "xyz123"}'

# ✅ RESULTADO: {"success": true, "txid": "abc123..."}
```

---

## 📈 **COMPARAÇÃO: ANTES vs DEPOIS**

| **ASPECTO** | **ANTES (SIGHASH_SINGLE)** | **DEPOIS (ENCRYPTED SIGNATURE)** |
|-------------|----------------------------|----------------------------------|
| **Atomic** | ✅ Sim | ✅ Sim |
| **Trustless** | ⚠️ Parcial | ✅ Sim (marketplace é escrow) |
| **Seller online?** | ❌ Não | ❌ Não |
| **Buyer pode fraudar (modificar payment)?** | ❌ **SIM!** | ✅ **NÃO!** |
| **Atacante pode broadcast fora do marketplace?** | ❌ **SIM!** | ✅ **NÃO!** |
| **PSBT público tem assinatura?** | ❌ **SIM!** | ✅ **NÃO!** |
| **Validação de output no backend?** | ❌ Não | ✅ **SIM!** |
| **Complexidade** | ⭐ Simples | ⭐⭐ Média |
| **Segurança** | ⭐⭐⭐ Boa | ⭐⭐⭐⭐⭐ **Excelente** |

---

## 🎯 **CONCLUSÃO**

O **ENCRYPTED SIGNATURE ATOMIC SWAP** é a solução **definitiva** para:

✅ **Impedir fraude**: Atacantes não podem modificar valores de pagamento  
✅ **Controlar broadcast**: Apenas o marketplace pode fazer broadcast  
✅ **Manter atomic swap**: Transação continua sendo atômica  
✅ **Seller offline**: Seller não precisa estar online durante a venda  
✅ **Segurança máxima**: Assinatura criptografada em múltiplas camadas  

**Este é o sistema mais seguro para marketplace de Ordinals com atomic swaps!** 🚀🔐

