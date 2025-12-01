# 🔐 Implementação de Assinaturas - Plano Completo

## ✅ CORREÇÃO 1: Usar L1 Address como Identidade

### **ANTES (Confuso):**
```
L2 Account ID: kray_abc123def456...
User vê: "kray_abc123..."
Problema: Ninguém reconhece esse ID
```

### **DEPOIS (Correto):**
```
L2 Account ID: Internamente usa kray_abc123... (hash)
User vê: bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag
Benefício: Todo mundo reconhece esse address!
```

### **Mudanças:**

```javascript
// UI sempre mostra L1 address:
Dashboard: bc1pggclc... (não kray_abc...)
Extension: bc1pggclc... (seu address conhecido)
Transfers: "Send to bc1p..." (não kray_)

// Mas internamente:
Database: kray_abc123... (hash do L1 address)
API: Aceita ambos (L1 address OU account_id)
```

---

## 🔐 IMPLEMENTAÇÃO DE ASSINATURAS

### **Arquivo 1: extension-prod/popup/krayL2.js**

Adicionar função de assinatura:

```javascript
/**
 * Sign L2 transaction with user's private key
 */
async function signL2Transaction(messageData) {
  try {
    // Create message to sign
    const message = [
      messageData.from,
      messageData.to,
      messageData.amount.toString(),
      messageData.nonce.toString(),
      messageData.type
    ].join(':');
    
    console.log('🔐 Signing L2 transaction...');
    console.log('   Message:', message);
    
    // Request signature from background (has private key)
    const result = await chrome.runtime.sendMessage({
      action: 'signL2Message',
      message: message
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Signature failed');
    }
    
    console.log('✅ Signature obtained');
    return result.signature;
    
  } catch (error) {
    console.error('❌ Error signing:', error);
    throw error;
  }
}

// Update executeTransfer to use real signature:
async function executeTransfer() {
  // ... (código existente)
  
  const credits = Math.floor(amount * 1000);
  
  // Get nonce from API
  const nonceResponse = await fetch(`${L2_API_URL}/api/account/${l2Account}/balance`);
  const accountData = await nonceResponse.json();
  const nonce = accountData.nonce;
  
  // SIGN TRANSACTION (NEW!)
  const signature = await signL2Transaction({
    from: l2Account,
    to: recipient,
    amount: credits,
    nonce: nonce,
    type: 'transfer'
  });
  
  // Send with REAL signature
  const response = await fetch(`${L2_API_URL}/api/transaction/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_account: l2Account,
      to_account: recipient,
      amount: credits.toString(),
      signature: signature, // ✅ REAL!
      nonce: nonce,
      tx_type: 'transfer'
    })
  });
  
  // ... (resto do código)
}
```

---

### **Arquivo 2: extension-prod/background/background-real.js**

Adicionar handler de assinatura:

```javascript
// No handleMessage(), adicionar:

case 'signL2Message':
  try {
    const { message } = request;
    
    console.log('🔐 Signing L2 message...');
    
    // Get unlocked wallet
    if (!unlockedWallet || !unlockedWallet.childNode) {
      return sendResponse({
        success: false,
        error: 'Wallet is locked'
      });
    }
    
    // Hash message
    const messageHash = createHash('sha256').update(message).digest();
    
    // Sign with Schnorr (Taproot)
    const signature = unlockedWallet.childNode.signSchnorr(messageHash);
    
    console.log('✅ L2 message signed');
    
    sendResponse({
      success: true,
      signature: signature.toString('hex'),
      pubkey: unlockedWallet.childNode.publicKey.toString('hex')
    });
    
  } catch (error) {
    console.error('❌ Error signing L2 message:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
  return true; // Async response
```

---

### **Arquivo 3: kray-l2/state/accountManager.js**

Salvar pubkey ao criar conta:

```javascript
// Modificar createAccount para aceitar pubkey:

export function createAccount(l1Address, publicKey = null) {
  // ... código existente ...
  
  // IMPORTANTE: Salvar pubkey!
  const stmt = db.prepare(`
    INSERT INTO l2_accounts (
      account_id, l1_address, pubkey,
      balance_credits, staked_credits, locked_credits,
      nonce, created_at, updated_at, last_activity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    accountId,
    l1Address,
    publicKey,  // ✅ Salva pubkey
    '0', '0', '0', 0,
    timestamp, timestamp, timestamp
  );
  
  // ... resto
}
```

---

## 🎯 RESUMINDO:

### **SÃO 2 ASSINATURAS DIFERENTES:**

#### **Assinatura 1: Transações L2** (OPÇÃO 2)

```
Quem assina: USER (você, cada pessoa)
O quê: Transfers, swaps, trades na L2
Com qual chave: Chave privada da WALLET do user
Onde: Extension (popup) → Background
Quando: Toda operação na L2
Status: ❌ NÃO implementado (fake agora)
```

#### **Assinatura 2: PSBT Withdrawal** (JÁ implementado!)

```
Quem assina: VALIDATORS (você, os 3)
O quê: PSBT para mover KRAY do multisig
Com qual chave: 3 mnemonics dos validators
Onde: Backend L2 (servidor)
Quando: Após 24h challenge period
Status: ✅ JÁ implementado!
```

---

## 💡 OPÇÃO 2 Implementa:

**Assinatura TIPO 1 (User)** - Para segurança das contas L2

**NÃO mexe em withdrawal** (isso já funciona!)

---

## 🎯 O Que Vai Mudar:

### **ANTES (Inseguro):**
```javascript
// Qualquer um pode tentar:
POST /api/transaction/send
{
  from: "kray_abc123",
  to: "kray_atacante",
  amount: "999999",
  signature: "0000..." // Fake, mas aceita!
}
```

### **DEPOIS (Seguro):**
```javascript
// Só owner da conta pode:
POST /api/transaction/send
{
  from: "kray_abc123",
  to: "kray_xyz789",
  amount: "5000",
  signature: "a1b2c3..." // Real, verificado!
}

// L2 verifica:
const pubkey = getFromAccount(from); // Pubkey do owner
const isValid = verifySchnorr(message, pubkey, signature);

if (!isValid) {
  reject(); // ❌ Signature inválida
}
```

---

## ✅ CONFIRMADO:

**Withdrawal continua automático!**
- Validators assinam PSBT (já funciona)
- User SÓ pede e espera 24h
- Sistema processa sozinho

**Transações L2 ficam seguras!**
- User precisa assinar cada TX
- Proteção contra roubo de credits
- Sistema completo!

---

**Quer que eu implemente OPÇÃO 2 agora?** 🔐

**Tempo:** 2-3 horas  
**Benefício:** Segurança 100% 

**Vamos fazer?** 🚀



