# 💰 QUEM PAGA A FEE NO ATOMIC SWAP?

## 🎯 RESUMO: O **BUYER** SEMPRE PAGA A FEE!

---

## 📊 ANATOMIA DO ATOMIC SWAP (ORD CLI):

### 1️⃣ **SELLER cria oferta** (`ord wallet offer create`):
```bash
ord wallet offer create \
  --inscription abc123...i0 \
  --price 50000
```

**O que acontece:**
- Seller assina um PSBT com **SIGHASH_SINGLE|ANYONECANPAY**
- PSBT contém:
  - Input 0: Inscription (assinado pelo seller)
  - Output 0: Pagamento ao seller (50,000 sats)
- **Seller NÃO paga nada neste momento!** (sem broadcast)
- PSBT fica "pendente" esperando buyer

---

### 2️⃣ **BUYER aceita oferta**:

**O que acontece:**
- Buyer pega o PSBT do seller
- Buyer **ADICIONA** ao PSBT:
  - Input 1, 2, 3...: UTXOs do buyer (para pagar)
  - Output 1: Inscription vai para o buyer
  - Output 2: Change volta para o buyer
  - **Output extra para SERVICE FEE (se ORD externo)**

**Exemplo (oferta ORD de 50,000 sats com 1% taxa):**

```
PSBT FINAL:
├─ Input 0: Inscription (seller) ← Assinado pelo seller
├─ Input 1: 60,000 sats (buyer)  ← Buyer adiciona
│
├─ Output 0: 50,000 sats → Seller ← Locked pela assinatura do seller!
├─ Output 1: 546 sats → Buyer (inscription)
├─ Output 2: 500 sats → Kray Station (1% service fee) ← NOSSO!
└─ Output 3: 8,454 sats → Buyer (change)

FEE: ~1,000 sats (pago pelo buyer!)
```

**Total que o buyer precisa:**
- Pagamento ao seller: 50,000 sats
- Service fee (1%): 500 sats
- Network fee: 1,000 sats
- **Total: 51,500 sats do buyer!**

---

## 🔧 O QUE SIGNIFICA O `--fee-rate` NO `ord wallet offer create`?

### ❌ **O que NÃO é:**
- NÃO é a fee que o seller paga
- NÃO é a fee do broadcast final

### ✅ **O que realmente é:**
- É apenas um **HINT** para o buyer
- Sugere uma fee rate para quando o buyer for fazer o broadcast
- **O buyer pode ignorar completamente!**

---

## 💡 CONCLUSÃO:

### Para `ord wallet offer create`:

**O `--fee-rate` é OPCIONAL e IRRELEVANTE!**

Por quê?
1. Seller não paga nada ao criar a oferta
2. Buyer que escolhe a fee quando faz o broadcast
3. Buyer paga TUDO:
   - Pagamento ao seller
   - Service fee (1% para nós)
   - Network fee

---

## 🎯 PARA NOSSO FORMULÁRIO:

### ❌ REMOVER COMPLETAMENTE:
```
Fee Rate (sat/vB): [____10____]  ← Desnecessário!
```

### ✅ MANTER APENAS:
```
📝 Inscription ID: [____________]
💰 Offer Amount:   [____________] sats
```

**Comando gerado:**
```bash
ord wallet offer create \
  --inscription abc123...i0 \
  --price 50000
```

**Sem `--fee-rate`!** O buyer decide isso depois!

---

## 📋 FLUXO COMPLETO:

```
1. Seller (Unisat/Xverse):
   └─ Executa: ord wallet offer create --inscription X --price 50000
   └─ PSBT criado (sem broadcast, sem fee paga)
   └─ Oferta indexada no Kray Station

2. Buyer (qualquer wallet):
   └─ Clica "Buy Now" no Kray Station
   └─ Escolhe fee rate (10, 20, 50 sat/vB)
   └─ Sistema monta PSBT completo
   └─ Buyer assina e paga TUDO:
      • 50,000 sats → Seller
      • 500 sats → Kray Station (1%)
      • 1,000 sats → Network fee
   └─ Broadcast!

3. Resultado:
   ✅ Seller recebe 50,000 sats
   ✅ Kray Station recebe 500 sats
   ✅ Buyer recebe inscription
   ✅ Atomic swap completo!
```

---

## 🎉 VANTAGENS:

✅ **Seller:** Sem risco, sem fee antecipada
✅ **Buyer:** Total controle sobre a fee
✅ **Kray Station:** 1% de todas transações ORD!
✅ **Atomic:** Trustless e seguro

---

**Conclusão final:** O `--fee-rate` no `ord wallet offer create` é apenas um **hint decorativo** que pode ser completamente omitido! 🚀
