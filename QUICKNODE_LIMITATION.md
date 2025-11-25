# ⚠️  QuickNode Limitation - Inscriptions por Endereço

## 🎯 Problema Identificado

**QuickNode NÃO tem endpoint para buscar inscriptions por endereço!**

### Métodos Disponíveis no QuickNode:

✅ `ord_getInscriptions` - Lista TODAS as inscriptions (não filtra por endereço)  
✅ `ord_getInscription` - Detalhes de UMA inscription específica  
✅ `ord_getOutput` - Verifica se um UTXO tem inscription  
✅ `ord_getRunes` - Lista todas as runes  
✅ `ord_getRune` - Detalhes de uma rune específica  
❌ `scantxoutset` - **NÃO disponível** (retorna 400 Bad Request)  

### O Que Está Faltando:

❌ Endpoint para buscar: "Quais inscriptions pertencem ao endereço X?"  
❌ Endpoint para buscar: "Quais UTXOs o endereço X possui?"  

---

## 💡 Soluções Possíveis

### Opção 1: ✅ Usar Banco de Dados Local como Cache

```javascript
// Manter uma tabela local com:
// - inscription_id
// - address (owner)
// - output (txid:vout)

// Quando buscar inscriptions:
SELECT * FROM inscriptions WHERE address = ?
```

**Vantagens:**
- ✅ Rápido
- ✅ Funciona offline
- ✅ Cache persistente

**Desvantagens:**
- ❌ Precisa popular o DB (indexar)
- ❌ Pode ficar desatualizado

---

### Opção 2: ❌ Varrer TODAS as inscriptions (NÃO VIÁVEL)

```javascript
// Buscar TODAS as inscriptions e filtrar
const all = await quicknode.getInscriptions(0, 100000);
const filtered = all.filter(ins => ins.address === myAddress);
```

**Problema:**
- ❌ Existem 80+ MILHÕES de inscriptions
- ❌ Impossível baixar todas
- ❌ Muito lento

---

### Opção 3: ✅ Usar Wallet própria da extensão (RECOMENDADO)

A **extensão KrayWallet** já rastreia as próprias inscriptions!

```javascript
// Na extensão:
const inscriptions = await window.krayWallet.getInscriptions();
```

**Como funciona:**
1. Extensão deriva endereços da seed
2. Rastreia transações recebidas
3. Mantém cache local das inscriptions
4. Usa QuickNode apenas para validar/atualizar

---

## 🎯 Solução que Vou Implementar

### Para Inscriptions:

1. **Extensão KrayWallet:** Rastreia próprias inscriptions
2. **Backend:** Apenas valida e enriquece com QuickNode
3. **QuickNode:** Usado para `getInscription(id)` (detalhes)

### Para Runes:

1. **Extensão:** Rastreia UTXOs com runes
2. **Backend:** Busca detalhes via `ord_getRune(runeId)`
3. **QuickNode:** 100% para detalhes das runes

---

## 📊 Estratégia Final

```
┌─────────────────────────────────────────┐
│  Extensão KrayWallet (Client-Side)      │
│  - Deriva endereços da seed             │
│  - Rastreia transações recebidas        │
│  - Cache local de inscriptions/runes    │
│  - Sincroniza com QuickNode             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Backend (Kray Station)                 │
│  - Valida inscriptions via QuickNode    │
│  - Enriquece com detalhes               │
│  - Marketplace (atomic swaps)           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  QuickNode                              │
│  - ord_getInscription(id)               │
│  - ord_getRune(runeId)                  │
│  - Bitcoin RPC completo                 │
│  - ord_getOutput(outpoint)              │
└─────────────────────────────────────────┘
```

---

## 🚀 Próximos Passos

Vou implementar a extensão para usar QuickNode diretamente:

1. ✅ Extensão rastreia próprias inscriptions
2. ✅ Backend usa QuickNode para validar
3. ✅ Tudo funciona sem ord local

**Isso é a forma CORRETA de usar QuickNode!** 💪

---

**Continuo implementando agora...**


