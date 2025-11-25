# 🔧 KrayScan - Debug API Inscriptions

## 🎯 Problema Relatado

O frontend do KrayScan não está mostrando os thumbnails e números das inscriptions ao acessar:
```
http://localhost:3000/krayscan.html?txid=72e206ff59c5922d86f6816b077dcd85ad5d7433e47eed9e5c8200205385c628
```

## ✅ Verificações Realizadas

### 1. API Funcionando ✅
```bash
curl "http://localhost:3000/api/explorer/tx/72e206ff59c5922d86f6816b077dcd85ad5d7433e47eed9e5c8200205385c628"
```

**Resultado:**
```json
{
  "success": true,
  "inscriptions": [
    {
      "inscriptionId": "23c80e5a8c8a17f31f4c2839982d07e347a5974ee4372a6264c61f0f2471d02fi196",
      "inscriptionNumber": 98477263,
      "contentUrl": "http://127.0.0.1:80/content/...",
      "preview": "http://127.0.0.1:80/preview/...",
      "outputIndex": 0
    }
  ]
}
```
✅ **API está retornando os dados corretamente!**

### 2. HTML sendo servido ✅
```bash
curl "http://localhost:3000/krayscan.html"
```
✅ **HTML está sendo servido corretamente!**

### 3. CORS ✅
```
Access-Control-Allow-Origin: *
```
✅ **CORS está configurado corretamente!**

## 🔧 Correções Aplicadas

### 1. Bug no `renderActivities()` - Output Index

**Problema:** O código estava procurando outputs por valor em sats (546, 10000), mas a API retorna valores em **BTC** (0.00000555).

**Antes:**
```javascript
if (output.value === 546 || output.value === 10000) {
    outputIndex = i;
    // ...
}
```

**Depois:**
```javascript
// ✅ Usar outputIndex da inscription se disponível
let outputIndex = insc.outputIndex !== undefined ? insc.outputIndex : -1;

// Se temos o outputIndex, pegar os dados do output correto
if (outputIndex >= 0 && outputIndex < tx.vout.length) {
    const output = tx.vout[outputIndex];
    address = output.scriptpubkey_address || output.scriptPubKey?.address || 'N/A';
    scriptPubKey = output.scriptpubkey || output.scriptPubKey?.hex || '';
} else {
    // Fallback: converter BTC para sats e comparar
    for (let i = 0; i < tx.vout.length; i++) {
        const output = tx.vout[i];
        const valueSats = Math.floor(output.value * 100000000);
        
        if (valueSats <= 10000) {
            outputIndex = i;
            // ...
        }
    }
}
```

### 2. Logs de Debug Adicionados

Adicionado logs para facilitar debug no console do browser:

```javascript
function renderTransaction(data) {
    console.log('🎨 renderTransaction called with:', data);
    console.log('   Inscriptions:', data.inscriptions);
    console.log('   Runes:', data.runes);
    // ...
}

async function renderActivities(tx, inscriptions, runes) {
    console.log('🎨 renderActivities called');
    console.log('   TX:', tx.txid);
    console.log('   Inscriptions:', inscriptions);
    console.log('   Runes:', runes);
    // ...
}
```

## 📱 Como Testar

### Teste 1: API Direta
```bash
curl "http://localhost:3000/api/explorer/tx/72e206ff59c5922d86f6816b077dcd85ad5d7433e47eed9e5c8200205385c628" | python3 -m json.tool
```

### Teste 2: Arquivo de Teste Simples
```
http://localhost:3000/test-krayscan.html
```
Clique no botão "Test API" e veja o resultado no console.

### Teste 3: KrayScan Completo
```
http://localhost:3000/krayscan.html?txid=72e206ff59c5922d86f6816b077dcd85ad5d7433e47eed9e5c8200205385c628
```

**Abra o Console do Browser (F12) e verifique:**
1. ✅ Logs `🎨 renderTransaction called`
2. ✅ Logs `🎨 renderActivities called`
3. ✅ `Inscriptions: Array(1)`
4. ✅ Sem erros JavaScript

**No frontend deve aparecer:**
- 📦 Container "Activities"
- 🖼️ Thumbnail da inscription
- 📝 "Inscription #98477263"
- 📍 Output Index #0
- 📍 Endereço correto

## 🔍 Debug no Browser

Se ainda não aparecer, verificar no Console:

```javascript
// No console do browser:
fetch('/api/explorer/tx/72e206ff59c5922d86f6816b077dcd85ad5d7433e47eed9e5c8200205385c628')
  .then(r => r.json())
  .then(d => console.log('API Response:', d))
```

Deve mostrar o objeto completo com `inscriptions` array.

## 🎯 Próximos Passos

Se ainda não funcionar, verificar:
1. ❓ Cache do browser (Ctrl+Shift+R para hard refresh)
2. ❓ Service Worker (desabilitar temporariamente)
3. ❓ Extensions do browser interferindo
4. ❓ Rede local bloqueando requisições

---

**Data:** 31 de Outubro de 2025  
**Status:** 🔧 Debug Aplicado  
**Servidor:** ✅ Rodando em http://localhost:3000

