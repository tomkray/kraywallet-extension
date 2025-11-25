# 🐛 DEBUG: Por que as Runes não aparecem?

## ✅ Sistema está funcionando!

O popup está chamando o backend corretamente:
- ✅ `getRunes` message enviada
- ✅ Backend responde com `{success: true, runes: []}`
- ✅ Mas retorna **0 runes** (array vazio)

---

## 🔍 PROBLEMA IDENTIFICADO

O backend está retornando **0 runes** para o endereço:
```
bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx
```

---

## 📋 COMANDOS PARA EXECUTAR NO SEU TERMINAL

### 1. Verificar se o backend está rodando

```bash
curl http://localhost:3000/api/health
```

**Resultado esperado:**
```json
{"status":"ok"}
```

---

### 2. Testar endpoint de runes diretamente

```bash
ADDRESS="bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx"
curl "http://localhost:3000/api/runes/by-address/$ADDRESS"
```

**O que procurar:**
- Se retornar `{"success":true,"runes":[]}` → Backend não está encontrando runes
- Se retornar erro → Backend tem problema

---

### 3. Verificar UTXOs do endereço via Bitcoin Core

```bash
curl --user Tomkray7:bobeternallove77$ \
  --data-binary '{"jsonrpc":"1.0","method":"scantxoutset","params":["start", [{"desc":"addr(bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx)"}]]}' \
  http://127.0.0.1:8332/
```

**O que procurar:**
- `"unspents": []` → Endereço não tem UTXOs (não tem runes)
- `"unspents": [{...}]` → Endereço tem UTXOs (pode ter runes)

---

### 4. Se encontrou UTXOs, testar ORD Server

Copie um `txid` e `vout` do resultado anterior e teste:

```bash
# Exemplo (substitua pelos valores reais):
TXID="0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28"
VOUT="1"

curl "http://localhost:80/output/${TXID}:${VOUT}"
```

**O que procurar:**
- HTML com `<dt>runes</dt>` → UTXO tem runes!
- HTML sem `<dt>runes</dt>` → UTXO não tem runes

---

### 5. Verificar logs do backend

Se o backend está rodando em um terminal, olhe os logs lá.

Ou se está rodando em background:

```bash
tail -f /tmp/psbt-backend.log
```

**O que procurar:**
- `✅ Found X UTXOs` → Backend está encontrando UTXOs
- `✅ Checking UTXO: txid:vout` → Backend está verificando cada UTXO
- `✅ Found rune: DOG•GO•TO•THE•MOON` → Backend encontrou a rune!
- Erros vermelhos → Problema no backend

---

## 🎯 POSSÍVEIS CAUSAS

### Causa 1: Endereço não tem UTXOs
**Solução:** Envie runes para esse endereço

### Causa 2: UTXOs não têm runes
**Solução:** O UTXO específico não contém runes (pode ter sido gasto)

### Causa 3: ORD Server não está rodando
**Solução:** Iniciar ORD server na porta 80

```bash
# Verificar se ORD está rodando
curl http://localhost:80/
```

### Causa 4: ORD Server não indexou ainda
**Solução:** Aguardar indexação (pode levar 15-30 min após confirmação)

### Causa 5: Bitcoin Core não sincronizado
**Solução:** Aguardar sincronização completa

---

## 📊 TRANSAÇÃO CONHECIDA

Você mencionou que enviou DOG•GO•TO•THE•MOON para esse endereço.

**TXID da transação:** `0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28`

**Testar especificamente essa transação:**

```bash
# 1. Verificar se a transação está no Bitcoin Core
curl --user Tomkray7:bobeternallove77$ \
  --data-binary '{"jsonrpc":"1.0","method":"getrawtransaction","params":["0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28",true]}' \
  http://127.0.0.1:8332/

# 2. Verificar no ORD Server (output 1 tinha a rune)
curl "http://localhost:80/output/0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28:1"
```

---

## ✅ PRÓXIMOS PASSOS

1. Execute os comandos acima
2. Me envie os resultados
3. Vou identificar exatamente onde está o problema
4. Vou corrigir o código se necessário

---

## 🚀 LEMBRANDO

O sistema está **funcionando corretamente**:
- ✅ Frontend chama backend
- ✅ Backend responde
- ✅ Apenas não está **encontrando runes**

Precisamos descobrir **por que** não está encontrando!

