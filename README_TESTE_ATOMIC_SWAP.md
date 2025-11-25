# 🎯 COMO TESTAR O ATOMIC SWAP - COMEÇE AQUI!

**Para:** Desenvolvedor/Tester  
**Data:** 2025-11-01  
**Status Backend:** ✅ 100% Completo  

---

## 📌 RESUMO EXECUTIVO

O **Atomic Swap Marketplace** está **100% implementado no backend** com:

- ✅ **SIGHASH_SINGLE|ANYONECANPAY (0x83)** - Preço do seller travado
- ✅ **Taxa 2%** → Treasure Marketplace (`bc1pe3nvk...`)
- ✅ **Ordinal-aware** - Inscrições preservadas
- ✅ **Local nodes** - Bitcoin RPC + ORD Server
- ✅ **7 API endpoints** funcionais
- ✅ **Validações de segurança** robustas

**Você pode testar AGORA via scripts!** 🚀

---

## ⚡ TESTE RÁPIDO (5 minutos)

### **1. Verificar Pré-requisitos:**

```bash
# Backend
curl http://localhost:3000/api/health

# Bitcoin RPC
curl --user bitcoin:bitcoin \
  --data-binary '{"method":"getblockchaininfo"}' \
  http://127.0.0.1:8332

# ORD Server
curl http://127.0.0.1:3001/

# Database
ls -la server/db/ordinals.db
```

**Tudo OK?** ✅ Continue!  
**Algo falhou?** ❌ Inicie os serviços primeiro.

---

### **2. Executar Teste Automatizado:**

```bash
./test-atomic-swap-complete.sh
```

**O que faz:**
- Cria listagem de teste
- Lista ofertas
- Mostra estatísticas
- Explica próximos passos

**Resultado:**
```
✅ Listagem criada: abc123-...
⚠️  Status: PENDING_SIGNATURES
```

**Limitação:** Não assina (precisa de chaves privadas reais).

---

## 🔧 TESTE COMPLETO (30 minutos)

Para teste **end-to-end** com assinaturas reais:

### **📖 Documentação:**

1. **GUIA_RAPIDO_TESTE.md** ← **COMECE AQUI!**
   - Tutorial conciso e direto
   - Comandos prontos para copiar/colar
   - Opção automatizada + manual

2. **TUTORIAL_TESTE_ATOMIC_SWAP.md**
   - Tutorial detalhado passo a passo
   - Explicações aprofundadas
   - Troubleshooting completo

3. **CHECKLIST_TESTE.md**
   - Checklist interativo
   - Marque ✅ conforme avança
   - Inclui testes de segurança

---

## 🛠️ FERRAMENTAS DISPONÍVEIS

### **Scripts de Assinatura:**

```bash
# Assinar PSBT do Seller (SIGHASH 0x83)
node sign-seller-psbt.js "<PSBT>" "<SELLER_WIF>"

# Assinar PSBT do Buyer (SIGHASH ALL)
node sign-buyer-psbt.js "<PSBT>" "<BUYER_WIF>"
```

### **Script de Teste Completo:**

```bash
# Teste automatizado (demonstração)
./test-atomic-swap-complete.sh
```

---

## 📚 ARQUIVOS DE DOCUMENTAÇÃO

```
📂 Documentação de Teste:
├─ README_TESTE_ATOMIC_SWAP.md    ← VOCÊ ESTÁ AQUI
├─ GUIA_RAPIDO_TESTE.md           ← Teste em 15 min
├─ TUTORIAL_TESTE_ATOMIC_SWAP.md  ← Tutorial completo
├─ CHECKLIST_TESTE.md             ← Checklist interativo
└─ FINAL_STATUS.md                ← Status da implementação

📂 Scripts:
├─ test-atomic-swap-complete.sh   ← Teste automatizado
├─ sign-seller-psbt.js            ← Assinar PSBT do seller
└─ sign-buyer-psbt.js             ← Assinar PSBT do buyer

📂 Implementação:
├─ server/routes/atomicSwap.js         ← API routes
├─ server/utils/atomicSwapBuilder.js   ← PSBT builders
├─ server/utils/atomicSwapPurchase.js  ← Purchase logic
└─ server/db/migrations/001_*.sql      ← Database schema
```

---

## 🎬 FLUXO DO TESTE

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣  SELLER: Criar Listagem                                 │
│    → POST /api/atomic-swap/                                │
│    → Recebe template PSBT                                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣  SELLER: Assinar com SIGHASH 0x83                       │
│    → node sign-seller-psbt.js                              │
│    → Output: signed-seller-psbt.txt                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣  SELLER: Enviar Assinatura                              │
│    → POST /api/atomic-swap/:id/seller-signature            │
│    → Listagem fica OPEN                                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣  BUYER: Listar Ofertas                                  │
│    → GET /api/atomic-swap/                                 │
│    → Ver preço + taxa 2%                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣  BUYER: Preparar Compra                                 │
│    → POST /api/atomic-swap/:id/buy/prepare                 │
│    → Recebe PSBT para assinar                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 6️⃣  BUYER: Assinar PSBT                                    │
│    → node sign-buyer-psbt.js                               │
│    → Output: signed-buyer-psbt.txt                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 7️⃣  BUYER: Finalizar                                       │
│    → POST /api/atomic-swap/:id/buy/finalize                │
│    → Backend valida + broadcast                            │
│    → Retorna TXID                                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ SUCESSO!                                                 │
│    → Seller recebe preço                                   │
│    → Buyer recebe inscrição                                │
│    → Marketplace recebe 2%                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 O QUE ESTÁ SENDO TESTADO

### **Funcionalidades:**
- ✅ Criar listagem sem conhecer o comprador
- ✅ Seller assina apenas 1 vez (não-custodial)
- ✅ Buyer completa a transação
- ✅ Taxa 2% automática (mínimo 546 sats)
- ✅ Inscrição roteada corretamente (ordinal-aware)
- ✅ Broadcast automático

### **Segurança:**
- 🔒 Output[0] imutável (seller payout travado)
- 🔒 SIGHASH 0x83 obrigatório (seller)
- 🔒 Market fee obrigatório (2%, min 546 sats)
- 🔒 UTXO verification (não permite gasto duplo)
- 🔒 Ordinal routing (inscrição não vaza)
- 🔒 Dust limits (todos outputs >= 546 sats)

---

## 💰 TREASURE MARKETPLACE

**Endereço das taxas (2%):**
```
bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2
```

**Configuração:**
- Taxa: 2% do preço do seller
- Mínimo: 546 sats (dust limit)
- Paga pelo: Buyer (adicionada na transação final)
- Validação: Obrigatória (transação não finaliza sem ela)

**Exemplos:**
```
Preço 1,000 sats   → Taxa 546 sats (mínimo dust)
Preço 10,000 sats  → Taxa 546 sats (mínimo dust)
Preço 30,000 sats  → Taxa 600 sats (2%)
Preço 100,000 sats → Taxa 2,000 sats (2%)
```

---

## 🚀 COMEÇE AGORA!

### **Escolha seu caminho:**

#### **🟢 Iniciante / Primeira vez:**
→ Leia: **GUIA_RAPIDO_TESTE.md**  
→ Execute: `./test-atomic-swap-complete.sh`

#### **🟡 Intermediário / Quer testar de verdade:**
→ Leia: **TUTORIAL_TESTE_ATOMIC_SWAP.md**  
→ Prepare: Chaves privadas (WIF) + UTXOs  
→ Execute: Passo a passo manual

#### **🔴 Avançado / Quer validar tudo:**
→ Leia: **CHECKLIST_TESTE.md**  
→ Execute: Todos os testes + segurança  
→ Valide: Database, transação, estatísticas

---

## ❓ FAQ

### **P: Posso testar sem chaves privadas reais?**
R: Sim! Execute `./test-atomic-swap-complete.sh` para ver o fluxo (sem assinaturas).

### **P: Preciso de Bitcoin real para testar?**
R: Não! Use **testnet** para testes sem risco.

### **P: A taxa de 2% é obrigatória?**
R: Sim! O backend valida e só finaliza se a taxa estiver presente e correta.

### **P: O buyer pode alterar o preço do seller?**
R: Não! `SIGHASH_SINGLE|ANYONECANPAY` trava o `output[0]` (payout do seller).

### **P: Posso usar mainnet?**
R: Sim, mas **só depois de testar extensivamente em testnet**!

### **P: Preciso da Extension/Frontend para testar?**
R: Não! O backend pode ser testado via scripts/cURL diretamente.

---

## 🐛 PROBLEMAS?

### **Backend não responde:**
```bash
# Verificar se está rodando
ps aux | grep node

# Iniciar
npm start
```

### **Bitcoin RPC não responde:**
```bash
# Verificar se bitcoind está rodando
bitcoin-cli getblockchaininfo

# Ou
curl --user bitcoin:bitcoin \
  --data-binary '{"method":"getblockchaininfo"}' \
  http://127.0.0.1:8332
```

### **Erros nos scripts de assinatura:**
```bash
# Verificar dependências
npm install

# Verificar sintaxe do WIF
# Testnet: começa com 'c'
# Mainnet: começa com '5', 'K' ou 'L'
```

### **Mais ajuda:**
→ Veja seção **TROUBLESHOOTING** em `TUTORIAL_TESTE_ATOMIC_SWAP.md`

---

## 📞 SUPORTE

Se encontrar problemas:

1. Verifique logs do backend (console)
2. Verifique database: `sqlite3 server/db/ordinals.db`
3. Leia TUTORIAL_TESTE_ATOMIC_SWAP.md (troubleshooting)
4. Verifique CHECKLIST_TESTE.md (validações)

---

## ✅ PRONTO PARA COMEÇAR!

**3 comandos para testar agora:**

```bash
# 1. Verificar pré-requisitos
curl http://localhost:3000/api/health

# 2. Executar teste automatizado
./test-atomic-swap-complete.sh

# 3. Ver estatísticas
sqlite3 server/db/ordinals.db "SELECT * FROM marketplace_stats;"
```

---

**BOA SORTE! 🍀**

Qualquer dúvida, consulte os arquivos de documentação listados acima!

