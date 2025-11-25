# 💰 Como Recuperar Fundos Órfãos - GUIA RÁPIDO

## ✅ O QUE FOI CORRIGIDO:

1. ✅ Backend agora usa **ordinalsbot.com** como API primária (mais confiável)
2. ✅ Fallback para mempool.space se ordinalsbot falhar
3. ✅ Frontend aceita qualquer TXID (não mais hardcoded)
4. ✅ Nova ferramenta de **auto-scan** criada

---

## 🚀 MÉTODO 1: AUTO-SCAN (MAIS FÁCIL)

### Passo 1: Abra o scanner
```
http://localhost:3000/find-orphan.html
```

### Passo 2: Clique em "🔎 Scan for Orphan UTXOs"

### Passo 3: Ele vai mostrar TODOS os seus UTXOs e marcar os suspeitos

### Passo 4: Clique em "🔓 Recover" no UTXO órfão

### Passo 5: Assine o PSBT na KrayWallet

**PRONTO! 🎉**

---

## 🔧 MÉTODO 2: MANUAL (SE O AUTO-SCAN NÃO FUNCIONAR)

### Passo 1: Encontre o TXID órfão

**Opção A - Via KrayWallet:**
1. Abra a extensão KrayWallet
2. Vá em "Activity" ou histórico
3. Procure a última transação "Create Pool"
4. Copie o TXID

**Opção B - Via Blockchain Explorer:**
1. Vá em: https://mempool.space/address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx
2. Procure transações recentes com valor pequeno (~10,000 sats)
3. Copie o TXID

### Passo 2: Abra a página de recuperação
```
http://localhost:3000/recover-orphan.html
```

### Passo 3: Preencha os campos:
- **UTXO TXID:** Cole o TXID que você copiou
- **UTXO VOUT:** Deixe `0` (geralmente é 0)
- **Pool Pubkey:** Já vem preenchido (03ccd7f9e...)
- **Seu Endereço:** Auto-preenchido da wallet
- **Fee Rate:** Deixe `10` (ou diminua para `2` se quiser economizar)

### Passo 4: Clique em "🔓 Recover Funds"

### Passo 5: Assine o PSBT quando a KrayWallet abrir

### Passo 6: Aguarde confirmação!

---

## 📊 QUANTO VOU RECUPERAR?

Se o UTXO tem **10,546 sats** e você usar fee rate de **10 sat/vB**:

```
Valor Original:  10,546 sats
Fee (estimada):  -1,500 sats
─────────────────────────────
Você recebe:      9,046 sats ✨
```

Se usar fee rate de **2 sat/vB**:

```
Valor Original:  10,546 sats
Fee (estimada):    -300 sats
─────────────────────────────
Você recebe:     10,246 sats ✨
```

---

## ⚠️ TROUBLESHOOTING

### "Transaction not found" (404)

**Causa:** A TX pode não existir ou a API está com problemas.

**Solução:** Use o **Auto-Scan** que busca diretamente na sua wallet!

### "No wallet connected"

**Causa:** KrayWallet não está conectada.

**Solução:** 
1. Abra a extensão KrayWallet
2. Certifique-se que está desbloqueada
3. Recarregue a página

### "User cancelled"

**Causa:** Você cancelou a assinatura do PSBT.

**Solução:** Tente novamente e clique em "Sign" na wallet.

---

## 🎯 LINKS RÁPIDOS

- 🔍 **Auto-Scan:** http://localhost:3000/find-orphan.html
- 💰 **Recuperação Manual:** http://localhost:3000/recover-orphan.html
- 📊 **Ver Saldo:** Abra a KrayWallet
- 🌐 **Explorer:** https://mempool.space/address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx

---

## ✅ DEPOIS DE RECUPERAR

1. Seus sats voltarão para o endereço que você escolheu
2. Você pode tentar criar a pool novamente
3. Agora com o Runestone correto, as Runes não serão queimadas! 🎉

---

**Boa sorte! 💪**

