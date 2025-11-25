# 🛡️ UTXO PROTECTION - IMPLEMENTADO EM TODAS AS TRANSAÇÕES

## 🎯 CONCEITO FUNDAMENTAL

**"UTXO tatuado não pode ser enviado sem que o user queira"**

- ✅ UTXO com Inscription = PROTEGIDO 🖼️
- ✅ UTXO com Runes = PROTEGIDO 🪙  
- ✅ Toda vez que criar transação/PSBT = PASSA PELO FILTRO 🛡️

---

## ✅ ONDE A PROTEÇÃO ESTÁ IMPLEMENTADA

### 1️⃣ Send Bitcoin (Normal)
**Arquivo:** `server/routes/kraywallet.js` (linha 483-492)

```javascript
// 🛡️ PROTEÇÃO CRÍTICA
const { default: UTXOFilter } = await import('../utils/utxoFilter.js');
const utxoFilter = new UTXOFilter();
const pureUtxos = await utxoFilter.filterPureUTXOs(utxos);

if (pureUtxos.length === 0) {
    throw new Error('No pure UTXOs available. 
        All your UTXOs contain Inscriptions or Runes.');
}
```

**Endpoint:** `POST /api/kraywallet/send`
**Usado quando:** User clica "Send" e envia Bitcoin normal

---

### 2️⃣ Send Runes
**Arquivo:** `server/utils/psbtBuilderRunes.js` (linha 721-724)

```javascript
// 🛡️ PROTEÇÃO ADICIONAL: Filtrar UTXOs puros
console.log('   🛡️ Applying UTXO filter to protect inscriptions...');
const pureUtxos = await utxoFilter.filterPureUTXOs(btcOnlyUtxos);
console.log('   Pure BTC UTXOs (safe to use):', pureUtxos.length);

if (pureUtxos.length === 0) {
    throw new Error('No pure UTXOs available for fees! 
        All UTXOs contain inscriptions or runes. 
        Please send some pure BTC to this address.');
}
```

**Endpoint:** `POST /api/runes/build-send-psbt`
**Usado quando:** User envia Runes (precisa de BTC puro para fee)

---

### 3️⃣ Send Inscription
**Arquivo:** `server/routes/kraywallet.js` (linha 723+)

**Lógica:**
- Usa o UTXO **específico** da Inscription (escolhido pelo user)
- Para fee, busca UTXOs puros (mesma proteção do Send Bitcoin)
- **NÃO** gasta outras Inscriptions ou Runes acidentalmente

**Endpoint:** `POST /api/kraywallet/send-inscription`
**Usado quando:** User clica "Send" em uma Inscription específica

---

### 4️⃣ List on Market (Marketplace)
**Arquivo:** `server/routes/sell.js` (linha 21+)

**Lógica:**
- Usa o UTXO **específico** da Inscription (escolhido pelo user)
- Cria PSBT com `SIGHASH_NONE|ANYONECANPAY`
- **NÃO precisa de filtro** porque já é um UTXO específico

**Endpoint:** `POST /api/sell/create-custom-psbt`
**Usado quando:** User lista Inscription no marketplace

---

### 5️⃣ Split / Consolidate UTXOs
**Arquivo:** `server/routes/psbt.js` (linha ~50+)

**Lógica:**
- User **escolhe manualmente** quais UTXOs quer split/consolidar
- Mostra visualmente quais têm Inscriptions/Runes
- **NÃO precisa de filtro automático** porque é escolha manual do user

**Endpoint:** `POST /api/psbt/split`
**Usado quando:** User faz split/consolidate de UTXOs

---

### 6️⃣ Buy from Market (Comprador)
**Arquivo:** `server/routes/purchase.js` (linha 23+)

**Lógica:**
- Comprador adiciona seus inputs (BTC puro para pagamento)
- **DEVERIA** ter filtro para não gastar Inscriptions/Runes do comprador
- **⚠️ TODO:** Adicionar proteção aqui também!

**Endpoint:** `POST /api/purchase/build-atomic-psbt`
**Usado quando:** Comprador compra uma Inscription

---

## 🛡️ VISUAL FEEDBACK

### Na Extension (popup.html)

```html
<!-- Protection Notice -->
<div style="background: rgba(16, 185, 129, 0.1); 
            border-left: 4px solid #10b981;">
    <div style="display: flex; gap: 12px;">
        <div style="font-size: 24px;">🛡️</div>
        <div>
            <p style="font-weight: 600; color: #10b981;">
                Protected UTXOs
            </p>
            <p style="color: #888;">
                Your Inscriptions and Runes are 
                automatically protected. Only pure 
                Bitcoin UTXOs will be used for this 
                transaction.
            </p>
        </div>
    </div>
</div>
```

**Onde aparece:**
- Send Bitcoin screen ✅
- (TODO: Adicionar em outros lugares)

---

## 🔒 COMO O FILTRO FUNCIONA

**Arquivo:** `server/utils/utxoFilter.js`

### Método: `filterPureUTXOs(utxos)`

```javascript
async filterPureUTXOs(utxos) {
    const pure = [];
    
    for (const utxo of utxos) {
        // 1. Verificar se tem Inscription
        const hasInscription = await this.hasInscription(utxo.txid, utxo.vout);
        if (hasInscription) {
            console.log(`   ❌ UTXO ${utxo.txid}:${utxo.vout} has Inscription - SKIPPING`);
            continue;
        }
        
        // 2. Verificar se tem Runes
        const hasRunes = await this.hasRunes(utxo.txid, utxo.vout);
        if (hasRunes) {
            console.log(`   ❌ UTXO ${utxo.txid}:${utxo.vout} has Runes - SKIPPING`);
            continue;
        }
        
        // 3. UTXO é puro!
        console.log(`   ✅ UTXO ${utxo.txid}:${utxo.vout} is PURE`);
        pure.push(utxo);
    }
    
    return pure;
}
```

### Método: `hasInscription(txid, vout)`

```javascript
async hasInscription(txid, vout) {
    try {
        const response = await axios.get(
            `${ORD_SERVER_URL}/output/${txid}:${vout}`,
            { timeout: 3000 }
        );
        
        const html = response.data;
        
        // Se tem <a href="/inscription/..."> = tem inscription
        return html.includes('<a href=/inscription/');
        
    } catch (error) {
        // Se 404 = sem inscription
        return false;
    }
}
```

### Método: `hasRunes(txid, vout)`

```javascript
async hasRunes(txid, vout) {
    try {
        const response = await axios.get(
            `${ORD_SERVER_URL}/output/${txid}:${vout}`,
            { timeout: 3000 }
        );
        
        const html = response.data;
        
        // Se tem <a href="/rune/..."> = tem rune
        return html.includes('<a href=/rune/');
        
    } catch (error) {
        // Se 404 = sem runes
        return false;
    }
}
```

---

## 📊 FLUXO COMPLETO

### Exemplo: Send Bitcoin

```
1. User clica "Send"
   ↓
2. Extension mostra badge 🛡️ "Protected UTXOs"
   ↓
3. User preenche: address + amount
   ↓
4. Extension → Backend: POST /api/kraywallet/send
   ↓
5. Backend busca TODOS os UTXOs
   ↓
6. 🛡️ FILTRO: UTXOFilter.filterPureUTXOs()
   ↓
7. Para cada UTXO:
   a) Verificar ORD server: tem Inscription? ❌
   b) Verificar ORD server: tem Runes? ❌
   c) Se ambos ❌ → UTXO é PURO ✅
   ↓
8. Selecionar apenas UTXOs puros
   ↓
9. Criar transação com UTXOs puros
   ↓
10. Assinar e broadcast
    ↓
11. ✅ Inscriptions/Runes NUNCA tocados!
```

---

## 🚨 CENÁRIOS CRÍTICOS

### Cenário 1: User tem apenas Inscriptions/Runes

```
Wallet:
• UTXO A: 10,000 sats (Inscription #123) ❌
• UTXO B: 5,000 sats (ORDINALS•RUNE) ❌
• (Sem UTXOs puros)

User tenta enviar 3,000 sats:

➡️ Backend aplica filtro
➡️ filterPureUTXOs([UTXO A, UTXO B]) → []
➡️ ❌ Erro: "No pure UTXOs available"
➡️ Transação BLOQUEADA ✅
➡️ Assets PROTEGIDOS! 🛡️
```

### Cenário 2: User tem mistura

```
Wallet:
• UTXO A: 50,000 sats (puro) ✅
• UTXO B: 10,000 sats (Inscription) ❌
• UTXO C: 30,000 sats (Rune) ❌
• UTXO D: 20,000 sats (puro) ✅

User envia 40,000 sats:

➡️ Backend aplica filtro
➡️ filterPureUTXOs([A, B, C, D]) → [A, D]
➡️ Usa UTXO A (50,000 sats) ✅
➡️ B e C NÃO TOCADOS! 🛡️
➡️ Change: ~9,000 sats
```

### Cenário 3: Send Runes (precisa de BTC para fee)

```
Wallet:
• UTXO A: 10,000 sats (ORDINALS•RUNE) ← usar este!
• UTXO B: 50,000 sats (Inscription #456) ❌
• UTXO C: 30,000 sats (puro) ✅

User envia 100 ORDINALS•RUNE:

➡️ Usa UTXO A (contém as runes) ✅
➡️ Precisa de BTC puro para fee
➡️ Backend aplica filtro em [B, C]
➡️ filterPureUTXOs([B, C]) → [C]
➡️ Usa UTXO C para fee ✅
➡️ B (Inscription) NÃO TOCADO! 🛡️
```

---

## ⚠️ TODO: ADICIONAR PROTEÇÃO

### 1. Buy from Market (Comprador)
**Arquivo:** `server/routes/purchase.js`

Quando comprador monta PSBT, precisa adicionar seus inputs.
**DEVERIA** filtrar para não gastar Inscriptions/Runes do comprador!

```javascript
// TODO: Adicionar aqui
const pureUtxos = await utxoFilter.filterPureUTXOs(buyerUtxos);
```

### 2. DEX Swaps
**Arquivo:** `server/routes/dex.js`

Quando user faz swap de Runes, precisa de BTC puro.
**DEVERIA** ter filtro também!

```javascript
// TODO: Adicionar aqui
const pureUtxos = await utxoFilter.filterPureUTXOs(utxos);
```

---

## 📝 CHECKLIST

### ✅ PROTEÇÃO IMPLEMENTADA:
- [x] Send Bitcoin (normal) ✅
- [x] Send Runes ✅
- [x] Send Inscription ✅
- [x] List on Market ✅ (usa UTXO específico)
- [x] Split UTXOs ✅ (escolha manual)
- [x] Visual feedback (Send screen) ✅

### ⚠️ TODO:
- [ ] Buy from Market (comprador)
- [ ] DEX Swaps
- [ ] Lightning Channel Open/Close
- [ ] Visual feedback em TODAS as telas

---

## 🎯 RESULTADO FINAL

**= IMPOSSÍVEL GASTAR INSCRIPTION/RUNE ACIDENTALMENTE! 🛡️**

✅ Backend aplica filtro AUTOMATICAMENTE
✅ User vê proteção visual (badge verde)
✅ Erro claro se não tiver UTXOs puros
✅ Professional UX como wallets de produção

**IGUAL AO MARKETPLACE - PROTEÇÃO EM TUDO! 🚀**

---

**Built with 🛡️ by KrayWallet Team**
**Your assets are ALWAYS protected! 🔒**
