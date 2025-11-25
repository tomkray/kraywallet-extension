# 🛡️ UTXO PROTECTION - CRITICAL SECURITY

## 🎯 PROBLEMA

Quando enviamos Bitcoin, precisamos selecionar UTXOs para usar como inputs.
**PROBLEMA:** Se selecionarmos um UTXO que contém uma Inscription ou Rune, podemos **PERDER PERMANENTEMENTE** esse ativo!

## ✅ SOLUÇÃO IMPLEMENTADA

### Backend Protection (JÁ IMPLEMENTADO)

**Arquivo:** `server/routes/kraywallet.js` (linha 483-492)

```javascript
// 🛡️ PROTEÇÃO CRÍTICA: Filtrar UTXOs puros (sem Inscriptions nem Runes)
console.log('  🛡️  Filtering pure UTXOs (protecting Inscriptions and Runes)...');
const { default: UTXOFilter } = await import('../utils/utxoFilter.js');
const utxoFilter = new UTXOFilter();
const pureUtxos = await utxoFilter.filterPureUTXOs(utxos);
console.log('  Pure UTXOs (safe to use):', pureUtxos.length);

if (pureUtxos.length === 0) {
    throw new Error('No pure UTXOs available. All your UTXOs contain Inscriptions or Runes.');
}
```

### Como Funciona

1. **Buscar todos os UTXOs** do endereço (via Mempool.space)
2. **Filtrar UTXOs puros** usando `UTXOFilter.filterPureUTXOs()`
   - Verifica cada UTXO contra o ORD server
   - Remove UTXOs que contêm Inscriptions
   - Remove UTXOs que contêm Runes
3. **Usar apenas UTXOs puros** para criar a transação

### Visual Feedback (NOVO!)

**Arquivo:** `kraywallet-extension/popup/popup.html`

Adicionamos um **notice de proteção** na tela "Send Bitcoin":

```html
<!-- Protection Notice -->
<div style="margin: 16px; padding: 16px; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; border-radius: 8px;">
    <div style="display: flex; align-items: start; gap: 12px;">
        <div style="font-size: 24px; line-height: 1;">🛡️</div>
        <div style="flex: 1;">
            <p style="font-size: 13px; font-weight: 600; color: #10b981; margin: 0 0 6px 0;">
                Protected UTXOs
            </p>
            <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">
                Your Inscriptions and Runes are automatically protected. Only pure Bitcoin UTXOs will be used for this transaction.
            </p>
        </div>
    </div>
</div>
```

**Visual:**

```
┌─────────────────────────────────────────────────┐
│ 🛡️  Protected UTXOs                             │
│                                                  │
│     Your Inscriptions and Runes are             │
│     automatically protected. Only pure Bitcoin  │
│     UTXOs will be used for this transaction.    │
└─────────────────────────────────────────────────┘
```

---

## 🔍 UTXOFilter Implementation

**Arquivo:** `server/utils/utxoFilter.js`

### Métodos:

1. **`filterPureUTXOs(utxos)`**
   - Filtra UTXOs que NÃO contêm Inscriptions ou Runes
   - Retorna apenas UTXOs "puros" (safe to spend)

2. **`hasInscription(txid, vout)`**
   - Verifica se um UTXO específico contém uma Inscription
   - Consulta ORD server local

3. **`hasRunes(txid, vout)`**
   - Verifica se um UTXO específico contém Runes
   - Consulta ORD server local

### Fluxo:

```
1. Buscar UTXOs
   ↓
2. Para cada UTXO:
   a) Verificar se tem Inscription
   b) Verificar se tem Runes
   ↓
3. Retornar apenas UTXOs limpos
   ↓
4. Usar para criar transação
```

---

## 🚨 CENÁRIOS PROTEGIDOS

### ✅ Cenário 1: Send Bitcoin (Normal)

```
UTXOs disponíveis:
• UTXO A: 50,000 sats (puro) ✅
• UTXO B: 10,000 sats (Inscription #123) ❌
• UTXO C: 30,000 sats (Rune: ORDINALS•RUNE) ❌
• UTXO D: 100,000 sats (puro) ✅

User envia 40,000 sats:
→ Usa UTXO A (50,000 sats) ✅
→ NUNCA toca UTXO B ou C! 🛡️
→ Change: ~9,000 sats (após fee)
```

### ✅ Cenário 2: Send Bitcoin (sem UTXOs puros)

```
UTXOs disponíveis:
• UTXO A: 50,000 sats (Inscription #456) ❌
• UTXO B: 30,000 sats (Rune: TEST•RUNE) ❌

User tenta enviar 20,000 sats:
→ Erro: "No pure UTXOs available. All your UTXOs contain Inscriptions or Runes."
→ Transação bloqueada! ✅
→ Usuário NÃO perde seus assets! 🛡️
```

### ✅ Cenário 3: Send Inscription (específico)

```
UTXOs disponíveis:
• UTXO A: 10,000 sats (Inscription #123) ✅
• UTXO B: 50,000 sats (puro) ✅

User envia Inscription #123:
→ Usa ESPECIFICAMENTE UTXO A (que contém a inscription)
→ Adiciona UTXO B como input para pagar fee (puro) ✅
→ Inscription vai para destinatário
→ Change retorna para user
```

---

## 🎨 UI/UX BENEFITS

1. **Transparência**
   - User vê que tem proteção
   - Sabe que Inscriptions/Runes estão safe

2. **Confiança**
   - "Protected UTXOs" badge verde
   - Mensagem clara sobre proteção automática

3. **Educação**
   - User aprende que existe proteção
   - Entende diferença entre UTXO puro vs. UTXO com assets

4. **Erro Claro**
   - Se não tem UTXOs puros, erro específico
   - User sabe exatamente o problema
   - Sugere solução (receber mais Bitcoin puro)

---

## 📊 COMPARAÇÃO

### Wallets SEM Proteção:

❌ **Unisat (versões antigas)**
- Sem filtro automático
- User podia gastar Inscription acidentalmente
- Perda permanente! 💔

❌ **Sparrow Wallet (modo avançado)**
- Mostra todos os UTXOs
- User precisa filtrar manualmente
- Risco de erro humano

### KrayWallet (COM Proteção):

✅ **Proteção Automática**
- Filtro em TODAS as transações
- Backend + Visual feedback
- Impossível gastar asset acidentalmente

✅ **Smart**
- ORD server integration
- Real-time verification
- Mesmo padrão que marketplaces usam

✅ **Educativo**
- UI mostra proteção
- User confia na wallet
- Professional UX

---

## 🔒 CRITICAL CODE LOCATIONS

### Backend (Protection Logic):

1. **`server/routes/kraywallet.js`**
   - Linha 483-492: Filtragem de UTXOs puros
   - Usado em: `/api/kraywallet/send`

2. **`server/utils/utxoFilter.js`**
   - Classe `UTXOFilter`
   - Métodos: `filterPureUTXOs()`, `hasInscription()`, `hasRunes()`

### Frontend (Visual Feedback):

1. **`kraywallet-extension/popup/popup.html`**
   - Linha 377-390: Protection notice na Send screen
   - Badge verde com emoji 🛡️

### Extension (Send Flow):

1. **`kraywallet-extension/background/background-real.js`**
   - Linha 933-1040: `sendBitcoin()` function
   - Chama backend que aplica filtro

2. **`kraywallet-extension/popup/popup.js`**
   - `handleSend()`: Trigger do send flow
   - Mostra tela com protection notice

---

## 🎯 RESULT

**= IMPOSSÍVEL PERDER INSCRIPTIONS OU RUNES ACIDENTALMENTE! 🛡️**

1. Backend aplica filtro SEMPRE
2. User vê proteção visual
3. Erro claro se não tiver UTXOs puros
4. Professional UX como marketplaces (OpenSea, Magic Eden)

**IGUAL AO MARKETPLACE DO FRONT! ✅**

---

## 📝 TESTING SCENARIOS

### Test 1: Send com UTXOs mistos
```
1. Wallet tem: 3 UTXOs puros + 2 Inscriptions + 1 Rune
2. User clica "Send"
3. Vê notice "Protected UTXOs" 🛡️
4. Envia 10,000 sats
5. ✅ Usa apenas UTXOs puros
6. ✅ Inscriptions/Runes não tocados
```

### Test 2: Send sem UTXOs puros
```
1. Wallet tem: 0 UTXOs puros + 3 Inscriptions
2. User clica "Send"
3. Vê notice "Protected UTXOs" 🛡️
4. Tenta enviar 5,000 sats
5. ❌ Erro: "No pure UTXOs available..."
6. ✅ Transação bloqueada, assets safe!
```

### Test 3: Send Inscription específico
```
1. User clica em Inscription #123
2. Clica "Send" button
3. Envia para endereço
4. ✅ Usa UTXO específico da inscription
5. ✅ Adiciona UTXO puro para fee
6. ✅ Inscription transferido corretamente
```

---

**Built with 🛡️ by KrayWallet Team**
**Your assets are ALWAYS protected! 🔒**
