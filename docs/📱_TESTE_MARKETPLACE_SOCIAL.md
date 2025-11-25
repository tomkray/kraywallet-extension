# 📱 TESTE DO MARKETPLACE SOCIAL - PASSO A PASSO

## 🎯 O QUE VAMOS TESTAR

1. ✅ Listar uma Inscription dentro da KrayWallet Extension
2. ✅ Ver a listing aparecer no perfil público
3. ✅ Compartilhar o perfil (Twitter/Telegram/WhatsApp/QR Code)
4. ✅ Ver a oferta individual com Open Graph
5. ✅ Testar o fluxo completo do "post social"

---

## 🚀 PASSO 1: ABRIR A KRAYWALLET EXTENSION

### 1.1. Carregar a Extension no Chrome

```
1. Abra Chrome
2. Vá em: chrome://extensions/
3. Ative "Developer mode" (canto superior direito)
4. Click "Load unpacked"
5. Selecione a pasta: /Volumes/D2/KRAY WALLET/kraywallet-extension
6. ✅ Extension carregada!
```

### 1.2. Unlock a Wallet

```
1. Click no ícone da KrayWallet na toolbar
2. Se já tem wallet:
   • Digite password
   • Click "Unlock"
   
3. Se não tem wallet:
   • Click "Create New Wallet"
   • Digite password
   • Salve a seed phrase
   • Click "Create Wallet"
```

**⚠️ IMPORTANTE:** Você precisa ter:
- Uma wallet com BTC balance
- Pelo menos 1 Inscription (Ordinal)
- Endereço Taproot (bc1p...)

---

## 🖼️ PASSO 2: LISTAR UMA INSCRIPTION

### 2.1. Navegar até Ordinals

```
1. Na tela principal da wallet
2. Veja suas Inscriptions na lista
3. Cada card tem 2 botões:
   • 📋 List (novo!)
   • 📤 Send
```

### 2.2. Clicar em "📋 List"

```
1. Click no botão "📋 List" de qualquer Inscription
2. ✅ Abre tela full-screen "List on Market"
```

**Você verá:**

```
┌────────────────────────────────────────┐
│          📋 List on Market      ←      │
├────────────────────────────────────────┤
│                                        │
│  [PREVIEW GRANDE DA INSCRIPTION]       │
│                                        │
│  Inscription #12345                    │
│  ID: abc123...def456                   │
│                                        │
│  💰 Price (sats)                       │
│  Minimum: 1,000 sats                   │
│  [10000...........................]     │
│                                        │
│  💬 Your Post (optional)               │
│  Share your story, make it viral! 🚀  │
│                                        │
│  [Share your story... Why is this      │
│   inscription special? What's the      │
│   background? Make it engaging! 🚀     │
│                                        │
│   Example: 'One of the first 10K       │
│   inscriptions! Minted during the      │
│   Ordinals gold rush. Rare piece of    │
│   Bitcoin history. 🔥']                │
│                                        │
│  💡 Tip: Good stories sell better!     │
│  0 / 500 characters                    │
│                                        │
│  ╔══════════════════════════════════╗  │
│  ║ You will receive                 ║  │
│  ║ 10,000 sats 💰                   ║  │
│  ║                                  ║  │
│  ║ ⚡ Buyer pays network fees       ║  │
│  ╚══════════════════════════════════╝  │
│                                        │
│  ℹ️  Your inscription will be listed  │
│  ✅ You can cancel anytime             │
│  🔒 Stays in your wallet until sold    │
│                                        │
│       [📋 Create Listing]              │
└────────────────────────────────────────┘
```

### 2.3. Preencher o Formulário

**Exemplo 1 (Simples):**
```
Price: 10000
Post: "🎨 My first Ordinal! Special to me. 1/1 💎"
```

**Exemplo 2 (Com História):**
```
Price: 25000
Post: "⚡ Inscription #7834 - minted during the first week of Ordinals! Rare piece of Bitcoin history. Only selling because need funds for new project. 🔥"
```

**Exemplo 3 (Meme):**
```
Price: 5000
Post: "😂 This meme was created at 3am. No regrets. Bitcoin culture at its finest. WAGMI! 🚀"
```

### 2.4. Criar a Listing

```
1. Preencha o price (mínimo 1,000 sats)
2. Escreva seu post (opcional, mas recomendado!)
3. Veja o character counter mudar de cor:
   • 0-400: Gray
   • 401-450: Orange
   • 451-500: Red (chegando no limite!)
4. Veja o summary: "You will receive X sats"
5. Click "📋 Create Listing"
```

**O que acontece:**
```
1. Extension pega details da Inscription
   ↓
2. Chama backend: /api/sell/create-custom-psbt
   ↓
3. Backend cria PSBT com SIGHASH_NONE|ANYONECANPAY
   ↓
4. Extension assina o PSBT
   ↓
5. Salva no banco de dados: /api/offers
   ↓
6. ✅ Listing criada!
   ↓
7. Volta para tela principal
```

### 2.5. Verificar a Listing

```
1. Na tela principal, vá para Settings (⚙️)
2. Click "📋 My Market Listings"
3. ✅ Você verá sua listing!
```

**Você verá um card:**
```
┌────────────────────────────────────┐
│ [PREVIEW DA INSCRIPTION]           │
│                                    │
│ Inscription #12345                 │
│ "🎨 My first Ordinal! Special..."  │
│                                    │
│ 💰 10,000 sats                     │
│ 🕒 Just now                        │
│                                    │
│ [Cancel] [Share]                   │
└────────────────────────────────────┘
```

---

## 🎭 PASSO 3: VER O PERFIL PÚBLICO

### 3.1. Abrir o Perfil

```
1. Na extension, vá para Settings (⚙️)
2. Scroll até "🛠️ Wallet Tools"
3. Click "🎭 My Public Profile"
4. ✅ Abre nova tab com seu perfil!
```

**URL do perfil:**
```
http://localhost:3000/profile.html?address=bc1p...
```

### 3.2. O que você verá

```
┌────────────────────────────────────────────┐
│            KRAY STATION                    │
├────────────────────────────────────────────┤
│                                            │
│            🎭 (Avatar)                     │
│                                            │
│         bc1pvz02...hlk9q                   │
│         (seu endereço)                     │
│                                            │
│  ┌──────┬──────┬──────────┐               │
│  │  1   │  0   │  10,000  │               │
│  │Active│ Sold │  Volume  │               │
│  └──────┴──────┴──────────┘               │
│                                            │
│  [📱 Share Profile] [📋 Copy Link]        │
│                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  🖼️ Ordinals | 🪙 Runes | 💧 Pools       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                            │
│  ┌─────────────────┐                      │
│  │ [INSCRIPTION]   │                      │
│  │                 │                      │
│  │ Inscription     │                      │
│  │ #12345          │                      │
│  │                 │                      │
│  │ "🎨 My first    │                      │
│  │  Ordinal!..."   │                      │
│  │                 │                      │
│  │ 💰 10,000 sats  │                      │
│  │ 🕒 2 hours ago  │                      │
│  └─────────────────┘                      │
│                                            │
└────────────────────────────────────────────┘
```

**✅ Seu perfil público está funcionando!**

- Stats aparecem (Active Offers / Sold / Volume)
- Inscription listada aparece
- Tabs para Ordinals / Runes / Pools
- Botões de share funcionando

---

## 📱 PASSO 4: COMPARTILHAR O PERFIL

### 4.1. Click "📱 Share Profile"

**Abre modal bonito:**
```
┌────────────────────────────────────┐
│  📱 Share Profile             ✕    │
│  Share this Bitcoin marketplace    │
│  profile                           │
│                                    │
│  [🐦 Twitter] [✈️ Telegram]        │
│  [💬 WhatsApp] [📋 Copy Link]      │
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │     [QR CODE AQUI]           │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│  Scan to view this profile         │
│                                    │
│  http://localhost:3000/profile...  │
└────────────────────────────────────┘
```

### 4.2. Testar cada botão

**🐦 Twitter:**
```
1. Click "🐦 Twitter"
2. Abre Twitter Web Intent
3. Tweet pré-preenchido:
   "Check out my Bitcoin marketplace profile 
    on KRAY STATION! 🚀
    
    bc1pvz02...hlk9q
    
    [URL]"
4. ✅ Pronto para tweetar!
```

**✈️ Telegram:**
```
1. Click "✈️ Telegram"
2. Abre Telegram Share
3. Mensagem pré-preenchida
4. Escolhe contato ou grupo
5. ✅ Compartilhado!
```

**💬 WhatsApp:**
```
1. Click "💬 WhatsApp"
2. Abre WhatsApp Web
3. Mensagem pré-preenchida
4. Escolhe contato
5. ✅ Enviado!
```

**📋 Copy Link:**
```
1. Click "📋 Copy Link"
2. Botão muda para "✅ Copied!"
3. Link copiado para clipboard
4. ✅ Cole onde quiser!
```

**QR Code:**
```
1. QR Code gerado automaticamente
2. Scan com celular
3. Abre o perfil público
4. ✅ Funciona offline!
```

---

## 🔍 PASSO 5: VER A OFERTA INDIVIDUAL

### 5.1. Click na Oferta

```
1. No perfil público
2. Click em qualquer oferta da grid
3. ✅ Abre página individual da oferta!
```

**URL da oferta:**
```
http://localhost:3000/offer.html?id=offer_abc123
```

### 5.2. O que você verá

```
┌────────────────────────────────────────────────┐
│              KRAY STATION                      │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────┐  ┌──────────────────┐   │
│  │                  │  │ 🖼️ Ordinal       │   │
│  │   [PREVIEW]      │  │                  │   │
│  │   GRANDE DA      │  │ Inscription      │   │
│  │   INSCRIPTION    │  │ #12345           │   │
│  │                  │  │                  │   │
│  │                  │  │ ┌──────────────┐ │   │
│  │                  │  │ │ 🎭  Owned by │ │   │
│  │                  │  │ │ bc1pvz02...  │ │   │
│  │                  │  │ │ [View Profile]│ │   │
│  │                  │  │ └──────────────┘ │   │
│  │                  │  │                  │   │
│  │                  │  │ 💬 Seller's Post │   │
│  │                  │  │ "🎨 My first     │   │
│  │                  │  │  Ordinal!        │   │
│  │                  │  │  Special to me.  │   │
│  │                  │  │  1/1 💎"         │   │
│  │                  │  │                  │   │
│  │                  │  │ ╔══════════════╗ │   │
│  │                  │  │ ║ Current Price║ │   │
│  │                  │  │ ║ 💰 10,000    ║ │   │
│  │                  │  │ ║ sats         ║ │   │
│  │                  │  │ ║ ≈ $100 USD   ║ │   │
│  │                  │  │ ╚══════════════╝ │   │
│  │                  │  │                  │   │
│  │                  │  │ [🛒 Buy Now]     │   │
│  │                  │  │ [📱 Share]       │   │
│  │                  │  │                  │   │
│  │                  │  │ ━━━━━━━━━━━━━━━ │   │
│  │                  │  │ Status: ✅Active│   │
│  │                  │  │ Listed: Today   │   │
│  │                  │  │ ID: abc123...   │   │
│  │                  │  │ Type: ordinals  │   │
│  └──────────────────┘  └──────────────────┘   │
│                                                │
└────────────────────────────────────────────────┘
```

**✅ Oferta individual funcionando!**

- Preview grande da Inscription
- Seller info (avatar + endereço)
- Post social aparecendo
- Price card destacado
- Botão Buy Now (placeholder)
- Botão Share (funcional!)
- Metadata (Status, Date, ID, Type)

### 5.3. Compartilhar a Oferta

```
1. Click "📱 Share"
2. Abre mesmo modal de share
3. Mas com texto diferente:
   "Check out this Bitcoin inscription 
    on KRAY STATION! 🚀
    
    Inscription #12345 for 10,000 sats
    
    [URL]"
4. ✅ Share individual da oferta!
```

**Open Graph funcionando:**
- Twitter mostra preview da Inscription
- Facebook mostra card bonito
- Telegram mostra thumbnail
- WhatsApp mostra link preview

---

## 📊 PASSO 6: VERIFICAR O BANCO DE DADOS

### 6.1. Ver as Offers no DB

```bash
cd /Volumes/D2/KRAY\ WALLET
sqlite3 server/database.db "SELECT id, type, inscription_id, offer_amount, status, created_at FROM offers ORDER BY created_at DESC LIMIT 5;"
```

**Você verá:**
```
offer_abc123|ordinals|abc123...def456|10000|active|2025-10-24 12:34:56
```

### 6.2. Ver via API

```bash
curl "http://localhost:3000/api/offers?address=bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx" | jq
```

**Response:**
```json
{
  "success": true,
  "offers": [
    {
      "id": "offer_abc123",
      "type": "ordinals",
      "inscription_id": "abc123...def456",
      "offer_amount": 10000,
      "description": "🎨 My first Ordinal! Special to me. 1/1 💎",
      "creator_address": "bc1pvz02...",
      "status": "active",
      "created_at": "2025-10-24 12:34:56"
    }
  ]
}
```

---

## 🎯 CHECKLIST DE TESTE

### ✅ Extension (KrayWallet)
- [ ] Botão "📋 List" aparece em cada Inscription
- [ ] Click abre tela full-screen
- [ ] Preview grande da Inscription
- [ ] Input de price (mínimo 1,000 sats)
- [ ] Campo "Your Post" com placeholder
- [ ] Character counter (0/500)
- [ ] Cores mudam (gray → orange → red)
- [ ] Summary: "You will receive X sats"
- [ ] Info box: "Buyer pays network fees"
- [ ] Click "Create Listing" funciona
- [ ] Listing aparece em "My Market Listings"
- [ ] Botão "Cancel" funciona
- [ ] Botão "Share" (placeholder)

### ✅ Profile Page
- [ ] Settings → "My Public Profile" abre nova tab
- [ ] URL: profile.html?address=...
- [ ] Avatar aparece (🎭)
- [ ] Endereço aparece
- [ ] Stats aparecem (Active/Sold/Volume)
- [ ] Tabs (Ordinals/Runes/Pools) funcionam
- [ ] Offers aparecem na grid
- [ ] Click em offer abre offer.html
- [ ] Botão "Share Profile" funciona
- [ ] Botão "Copy Link" funciona

### ✅ Offer Page
- [ ] URL: offer.html?id=...
- [ ] Preview grande da Inscription
- [ ] Seller info aparece
- [ ] Post social aparece
- [ ] Price card destacado
- [ ] Botão "Buy Now" (placeholder)
- [ ] Botão "Share" funciona
- [ ] Metadata aparece

### ✅ Share Modal
- [ ] Modal abre bonito
- [ ] QR Code gerado
- [ ] URL exibida
- [ ] Botão Twitter funciona
- [ ] Botão Telegram funciona
- [ ] Botão WhatsApp funciona
- [ ] Botão Copy Link funciona
- [ ] ESC fecha modal
- [ ] Click fora fecha modal

### ✅ Backend/Database
- [ ] Offer salva no DB
- [ ] API /api/offers retorna offers
- [ ] API /api/offers?address=... filtra por address
- [ ] API /api/offers/:id retorna offer específica

---

## 🚨 TROUBLESHOOTING

### Problema 1: Listing não aparece no perfil
```
1. Verifique se o servidor está rodando (porta 3000)
2. Abra Console do browser (F12)
3. Veja se há erros na network tab
4. Verifique se a offer foi salva no DB:
   sqlite3 server/database.db "SELECT * FROM offers;"
```

### Problema 2: QR Code não aparece
```
1. Verifique se o CDN está carregando:
   https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
2. Abra Console e veja erros
3. Se necessário, baixe local
```

### Problema 3: Share não funciona
```
1. Teste se navigator.clipboard funciona
2. Verifique HTTPS (localhost é OK)
3. Veja se há bloqueio de popup
```

---

## 🎉 PRÓXIMOS PASSOS

Depois de testar tudo:

1. [ ] Implementar "Buy Now" flow (Fase 6)
2. [ ] Adicionar likes/comments (futuro)
3. [ ] Create feed de marketplace (futuro)
4. [ ] Implement follow system (futuro)
5. [ ] Add notifications (futuro)

---

**🚀 DIVIRTA-SE TESTANDO O MARKETPLACE SOCIAL! 📱**

É REVOLUCIONÁRIO! 🔥
