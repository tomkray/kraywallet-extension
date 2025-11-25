# ⚡ KRAY STATION + ORD CLI INTEGRATION

## 🎯 VISÃO GERAL

Kray Station é a **ponte universal** entre todas as wallets do ecossistema Bitcoin Ordinals.

```
┌─────────────────────────────────────────────────────────┐
│              KRAY STATION MARKETPLACE                    │
│                                                          │
│  🟢 Kray Wallet    →  0% taxa  →  UX Perfeita           │
│  🟠 Unisat         →  1% taxa  →  Via ORD CLI           │
│  🟠 Xverse         →  1% taxa  →  Via ORD CLI           │
│  🟠 Leather        →  1% taxa  →  Via ORD CLI           │
│                                                          │
│  = MAIOR INVENTÁRIO + MELHOR UX! 🚀                      │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 MODELO DE RECEITA

### 🟢 Ofertas Kray Wallet (Nativas)
- **Taxa:** 0%
- **UX:** 1 clique na extensão
- **Features:** Social marketplace, likes, BitChat
- **Target:** Seus usuários principais

### 🟠 Ofertas ORD CLI (Externas)
- **Taxa:** 1% (você recebe!)
- **UX:** Comando ORD CLI
- **Compatibilidade:** Unisat, Xverse, Leather
- **Target:** Usuários de outras wallets

---

## 🔧 IMPLEMENTAÇÃO TÉCNICA

### 1. Indexação Automática (Cron Job)

```javascript
// server/jobs/index-ord-offers.js
cron.schedule('*/5 * * * *', async () => {
    const { stdout } = await execAsync('ord wallet offers --json');
    const ordOffers = JSON.parse(stdout);
    
    for (const offer of ordOffers) {
        await db.run(`
            INSERT OR REPLACE INTO offers (
                source, 
                service_fee_percentage, 
                service_fee_address,
                ...
            ) VALUES ('ord-cli', 1.0, ?, ...)
        `, [process.env.SERVICE_FEE_ADDRESS]);
    }
});
```

### 2. Badge Visual no Frontend

```javascript
// app.js
const isOrdExternal = ordinal.source === 'ord-cli';
const ordBadge = isOrdExternal ? `
    <div style="...gradient orange...">
        ⚡ ORD CLI • 1% Fee
    </div>
` : '';
```

### 3. Cálculo de Taxa na Compra

```javascript
// server/routes/purchase.js
if (offerData.source === 'ord-cli') {
    const serviceFeeAmount = Math.floor(
        paymentAmount * (offerData.service_fee_percentage / 100)
    );
    
    // Output 2: Service Fee → Kray Station
    buyerPsbt.addOutput({
        address: offerData.service_fee_address,
        value: serviceFeeAmount
    });
}
```

---

## 📋 PARA HABILITAR

### 1. Configurar `.env`

```bash
SERVICE_FEE_ADDRESS=bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2
SERVICE_FEE_PERCENTAGE=1.0
ORD_INDEXING_ENABLED=true  # ⬅️ Habilitar indexação
```

### 2. Reiniciar Servidor

```bash
cd server && npm start
```

### 3. Verificar Logs

```
✅ Migration: Added source column to offers table
✅ Migration: Added service_fee_percentage column
✅ Migration: Added service_fee_address column
🔄 Starting ORD offers indexing cron job (every 5 minutes)...
```

---

## 🌐 WALLETS COMPATÍVEIS

### ✅ Suportadas (via ORD CLI):
- **Unisat Wallet** (mais popular para Ordinals)
- **Xverse Wallet** (multi-chain)
- **Leather Wallet** (ex-Hiro)

### ❌ Não incluir:
- Sparrow (foco em Lightning/UTXO management, não Ordinals)

---

## 📊 COMPARAÇÃO COM CONCORRENTES

| Marketplace | Taxa Nativa | Taxa Externa | Social Features |
|-------------|-------------|--------------|-----------------|
| **Kray Station** | 0% | 1% | ✅ Likes, Posts |
| Magic Eden | 2-5% | N/A | ❌ |
| OpenOrdex | 0% | N/A | ❌ |
| Gamma | 2% | N/A | ❌ |

**Kray Station = Melhor de todos!** 🎯

---

## 🚀 ROADMAP

### FASE 1: Core (✅ FEITO)
- [x] Database migrations (source, service_fee)
- [x] Cron job indexação ORD
- [x] Badge visual frontend
- [x] Cálculo taxa na compra
- [x] Documentação externa

### FASE 2: Atomic Swap Bug (🔧 AGORA)
- [ ] Resolver `Invalid Schnorr signature`
- [ ] Testar compra end-to-end
- [ ] Validar broadcast

### FASE 3: Go Live (🎉 PRÓXIMO)
- [ ] Deploy produção
- [ ] Habilitar indexação ORD
- [ ] Marketing para outras wallets
- [ ] Monitorar receita 1%

---

## 💡 VANTAGENS COMPETITIVAS

1. **Inventário Massivo**
   - Kray Wallet users
   - Unisat users
   - Xverse users
   - Leather users
   - = 4x mais inscriptions que concorrentes!

2. **Melhor UX**
   - Kray Wallet: 0% + social features
   - Outras: 1% + compatibilidade

3. **Receita Passiva**
   - 1% de TODAS transações externas
   - Quanto mais cresce, mais você recebe!

4. **Network Effect**
   - Mais wallets → Mais ofertas → Mais compradores → Mais wallets!

---

## 🎯 CONCLUSÃO

**Kray Station será o marketplace #1 de Ordinals porque:**

✅ Aceita TODAS as wallets principais (via ORD CLI)
✅ Melhor deal para usuários Kray Wallet (0% taxa)
✅ Social marketplace único no mercado
✅ Atomic swaps = trustless e seguro
✅ Modelo de receita sustentável (1% externas)

**Próximo passo:** Resolver bug atomic swap e GO LIVE! 🚀

---

**Documentação relacionada:**
- `EXTERNAL_WALLETS_GUIDE.md` - Guia para usuários Unisat/Xverse/Leather
- `ORD_INTEGRATION_README.md` - Detalhes técnicos implementação
- `COMPARISON_ORD_VS_KRAYWALLET.md` - Comparação estratégias
