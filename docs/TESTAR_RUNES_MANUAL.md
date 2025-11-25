# 🧪 TESTE DE RUNES - PASSO A PASSO MANUAL

## ✅ CORREÇÕES APLICADAS:
- ✅ Corrigido erro em `runes-swap.js` (addEventListener null)
- ✅ Backend configurado para buscar runes via Bitcoin Core RPC + ORD Server
- ✅ Frontend pronto com CSS e tela de detalhes

---

## 📋 EXECUTAR MANUALMENTE:

### 1️⃣ PARAR PROCESSOS ANTIGOS

```bash
pkill -9 -f "node server/index.js"
```

### 2️⃣ INICIAR BACKEND (Em um terminal)

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
node server/index.js
```

Aguarde aparecer:
```
✅ Server running on http://localhost:3000
```

### 3️⃣ TESTAR ENDPOINT (Em outro terminal)

```bash
curl "http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
```

**Deve retornar JSON com:**
```json
{
  "success": true,
  "address": "bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx",
  "runes": [
    {
      "name": "DOG•GO•TO•THE•MOON",
      "displayName": "DOG•GO•TO•THE•MOON",
      "amount": "...",
      "symbol": "🐕",
      ...
    }
  ]
}
```

### 4️⃣ RECARREGAR MYWALLET

1. Abra: `chrome://extensions`
2. Encontre: **MyWallet - Bitcoin Ordinals Runes**
3. Clique: **🔄 Reload**

### 5️⃣ ABRIR MYWALLET

1. Clique no **ícone da MyWallet**
2. Vá para tab **"Runes"**
3. Deve aparecer:

```
┌────────────────────────────────────┐
│ [📷] DOG•GO•TO•THE•MOON  🐕   → │
│      [quantidade]                │
└────────────────────────────────────┘
```

### 6️⃣ CLICAR NA RUNE

Deve abrir tela completa com:
- **Parent image** (grande)
- **Rune name**
- **Your balance**
- **Total supply**
- **Etching transaction**
- **Botões:** Send, Receive, Swap

---

## 🔍 DEBUG SE NÃO FUNCIONAR:

### Console do Backend (terminal onde rodou `node server/index.js`):

Procure por:
- `✅ Found X UTXOs`
- `✅ Checking UTXO: TXID:VOUT`
- `✅ Found rune: DOG•GO•TO•THE•MOON`
- ❌ Erros vermelhos

### Console do Chrome (na página da MyWallet):

1. Pressione `F12`
2. Vá para tab **Console**
3. Procure por erros vermelhos

### Testar Manualmente o ORD Server:

```bash
# Primeiro, descubra o UTXO da rune consultando Bitcoin Core
curl --user Tomkray7:bobeternallove77$ \
  --data-binary '{"jsonrpc":"1.0","method":"scantxoutset","params":["start", [{"desc":"addr(bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx)"}]]}' \
  http://127.0.0.1:8332/

# Depois, use o TXID:VOUT retornado para consultar o ORD server
curl http://localhost:80/output/TXID:VOUT
```

O ORD server deve retornar HTML com:
```html
<dt>runes</dt>
<dd>
  <a href="/rune/DOG%E2%80%A2GO%E2%80%A2TO%E2%80%A2THE%E2%80%A2MOON">DOG•GO•TO•THE•MOON</a>: QUANTIDADE
</dd>
```

---

## ✅ CHECKLIST FINAL:

- [ ] Backend rodando sem erros
- [ ] Endpoint `/api/runes/by-address` retorna JSON correto
- [ ] MyWallet recarregada
- [ ] Tab "Runes" aberta
- [ ] Rune aparece na lista
- [ ] Detalhes completos ao clicar

---

## 🎯 RESULTADO ESPERADO:

Sua rune **DOG•GO•TO•THE•MOON 🐕** deve aparecer na MyWallet com:
- ✅ Thumbnail do parent
- ✅ Nome + símbolo
- ✅ Quantidade correta
- ✅ Detalhes completos

**TUDO FUNCIONANDO! 🚀🪙**

