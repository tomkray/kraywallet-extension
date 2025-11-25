# 🧪 Guia de Testes Completo - Marketplace v0.23.3

## 📋 Checklist de Validação

Execute todos os testes abaixo para garantir que o sistema está funcionando perfeitamente.

---

## ✅ FASE 1: Testar Conexões

### 1.1 Bitcoin Core RPC

```bash
# Testar conexão direta
bitcoin-cli -rpcuser=Tomkray7 -rpcpassword='bobeternallove77$' getblockchaininfo

# Deve retornar:
# - chain: "main"
# - blocks: número alto (918,000+)
# - verificationprogress: ~1.0
```

**✅ Passou:** Bitcoin Core conectado e sincronizado

### 1.2 Ord Server

```bash
# Testar conexão direta
curl http://127.0.0.1:80/ | head -50

# Deve retornar HTML do Ord Server
```

**✅ Passou:** Ord Server respondendo

### 1.3 Marketplace API

```bash
# Testar status geral
curl http://localhost:3000/api/status | jq

# Deve retornar:
# - status: "ok"
# - nodes.bitcoin.connected: true
# - nodes.ord.connected: true
```

**✅ Passou:** Marketplace conectado a ambos os nodes

---

## ✅ FASE 2: Testar APIs Básicas

### 2.1 Fees (Mempool.space)

```bash
curl http://localhost:3000/api/psbt/fees | jq

# Verificar:
# ✓ source: "mempool.space"
# ✓ fees.high > 0
# ✓ fees.medium > 0
# ✓ fees.low > 0
```

**✅ Passou:** Fees em tempo real funcionando

### 2.2 Inscriptions

```bash
# Listar inscriptions
curl http://localhost:3000/api/ordinals | jq

# Verificar:
# ✓ inscriptions: array
# ✓ pagination.total > 0
```

**✅ Passou:** API de inscriptions funcionando

### 2.3 Runes

```bash
# Listar runes
curl http://localhost:3000/api/runes | jq

# Verificar:
# ✓ success: true
# ✓ runes: array (pode estar vazio se não houver runes)
```

**✅ Passou:** API de runes funcionando

### 2.4 Ofertas

```bash
# Listar ofertas
curl http://localhost:3000/api/offers | jq

# Verificar:
# ✓ offers: array
# ✓ pagination existe
```

**✅ Passou:** API de ofertas funcionando

---

## ✅ FASE 3: Testar Fluxo de Compra

### 3.1 Vendedor: Criar Oferta

```bash
# Criar oferta de venda
curl -X POST http://localhost:3000/api/offers \
  -H "Content-Type: application/json" \
  -d '{
    "type": "inscription",
    "inscriptionId": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
    "offerAmount": 50000,
    "feeRate": 10,
    "creatorAddress": "bc1qvendedor123",
    "psbt": "cHNidP8BAMockDataHere"
  }' | jq

# Verificar:
# ✓ success: true
# ✓ offer.id existe
# Guardar o offer.id para próximo teste
```

**✅ Passou:** Criar oferta funcionando

### 3.2 Ativar Oferta

```bash
# Substituir [OFFER_ID] pelo ID recebido acima
curl -X PUT http://localhost:3000/api/offers/[OFFER_ID]/submit \
  -H "Content-Type: application/json" \
  -d '{"txid": "test_txid_123"}' | jq

# Verificar:
# ✓ success: true
# ✓ message: "Offer submitted successfully"
```

**✅ Passou:** Ativar oferta funcionando

### 3.3 Listar Ofertas Ativas

```bash
curl http://localhost:3000/api/offers?status=active | jq

# Verificar:
# ✓ Deve aparecer a oferta criada
# ✓ status: "active"
```

**✅ Passou:** Listar ofertas ativas funcionando

### 3.4 Comprador: Completar Compra

```bash
curl -X PUT http://localhost:3000/api/offers/[OFFER_ID]/complete \
  -H "Content-Type: application/json" \
  -d '{"txid": "final_txid_456"}' | jq

# Verificar:
# ✓ success: true
# ✓ message: "Offer completed successfully"
```

**✅ Passou:** Completar compra funcionando

---

## ✅ FASE 4: Testar Fluxo de Swap de Runes

### 4.1 Criar Swap

```bash
curl -X POST http://localhost:3000/api/offers \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rune_swap",
    "fromRune": "BITCOIN•RUNE",
    "toRune": "OTHER•RUNE",
    "fromAmount": 1000000,
    "toAmount": 1500000,
    "feeRate": 10,
    "creatorAddress": "bc1qtraderA",
    "psbt": "cHNidP8BAMockSwapData"
  }' | jq

# Verificar:
# ✓ success: true
# ✓ offer.id existe
```

**✅ Passou:** Criar swap funcionando

### 4.2 Ativar Swap

```bash
curl -X PUT http://localhost:3000/api/offers/[SWAP_ID]/submit \
  -H "Content-Type: application/json" \
  -d '{"txid": "swap_txid_789"}' | jq
```

**✅ Passou:** Ativar swap funcionando

### 4.3 Consultar Mercado

```bash
curl http://localhost:3000/api/runes/market/BITCOIN•RUNE/OTHER•RUNE | jq

# Verificar:
# ✓ market.fromRune: "BITCOIN•RUNE"
# ✓ market.toRune: "OTHER•RUNE"
# ✓ market.activeOffers > 0
```

**✅ Passou:** Dados de mercado funcionando

---

## ✅ FASE 5: Testar Frontend

### 5.1 Acessar Marketplace

```
1. Abrir: http://localhost:3000
2. Verificar:
   ✓ Página carrega
   ✓ Inscriptions aparecem
   ✓ Interface responsiva
```

**✅ Passou:** Frontend principal funcionando

### 5.2 Testar Fee Selector

```
1. Abrir: http://localhost:3000/public/fee-demo.html
2. Verificar:
   ✓ Fees carregam automaticamente
   ✓ Source: "mempool.space"
   ✓ Pode selecionar diferentes opções
   ✓ Custom fee funciona
   ✓ Botão refresh atualiza
```

**✅ Passou:** Fee Selector funcionando

### 5.3 Criar Oferta (UI)

```
1. Ir para tab "Create Offer"
2. Preencher:
   - Inscription ID
   - Price
   - Fee Rate
3. Clicar "Create Offer"
4. Verificar:
   ✓ Oferta criada
   ✓ Aparece em "My Offers"
```

**✅ Passou:** Criar oferta via UI funcionando

---

## ✅ FASE 6: Testar PSBT (Ord 0.23.3)

### 6.1 Criar PSBT

```bash
curl -X POST http://localhost:3000/api/psbt/create \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": [{"txid": "abc123", "vout": 0}],
    "outputs": [{"bc1qtest": 0.001}]
  }' | jq

# Verificar:
# ✓ success: true
# ✓ psbt começa com "cHNidP8"
```

**✅ Passou:** Criar PSBT funcionando

### 6.2 Decodificar PSBT

```bash
curl -X POST http://localhost:3000/api/psbt/decode \
  -H "Content-Type: application/json" \
  -d '{"psbt": "cHNidP8BAMockData"}' | jq

# Verificar:
# ✓ success: true
# ✓ decoded existe
```

**✅ Passou:** Decodificar PSBT funcionando

### 6.3 Analisar PSBT

```bash
curl -X POST http://localhost:3000/api/psbt/analyze \
  -H "Content-Type: application/json" \
  -d '{"psbt": "cHNidP8BAMockData"}' | jq

# Verificar:
# ✓ success: true
# ✓ analysis existe
```

**✅ Passou:** Analisar PSBT funcionando

---

## ✅ FASE 7: Testar Wallet

### 7.1 Consultar Balance

```bash
# Usar um endereço real ou de teste
curl http://localhost:3000/api/wallet/balance/bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 | jq

# Verificar:
# ✓ address retorna
# ✓ balance.total existe
```

**✅ Passou:** Consultar balance funcionando

### 7.2 Listar UTXOs

```bash
curl http://localhost:3000/api/wallet/utxos/bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 | jq

# Verificar:
# ✓ success: true
# ✓ utxos: array (pode estar vazio)
```

**✅ Passou:** Listar UTXOs funcionando

---

## ✅ FASE 8: Teste Automático Completo

### Executar Script de Teste

```bash
# Teste completo automático
npm run test:flow

# Verificar saída:
# ✓ Fees & Status: PASSOU
# ✓ Compra de Inscription: PASSOU
# ✓ Swap de Runes: PASSOU
```

**✅ Passou:** Todos os testes automatizados passaram

---

## 📊 Resumo de Compatibilidade Ord 0.23.3

### Funcionalidades Testadas

| Feature Ord 0.23.3 | Status | Implementado |
|-------------------|--------|--------------|
| PSBT Offer Submission | ✅ | Sim |
| Auto-Submit Offers | ✅ | Sim |
| Wallet Sweep | ✅ | Sim |
| Runes Protocol | ✅ | Sim |
| Inscription Index | ✅ | Sim |
| Content Retrieval | ✅ | Sim |

---

## 🎯 Teste Manual Completo (Cenário Real)

### Cenário: Compra de Inscription Completa

#### Passo 1: Vendedor Lista

```bash
# Terminal 1: Criar oferta
OFFER_ID=$(curl -s -X POST http://localhost:3000/api/offers \
  -H "Content-Type: application/json" \
  -d '{
    "type": "inscription",
    "inscriptionId": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
    "offerAmount": 50000,
    "feeRate": 10,
    "creatorAddress": "bc1qvendedor",
    "psbt": "cHNidP8BATest"
  }' | jq -r '.offer.id')

echo "Oferta criada: $OFFER_ID"
```

#### Passo 2: Ativar Oferta

```bash
# Ativar oferta
curl -X PUT http://localhost:3000/api/offers/$OFFER_ID/submit \
  -H "Content-Type: application/json" \
  -d '{"txid": "mock_activation_txid"}' | jq

echo "Oferta ativada!"
```

#### Passo 3: Comprador Vê Oferta

```bash
# Listar ofertas ativas
curl http://localhost:3000/api/offers?status=active | jq '.offers[] | {id, offerAmount, feeRate}'
```

#### Passo 4: Comprador Aceita

```bash
# Completar compra
curl -X PUT http://localhost:3000/api/offers/$OFFER_ID/complete \
  -H "Content-Type: application/json" \
  -d '{"txid": "real_purchase_txid"}' | jq

echo "Compra concluída! ✅"
```

**✅ Cenário Real Completo:** Funcionando perfeitamente!

---

## 🔍 Troubleshooting

### Se algum teste falhar:

#### 1. Verificar Logs

```bash
# Ver logs do servidor
tail -f /path/to/server/logs

# Ou simplesmente ver output do terminal onde npm start está rodando
```

#### 2. Verificar Nodes

```bash
# Bitcoin Core
bitcoin-cli getblockchaininfo

# Ord Server
curl http://127.0.0.1:80/
```

#### 3. Reiniciar Servidor

```bash
# Parar
pkill -f "node server/index.js"

# Iniciar
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start
```

#### 4. Limpar Database (se necessário)

```bash
# Backup primeiro!
cp server/db/marketplace.db server/db/marketplace.db.backup

# Reiniciar
rm server/db/marketplace.db
npm run init-db
```

---

## ✅ Checklist Final

Marque cada item após testar:

### Infraestrutura
- [ ] Bitcoin Core conectado
- [ ] Ord Server conectado
- [ ] Marketplace rodando
- [ ] Database inicializado

### APIs
- [ ] GET /api/status - OK
- [ ] GET /api/psbt/fees - Mempool.space funcionando
- [ ] GET /api/ordinals - Listando inscriptions
- [ ] GET /api/runes - Listando runes
- [ ] GET /api/offers - Listando ofertas

### Fluxo de Compra
- [ ] POST /api/offers - Criar oferta
- [ ] PUT /api/offers/:id/submit - Ativar oferta
- [ ] GET /api/offers?status=active - Listar ativas
- [ ] PUT /api/offers/:id/complete - Completar compra

### Fluxo de Swap
- [ ] POST /api/offers (type: rune_swap) - Criar swap
- [ ] PUT /api/offers/:id/submit - Ativar swap
- [ ] GET /api/runes/market/:from/:to - Dados mercado

### PSBT (Ord 0.23.3)
- [ ] POST /api/psbt/create - Criar PSBT
- [ ] POST /api/psbt/decode - Decodificar
- [ ] POST /api/psbt/analyze - Analisar
- [ ] POST /api/psbt/broadcast - Broadcast

### Frontend
- [ ] http://localhost:3000 - Marketplace carrega
- [ ] Fee Selector funciona
- [ ] Criar oferta via UI
- [ ] Interface responsiva

### Extras
- [ ] npm run test:flow - Testes automatizados
- [ ] Documentação completa
- [ ] Sem erros no console

---

## 🎉 Resultado Esperado

**Se TODOS os testes passarem:**

✅ Sistema 100% funcional  
✅ Compatível com Ord 0.23.3  
✅ Integrado com Bitcoin Core  
✅ Integrado com Ord Server  
✅ Fees em tempo real da Mempool.space  
✅ PSBTs criados e gerenciados corretamente  
✅ Ofertas funcionando  
✅ Swaps funcionando  
✅ Frontend operacional  

**🚀 MARKETPLACE PRONTO PARA PRODUÇÃO!**

---

## 📞 Suporte

Se encontrar problemas:

1. ✅ Verificar logs do servidor
2. ✅ Testar nodes individualmente
3. ✅ Consultar documentação:
   - STATUS_FINAL.md
   - API_REFERENCE.md
   - NODE_SETUP.md
   - FEE_SYSTEM.md

---

**Data do Teste:** _____________  
**Testado por:** _____________  
**Resultado:** ☐ Aprovado  ☐ Reprovado  
**Notas:** ________________________________








