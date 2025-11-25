# 🚨 VULNERABILIDADE CRÍTICA IDENTIFICADA: SIGHASH_NONE

## ❌ PROBLEMA

O uso de `SIGHASH_NONE|ANYONECANPAY` (0x82) em marketplace público é **INSEGURO**!

### Cenário de Ataque

1. Seller cria oferta com SIGHASH_NONE
2. Backend armazena PSBT assinado (sem criptografia)
3. Buyer malicioso busca PSBT
4. **Atacante vê assinatura do seller**
5. **Atacante constrói PSBT malicioso:**
   - Input 0: Inscription (com assinatura do seller)
   - Input 1: UTXO do atacante
   - Output 0: Inscription → Atacante ❌
   - Output 1: Payment → Atacante ❌
6. **Atacante faz broadcast direto via bitcoin-cli**
7. **Seller perde inscription SEM receber pagamento!**

### Por Que Funciona?

```
SIGHASH_NONE significa:
"Eu assino apenas o INPUT, não me importo com OUTPUTS"

Portanto:
- Assinatura do seller é válida para QUALQUER output
- Atacante pode mudar outputs à vontade
- Bitcoin aceita transação (assinatura válida!)
```

---

## ✅ SOLUÇÃO: USAR SIGHASH_SINGLE|ANYONECANPAY (0x83)

### Por Que É Seguro?

```
SIGHASH_SINGLE|ANYONECANPAY significa:
"Eu assino Input 0 + Output 0 correspondente"

Portanto:
- Seller assina Output 0 = "Inscription → bc1p..."
- Se atacante mudar Output 0, assinatura INVALIDA
- Bitcoin REJEITA transação!
```

### Fluxo Seguro

```javascript
// 1. Seller assina com SIGHASH_SINGLE
Input 0: Inscription
Output 0: Inscription → <endereço genérico>
Output 1: Payment → Seller (preço)

// 2. Backend EXTRAI e CRIPTOGRAFA assinatura
const { unsignedPsbt, encryptedSignature } = 
  extractAndEncryptSignature(signedPsbt);

// 3. Backend armazena:
psbt: <PSBT SEM assinatura>
encrypted_signature: <Assinatura criptografada RSA+AES>

// 4. Buyer NÃO vê assinatura do seller!

// 5. Backend descriptografa apenas no broadcast
```

---

## 🔧 AÇÃO NECESSÁRIA

### 1. Reverter para SIGHASH_SINGLE

**Arquivo:** `server/utils/psbtBuilder.js`

```javascript
// MUDAR DE:
const sighashType = bitcoin.Transaction.SIGHASH_NONE | 
                    bitcoin.Transaction.SIGHASH_ANYONECANPAY; // 0x82

// PARA:
const sighashType = bitcoin.Transaction.SIGHASH_SINGLE | 
                    bitcoin.Transaction.SIGHASH_ANYONECANPAY; // 0x83
```

### 2. Adicionar Outputs no Seller PSBT

```javascript
// Adicionar outputs:
psbt.addOutput({
  address: 'bc1p...', // Endereço genérico qualquer
  value: inscriptionValue
});

psbt.addOutput({
  address: sellerAddress,
  value: price
});
```

### 3. Usar Sistema de Assinatura Criptografada

**Arquivo:** `server/routes/offers.js`

```javascript
// SEMPRE usar criptografia:
const { unsignedPsbt, encryptedSignature, encryptedKey } = 
  await extractAndEncryptSignature(psbt);

// Armazenar:
psbt: unsignedPsbt,  // ✅ SEM assinatura
encrypted_signature: encryptedSignature,  // 🔐 Criptografada
encrypted_key: encryptedKey
```

### 4. Remover Suporte a SIGHASH_NONE no Broadcast

**Arquivo:** `server/routes/psbt.js`

```javascript
// REMOVER:
if (offer.sighash_type === 0x82) {
  completePsbtBase64 = buyerPsbtBase64;  // ❌ VULNERÁVEL!
}

// MANTER APENAS:
if (!offer.encrypted_signature) {
  return res.status(400).json({ error: 'Invalid offer' });
}

completePsbtBase64 = await decryptAndAddSignature(
  buyerPsbtBase64,
  offer.encrypted_signature,
  offer.encrypted_key
);
```

---

## 🎯 RESUMO

| SIGHASH Type | Segurança | Uso |
|--------------|-----------|-----|
| NONE (0x82) | ❌ INSEGURO | Apenas trocas privadas com confiança |
| SINGLE (0x83) | ✅ SEGURO | Marketplace público |

**RECOMENDAÇÃO:** Usar **SEMPRE** SIGHASH_SINGLE com encrypted signature!

---

## 📞 PRIORIDADE: CRÍTICA 🚨

Esta vulnerabilidade permite que atacantes roubem inscriptions!

**Ação imediata necessária:**
1. Reverter para SIGHASH_SINGLE
2. Testar fluxo completo
3. Validar segurança

