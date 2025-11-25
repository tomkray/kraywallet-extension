# 🖼️ MyWallet Thumbnail System

## 📋 Visão Geral

O **Thumbnail System** é responsável por exibir a **imagem do Parent Inscription** de cada Rune em todas as interfaces da MyWallet.

---

## 🎯 Como Funciona

### **1. Fonte dos Dados**

#### **Endpoint Backend:**
```
GET /api/runes/fast/:address
```

**Retorna:**
```json
{
  "runes": [
    {
      "name": "DOG•GO•TO•THE•MOON",
      "thumbnail": "http://localhost:80/content/abc123def456i0",
      "parent": "abc123def456i0",
      "runeId": "840000:3",
      "amount": 1000,
      "symbol": "🐕"
    }
  ]
}
```

#### **Campos Importantes:**
- **`thumbnail`** - URL completa da imagem (content do parent)
- **`parent`** - ID da parent inscription
- **`symbol`** - Emoji para fallback

---

## 🖼️ Hierarquia de Exibição

### **Prioridade:**

1. ✅ **`rune.thumbnail`** (novo endpoint, rápido)
2. ✅ **`rune.parentPreview`** (compatibilidade com endpoint antigo)
3. ✅ **`rune.symbol`** (emoji fallback)

### **Código (Exemplo):**

```javascript
${(rune.thumbnail || rune.parentPreview)
    ? `<img src="${rune.thumbnail || rune.parentPreview}" 
            alt="${rune.name}" 
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="fallback">${rune.symbol || '⧈'}</div>`
    : `<div class="fallback">${rune.symbol || '⧈'}</div>`
}
```

---

## 📱 Onde Aparece o Thumbnail

### **1. Runes Tab (Lista)**
- **Tamanho:** 52x52px
- **Posição:** Primeira coluna do grid
- **Badge:** 18x18px (canto superior direito)
- **Layout:** Grid alinhado (Thumb → Nome → Amount → Emoji)

```
╔════════════════════════════════════════╗
║ [🖼️✓] DOG•GO•TO•THE•MOON  1.00K  🐕 ║
╚════════════════════════════════════════╝
```

---

### **2. Rune Details Screen**
- **Tamanho:** Fullwidth (aspect-ratio 1:1)
- **Posição:** Topo da tela
- **Badge:** 48x48px (GRANDE, canto superior direito)
- **Border:** 1.5px solid rgba(255,255,255,0.15)

```
╔═══════════════════════════════╗
║  ← DOG•GO•TO•THE•MOON         ║
╠═══════════════════════════════╣
║  ┌──────────────────────┐    ║
║  │                     ✓│    ║
║  │   [Full Thumbnail]   │    ║
║  │                      │    ║
║  └──────────────────────┘    ║
║                               ║
║  RUNE ID: 840000:3            ║
║  BALANCE: 1,000               ║
╚═══════════════════════════════╝
```

---

### **3. Send Rune Screen**
- **Tamanho:** Padrão CSS (classe `.send-rune-icon`)
- **Posição:** Topo, acima do formulário
- **Badge:** 18x18px (se verificada)
- **Layout:** Horizontal com balance

```
╔═══════════════════════════════╗
║  ← Send DOG•GO•TO•THE•MOON    ║
╠═══════════════════════════════╣
║  ┌────────┐  Available Balance║
║  │ [Thumb]│  1,000 🐕         ║
║  └────────┘                   ║
║                               ║
║  [Recipient Address]          ║
║  [Amount]                     ║
║  [Fee Rate]                   ║
║  [Send Button]                ║
╚═══════════════════════════════╝
```

---

### **4. Burn Rune Screen**
- **Tamanho:** 120x120px (fixo)
- **Posição:** Centralizado, antes do warning
- **Badge:** 18x18px (se verificada)
- **Border:** 2px solid #ff4444 (vermelho)

```
╔═══════════════════════════════╗
║  ← 🔥 Burn DOG•GO•TO•THE•MOON ║
╠═══════════════════════════════╣
║       ┌──────────┐            ║
║       │ [Thumb] ✓│            ║
║       └──────────┘            ║
║                               ║
║  ⚠️ PERMANENT ACTION           ║
║  Burned runes are permanently ║
║  destroyed...                 ║
║                               ║
║  [Amount to Burn]             ║
║  [Burn Button]                ║
╚═══════════════════════════════╝
```

---

## 🛡️ Fallback System

### **Se a imagem falhar (404, timeout, CORS):**

1. ✅ **`onerror` handler** esconde a `<img>`
2. ✅ Mostra o **emoji fallback** (`.rune-thumbnail-fallback`)
3. ✅ Fallback é estilizado (background, tamanho do emoji)

### **Exemplo de Fallback:**

```javascript
<img src="${thumbnail}" 
     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
<div class="rune-thumbnail-fallback" style="display: none;">
    ${rune.symbol || '⧈'}
</div>
```

### **CSS do Fallback:**

```css
.rune-thumbnail-fallback {
    font-size: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    opacity: 0.7;
    background: rgba(255, 255, 255, 0.04);
}
```

---

## 🎨 Tamanhos e Estilos

| Localização | Tamanho | Border Radius | Badge | Border |
|-------------|---------|---------------|-------|--------|
| **Lista (Runes tab)** | 52x52px | 10px | 18px | 1.5px white |
| **Details Screen** | Fullwidth (1:1) | 12px | 48px | 1.5px white |
| **Send Screen** | Auto (CSS) | 8px | 18px | 1px white |
| **Burn Screen** | 120x120px | 12px | 18px | 2px red |

---

## 🔧 Backend (Como o Thumbnail é Obtido)

### **Endpoint: `/api/runes/fast/:address`**

**Lógica:**

1. Busca UTXOs do endereço (Mempool.space)
2. Para cada UTXO, verifica runes no ORD server (`/output/{txid}:{vout}`)
3. Agrega amounts por nome de rune
4. Para cada rune, busca detalhes no ORD (`/rune/{name}`)
5. Extrai **parent inscription ID** do HTML
6. Constrói URL do thumbnail: `http://localhost:80/content/{parent}`
7. Retorna JSON com `thumbnail`, `parent`, `runeId`

### **Código Relevante (Backend):**

```javascript
// server/routes/runes.js
const runeResponse = await axios.get(`${ORD_SERVER_URL}/rune/${rune.name}`);
const html = runeResponse.data;

// Extrair parent
let parent = null;
const parentMatch = html.match(/<dt>parent<\/dt>\s*<dd[^>]*>\s*<a[^>]+>([a-f0-9]{64}i\d+)<\/a>/i);
if (parentMatch) {
    parent = parentMatch[1];
}

runesWithDetails.push({
    name: rune.name,
    amount: rune.amount,
    parent: parent,
    thumbnail: parent ? `${ORD_SERVER_URL}/content/${parent}` : null
});
```

---

## ✅ Benefícios do Sistema

1. ✅ **Visual Atraente** - Usuários veem a arte da rune
2. ✅ **Identificação Rápida** - Reconhece rune pela imagem
3. ✅ **Fallback Robusto** - Nunca mostra erro, sempre tem emoji
4. ✅ **Performance** - Endpoint rápido (~5s vs 20s+)
5. ✅ **Consistência** - Mesmo thumbnail em todas as telas
6. ✅ **Verificação Visual** - Badge azul destaca runes verificadas

---

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────┐
│ 1. User abre Runes tab                      │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 2. Frontend chama /api/runes/fast/:address  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 3. Backend busca UTXOs (Mempool.space)      │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 4. Backend verifica runes (ORD /output)     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 5. Backend busca parent (ORD /rune/{name})  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 6. Backend retorna JSON com thumbnail URL   │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 7. Frontend renderiza <img src=thumbnail>   │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 8. Se falhar, mostra emoji fallback         │
└─────────────────────────────────────────────┘
```

---

## 📝 Exemplo Completo (Frontend)

```javascript
function createRuneItem(rune) {
    const item = document.createElement('div');
    item.className = 'rune-item';
    
    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'rune-thumbnail';
    
    const thumbnailUrl = rune.thumbnail || rune.parentPreview;
    
    if (thumbnailUrl) {
        const img = document.createElement('img');
        img.src = thumbnailUrl;
        img.alt = rune.name;
        img.onerror = () => {
            thumbnail.innerHTML = `<div class="rune-thumbnail-fallback">${rune.symbol || '⧈'}</div>`;
        };
        thumbnail.appendChild(img);
    } else {
        thumbnail.innerHTML = `<div class="rune-thumbnail-fallback">${rune.symbol || '⧈'}</div>`;
    }
    
    // Badge de verificado
    if (isRuneVerified(rune.name)) {
        const badge = document.createElement('div');
        badge.className = 'rune-verified-badge';
        thumbnail.appendChild(badge);
    }
    
    item.appendChild(thumbnail);
    return item;
}
```

---

## 🎯 Conclusão

O **Thumbnail System** da MyWallet:

✅ **Funciona em todas as telas** (Lista, Details, Send, Burn)  
✅ **Sempre tem fallback** (emoji se imagem falhar)  
✅ **Performance otimizada** (endpoint rápido)  
✅ **Visual profissional** (badges de verificação)  
✅ **Experiência consistente** (mesmo design em todo lugar)

---

**MyWallet Team**  
Building the best Runes experience on Bitcoin  
v1.0 - Janeiro 2025

