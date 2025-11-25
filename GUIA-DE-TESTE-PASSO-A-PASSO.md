# 🧪 GUIA DE TESTE COMPLETO - PASSO A PASSO

## ✅ PREPARAÇÃO (5 minutos)

### **PASSO 1: Verificar Backend (já está rodando!)**
```bash
# Verificar se está rodando na porta 3000
lsof -i:3000

# Se NÃO estiver rodando, iniciar:
cd "/Volumes/D2/KRAY WALLET- V1/server"
node index.js
```

**✅ Status:** Backend rodando na porta 3000!

---

### **PASSO 2: Iniciar LND**
```bash
# Terminal 2 (novo)
cd "/Volumes/D2/KRAY WALLET- V1"
./start-lnd.sh

# Aguardar até ver:
# "✅ LND started successfully"
# "⚡ Server is running"
```

**⏱️ Tempo:** ~10 segundos

---

### **PASSO 3: Recarregar Extension**
```
1. Abrir: chrome://extensions
2. Encontrar: "KrayWallet"
3. Clicar: Botão "Recarregar" (ícone refresh)
```

**✅ Confirmação:** Extension deve mostrar "Service worker (Ativo)"

---

## 🧪 TESTE 1: LIGHTNING HUB (5 minutos)

### **Objetivo:** Verificar se Lightning Hub carrega corretamente

### **PASSOS:**

1. **Abrir Lightning Hub:**
   ```
   http://localhost:3000/lightning-hub.html
   ```

2. **Abrir Console do Browser:**
   - Pressionar `F12` (ou Cmd+Option+I no Mac)
   - Ir para aba "Console"

3. **Verificar mensagens no console:**
   ```
   ✅ Deve aparecer:
   "⚡ Lightning Hub UI initializing..."
   "🔗 Connecting to LND..."
   "✅ LND connected"
   "🏊 Loading Lightning DeFi pools..."
   "✅ Loaded X Lightning pools"
   ```

4. **Verificar UI:**
   ```
   ✅ Hub Status: "✅ Connected to LND..."
   ✅ Hub Channels: Número aparece (pode ser 0)
   ✅ Lightning Pools: Número aparece (pode ser 0)
   ✅ Avg Swap Time: "< 1s"
   ✅ Total Fees: "~0.3%"
   ```

5. **Conectar Wallet:**
   ```
   - Clicar em "Connect Wallet"
   - KrayWallet popup deve abrir
   - Digitar senha (se necessário)
   - Aprovar conexão
   ```

6. **Verificar conexão:**
   ```
   ✅ Botão muda para: "bc1q...abc" (endereço abreviado)
   ```

### **RESULTADO ESPERADO:**
```
✅ Lightning Hub carrega
✅ LND conectado
✅ Stats aparecem
✅ Wallet conecta
```

### **SE DER ERRO:**
```
❌ "LND not connected"
   → Verificar se LND está rodando (./start-lnd.sh)
   → Aguardar 10 segundos após iniciar LND

❌ "Failed to load pools"
   → Normal se não tiver pools criados ainda
   → Vamos criar um no próximo teste!
```

---

## 🧪 TESTE 2: CREATE POOL (10 minutos)

### **Objetivo:** Criar um pool Lightning DeFi

### **PASSOS:**

1. **Abrir Runes DeFi:**
   ```
   http://localhost:3000/runes-swap.html
   ```

2. **Conectar Wallet (se não conectou ainda):**
   ```
   - Clicar "Connect Wallet" no topo
   - Aprovar no KrayWallet popup
   ```

3. **Ir para aba "Create Pool":**
   ```
   - Clicar na tab "Create Pool"
   ```

4. **Preencher formulário:**
   ```
   1. Pool Name: "DOG/BTC Test Pool"
   2. Rune: Selecionar uma rune (ex: DOG)
   3. Amount Rune: 100
   4. Amount BTC: 0.001
   5. Fee Rate: 10 sat/vB
   ```

5. **Criar Pool:**
   ```
   - Clicar "🏊 Create Pool"
   ```

6. **Verificar console (F12):**
   ```
   ✅ Deve aparecer:
   "🏊 ========== CREATE POOL FLOW =========="
   "⚡ USAR LIGHTNING DEFI CREATE POOL (NOVO!)"
   "✅ Lightning Pool PSBT prepared"
   "   Pool ID: ..."
   "   Channel ID: ..."
   ```

7. **Popup PSBT deve abrir automaticamente:**
   ```
   - Extension popup abre
   - Tela "🔏 Sign Transaction"
   - Detalhes do pool aparecem
   ```

8. **Assinar transação:**
   ```
   - Digitar senha
   - Clicar "Sign & Send"
   ```

9. **Verificar console novamente:**
   ```
   ✅ Deve aparecer:
   "⚡ USAR LIGHTNING DEFI FINALIZE POOL (NOVO!)"
   "✅ Lightning Pool created successfully!"
   "   TXID: ..."
   "   Channel ID: ..."
   ```

10. **Verificar sucesso:**
    ```
    ✅ Mensagem verde: "✅ Pool created! TXID: ..."
    ✅ Aguardar 5 segundos
    ✅ Redirecionamento automático
    ```

### **RESULTADO ESPERADO:**
```
✅ Pool criado com sucesso
✅ PSBT assinado
✅ Transação broadcast
✅ Channel Lightning aberto
✅ Mensagem de sucesso aparece
```

### **SE DER ERRO:**
```
❌ "No UTXOs found"
   → Wallet precisa ter BTC e Runes
   → Verificar balance no popup da wallet

❌ "User rejected"
   → Você cancelou a assinatura
   → Tentar novamente

❌ "Failed to prepare Lightning pool"
   → Verificar se LND está rodando
   → Verificar console do backend
```

---

## 🧪 TESTE 3: SWAP LIGHTNING (10 minutos)

### **Objetivo:** Fazer um swap usando Lightning

### **PRÉ-REQUISITO:** Pool criado no teste anterior ✅

### **PASSOS:**

1. **Ir para aba "Swap":**
   ```
   - Clicar na tab "Swap" em runes-swap.html
   ```

2. **Selecionar tokens:**
   ```
   - FROM: Selecionar DOG (ou a rune que você usou)
   - TO: BTC (já vem selecionado)
   ```

3. **Inserir amount:**
   ```
   - Amount: 10
   - Pressionar Tab ou clicar fora
   ```

4. **Aguardar quote:**
   ```
   ✅ Quote box deve aparecer:
   - Rate: X DOG = Y BTC
   - Price Impact: X%
   - Pool Fee: X sats
   - Lightning Fee: 1 sat
   - You'll receive: X BTC
   ```

5. **Executar Swap:**
   ```
   - Clicar "Swap DOG → BTC"
   ```

6. **Verificar console (F12):**
   ```
   ✅ Deve aparecer:
   "⚡ ========== LIGHTNING DEFI SWAP FLOW =========="
   "📡 Step 1: Preparing Lightning DeFi swap..."
   "✅ Lightning swap prepared"
   "   Invoice: lnbc..."
   "   Amount: X sats"
   ```

7. **Popup Lightning Payment abre automaticamente:**
   ```
   - Extension popup abre
   - Tela "⚡ Lightning Payment"
   - Detalhes do pagamento:
     - Amount: X sats
     - Description: "Lightning DeFi Swap"
   ```

8. **Confirmar pagamento:**
   ```
   - Digitar senha
   - Clicar "⚡ Pay Invoice"
   ```

9. **Aguardar confirmação:**
   ```
   ✅ Loading: "⏳ Processing Lightning payment..."
   ✅ Sucesso: "✅ Payment successful!"
   ```

10. **Verificar console:**
    ```
    ✅ Deve aparecer:
    "✅ Lightning payment successful!"
    "   Preimage: ..."
    "   Payment Hash: ..."
    "✅ Swap completed successfully!"
    ```

11. **Verificar UI:**
    ```
    ✅ Mensagem verde: "✅ Lightning swap successful! ⚡🎉"
    ✅ Payment Hash aparece
    ✅ Inputs são limpos
    ```

### **RESULTADO ESPERADO:**
```
✅ Swap executado
✅ Invoice pago via Lightning
✅ Balances atualizados
✅ Mensagem de sucesso
✅ Tudo em < 2 segundos! ⚡
```

### **SE DER ERRO:**
```
❌ "No quote available"
   → Pool pode estar vazio
   → Verificar se pool foi criado

❌ "Failed to prepare Lightning swap"
   → Verificar se LND está rodando
   → Verificar se tem liquidez no pool

❌ "Lightning payment failed"
   → Invoice pode ter expirado
   → Tentar novamente
```

---

## 🧪 TESTE 4: LIGHTNING UI NO POPUP (5 minutos)

### **Objetivo:** Testar Send/Receive Lightning na wallet

### **PASSOS:**

### **A) RECEIVE LIGHTNING (Criar Invoice)**

1. **Abrir popup da KrayWallet:**
   ```
   - Clicar no ícone da extensão
   ```

2. **Ir para Lightning:**
   ```
   - Scroll até ver "Lightning Network Actions"
   - Seção com botões "Send" e "Receive"
   ```

3. **Clicar "Receive Lightning":**
   ```
   - Tela "⚡ Receive Lightning" abre
   ```

4. **Preencher:**
   ```
   - Amount: 1000 sats
   - Description: "Test payment"
   - Clicar "⚡ Create Invoice"
   ```

5. **Verificar:**
   ```
   ✅ Mensagem: "✅ Invoice created successfully!"
   ✅ Invoice aparece (texto longo começando com "lnbc")
   ✅ Botão "📋 Copy Invoice" aparece
   ```

6. **Copiar invoice:**
   ```
   - Clicar "📋 Copy Invoice"
   ✅ Mensagem: "✅ Invoice copied to clipboard!"
   ```

### **B) SEND LIGHTNING (Pagar Invoice)**

1. **Voltar:**
   ```
   - Clicar "←" (voltar)
   ```

2. **Clicar "Send Lightning":**
   ```
   - Tela "⚡ Send Lightning" abre
   ```

3. **Colar invoice:**
   ```
   - Colar o invoice que você copiou
   - Clicar "Decode Invoice"
   ```

4. **Verificar decode:**
   ```
   ✅ Amount: 1000 sats aparece
   ✅ Description: "Test payment" aparece
   ✅ Botão "⚡ Pay Invoice" fica habilitado
   ```

5. **Pagar (OPCIONAL):**
   ```
   ⚠️ Só pagar se você tiver outro wallet/node para receber!
   - Se não tiver, tudo bem! O teste de decode já funcionou ✅
   ```

### **RESULTADO ESPERADO:**
```
✅ Receive Lightning funciona
✅ Invoice criado
✅ Copy funciona
✅ Send Lightning funciona
✅ Decode funciona
```

---

## 📊 CHECKLIST FINAL

### **Após todos os testes, você deve ter:**

```
✅ TESTE 1: Lightning Hub
   ✅ Conectou ao LND
   ✅ Stats aparecem
   ✅ Wallet conecta

✅ TESTE 2: Create Pool
   ✅ Pool criado
   ✅ PSBT assinado
   ✅ Transação broadcast
   ✅ Channel aberto

✅ TESTE 3: Swap Lightning
   ✅ Quote calculado
   ✅ Invoice gerado
   ✅ Payment confirmado
   ✅ Swap executado

✅ TESTE 4: Lightning UI
   ✅ Receive Lightning funciona
   ✅ Send Lightning funciona
   ✅ Decode funciona
```

---

## 🐛 TROUBLESHOOTING GERAL

### **Problema: "Extension not responding"**
```
Solução:
1. chrome://extensions
2. Recarregar KrayWallet
3. Tentar novamente
```

### **Problema: "Backend not responding"**
```
Solução:
1. Verificar se servidor está rodando (lsof -i:3000)
2. Reiniciar: node server/index.js
3. Aguardar "Server running on port 3000"
```

### **Problema: "LND not connected"**
```
Solução:
1. Iniciar LND: ./start-lnd.sh
2. Aguardar 10 segundos
3. Refresh página
```

### **Problema: Console mostra erros 404**
```
Solução:
1. Verificar URL correta (localhost:3000)
2. Verificar se arquivo existe
3. Hard refresh (Cmd+Shift+R ou Ctrl+Shift+R)
```

---

## 🎉 PARABÉNS!

Se todos os testes passaram, você tem:

```
⚡ Lightning Hub funcional
🔄 Lightning DeFi Swap funcional
🏊 Create Pool funcional
💼 Lightning UI no popup funcional
🔐 PSBT Signing funcional
📡 LND Integration funcional
```

**VOCÊ TEM O SISTEMA LIGHTNING DEFI MAIS AVANÇADO DO MUNDO! 🌍⚡**

---

## 📝 PRÓXIMOS PASSOS:

1. **Criar mais pools** (diferentes runes)
2. **Fazer mais swaps** (testar diferentes amounts)
3. **Abrir channels** (com outros nodes)
4. **Monitorar stats** (no Lightning Hub)
5. **Testar em produção!** 🚀

