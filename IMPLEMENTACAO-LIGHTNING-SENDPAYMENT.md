# ⚡ IMPLEMENTAÇÃO sendPayment() PARA LIGHTNING

## 🎯 OBJETIVO:

Implementar `window.krayWallet.sendPayment(invoice)` para pagar invoices Lightning de forma segura.

## 📋 REQUISITOS:

1. Parse bolt11 invoice
2. Mostrar modal de confirmação ao usuário
3. Integrar com LND REST API
4. Retornar preimage após pagamento bem-sucedido

## 🔧 ARQUITETURA:

```
Frontend (injected.js)
  ↓
  sendMessage('sendPayment', { invoice })
  ↓
background-real.js
  ↓
  1. Parse invoice (bolt11.decode)
  2. Abrir popup de confirmação
  3. User confirma + senha
  4. Chamar LND REST API
  5. Retornar preimage
```

## 📝 STEPS:

### 1. Adicionar ação 'sendPayment' no background-real.js

```javascript
case 'sendPayment':
    return await sendPayment(data);
```

### 2. Implementar função sendPayment()

```javascript
async function sendPayment({ invoice }) {
    console.log('⚡ ===== SEND LIGHTNING PAYMENT =====');
    console.log('  Invoice:', invoice.substring(0, 50) + '...');
    
    // Parse invoice (usando biblioteca bolt11 ou chamar backend)
    const decoded = await decodeInvoice(invoice);
    
    // Guardar pending payment request
    pendingPaymentRequest = {
        invoice,
        decoded,
        timestamp: Date.now()
    };
    
    await chrome.storage.local.set({ pendingPaymentRequest });
    
    // Abrir popup para confirmação
    await chrome.action.openPopup();
    
    // Aguardar confirmação do usuário
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingPaymentRequest = null;
            reject(new Error('Payment timeout'));
        }, 120000);
        
        const listener = (changes, namespace) => {
            if (namespace === 'local' && changes.paymentResult) {
                clearTimeout(timeout);
                chrome.storage.onChanged.removeListener(listener);
                
                const result = changes.paymentResult.newValue;
                pendingPaymentRequest = null;
                
                if (result.success) {
                    resolve(result);
                } else {
                    reject(new Error(result.error));
                }
            }
        };
        
        chrome.storage.onChanged.addListener(listener);
    });
}
```

### 3. Criar modal de confirmação no popup

```javascript
// popup.js
async function confirmLightningPayment(password) {
    const { pendingPaymentRequest } = await chrome.storage.local.get(['pendingPaymentRequest']);
    
    if (!pendingPaymentRequest) {
        throw new Error('No pending payment');
    }
    
    const { invoice, decoded } = pendingPaymentRequest;
    
    // Chamar LND REST API (ou backend que faz proxy)
    const response = await fetch('http://localhost:3000/api/lightning/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            invoice,
            password  // Para descriptografar macaroon se necessário
        })
    });
    
    const result = await response.json();
    
    // Salvar resultado
    await chrome.storage.local.set({
        paymentResult: result
    });
    
    return result;
}
```

### 4. Backend endpoint /api/lightning/pay

```javascript
// server/routes/lightningPay.js
router.post('/pay', async (req, res) => {
    try {
        const { invoice } = req.body;
        
        // Decode invoice
        const decoded = bolt11.decode(invoice);
        
        // Pagar via LND
        const response = await lndClient.sendPaymentSync({
            payment_request: invoice,
            timeout_seconds: 60
        });
        
        if (response.payment_error) {
            throw new Error(response.payment_error);
        }
        
        res.json({
            success: true,
            preimage: response.payment_preimage.toString('hex'),
            paymentHash: decoded.tagsObject.payment_hash,
            amountSats: decoded.satoshis
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

## ✅ RESULTADO ESPERADO:

```javascript
// Frontend:
const result = await window.krayWallet.sendPayment(invoice);

// result:
{
    success: true,
    preimage: "abc123...",
    paymentHash: "xyz789...",
    amountSats: 1000
}
```

