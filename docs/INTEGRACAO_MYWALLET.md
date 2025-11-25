# 🔌 Integração MyWallet no Marketplace

## 🎯 Como integrar MyWallet no seu marketplace AGORA

---

## Opção 1: Substituir Unisat (Mais Simples) ⭐

### 1. Incluir MyWallet no HTML:

**Adicionar em `index.html`:**
```html
<!-- Antes do fechamento do </body> -->
<script type="module">
  import { initializeWallet } from './mywallet/marketplace-integration.js';
  initializeWallet();
  console.log('✅ MyWallet disponível em window.myWallet');
</script>
```

### 2. Substituir chamadas Unisat:

**No `app.js`, trocar:**
```javascript
// ANTES:
const accounts = await window.unisat.requestAccounts();

// DEPOIS:
const accounts = await window.myWallet.connect();
```

```javascript
// ANTES:
const signedPsbt = await window.unisat.signPsbt(psbt, {
    autoFinalized: false
});

// DEPOIS:
const signedPsbt = await window.myWallet.signPsbt(psbt, {
    sighashType: 'SINGLE|ANYONECANPAY', // ⭐ ISTO RESOLVE O PROBLEMA!
    autoFinalized: false
});
```

### 3. Testar:

1. Abra `http://localhost:3000`
2. Clique "Connect Wallet"
3. Crie uma nova wallet ou restaure
4. Teste criar listing e comprar!

---

## Opção 2: Usar Ambas (Fallback)

### Tentar MyWallet primeiro, fallback para Unisat:

```javascript
async function connectWallet() {
    try {
        // Tentar MyWallet primeiro
        if (window.myWallet) {
            const accounts = await window.myWallet.connect();
            console.log('✅ Conectado com MyWallet');
            return accounts;
        }
    } catch (error) {
        console.log('MyWallet não disponível, usando Unisat...');
    }

    // Fallback: Unisat
    if (window.unisat) {
        const accounts = await window.unisat.requestAccounts();
        console.log('✅ Conectado com Unisat');
        return accounts;
    }

    throw new Error('Nenhuma wallet encontrada!');
}
```

---

## 📝 Mudanças Necessárias no `app.js`:

### 1. Função `connectWallet()`:
```javascript
async function connectWallet() {
    if (!window.myWallet) {
        showNotification('❌ MyWallet not found!', 'error');
        return;
    }

    try {
        const accounts = await window.myWallet.connect();
        connectedAddress = accounts[0];
        isWalletConnected = true;

        document.getElementById('walletAddress').textContent = 
            connectedAddress.slice(0, 8) + '...' + connectedAddress.slice(-6);
        document.getElementById('connectBtn').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';

        showNotification('✅ Wallet connected!', 'success');

        await loadOrdinals();
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showNotification('❌ Failed to connect wallet', 'error');
    }
}
```

### 2. Função `createOffer()` (VENDEDOR):
```javascript
async function createOffer() {
    // ... código existente ...

    try {
        // Criar PSBT no backend
        const psbtResponse = await apiRequest('/sell/create-custom-psbt', {
            method: 'POST',
            body: JSON.stringify({
                inscriptionId,
                inscriptionUtxo: {
                    txid: inscription.utxo?.txid || txid,
                    vout: inscription.utxo?.vout || vout,
                    value: inscription.utxo?.satoshi || 546,
                    address: inscription.address || connectedAddress
                },
                price: parseInt(offerAmount),
                sellerAddress: connectedAddress,
                feeRate: parseInt(feeRate)
            })
        });

        // ⭐ ASSINAR COM MYWALLET (SIGHASH_SINGLE|ANYONECANPAY)
        showNotification('🔏 Signing with MyWallet...', 'info');
        
        const sellerPsbtSigned = await window.myWallet.signPsbt(psbtResponse.psbt, {
            sighashType: 'SINGLE|ANYONECANPAY', // 🔥 ISTO RESOLVE O PROBLEMA!
            autoFinalized: false
        });

        console.log('✅ PSBT signed with SIGHASH_SINGLE|ANYONECANPAY');

        // Salvar oferta
        await apiRequest('/offers', {
            method: 'POST',
            body: JSON.stringify({
                type: 'inscription',
                inscriptionId,
                offerAmount: parseInt(offerAmount),
                feeRate: parseInt(feeRate),
                psbt: sellerPsbtSigned,
                creatorAddress: connectedAddress,
                expiresIn: 86400000,
                sighashType: "SINGLE|ANYONECANPAY"
            })
        });

        showNotification('✅ Offer created successfully!', 'success');
    } catch (error) {
        console.error('Error creating offer:', error);
        showNotification('❌ Failed to create offer', 'error');
    }
}
```

### 3. Função `buyNow()` (COMPRADOR):
```javascript
async function buyNow(inscriptionId) {
    // ... código existente ...

    // Criar PSBT atômico
    const atomicPsbtResponse = await apiRequest('/purchase/build-atomic-psbt', {
        method: 'POST',
        body: JSON.stringify({
            sellerPsbt: offer.psbt,
            buyerAddress: connectedAddress,
            buyerUtxos: selectedUtxos,
            paymentAmount: offer.offer_amount,
            feeRate: selectedFeeRate,
            estimatedFee
        })
    });

    // ⭐ COMPRADOR ASSINA COM MYWALLET
    const buyerPublicKey = await window.myWallet.getPublicKey();

    const toSignInputs = [];
    for (let i = 1; i < atomicPsbtResponse.details.totalInputs; i++) {
        toSignInputs.push({
            index: i,
            publicKey: buyerPublicKey
        });
    }

    showNotification('🔏 Signing with MyWallet...', 'info');

    const signedPsbt = await window.myWallet.signPsbt(atomicPsbtResponse.psbt, {
        toSignInputs,
        autoFinalized: false
    });

    console.log('✅ PSBT signed by buyer');

    // Finalizar e broadcast
    const finalizeResponse = await apiRequest('/psbt/finalize', {
        method: 'POST',
        body: JSON.stringify({ psbt: signedPsbt })
    });

    const txid = await window.myWallet.pushTx(finalizeResponse.hex);

    showNotification(`✅ Purchase complete! TXID: ${txid}`, 'success');
}
```

---

## 🧪 Teste Rápido:

### 1. Resetar ofertas:
```bash
# (se tiver endpoint de reset)
curl -X DELETE http://localhost:3000/api/offers
```

### 2. Criar nova wallet:
1. Abra `http://localhost:3000`
2. Clique "Connect Wallet"
3. Clique "Create New Wallet"
4. **GUARDE O MNEMONIC!**
5. Defina uma senha

### 3. Criar listing:
1. Preencha formulário de oferta
2. Clique "Create Offer"
3. MyWallet vai assinar com SIGHASH_SINGLE|ANYONECANPAY
4. ✅ Oferta criada!

### 4. Comprar (outra conta):
1. Abra em navegador anônimo
2. Conecte outra wallet
3. Veja a oferta
4. Clique "Buy Now"
5. Escolha taxa
6. MyWallet assina
7. ✅ **ATOMIC SWAP COMPLETO!**

---

## 🐛 Troubleshooting:

### "MyWallet not found"
- Verifique se o script de integração está carregado
- Abra console: `console.log(window.myWallet)`

### "Password required"
- MyWallet pede senha para descriptografar o mnemonic
- Em dev, pode remover isso do código

### "PSBT signature invalid"
- Verifique se está usando `SIGHASH_SINGLE|ANYONECANPAY` no vendedor
- Verifique se o PSBT está sendo reconstruído corretamente

---

## 📊 Checklist de Integração:

- [ ] MyWallet incluída no HTML
- [ ] `window.myWallet` disponível
- [ ] Função `connectWallet()` atualizada
- [ ] Função `createOffer()` usa MyWallet
- [ ] Função `buyNow()` usa MyWallet
- [ ] Testado criar wallet
- [ ] Testado criar listing
- [ ] Testado comprar
- [ ] ✅ Atomic swap funcionando!

---

## 🎉 Resultado Esperado:

```
1. Vendedor cria listing
   → MyWallet assina com SIGHASH_SINGLE|ANYONECANPAY
   → ✅ Oferta salva

2. Comprador clica "Buy Now"
   → Backend cria PSBT atômico
   → MyWallet assina inputs do comprador
   → ✅ Ambas assinaturas válidas!

3. Backend finaliza e faz broadcast
   → ✅ Transação na mempool
   → ✅ ATOMIC SWAP COMPLETO!
```

---

## 🚀 Próximos Passos:

1. **Agora**: Integrar MyWallet no marketplace
2. **Testar**: Fazer atomic swap completo
3. **Depois**: Adicionar UI visual para MyWallet
4. **Futuro**: Adicionar suporte a Ordinals/Runes

---

**Pronto para testar! 🔥**



