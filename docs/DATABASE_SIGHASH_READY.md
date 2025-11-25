# ✅ BANCO DE DADOS PRONTO PARA SIGHASH

## 📊 ESTRUTURA ATUALIZADA

### Tabela `offers` (Completa)

```sql
CREATE TABLE offers (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('inscription', 'rune_swap')),
    inscription_id TEXT,
    from_rune TEXT,
    to_rune TEXT,
    from_amount INTEGER,
    to_amount INTEGER,
    offer_amount INTEGER,
    fee_rate INTEGER,
    psbt TEXT NOT NULL,                    -- ✅ Armazena PSBT com SIGHASH
    creator_address TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    filled_at INTEGER,
    txid TEXT,
    sighash_type TEXT                      -- ✨ NOVO! Tipo de SIGHASH usado
);
```

---

## 🎯 CAMPO SIGHASH_TYPE

### Valores possíveis:

| Valor | Descrição | Uso |
|-------|-----------|-----|
| `NULL` | Não especificado (SIGHASH_ALL padrão) | Ofertas antigas |
| `"ALL"` | SIGHASH_ALL (padrão) | Assinatura completa |
| `"SINGLE\|ANYONECANPAY"` | SIGHASH_SINGLE \| ANYONECANPAY | **Atomic swaps** ✅ |
| `"ALL\|ANYONECANPAY"` | SIGHASH_ALL \| ANYONECANPAY | Permite adicionar inputs |
| `"NONE\|ANYONECANPAY"` | SIGHASH_NONE \| ANYONECANPAY | Raro |

---

## 🔄 FLUXO DE DADOS

### 1. Vendedor Cria Offer

**Frontend (`app.js`):**
```javascript
await apiRequest('/offers', {
    method: 'POST',
    body: JSON.stringify({
        type: 'inscription',
        inscriptionId,
        psbt: sellerPsbtSigned,
        sighashType: "SINGLE|ANYONECANPAY"  // ✨
    })
});
```

**Backend (`offers.js`):**
```javascript
const { psbt, sighashType } = req.body;

db.prepare(`
    INSERT INTO offers (..., psbt, sighash_type)
    VALUES (..., ?, ?)
`).run(..., psbt, sighashType);
```

**Banco de dados:**
```
offers table:
  id: "offer_abc123"
  psbt: "cHNidP8BA..."
  sighash_type: "SINGLE|ANYONECANPAY"  ✅
```

---

### 2. Comprador Busca Offers

**Backend (`offers.js`):**
```javascript
router.get('/', (req, res) => {
    const offers = db.prepare('SELECT * FROM offers WHERE status = "active"').all();
    // Cada offer tem: psbt, sighash_type
    res.json({ offers });
});
```

**Frontend:**
```javascript
const offers = await apiRequest('/offers');

offers.forEach(offer => {
    console.log('Offer PSBT:', offer.psbt);
    console.log('SIGHASH used:', offer.sighash_type);  // ✨
    
    // Pode ajustar construção do atomic PSBT baseado no sighashType!
});
```

---

### 3. Construir Atomic PSBT

**Backend (`purchase.js`):**
```javascript
const sellerOffer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offerId);

if (sellerOffer.sighash_type === "SINGLE|ANYONECANPAY") {
    // Output 0 LOCKED (payment to seller)
    // Buyer can add Output 1+ (inscription, change)
    console.log('✅ SIGHASH detected - using atomic swap mode');
} else {
    // Fallback para método antigo
    console.log('⚠️  No SIGHASH - using legacy mode');
}
```

---

## ✅ VANTAGENS

### 1. **Rastreabilidade**
Saber qual SIGHASH foi usado em cada offer para debugging e analytics.

### 2. **Flexibilidade**
Suportar múltiplos métodos de assinatura:
- Offers com SIGHASH (atomic swaps)
- Offers sem SIGHASH (legacy/fallback)

### 3. **Compatibilidade**
Ofertas antigas (`sighash_type = NULL`) ainda funcionam.

### 4. **Futuro**
Fácil adicionar novos tipos de SIGHASH quando necessário.

---

## 🔍 QUERIES ÚTEIS

### Verificar offers com SIGHASH

```sql
SELECT 
    id, 
    inscription_id, 
    offer_amount, 
    sighash_type,
    created_at
FROM offers
WHERE sighash_type = 'SINGLE|ANYONECANPAY';
```

### Contar por tipo de SIGHASH

```sql
SELECT 
    sighash_type,
    COUNT(*) as count
FROM offers
GROUP BY sighash_type;
```

### Offers atomic vs legacy

```sql
-- Atomic swaps (SIGHASH)
SELECT COUNT(*) FROM offers WHERE sighash_type IS NOT NULL;

-- Legacy (sem SIGHASH)
SELECT COUNT(*) FROM offers WHERE sighash_type IS NULL;
```

---

## 📝 RESET REALIZADO

✅ **Todas as offers deletadas**
✅ **Inscriptions resetadas**
✅ **Campo `sighash_type` adicionado**
✅ **Runes preservadas**
✅ **Índices mantidos**

---

## 🚀 STATUS

**Database:** ✅ Pronto
**Backend:** ✅ Atualizado
**Frontend:** ✅ Atualizado
**Documentação:** ✅ Completa

---

## 🎯 PRÓXIMO PASSO

**TESTAR O FLUXO COMPLETO:**

1. Vendedor lista inscription
2. Backend assina com SIGHASH_SINGLE|ANYONECANPAY
3. Offer é salva com `sighash_type = "SINGLE|ANYONECANPAY"`
4. Comprador compra
5. Backend constrói atomic PSBT (Output 0 locked!)
6. Finaliza e faz broadcast
7. ✅ Transaction confirmada!

Ver: `TESTE_SIGHASH.md` para instruções detalhadas.

---

**Data da atualização:** Outubro 2025  
**Versão:** 2.0.0 (SIGHASH Support)



