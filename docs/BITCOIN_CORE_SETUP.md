# 🔐 Bitcoin Core Wallet Setup (Produção Segura)

## ✅ Solução CORRETA para SIGHASH customizado

**SEM expor private keys! SEM pedir chaves privadas!**

---

## 1️⃣ Criar/Carregar Wallet no Bitcoin Core

```bash
# Criar nova wallet (se não existe)
bitcoin-cli createwallet "marketplace"

# OU carregar wallet existente
bitcoin-cli loadwallet "marketplace"

# Verificar wallets carregadas
bitcoin-cli listwallets
```

---

## 2️⃣ Gerar ou Importar Endereço do Vendedor

### Opção A: Gerar NOVO endereço na wallet do Bitcoin Core
```bash
# Gerar endereço Taproot (bc1p...)
bitcoin-cli -rpcwallet=marketplace getnewaddress "seller" "bech32m"
```

**Resultado:**
```
bc1p... (endereço Taproot)
```

✅ **Vantagem**: Bitcoin Core tem a private key segura!

### Opção B: Usar endereço existente da Unisat

**⚠️ PROBLEMA**: Bitcoin Core não tem a private key do Unisat!

**SOLUÇÃO**: Usar um "descriptor wallet" ou importar a seed (MUITO complexo)

**RECOMENDAÇÃO**: Usar Opção A (gerar novo endereço no Bitcoin Core)

---

## 3️⃣ Transferir Inscription para Endereço do Bitcoin Core

```bash
# No Unisat: Enviar inscription para o endereço bc1p... gerado acima
# Aguardar confirmação
```

---

## 4️⃣ Atualizar Backend para Usar Bitcoin Core RPC

**Arquivo: `server/routes/sell.js`**

```javascript
router.post('/sign-with-sighash', async (req, res) => {
    try {
        const { psbt } = req.body;
        
        if (!psbt) {
            return res.status(400).json({ error: 'Missing PSBT' });
        }
        
        console.log('\n🔐 ========== SIGNING WITH BITCOIN CORE ==========');
        
        // Assinar com Bitcoin Core usando walletprocesspsbt
        const signedPsbt = await bitcoinRpc.signPsbtWithSighash(
            psbt, 
            "SINGLE|ANYONECANPAY"
        );
        
        // Verificar assinatura
        const decoded = bitcoin.Psbt.fromBase64(signedPsbt);
        const input0 = decoded.data.inputs[0];
        const hasSig = !!(input0.tapKeySig || input0.partialSig);
        
        if (!hasSig) {
            throw new Error('PSBT was not signed by Bitcoin Core');
        }
        
        console.log('✅ PSBT signed with SIGHASH_SINGLE|ANYONECANPAY');
        
        res.json({
            success: true,
            psbt: signedPsbt,
            signed: hasSig,
            sighashType: 'SINGLE|ANYONECANPAY'
        });
        
    } catch (error) {
        console.error('❌ Bitcoin Core signing failed:', error.message);
        res.status(500).json({ 
            error: 'Failed to sign with Bitcoin Core',
            details: error.message 
        });
    }
});
```

---

## 5️⃣ Atualizar Frontend (Remover Prompt de Private Key!)

**Arquivo: `app.js`**

```javascript
// Criar PSBT
const psbtResponse = await apiRequest('/sell/create-custom-psbt', {
    method: 'POST',
    body: JSON.stringify({
        inscriptionId,
        inscriptionUtxo: { ... },
        price: parseInt(offerAmount),
        sellerAddress: connectedAddress,
        feeRate: parseInt(feeRate)
    })
});

// ✅ Assinar com Bitcoin Core (SEM pedir private key!)
showNotification('🔏 Signing with Bitcoin Core...', 'info');

const signResponse = await apiRequest('/sell/sign-with-sighash', {
    method: 'POST',
    body: JSON.stringify({
        psbt: psbtResponse.psbt
    })
});

if (!signResponse.signed) {
    showNotification('❌ Bitcoin Core failed to sign!', 'error');
    return;
}

const sellerPsbtSigned = signResponse.psbt;
console.log('✅ PSBT signed with SIGHASH_SINGLE|ANYONECANPAY');
```

---

## 6️⃣ Testar

```bash
# 1. Criar wallet
bitcoin-cli createwallet "marketplace"

# 2. Gerar endereço
bitcoin-cli -rpcwallet=marketplace getnewaddress "seller" "bech32m"

# 3. Enviar inscription para esse endereço (via Unisat)

# 4. Criar listing (frontend vai usar Bitcoin Core para assinar)
```

---

## 🔐 Por que é Seguro?

1. ✅ **Private keys NUNCA saem do Bitcoin Core**
2. ✅ **Bitcoin Core está no SEU servidor/computador**
3. ✅ **Ninguém vê ou digita private keys**
4. ✅ **Bitcoin Core assina com SIGHASH customizado**
5. ✅ **Marketplaces reais usam essa arquitetura**

---

## 🎯 Fluxo Completo:

```
1. Vendedor: Gerar endereço no Bitcoin Core
2. Vendedor: Enviar inscription para esse endereço via Unisat
3. Vendedor: Criar listing no marketplace
4. Backend: Criar PSBT
5. Backend: Assinar via Bitcoin Core RPC (SIGHASH_SINGLE|ANYONECANPAY)
6. Backend: Salvar PSBT assinado no banco
7. Comprador: Clicar "Buy Now"
8. Backend: Adicionar inputs/outputs do comprador
9. Comprador: Assinar com Unisat
10. Backend: Finalizar e broadcast
```

---

## ⚠️ Limitação:

**Vendedor precisa ter a inscription em um endereço controlado pelo Bitcoin Core!**

Se a inscription está na Unisat, o vendedor precisa:
1. Gerar endereço no Bitcoin Core
2. Transferir inscription da Unisat para Bitcoin Core
3. Depois criar listing

---

## 🚀 Alternativa: Descriptor Wallet (Avançado)

Se quiser usar endereços da Unisat diretamente:

```bash
# Importar descriptor da Unisat (se tiver a seed)
bitcoin-cli -rpcwallet=marketplace importdescriptors '[{...}]'
```

**Mas isso é MUITO complexo e requer a seed da Unisat.**

---

## 📝 Resumo:

**ANTES (ERRADO):** Pedir private key no frontend 🔴  
**DEPOIS (CORRETO):** Bitcoin Core assina via RPC 🟢

**Private keys NUNCA são expostas!**

---

Quer que eu implemente essa solução correta agora? 🔐
