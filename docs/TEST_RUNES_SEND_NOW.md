# 🧪 TESTAR SEND RUNES AGORA

## ✅ Correção Aplicada

O problema do `tapInternalKey` foi corrigido em `server/utils/psbtBuilderRunes.js`.

## 🚀 Como Testar

### 1. Reiniciar o Backend (SE NÃO ESTIVER RODANDO)

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
node app.js
```

**OU** se estiver usando PM2/outro gerenciador:
```bash
# Verificar se está rodando
ps aux | grep "node app.js"

# Se não estiver, iniciar:
node app.js
```

### 2. Recarregar Extension

1. Abrir Chrome → `chrome://extensions/`
2. Encontrar "MyWallet"
3. Clicar no botão de **reload** (🔄)

### 3. Testar Send Runes

1. Abrir MyWallet extension
2. Fazer login/unlock com sua senha
3. Ir para a aba **"Runes"**
4. Verificar se você tem runes disponíveis
5. Clicar em **"Send"** em alguma rune
6. Preencher:
   - **To Address**: Endereço Bitcoin válido (bc1p...)
   - **Amount**: Quantidade de runes
   - **Fee Rate**: Taxa (ex: 10 sat/vB)
7. Clicar em **"Send"**
8. Confirmar com **senha**
9. ✅ Aguardar broadcast

## 🔍 O Que Observar nos Logs

### Backend Logs (Terminal onde rodou `node app.js`)

```
🚀 ========== BUILD RUNE SEND PSBT ==========
From: bc1p...
To: bc1p...
Rune: YOUR•RUNE
Amount: 500
Fee Rate: 10 sat/vB

🔨 Step 5: Building actual PSBT...
   Adding inputs...
   ✅ Added 3 inputs          <-- Sem tapInternalKey aqui!
   Adding outputs...
   ✅ Added 4 outputs

🔏 Signing PSBT...
  📝 Input 0: Adding OUR tapInternalKey (abc123...)  <-- Adicionado aqui!
  ✅ Input 0 signed
  📝 Input 1: Adding OUR tapInternalKey (abc123...)
  ✅ Input 1 signed
  (...)

🔨 Finalizing PSBT...
  ✅ Input 0 finalized
  ✅ Input 1 finalized
  (...)

📡 BROADCAST TRANSACTION
📦 Transaction size: 523 bytes
🔥 Rune transaction detected!
✅ Bitcoin Core v30.0 supports Runes natively!
📡 Trying Bitcoin Core FIRST (recommended)...
```

### Se Bitcoin Core funcionar:
```
✅ ========== BROADCAST SUCCESSFUL! ==========
🎉 Service: Bitcoin Core v30.0
🔗 TXID: abc123...
🌐 View on mempool: https://mempool.space/tx/abc123...
```

### Se Bitcoin Core falhar (fallback):
```
❌ Bitcoin Core broadcast failed: ...
⚠️  Bitcoin Core failed for Rune transaction
🔄 Falling back to Mining Pools + Public APIs...

⛏️  === FASE 1: MINING POOLS (PRIORIDADE) ===
🌐 [Priority 1] Tentando F2Pool (Priority)...
✅ F2Pool (Priority) SUCESSO!
   TXID: abc123...
```

### Extension Console Logs (F12 → Console na extension)

```
🚀 ========== SEND RUNE TRANSACTION ==========
From: bc1p...
To: bc1p...
Rune: YOUR•RUNE
Amount: 500

📦 Step 1: Building PSBT...
✅ PSBT built: cHNidP8BAH...

✍️  Step 2: Requesting password for signing...
🔐 Password input element: <input>
🔐 Password value: ***
✅ PSBT signed

🔨 Step 2.5: Finalizing PSBT...
✅ PSBT finalized
   Hex length: 1046

📡 Step 3: Broadcasting transaction...
✅ Transaction broadcast!
   TXID: abc123...
========== SEND COMPLETE ==========
```

## ❌ Possíveis Erros

### Se ainda der erro no broadcast:

1. **Verificar UTXOs disponíveis**
   - Pode não ter UTXOs Bitcoin suficientes para fees
   - Pode não ter UTXOs da rune específica

2. **Verificar fee rate**
   - Tentar aumentar para 20-30 sat/vB

3. **Verificar logs do backend**
   - Pode haver erro na construção do runestone
   - Pode haver erro na assinatura

4. **Verificar se a rune existe**
   - Usar `https://ordinals.com` para verificar se a rune é válida

## 📊 Comparação Bitcoin vs Runes

### ✅ Bitcoin Send (já funcionava)
- Construía PSBT com `tapInternalKey` correto desde o início
- Tinha mnemonic disponível no mesmo endpoint

### ✅ Runes Send (agora corrigido)
- Constrói PSBT **sem** `tapInternalKey`
- Adiciona `tapInternalKey` na hora de assinar (quando tem mnemonic)
- Segue o mesmo padrão de assinatura Taproot do Bitcoin

## 🎯 Próximos Passos

Se o teste funcionar:
1. ✅ Marcar como RESOLVED
2. 🎉 Documentar no README
3. 🚀 Deploy em produção

Se ainda houver erro:
1. 📋 Copiar logs completos (backend + extension)
2. 🔍 Analisar erro específico
3. 🛠️ Fazer ajustes adicionais

---

**Autor:** AI Assistant  
**Data:** 2025-10-23  
**Status:** ✅ PRONTO PARA TESTE

