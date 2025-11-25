
# 🚀 TESTE RÁPIDO - MAINNET (Bitcoin Real)

## ✅ STATUS: TUDO PRONTO PARA USAR!

Sua MyWallet está configurada para **Mainnet** e pronta para transações reais.

---

## 📋 PASSO-A-PASSO - TESTE COMPLETO

### 1️⃣ VERIFICAR SERVIDOR

✅ Server rodando: http://localhost:3000

```bash
# Se não estiver rodando:
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start
```

---

### 2️⃣ RECARREGAR EXTENSION

```
1. Abrir: chrome://extensions/
2. Encontrar "MyWallet - Bitcoin Ordinals Runes"
3. Clicar em 🔄 RELOAD
4. Fechar popup (se estiver aberto)
```

---

### 3️⃣ ABRIR MYWALLET POPUP

```
1. Clicar no ícone da MyWallet (barra de extensões)
2. Se já tiver wallet:
   - Ver endereço bc1p...
   - Ver balance
   - PRONTO! Pular para passo 4

3. Se NÃO tiver wallet:
   - Clicar "Create New Wallet"
   - Digitar senha (mínimo 6 caracteres)
   - Confirmar senha
   - Clicar "Generate Wallet"
   - ⚠️ ANOTAR AS 12 PALAVRAS EM PAPEL!
   - ✅ Wallet criada!
```

---

### 4️⃣ COPIAR SEU ENDEREÇO

```
1. Na tela principal da wallet
2. Clicar no botão 📋 (Copy Address)
3. ✅ Endereço copiado!
4. Deve começar com: bc1p...
```

**Exemplo de endereço válido:**
```
bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr
```

---

### 5️⃣ ENVIAR BITCOIN PARA SUA WALLET

**De onde enviar:**
- ✅ Unisat Wallet
- ✅ Xverse Wallet
- ✅ OKX Wallet
- ✅ Binance
- ✅ Qualquer exchange/wallet

**Quanto enviar:**
- 💰 Mínimo: 1000 sats ($0.30)
- 💰 Recomendado: 5000 sats ($1.50)
- 💰 Seguro: 10000 sats ($3.00)

**Processo:**
```
1. Abrir sua wallet atual (Unisat, Xverse, etc)
2. Clicar em "Send"
3. Colar seu endereço bc1p... (da MyWallet)
4. Valor: 5000 sats
5. Fee: Normal/Medium (1-3 sat/vB)
6. Confirmar transação
7. ✅ Transação enviada!
```

---

### 6️⃣ VERIFICAR TRANSAÇÃO NO MEMPOOL

**Copiar TXID da transação que você acabou de enviar**

```
Abrir: https://mempool.space/tx/SEU_TXID

Status esperado:
  🟡 "Unconfirmed" (0/1)     → Na mempool, aguardando confirmação
  
Aguardar 10-60 minutos:
  🟢 "1 confirmation"        → Incluída em bloco!
  ✅ "6 confirmations"       → Considerada final (1 hora)
```

---

### 7️⃣ VER BALANCE ATUALIZAR NA MYWALLET

```
1. Abrir popup MyWallet
2. Aguardar 3 segundos (auto-refresh)
3. Balance deve atualizar:
   
   ANTES:  0 sats
   DEPOIS: 5000 sats ✅
   
4. Se não atualizar automaticamente:
   - Fechar e reabrir popup
   - Verificar console (F12) se há erros
```

---

### 8️⃣ FAZER PRIMEIRA TRANSAÇÃO DE ENVIO

**Preparar endereço de destino:**
- Pode ser sua Unisat/Xverse (enviar de volta)
- Ou qualquer outro endereço bc1... que você controla

```
1. Na MyWallet, clicar "Send"
2. Preencher:
   
   📍 Recipient Address:
   bc1p... (seu endereço Unisat ou outro)
   
   💰 Amount (sats):
   2000
   
   ⚡ Fee Rate (sat/vB):
   1
   
3. Clicar "Send Transaction"
4. Aguardar loading...
```

---

### 9️⃣ VERIFICAR CONSOLE E LOGS

**Console do Popup (F12 no popup):**
```javascript
💸 Sending Bitcoin...
  To: bc1p...
  Amount: 2000 sats
  Fee rate: 1 sat/vB
📡 Calling backend /api/mywallet/send...
✅ Transaction created
  TXID: abc123...
  Fee: 110 sats
  Change: 2890 sats
📡 Broadcasting transaction...
✅ Transaction broadcasted!
```

**Terminal do Backend:**
```
💸 Creating transaction...
  To: bc1p...
  Amount: 2000 sats
  Fee rate: 1 sat/vB
  From: bc1p... (sua wallet)
  Found 1 UTXOs
  Selected 1 UTXOs
  Total input: 5000 sats
  Fee: 110 sats
  Change: 2890 sats
  ✅ PSBT created
  ✅ PSBT signed
  ✅ PSBT finalized
  ✅ Transaction ready
  TXID: abc123...

Broadcast to mempool.space...
✅ Transaction broadcasted: abc123...
```

---

### 🔟 VERIFICAR TRANSAÇÃO NO MEMPOOL

```
Popup MyWallet mostrará:
  "Transaction sent! TXID: abc123..."

Copiar TXID e verificar:
  https://mempool.space/tx/abc123...

Status:
  🟡 Unconfirmed → Sucesso! TX na mempool!
  
Aguardar confirmação:
  10-60 minutos para 1ª confirmação
```

---

## ✅ CHECKLIST COMPLETO

```
[ ] 1. Server rodando (http://localhost:3000)
[ ] 2. Extension recarregada
[ ] 3. Wallet criada (ou restaurada)
[ ] 4. Endereço bc1p... copiado
[ ] 5. 5000 sats enviados de outra wallet
[ ] 6. Transação confirmada (ou na mempool)
[ ] 7. Balance atualizado na MyWallet
[ ] 8. Transação de envio feita (2000 sats)
[ ] 9. Console sem erros
[ ] 10. TXID verificado em mempool.space
```

---

## 🎉 SE TUDO FUNCIONOU:

### ✅ SUA MYWALLET ESTÁ 100% FUNCIONAL!

Você pode agora:
- ✅ Receber Bitcoin
- ✅ Enviar Bitcoin
- ✅ Ver balance real
- ✅ Fazer transações Taproot
- ✅ Integrar com marketplace
- ✅ Fazer atomic swaps

---

## ⚠️ SE ALGO DEU ERRADO:

### 🔴 Erro: "No UTXOs found"
```
Causa: Endereço sem fundos
Solução: Aguardar confirmação da TX de recebimento
```

### 🔴 Erro: "Insufficient funds"
```
Causa: Balance menor que amount + fee
Solução: Reduzir amount ou aumentar balance
```

### 🔴 Erro: "Failed to broadcast"
```
Causa: TX inválida ou já broadcasted
Solução: 
  1. Ver console para detalhes
  2. Verificar se TXID já existe em mempool.space
  3. Se existir = TX foi enviada com sucesso!
```

### 🔴 Erro: "Wallet is locked"
```
Causa: Mnemonic não está em memória
Solução: Fechar e reabrir popup (auto-unlock)
```

---

## 📊 VALORES DE REFERÊNCIA

```
Dust limit:     546 sats    (mínimo para output)
Fee mínima:     ~110 sats   (TX simples 1 input, 2 outputs)
Fee normal:     1-3 sat/vB  (confirmação em 1-6 blocos)
Fee alta:       5-10 sat/vB (confirmação rápida)

1000 sats  ≈ $0.30
5000 sats  ≈ $1.50
10000 sats ≈ $3.00

(Cotação BTC: ~$30,000)
```

---

## 🚀 PRÓXIMO NÍVEL

Depois de confirmar que envio/recebimento funciona:

1. **Integrar com Marketplace**
   - Usar MyWallet para comprar Ordinals
   - Fazer atomic swaps

2. **Adicionar Features**
   - Transaction history
   - Multiple addresses
   - Testnet toggle

3. **Melhorar Segurança**
   - Password prompt antes de TX
   - Client-side signing (bundler)
   - Hardware wallet support

---

## 💡 DICAS

- ✅ Sempre verifique TXID em mempool.space
- ✅ Anote mnemonic em PAPEL (não digital)
- ✅ Use fee 1-3 sat/vB para economia
- ✅ Aguarde 1+ confirmação antes de gastar
- ⚠️ Não compartilhe mnemonic com NINGUÉM
- ⚠️ Não tire screenshot do mnemonic

---

🎯 **READY TO GO!** 🎯

Pode começar o teste agora! Se tiver qualquer erro, me avise
que eu ajudo a resolver imediatamente! 🚀

