# 🖼️ Inscription Details Screen - MyWallet Feature

## 📋 Overview

Quando o usuário clica em uma **Inscription no Ordinals tab**, ao invés de abrir **ordinals.com** em uma aba externa, a MyWallet agora mostra uma **tela de detalhes interna** com todas as informações da inscription, similar à tela de detalhes das Runes.

---

## ✨ Features

### 1️⃣ **Tela de Detalhes Completa**
- **Thumbnail grande** do conteúdo da inscription
- **Todas as informações** disponíveis no ordinals.com:
  - Inscription ID
  - Inscription Number (#)
  - Content Type
  - Content Length (bytes)
  - Output (Location - txid:vout)
  - Genesis Height
  - Genesis Fee
  - Timestamp
  - Sat Number
  - Address

### 2️⃣ **Botões de Ação**
- **Send** - Envia a inscription para outro endereço
- **List on Market** - Lista a inscription em marketplaces (coming soon)
- **View on Ordinals.com** - Abre ordinals.com em nova aba (fallback)

### 3️⃣ **Loading State**
- Spinner enquanto busca os dados do backend
- Error handling com mensagem amigável

---

## 🔧 Implementation

### **Backend**

#### 1. **Novo Endpoint:**
```javascript
GET /api/ordinals/details/:inscriptionId
```

**Resposta:**
```json
{
  "success": true,
  "inscription": {
    "id": "abc123...i0",
    "number": 78630547,
    "content_type": "image/png",
    "content_length": 12345,
    "output": "abc123...def456:0",
    "txid": "abc123...def456",
    "vout": 0,
    "genesis_height": 840000,
    "genesis_fee": 5000,
    "timestamp": "2024-01-01 12:00:00",
    "address": "bc1p...",
    "sat": 1234567890,
    "preview": "http://localhost:80/content/abc123...i0"
  }
}
```

#### 2. **Nova Função no `ordApi.js`:**
```javascript
async getInscriptionDetails(inscriptionId)
```

**Parseia HTML do ORD server** para extrair:
- Número da inscription
- Content Type e Length
- Output (location)
- Genesis Height e Fee
- Timestamp
- Sat Number
- Address

---

### **Frontend**

#### 1. **Nova Função:**
```javascript
async function showInscriptionDetails(inscription)
```

**Fluxo:**
1. Mostra loading screen
2. Busca detalhes do backend via `/api/ordinals/details/:id`
3. Renderiza UI completa com todos os dados
4. Adiciona event listeners para botões de ação

#### 2. **Click Handler Atualizado:**
```javascript
// ANTES (abria ordinals.com)
item.addEventListener('click', () => {
    const url = `https://ordinals.com/inscription/${inscription.id}`;
    chrome.tabs.create({ url });
});

// AGORA (mostra detalhes internos)
item.addEventListener('click', () => {
    showInscriptionDetails(inscription);
});
```

---

## 🎨 UI/UX

### **Layout:**
- **Header:** Botão ← voltar + Título (Inscription #12345)
- **Content:** Thumbnail grande (reutiliza `.rune-parent-preview`)
- **Info Grid:** Grid com todos os detalhes (reutiliza `.rune-info-grid`)
- **Actions:** 3 botões alinhados (reutiliza `.rune-actions`)

### **Estilo:**
- Reutiliza **CSS das Runes** (`.rune-details-screen`, `.rune-details-header`, etc)
- Cor roxa (`#8b5cf6`) para destacar Inscription Number
- Layout responsivo e clean

---

## 📊 Data Flow

```
User clicks Inscription Card
    ↓
showInscriptionDetails(inscription)
    ↓
Show Loading Spinner
    ↓
Fetch /api/ordinals/details/:id
    ↓
Backend: ordApi.getInscriptionDetails()
    ↓
Parse HTML from ORD server
    ↓
Return full details to frontend
    ↓
Update UI with complete data
    ↓
Add event listeners (Send, List, View)
```

---

## ✅ Benefits

1. **UX Melhorado** - Usuário não precisa sair da wallet
2. **Consistência** - Mesma experiência das Runes
3. **Informações Completas** - Todos os dados disponíveis
4. **Ações Rápidas** - Send e List disponíveis direto
5. **Fallback** - Ainda pode abrir ordinals.com se necessário

---

## 🚀 Future Enhancements

- [ ] Cache de detalhes para evitar re-fetch
- [ ] Suporte para inscriptions com HTML/Video
- [ ] Histórico de transferências da inscription
- [ ] Verificação de autenticidade (similar às Runes)
- [ ] Integração direta com marketplaces

---

## 📝 Files Changed

### Backend:
- `server/routes/ordinals.js` - Novo endpoint `/details/:inscriptionId`
- `server/utils/ordApi.js` - Nova função `getInscriptionDetails()`

### Frontend:
- `mywallet-extension/popup/popup.js` - Nova função `showInscriptionDetails()`
- Click handler atualizado para usar a nova função

---

**MyWallet Feature** - Inscription Details Screen v1.0  
**Status:** ✅ Implementado | **Tested:** Pending

