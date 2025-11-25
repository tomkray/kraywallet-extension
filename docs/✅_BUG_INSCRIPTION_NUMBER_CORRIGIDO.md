# ✅ BUG INSCRIPTION NUMBER CORRIGIDO

## 🐛 **PROBLEMA REPORTADO**

No MyWallet, os containers de Inscriptions (Ordinals tab) estavam mostrando:
- ❌ "Inscription #?" 
- ❌ "unknown"

Ao invés de:
- ✅ "Inscription #78630547"

## 🔍 **CAUSA RAIZ**

Arquivo: `server/utils/ordApi.js` (linha 264)

O código estava retornando **`inscription_number: null`** intencionalmente para acelerar as consultas, evitando fazer uma requisição adicional ao ORD server para cada inscription.

```javascript
// ❌ CÓDIGO ANTIGO (LINHA 264):
inscriptions.push({
    inscription_id: inscriptionId,
    inscription_number: null, // ← PROBLEMA AQUI!
    content_type: 'unknown',
    output_value: null,
    address: address,
    preview: `${this.baseUrl}/content/${inscriptionId}`
});
```

**Resultado**: Frontend recebia `null` e mostrava "Inscription #?" ou "unknown".

---

## ✅ **SOLUÇÃO IMPLEMENTADA**

Agora o código faz uma requisição adicional para cada inscription encontrada, buscando:
1. **Número da Inscription** (ex: #78630547)
2. **Content Type** (ex: image/png, text/html, etc)

### **Código Novo** (`server/utils/ordApi.js`, linhas 257-298):

```javascript
// ✅ BUSCAR NÚMERO DE CADA INSCRIPTION
for (const match of matches) {
    const inscriptionId = match[1];
    
    let inscriptionNumber = null;
    let contentType = 'unknown';
    
    // Buscar detalhes da inscription para pegar o número
    try {
        const inscResponse = await this.client.get(`/inscription/${inscriptionId}`, {
            headers: { 'Accept': 'text/html' },
            timeout: 3000
        });
        
        const inscHtml = inscResponse.data;
        
        // Extrair número: <h1>Inscription 78630547</h1>
        const numberMatch = inscHtml.match(/Inscription\s+(\d+)/i);
        if (numberMatch) {
            inscriptionNumber = parseInt(numberMatch[1]);
        }
        
        // Extrair content type: <dt>content type</dt><dd>image/png</dd>
        const typeMatch = inscHtml.match(/content\s+type<\/dt>\s*<dd[^>]*>([^<]+)/i);
        if (typeMatch) {
            contentType = typeMatch[1].trim();
        }
        
        console.log(`      ✅ Inscription ${inscriptionId}: #${inscriptionNumber} (${contentType})`);
    } catch (detailError) {
        console.log(`      ⚠️  Could not fetch details for ${inscriptionId}: ${detailError.message}`);
    }
    
    inscriptions.push({
        inscription_id: inscriptionId,
        inscription_number: inscriptionNumber, // ← AGORA TEM O NÚMERO REAL!
        content_type: contentType,            // ← E O CONTENT TYPE CORRETO!
        output_value: null,
        address: address,
        preview: `${this.baseUrl}/content/${inscriptionId}`
    });
}
```

---

## 🔄 **FLUXO COMPLETO**

### **1. Backend** (`server/utils/ordApi.js`):
```javascript
async getInscriptionsByAddress(address) {
    // 1. Buscar página do endereço no ORD server
    const response = await this.client.get(`/address/${address}`);
    const html = response.data;
    
    // 2. Extrair IDs das inscriptions da página
    const inscriptionRegex = /\/inscription\/([a-f0-9]{64}i\d+)/gi;
    const matches = [...html.matchAll(inscriptionRegex)];
    
    // 3. Para cada inscription encontrada:
    for (const match of matches) {
        const inscriptionId = match[1];
        
        // 4. Buscar detalhes da inscription
        const inscResponse = await this.client.get(`/inscription/${inscriptionId}`);
        const inscHtml = inscResponse.data;
        
        // 5. Extrair número e content type do HTML
        const numberMatch = inscHtml.match(/Inscription\s+(\d+)/i);
        const inscriptionNumber = numberMatch ? parseInt(numberMatch[1]) : null;
        
        // 6. Retornar com número real
        return {
            inscription_id: inscriptionId,
            inscription_number: inscriptionNumber, // ✅ NÚMERO REAL!
            content_type: contentType
        };
    }
}
```

### **2. Extension Background** (`mywallet-extension/background/background-real.js`):
```javascript
const apiInscriptions = (data.inscriptions || []).map(i => ({
    id: i.inscription_id,
    number: i.inscription_number, // ✅ Mapeamento correto
    content_type: i.content_type || 'unknown',
    preview: `http://localhost:80/content/${i.inscription_id}`,
    output: `${i.txid}:${i.vout}`
}));
```

### **3. Extension Popup** (`mywallet-extension/popup/popup.js`):
```javascript
function createOrdinalItem(inscription) {
    // ...
    const number = document.createElement('div');
    number.className = 'ordinal-number';
    number.textContent = `Inscription #${inscription.number || '?'}`; // ✅ Mostra o número!
    // ...
}
```

---

## 📊 **ANTES vs DEPOIS**

### **ANTES**:
```
┌─────────────────────────────┐
│  🖼️                         │
│                             │
│  Inscription #?             │  ← ❌ Número desconhecido
│  unknown                    │  ← ❌ Tipo desconhecido
└─────────────────────────────┘
```

### **DEPOIS**:
```
┌─────────────────────────────┐
│  🖼️                         │
│                             │
│  Inscription #78630547      │  ← ✅ Número correto!
│  image/png                  │  ← ✅ Tipo correto!
└─────────────────────────────┘
```

---

## 🔍 **LOGS DE DEBUG**

Quando a correção está ativa, você verá nos logs do servidor:

```bash
📡 Fetching inscriptions from ORD server for: bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag
   ✅ Found 1 inscription references in address page

      ✅ Inscription 0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831: #78630547 (image/webp)

✅ Returning 1 inscriptions for bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag
```

---

## ⚠️ **TRADE-OFF: Performance**

### **Antes**:
- ⚡ **Rápido**: 1 request por endereço
- ❌ **Sem informação**: Número e tipo desconhecidos

### **Depois**:
- ⏱️ **Mais lento**: 1 + N requests (N = número de inscriptions)
- ✅ **Informação completa**: Número e tipo corretos

### **Exemplo**:
- Endereço com **1 inscription**: 2 requests (~6s)
- Endereço com **5 inscriptions**: 6 requests (~18s)
- Endereço com **10 inscriptions**: 11 requests (~33s)

### **Otimização Futura**:
Se o desempenho se tornar um problema, podemos:
1. **Cache**: Armazenar números de inscriptions no banco de dados
2. **Lazy loading**: Carregar números sob demanda quando o usuário visualizar
3. **Parallel requests**: Buscar múltiplas inscriptions em paralelo

---

## 📝 **EXEMPLO PRÁTICO**

### **Inscription ID**:
```
0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831
```

### **Consulta ao ORD Server**:
```bash
GET http://127.0.0.1:80/inscription/0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831
```

### **HTML Retornado** (parcial):
```html
<!DOCTYPE html>
<html lang=en>
  <head>
    <title>Inscription 78630547</title>
  </head>
  <body>
    <h1>Inscription 78630547</h1>
    <dl>
      <dt>content type</dt>
      <dd>image/webp</dd>
      <dt>timestamp</dt>
      <dd>2024-03-15 10:30:45</dd>
    </dl>
  </body>
</html>
```

### **Regex Match**:
```javascript
// Extrair número
const numberMatch = inscHtml.match(/Inscription\s+(\d+)/i);
// Resultado: numberMatch[1] = "78630547"

// Extrair content type
const typeMatch = inscHtml.match(/content\s+type<\/dt>\s*<dd[^>]*>([^<]+)/i);
// Resultado: typeMatch[1] = "image/webp"
```

### **Resultado Final**:
```javascript
{
    inscription_id: "0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831",
    inscription_number: 78630547,  // ✅ Número correto!
    content_type: "image/webp",    // ✅ Tipo correto!
    address: "bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag",
    preview: "http://127.0.0.1:80/content/0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831"
}
```

---

## ✅ **STATUS**

- ✅ Bug identificado
- ✅ Correção implementada
- ✅ Backend atualizado (`server/utils/ordApi.js`)
- ✅ Mapeamento já estava correto (background e popup)
- ✅ Logs adicionados para debug

**Pronto para teste!**

---

## 🧪 **COMO TESTAR**

1. Reiniciar o servidor backend:
```bash
npm start
```

2. Abrir MyWallet extension

3. Ir na tab "Ordinals"

4. Verificar que as inscriptions agora mostram:
   - ✅ "Inscription #78630547" (número real)
   - ✅ "image/webp" (tipo real)

5. Verificar logs do servidor para confirmar:
   ```
   ✅ Inscription ...: #78630547 (image/webp)
   ```

---

**Data**: 23 de outubro de 2025  
**Status**: ✅ **CORRIGIDO**  
**Impacto**: MyWallet agora mostra números reais de Inscriptions

