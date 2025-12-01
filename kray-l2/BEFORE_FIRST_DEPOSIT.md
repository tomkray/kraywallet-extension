# ⚠️ ANTES DO PRIMEIRO DEPOSIT - CHECKLIST CRÍTICO

**NÃO deposite KRAY real até verificar TUDO isso!**

---

## 🔍 CHECKLIST DE SEGURANÇA

### 1. ✅ Servidor L2 Funcionando

**Verificar:**
```bash
curl http://localhost:5001/health
```

**Deve retornar:**
- `status: "healthy"`
- `network: "kray-mainnet-1"`

---

### 2. ✅ Bridge Address Correto

**Verificar:**
```bash
curl http://localhost:5001/api/bridge/info
```

**Deve retornar:**
- `multisig_address: "bc1p..."`
- `threshold: "2-of-3"`
- `network: "Bitcoin Testnet4"`

**⚠️ IMPORTANTE:** Copie esse endereço e salve!

---

### 3. ✅ Decoder de Runes Funcionando

**Teste antes:**
```bash
# No terminal do servidor L2, veja se não há erros
# Procure por:
# ✅ Found X KRAY in UTXO
# ❌ Se mostrar erro de decoder, NÃO deposite!
```

---

### 4. ✅ Database Pronto

**Verificar:**
```bash
cd kray-l2
ls -la data/
```

**Deve ter:**
- `fresh.db` (ou similar)
- Tamanho > 0

---

### 5. ✅ Extension Conectada

**Na extension:**
- Status: Connected (bolinha verde)
- Balance: 0.000 KRAY
- Bridge address visível

---

## 🚨 PROBLEMAS A CORRIGIR ANTES

### 1. ❌ Bridge Address NÃO Aparece na Extension

**Problema:** API `/bridge/info` não retorna o address  
**Solução:** Já corrigi! Reinicie servidor.

### 2. ❌ QR Code Abre Blue Wallet

**Problema:** QR code tem formato `bitcoin:address` que abre em wallets  
**Solução:** Corrigir para mostrar apenas o address

### 3. ⚠️ Rune Decoder Ainda É Placeholder

**Problema:** `extractKrayAmount()` pode não decodificar KRAY corretamente  
**Solução:** Precisa integrar 100% com backend-render decoder

---

## 🔧 CORREÇÕES NECESSÁRIAS (AGORA):

### Correção 1: Mostrar Bridge Address na Extension

Vou atualizar krayL2.js para pegar o address correto.

### Correção 2: QR Code Simples (Não Abre Blue Wallet)

Mudar de `bitcoin:address` para só `address`.

### Correção 3: Verificar Decoder

Testar com uma transação de teste antes de usar KRAY real.

---

## 📋 PRÓXIMOS PASSOS (ORDEM):

### AGORA (Antes de Depositar):

1. ✅ Reiniciar servidor L2 (pegar global.multisigAddress)
2. ✅ Recarregar extension
3. ✅ Ver bridge address aparecer
4. ✅ Verificar QR code
5. ✅ Testar com 1 KRAY testnet PRIMEIRO

### Depois de Testar:

6. Monitor servidor L2 (ver logs)
7. Enviar 1 KRAY para bridge
8. Aguardar 6 confirmações
9. Ver se creditsapparecem na L2
10. Se funcionar → depositar mais

---

## ⚠️ IMPORTANTE: Use TESTNET Primeiro!

**NÃO use KRAY mainnet ainda!**

Razões:
1. Decoder pode ter bugs
2. Multisig não testado com KRAY real
3. Withdrawal não testado
4. Pode perder fundos

**Use TESTNET:**
- Bitcoin Testnet4
- KRAY de teste (se houver)
- Ou quantidade mínima (1-10 KRAY)

---

## 🎯 Vou Corrigir AGORA:

1. Reiniciar servidor com global.multisigAddress
2. Corrigir QR code na extension
3. Verificar bridge address aparece
4. Criar checklist de teste

**Depois disso, podemos testar com CUIDADO!**

---

**Quer que eu corrija essas 3 coisas agora antes de depositar?** 🔧


