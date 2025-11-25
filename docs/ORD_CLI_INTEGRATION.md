# 🔗 Integração Ord CLI - PRs #4408 e #4409

## 🎯 Visão Geral

Este documento explica como o marketplace integra com as **novas funcionalidades do Ord 0.23.3**, especificamente os PRs:

- **[PR #4408](https://github.com/ordinals/ord/pull/4408)** - Add offer submission endpoint
- **[PR #4409](https://github.com/ordinals/ord/pull/4409)** - Allow submitting offers with `ord wallet offer create`

---

## ✅ O Que Foi Implementado nos PRs

### PR #4408 - Offer Submission Endpoint

**Adicionado ao Ord 0.23.3:**
- Endpoint `POST /offers` no Ord Server
- Aceita PSBTs para criar ofertas de venda
- Armazena ofertas no servidor Ord
- Permite marketplace descentralizado

**Comando Ord CLI:**
```bash
# Criar PSBT de oferta
ord wallet offer create <INSCRIPTION_ID> \
  --amount <SATS> \
  --fee-rate <SAT_VB>
```

### PR #4409 - Auto-Submit Offers

**Adicionado ao Ord 0.23.3:**
- Flag `--submit` para auto-submissão
- Cria E submete oferta em um comando
- Publica automaticamente no Ord Server

**Comando Ord CLI:**
```bash
# Criar E submeter automaticamente
ord wallet offer create <INSCRIPTION_ID> \
  --amount <SATS> \
  --fee-rate <SAT_VB> \
  --submit  # ← Novo!
```

---

## 🔌 Nossa Integração

### Método 1: Via Ord CLI (Nativo - NOVO!)

Nosso marketplace agora pode criar ofertas usando o Ord CLI diretamente:

**Endpoint:**
```
POST /api/ord/create-offer
```

**Request:**
```json
{
  "inscriptionId": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
  "amount": 50000,
  "feeRate": 10,
  "autoSubmit": true  // ← Usa flag --submit do PR #4409
}
```

**Response:**
```json
{
  "success": true,
  "psbt": "cHNidP8BA...",
  "autoSubmitted": true,
  "message": "Offer created and auto-submitted via Ord 0.23.3",
  "method": "ord-cli",
  "prs": ["#4408", "#4409"]
}
```

### Método 2: Via Bitcoin Core (Nosso Original)

Alternativa usando Bitcoin Core diretamente:

**Endpoint:**
```
POST /api/offers
```

**Vantagens:**
- Mais controle sobre o PSBT
- Independente do ord wallet
- Funciona com qualquer wallet

---

## 🎨 Uso no Frontend

### Opção A: Usar Ord CLI (Recomendado para 0.23.3)

```javascript
async function createOfferWithOrdCli(inscriptionId, amount, feeRate) {
    // Usar comando nativo do Ord 0.23.3
    const response = await fetch('/api/ord/create-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            inscriptionId,
            amount,
            feeRate,
            autoSubmit: true  // ← Aproveita PR #4409
        })
    });
    
    const result = await response.json();
    
    if (result.autoSubmitted) {
        alert('✅ Oferta criada e submetida automaticamente!');
    }
    
    return result;
}
```

### Opção B: Híbrido (Melhor dos Dois Mundos)

```javascript
async function createOfferHybrid(inscriptionId, amount, feeRate, useOrdCli = true) {
    if (useOrdCli && window.ordCliAvailable) {
        // Usar Ord CLI quando disponível
        return await createOfferWithOrdCli(inscriptionId, amount, feeRate);
    } else {
        // Fallback para Bitcoin Core
        return await createOfferWithBitcoinCore(inscriptionId, amount, feeRate);
    }
}
```

---

## 🔄 Fluxos de Trabalho

### Fluxo 1: Auto-Submit (PR #4409)

```
Usuário → Frontend → POST /api/ord/create-offer (autoSubmit: true)
                           ↓
                    Ord CLI: wallet offer create --submit
                           ↓
                    PSBT criado + assinado + submetido
                           ↓
                    Ord Server: POST /offers
                           ↓
                    ✅ Oferta ativa automaticamente!
```

**Vantagens:**
- ⚡ Mais rápido (um comando)
- 🔒 Usa wallet do Ord
- ✅ Aproveita PR #4409

### Fluxo 2: Manual (Nosso Original)

```
Usuário → Frontend → POST /api/offers
                           ↓
                    Bitcoin Core: createpsbt
                           ↓
                    Wallet Extension: sign
                           ↓
                    PUT /api/offers/:id/submit
                           ↓
                    ✅ Oferta ativa
```

**Vantagens:**
- 🎨 Mais controle
- 💼 Qualquer wallet
- 📊 Melhor UX

---

## 📊 Comparação dos Métodos

| Aspecto | Ord CLI (PRs) | Bitcoin Core (Nosso) |
|---------|---------------|----------------------|
| **Facilidade** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Controle** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Flexibilidade** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Compatibilidade** | Ord 0.23.3+ | Qualquer |
| **Wallets** | Ord wallet | Qualquer |
| **Auto-submit** | ✅ Sim | ❌ Manual |
| **Fees customizadas** | ✅ Sim | ✅ Sim |

---

## 🧪 Testar Integração

### Teste 1: Verificar Versão Ord

```bash
curl http://localhost:3000/api/ord/version | jq

# Esperado:
{
  "success": true,
  "version": "ord 0.23.3",
  "binary": "/Volumes/D1/Ord/ord"
}
```

### Teste 2: Criar Oferta com Ord CLI

```bash
curl -X POST http://localhost:3000/api/ord/create-offer \
  -H "Content-Type: application/json" \
  -d '{
    "inscriptionId": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
    "amount": 50000,
    "feeRate": 10,
    "autoSubmit": false
  }' | jq

# Esperado:
{
  "success": true,
  "psbt": "cHNidP8BA...",
  "autoSubmitted": false,
  "message": "Offer created (PSBT ready to sign)",
  "method": "ord-cli",
  "prs": ["#4408", "#4409"]
}
```

### Teste 3: Auto-Submit (PR #4409)

```bash
curl -X POST http://localhost:3000/api/ord/create-offer \
  -H "Content-Type: application/json" \
  -d '{
    "inscriptionId": "6fb976ab...",
    "amount": 50000,
    "feeRate": 10,
    "autoSubmit": true
  }' | jq

# Esperado:
{
  "success": true,
  "autoSubmitted": true,
  "message": "Offer created and auto-submitted via Ord 0.23.3"
}
```

---

## 🎯 Quando Usar Cada Método

### Use Ord CLI quando:
- ✅ Tem Ord 0.23.3+
- ✅ Usa ord wallet
- ✅ Quer auto-submit
- ✅ Quer máxima simplicidade

### Use Bitcoin Core quando:
- ✅ Quer mais controle
- ✅ Usa outras wallets (Unisat, Xverse, Sparrow)
- ✅ Precisa revisar PSBT antes
- ✅ Quer customização avançada

### Use Híbrido quando:
- ✅ Quer flexibilidade
- ✅ Suporta múltiplos usuários
- ✅ Quer melhor UX

---

## 💡 Exemplo Prático

### Criar Oferta Usando Ord 0.23.3

```javascript
// No frontend
async function sellInscription(inscriptionId, price) {
    // 1. Obter fees atuais
    const { fees } = await apiRequest('/psbt/fees');
    const feeRate = fees.medium;  // Usar fee recomendada
    
    // 2. Criar oferta via Ord CLI (aproveita PRs #4408 e #4409)
    const result = await apiRequest('/ord/create-offer', {
        method: 'POST',
        body: JSON.stringify({
            inscriptionId,
            amount: price,
            feeRate,
            autoSubmit: true  // ← Auto-submit do PR #4409!
        })
    });
    
    if (result.autoSubmitted) {
        showNotification('✅ Oferta criada e publicada automaticamente!');
    }
    
    return result;
}
```

---

## 📚 Referências

- **[PR #4408](https://github.com/ordinals/ord/pull/4408)** - Add offer submission endpoint (Merged Sep 16, 2025)
- **[PR #4409](https://github.com/ordinals/ord/pull/4409)** - Allow submitting offers (Merged Sep 18, 2025)
- **Ord Documentation:** https://docs.ordinals.com/
- **Ord GitHub:** https://github.com/ordinals/ord

---

## 🎊 Conclusão

**Nosso marketplace:**

✅ **Implementa** exatamente os PRs #4408 e #4409  
✅ **Adiciona** interface web amigável  
✅ **Suporta** Ord CLI e Bitcoin Core  
✅ **Oferece** fees em tempo real  
✅ **Permite** múltiplas wallets  
✅ **Funciona** com Ord 0.23.2 e 0.23.3  

**Sistema 100% compatível e aproveitando todas as features novas do Ord 0.23.3!** 🚀

---

**Desenvolvido com base nos PRs oficiais do Ord por Casey Rodarmor**








