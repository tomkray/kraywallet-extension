# 🎯 GUIA PASSO A PASSO - TESTAR SISTEMA COMPLETO

**Data:** 2025-11-05  
**Status:** ✅ Servidor online e pronto!

---

## 📋 O QUE VAMOS TESTAR

1. ✅ Interface Unificada (Unified DeFi)
2. ✅ Conexão com KrayWallet
3. ✅ Visualização de Balances (agregados)
4. ✅ Quote de Swap (cálculo em tempo real)
5. ✅ Execução de Swap (se houver pool ativa)
6. ✅ Smart Router (decisão automática L1 vs L2)

---

## 🚀 PASSO 1: ABRIR A INTERFACE

### 1.1 - Abrir o navegador e acessar:

```
http://localhost:3000/runes-swap.html
```

### 1.2 - O que você deve ver:

```
┌─────────────────────────────────────────┐
│  KRAY STATION                           │
│  Bitcoin Ordinals & Runes               │
│                                         │
│  [Home] [Ordinals] [Runes (DeFi)] ⚡   │
│                                         │
│  [Connect Wallet]                      │
└─────────────────────────────────────────┘

Abaixo:
┌─────────────────────────────────────────┐
│  [🔄 Swap] [+ Create Pool] [⚡ Lightning]│
│                                         │
│  (Tab "Swap" já estará ativa)          │
│                                         │
│  Dentro aparece:                        │
│  🎯 KRAY DEFI                          │
│  ⚡ Instant • 🔒 Secure • 💸 Low Fee  │
└─────────────────────────────────────────┘
```

### ✅ Checkpoint 1:
- [ ] Página carregou sem erros?
- [ ] Tab "Swap" está ativa?
- [ ] Interface unificada apareceu?

---

## 🔌 PASSO 2: CONECTAR KRAYWALLET

### 2.1 - Clicar no botão "Connect Wallet"

### 2.2 - Selecionar "KrayWallet"

### 2.3 - KrayWallet Extension vai abrir popup:

```
┌─────────────────────────────┐
│  🔒 KrayWallet              │
│                             │
│  Connect to this site?      │
│                             │
│  Kray Station               │
│  localhost:3000             │
│                             │
│  Permissions:               │
│  • View address             │
│  • View balances            │
│  • Request signatures       │
│                             │
│  [Reject]  [Connect]       │
└─────────────────────────────┘
```

### 2.4 - Clicar "Connect" ✅

### 2.5 - O que deve acontecer:

```
Interface atualiza:

┌─────────────────────────────────────────┐
│  KRAY STATION                           │
│                                         │
│  [bc1pvz02d8...] (seu endereço)       │
└─────────────────────────────────────────┘

E dentro da interface unificada:

┌─────────────────────────────────────────┐
│  🎯 KRAY DEFI                          │
│                                         │
│  💎 Seus Ativos                        │
│  🔄 Refresh                            │
│                                         │
│  (Carregando balances...)              │
└─────────────────────────────────────────┘
```

### ✅ Checkpoint 2:
- [ ] KrayWallet conectou?
- [ ] Endereço apareceu no topo?
- [ ] Interface unificada detectou conexão?
- [ ] Tentou carregar balances?

---

## 💰 PASSO 3: VERIFICAR BALANCES

### 3.1 - O sistema vai automaticamente buscar balances

**Request que acontece (invisível para você):**
```
GET /api/unified-defi/balance/bc1pvz02d8...
```

### 3.2 - Possíveis resultados:

#### Cenário A: Você tem Runes ✅

```
┌─────────────────────────────────────────┐
│  💎 Seus Ativos                        │
│  🔄 Refresh                            │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ DOG•GO•TO•THE•MOON                │ │
│  │ DOG                               │ │
│  │                            300    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ BILLION•DOLLAR•CAT                │ │
│  │ CAT                               │ │
│  │                            422    │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### Cenário B: Sem Runes (ainda) 📭

```
┌─────────────────────────────────────────┐
│  💎 Seus Ativos                        │
│  🔄 Refresh                            │
│                                         │
│  💰                                     │
│  No runes found.                        │
│  Get some runes to start trading!       │
└─────────────────────────────────────────┘
```

### ✅ Checkpoint 3:
- [ ] Balances carregaram?
- [ ] Se tem runes, aparecem listados?
- [ ] Valores estão corretos?
- [ ] Console do navegador sem erros?

### 3.3 - Verificar Console do Navegador

**Abrir DevTools (F12) e ver:**

```javascript
// Deve aparecer algo como:
✅ Wallet connected: bc1pvz02d8...
💰 Loading aggregated balances...
✅ Balances loaded: 2
```

**OU se não tiver runes:**

```javascript
✅ Wallet connected: bc1pvz02d8...
💰 Loading aggregated balances...
✅ Balances loaded: 0
```

---

## 🔄 PASSO 4: TESTAR SWAP (SE TIVER RUNES)

### 4.1 - Clicar em um Rune para selecionar

**Exemplo: Clicar no card "DOG•GO•TO•THE•MOON"**

### 4.2 - O que deve acontecer:

```
Interface de Swap aparece abaixo:

┌─────────────────────────────────────────┐
│  🔄 Swap                    ⚙️ Settings │
│                                         │
│  You Pay              Balance: 300     │
│  ┌─────────────────────────────────┐   │
│  │ 0.0                       DOG ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│           ⇅                             │
│                                         │
│  You Receive (estimated)                │
│  ┌─────────────────────────────────┐   │
│  │ 0.0                       BTC ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Enter Amount]                        │
└─────────────────────────────────────────┘
```

### 4.3 - Digitar quantidade

**Exemplo: Digite "100" no campo "You Pay"**

```
┌─────────────────────────────────────────┐
│  You Pay              Balance: 300     │
│  ┌─────────────────────────────────┐   │
│  │ 100                       DOG ▼ │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 4.4 - Aguardar 500ms (debounce)

**O sistema vai automaticamente buscar quote:**

```
POST /api/unified-defi/quote
{
  userAddress: "bc1pvz02d8...",
  fromAsset: "840000:3",
  toAsset: "BTC",
  amount: 100
}
```

### 4.5 - Possíveis resultados:

#### Cenário A: Pool Existe ✅

```
Interface atualiza com detalhes:

┌─────────────────────────────────────────┐
│  You Receive (estimated)                │
│  ┌─────────────────────────────────┐   │
│  │ 4012                      sats  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📊 Details:                            │
│  🚀 Route: ⚡ Lightning                │
│  📊 Price: 40.12 sats/DOG              │
│  💸 Fee: ~1 sat                        │
│  ⏱️ Speed: Instant                     │
│                                         │
│  [🚀 EXECUTE SWAP]                     │
└─────────────────────────────────────────┘
```

**Console vai mostrar:**
```javascript
💭 Getting quote...
🤖 ========== SMART ROUTER ==========
   User: bc1pvz02d8...
   From: 840000:3
   To: BTC
   Amount: 100

   ✅ Pool found: 840000:3:1730768945123
   ✅ ROUTE: L2_SYNTHETIC (user has synthetic balance)
   ⚡ Speed: INSTANT (~1-3s)
   💸 Fee: ~1 sat

✅ Quote received
```

#### Cenário B: Sem Pool 📭

```
Mensagem de erro aparece:

┌─────────────────────────────────────────┐
│  ❌ No pool available for this rune.   │
│     Create a pool first!                │
└─────────────────────────────────────────┘
```

### ✅ Checkpoint 4:
- [ ] Conseguiu selecionar rune?
- [ ] Conseguiu digitar quantidade?
- [ ] Quote foi buscado automaticamente?
- [ ] Detalhes do swap apareceram?
- [ ] Route foi escolhida (L2 ou L1)?

---

## 🚀 PASSO 5: EXECUTAR SWAP (SE HOUVER POOL)

### 5.1 - Clicar no botão "🚀 EXECUTE SWAP"

### 5.2 - O que acontece no backend:

```javascript
// 1. Smart Router decide rota
🤖 SMART ROUTER:
   CHECK 1: User tem synthetic? 
   └─> Verificando...
   
   CHECK 2: Pool tem liquidez L2?
   └─> Verificando...
   
   DECISÃO: L2_SYNTHETIC ⚡
   └─> Executar via Lightning (instant!)

// 2. Executa swap
⚡ Executing Lightning Swap (L2)...
   Calculating AMM...
   Validating slippage...
   Executing swap...
   ✅ Lightning swap completed!
```

### 5.3 - O que você vê na interface:

```
1. Botão muda:
   [⌛ Processing...]

2. Após 1-3 segundos:
   
┌─────────────────────────────────────────┐
│  ✅ Swap completed! ✨                  │
│     Swap completed successfully!        │
└─────────────────────────────────────────┘

3. Balances recarregam automaticamente:

┌─────────────────────────────────────────┐
│  💎 Seus Ativos                        │
│                                         │
│  DOG•GO•TO•THE•MOON                    │
│  200 (antes: 300)                      │
│                                         │
│  BTC: +4,012 sats                      │
└─────────────────────────────────────────┘
```

### ✅ Checkpoint 5:
- [ ] Swap executou?
- [ ] Mensagem de sucesso apareceu?
- [ ] Balances atualizaram?
- [ ] Valores estão corretos?

---

## 🧪 PASSO 6: VERIFICAR CONSOLE (IMPORTANTE!)

### 6.1 - Abrir DevTools (F12) → Aba "Console"

### 6.2 - O que procurar:

#### ✅ SUCESSO - Deve ver algo assim:

```javascript
🎯 ========== UNIFIED SWAP ==========
   User: bc1pvz02d8...
   From: 840000:3 Amount: 100
   To: BTC

🤖 ========== SMART ROUTER ==========
   ✅ Pool found: 840000:3:1730768945123
   ✅ ROUTE: L2_SYNTHETIC
   ⚡ Speed: INSTANT (~1-3s)
   💸 Fee: ~1 sat

⚡ Executing Lightning Swap (L2)...
   ✅ Lightning swap completed!

✅ ========== SWAP COMPLETED ==========
   Route used: L2_SYNTHETIC
   Amount out: 4012
   Fee: 1 sats
```

#### ❌ ERRO - Se ver erro:

```javascript
❌ Error in unified swap: [mensagem de erro]
```

**Me mostre o erro completo!**

---

## 📊 PASSO 7: VERIFICAR NO BACKEND (OPCIONAL)

### 7.1 - Abrir arquivo de log do servidor:

```bash
tail -100 server-output.log
```

### 7.2 - Procurar por:

```
🎯 ========== UNIFIED SWAP ==========
🤖 ========== SMART ROUTER ==========
⚡ Executing Lightning Swap (L2)...
✅ ========== SWAP COMPLETED ==========
```

---

## 🎨 PASSO 8: TESTAR OUTRAS TABS (OPCIONAL)

### 8.1 - Tab "Create Pool"

```
1. Clicar na tab "+ Create Pool"
2. Preencher formulário
3. Criar pool nova (se quiser)
```

### 8.2 - Tab "⚡ Lightning Swaps"

```
1. Clicar na tab "⚡ Lightning Swaps"
2. Ver interface de swaps Lightning
3. Explorar funcionalidades
```

---

## 🐛 TROUBLESHOOTING

### Problema 1: "Connect Wallet" não funciona

**Solução:**
1. Verificar se KrayWallet Extension está instalada
2. Atualizar a extensão (recarregar)
3. Recarregar a página (Cmd/Ctrl + R)

### Problema 2: Balances não carregam

**Verificar:**
1. Console do navegador (F12) - tem erro?
2. Network tab (F12) - request falhou?
3. Server log - backend respondeu?

**Comando para ver server log:**
```bash
tail -50 server-output.log
```

### Problema 3: Quote não aparece

**Verificar:**
1. Você digitou a quantidade?
2. Aguardou 500ms (debounce)?
3. Console mostra erro?
4. Pool existe para esse rune?

### Problema 4: Swap falha

**Verificar:**
1. Pool tem liquidez?
2. Backend está rodando?
3. Database tables existem?

**Teste database:**
```bash
sqlite3 server/db/ordinals.db ".tables" | grep virtual
```

Deve mostrar:
```
virtual_balances
virtual_pool_state
```

---

## 📋 CHECKLIST FINAL

### ✅ Frontend:
- [ ] Interface carregou
- [ ] Wallet conectou
- [ ] Balances apareceram
- [ ] Quote funcionou
- [ ] Swap executou
- [ ] Balances atualizaram

### ✅ Backend:
- [ ] Servidor rodando (porta 3000)
- [ ] Routes unifiedDefi carregadas
- [ ] Database tables criadas
- [ ] Smart Router decidindo
- [ ] Swaps executando

### ✅ KrayWallet:
- [ ] Extension instalada
- [ ] API injetada (window.krayWallet)
- [ ] Conectou com site
- [ ] Balances acessíveis

---

## 🎯 PRÓXIMOS PASSOS

### Se TUDO funcionou ✅:

**PARABÉNS!** 🎉

Você tem um sistema DeFi Lightning completo funcionando!

**Próximos passos:**
1. Criar mais pools
2. Fazer mais swaps
3. Testar com usuários reais
4. Adicionar features opcionais:
   - Lightning payment handler
   - Auto redemption
   - WebSocket notifications
   - Price charts

### Se algo NÃO funcionou ❌:

**ME MOSTRE:**
1. Mensagem de erro do console
2. Screenshot da interface
3. Log do servidor (últimas 50 linhas)
4. O que você estava tentando fazer

**Vou te ajudar a resolver!** 🔧

---

## 📞 SUPORTE

**Se precisar de ajuda:**

1. **Console Error:** Copie e cole o erro completo
2. **Server Log:** 
   ```bash
   tail -100 server-output.log
   ```
3. **Network Tab:** Veja se requests falharam (F12 → Network)
4. **Screenshot:** Se possível, mostre a tela

---

## 🎉 CONCLUSÃO

Este é o sistema DeFi Lightning mais avançado que existe!

**Features únicas:**
- ✅ Balance agregado (real + synthetic)
- ✅ Smart Router (decide automaticamente)
- ✅ L1 + L2 transparente
- ✅ Interface única (sem escolhas técnicas)
- ✅ Taproot nativo
- ✅ KrayWallet integrada perfeitamente

**Agora é só testar e ver a mágica acontecer!** ✨

---

**Data:** 2025-11-05  
**Status:** 🚀 **PRONTO PARA TESTE!**  
**URL:** http://localhost:3000/runes-swap.html  
**Boa sorte!** 🍀

