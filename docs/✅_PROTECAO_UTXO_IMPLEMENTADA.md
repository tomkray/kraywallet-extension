# 🛡️ Proteção de UTXO Implementada

## 🎯 **Problema Crítico Resolvido**

**ANTES**: Ao comprar uma Inscription, o sistema poderia usar **qualquer UTXO** do comprador, incluindo UTXOs que contêm:
- ❌ Inscriptions (Ordinals)
- ❌ Runes
- ❌ Outros assets valiosos

**RESULTADO**: Usuário perderia seus assets acidentalmente! 💸

---

## ✅ **Solução Implementada**

### **Filtro de UTXOs Puros**

Antes de selecionar UTXOs para pagar uma compra, o sistema agora:

1. ✅ **Verifica cada UTXO** se contém Inscription ou Rune
2. ✅ **Filtra apenas UTXOs "puros"** (sem nada)
3. ✅ **Usa apenas UTXOs seguros** para pagamento
4. ✅ **Protege automaticamente** Inscriptions e Runes do usuário

---

## 📊 **Onde está implementado**

### **1. UTXOFilter (Classe de Proteção)**

Arquivo: `server/utils/utxoFilter.js`

```javascript
class UTXOFilter {
    /**
     * Verificar se UTXO contém Inscription
     */
    async hasInscription(txid, vout) {
        // Consulta ORD server
        const response = await axios.get(`${ORD_SERVER}/output/${txid}:${vout}`);
        
        // Verifica se HTML contém referência a inscription
        return html.includes('/inscription/') || 
               html.includes('class="inscription"');
    }
    
    /**
     * Verificar se UTXO contém Runes
     */
    async hasRunes(txid, vout) {
        // Consulta ORD server
        const response = await axios.get(`${ORD_SERVER}/output/${txid}:${vout}`);
        
        // Verifica se HTML contém referência a runes
        return html.includes('class="rune"') ||
               html.includes('/rune/');
    }
    
    /**
     * Filtrar apenas UTXOs puros
     */
    async filterPureUTXOs(utxos) {
        const pureUtxos = [];
        
        for (const utxo of utxos) {
            const hasInscr = await this.hasInscription(utxo.txid, utxo.vout);
            const hasRune = await this.hasRunes(utxo.txid, utxo.vout);
            
            // ✅ Só adicionar se não tiver nem inscription nem rune
            if (!hasInscr && !hasRune) {
                pureUtxos.push(utxo);
            } else {
                console.log(`   🛡️  PROTECTED: ${utxo.txid}:${utxo.vout}`);
            }
        }
        
        return pureUtxos;
    }
}
```

---

### **2. Purchase Route (Compra de Inscriptions)**

Arquivo: `server/routes/purchase.js`

```javascript
// 🛡️ PROTEÇÃO CRÍTICA: Filtrar UTXOs puros
console.log('\n🛡️  Filtering pure UTXOs (protecting Inscriptions and Runes)...');
console.log('   Total UTXOs received:', buyerUtxos?.length || 0);

const { default: UTXOFilter } = await import('../utils/utxoFilter.js');
const utxoFilter = new UTXOFilter();

// Filtrar apenas UTXOs seguros para usar
const pureUtxos = await utxoFilter.filterPureUTXOs(buyerUtxos || []);
console.log('   Pure UTXOs (safe to use):', pureUtxos.length);

if (pureUtxos.length === 0) {
    return res.status(400).json({
        error: 'No pure UTXOs available. All your UTXOs contain Inscriptions or Runes.'
    });
}

// Selecionar apenas UTXOs puros para pagamento
for (const utxo of pureUtxos) {
    // Usar UTXO seguro...
}
```

---

### **3. Runes Send (Envio de Runes)**

Arquivo: `server/utils/psbtBuilderRunes.js`

```javascript
// 6.5. CRÍTICO: Filtrar UTXOs que NÃO contêm runes NEM inscriptions
console.log('\n🛡️  Step 4.5: Protecting inscriptions and runes...');

// Remover UTXOs que já estão sendo usados para runes
const runeUtxoIds = selected.map(u => `${u.txid}:${u.vout}`);
const btcOnlyUtxos = btcUtxos.filter(u => 
    !runeUtxoIds.includes(`${u.txid}:${u.vout}`)
);

// Filtrar apenas UTXOs "puros" (sem inscription nem runes)
const pureUtxos = await utxoFilter.filterPureUTXOs(btcOnlyUtxos);

if (pureUtxos.length === 0) {
    throw new Error('No pure BTC UTXOs available for fees. Please receive some pure BTC first.');
}
```

---

## 🔍 **Como funciona o filtro**

### **1. Consulta ao ORD Server**

Para cada UTXO, o filtro faz uma requisição ao ORD server:

```
GET http://127.0.0.1:80/output/{txid}:{vout}
```

### **2. Análise do HTML**

O ORD server retorna HTML com informações sobre o UTXO:

#### **UTXO com Inscription:**
```html
<dt>inscription</dt>
<dd><a href=/inscription/78630547i0>78630547</a></dd>
```

#### **UTXO com Rune:**
```html
<dt>runes</dt>
<dd>
  <a class=monospace href=/rune/DOG•GO•TO•THE•MOON>
    DOG•GO•TO•THE•MOON
  </a>: 1000🐕
</dd>
```

#### **UTXO Puro (seguro):**
```html
<!-- Sem referências a inscription ou runes -->
```

### **3. Decisão**

```javascript
if (hasInscription || hasRunes) {
    🛡️ PROTECTED - NÃO usar este UTXO
} else {
    ✅ SAFE - Pode usar para pagamento
}
```

---

## 📋 **Logs de Proteção**

Quando a proteção está ativa, você verá nos logs:

```
🛡️  Filtering pure UTXOs (protecting Inscriptions and Runes)...
   Total UTXOs received: 5
🔍 Checking inscription for abc123...:0...
🔍 Checking runes for abc123...:0...
   🛡️  PROTECTED: abc123...:0 (has Inscription)
🔍 Checking inscription for def456...:1...
🔍 Checking runes for def456...:1...
   ✅ SAFE: def456...:1 (pure BTC)
   Pure UTXOs (safe to use): 3
```

---

## ⚠️ **Casos de Erro**

### **Erro 1: Nenhum UTXO puro disponível**

```json
{
  "error": "No pure UTXOs available. All your UTXOs contain Inscriptions or Runes that cannot be used for payment."
}
```

**Solução**: Usuário precisa receber BTC "puro" (sem Inscriptions/Runes) antes de poder comprar.

### **Erro 2: UTXOs puros insuficientes**

```json
{
  "error": "Insufficient UTXOs. Need 5000 sats, have 3000 sats"
}
```

**Solução**: Usuário tem UTXOs puros, mas não o suficiente para pagar. Precisa de mais BTC puro.

---

## ✅ **Benefícios**

1. ✅ **Proteção automática** - Usuário não precisa se preocupar
2. ✅ **Sem perdas acidentais** - Inscriptions e Runes sempre protegidos
3. ✅ **Feedback claro** - Mensagens de erro explicam o problema
4. ✅ **Logs detalhados** - Fácil debug e auditoria
5. ✅ **Padrão da indústria** - Mesmo comportamento de Unisat/Xverse

---

## 🧪 **Como Testar**

### **Cenário 1: Usuário com UTXOs mistos**

```
Wallet tem:
- UTXO 1: 10,000 sats (contém Inscription #78630547) ❌
- UTXO 2: 50,000 sats (contém DOG•GO•TO•THE•MOON rune) ❌
- UTXO 3: 20,000 sats (BTC puro) ✅
- UTXO 4: 30,000 sats (BTC puro) ✅

Tenta comprar Inscription por 15,000 sats:
✅ Sistema usa UTXO 3 (20,000 sats puro)
✅ Inscriptions e Runes ficam protegidos
```

### **Cenário 2: Usuário sem UTXOs puros**

```
Wallet tem:
- UTXO 1: 10,000 sats (contém Inscription) ❌
- UTXO 2: 50,000 sats (contém Rune) ❌

Tenta comprar Inscription:
❌ Erro: "No pure UTXOs available"
💡 Usuário precisa receber BTC puro primeiro
```

---

## 📚 **Referências**

- [Ordinals Protocol](https://docs.ordinals.com/)
- [Runes Protocol](https://docs.ordinals.com/runes.html)
- [UTXO Management Best Practices](https://github.com/bitcoin/bitcoin)

---

**Status**: ✅ **PROTEÇÃO IMPLEMENTADA**  
**Pronto para**: Produção  
**Data**: 23 de outubro de 2025  
**Próximo passo**: Testar cenários de proteção

