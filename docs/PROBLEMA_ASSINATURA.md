# 🚨 PROBLEMA CRÍTICO ENCONTRADO

## ❌ O QUE ESTÁ ACONTECENDO

**Erro:** `Invalid Schnorr signature, input 0`

### Causa Raiz:
1. **Vendedor assina PSBT** com outputs: `[inscription → vendedor, payment → vendedor]`
2. **Backend modifica outputs** para: `[inscription → COMPRADOR, payment → vendedor]`
3. **Assinatura fica inválida!** ❌

### Por quê?
**Assinaturas Bitcoin assinam TODOS os outputs!** Se você mudar um output, a assinatura fica inválida!

---

## 🎯 SOLUÇÕES POSSÍVEIS

### Solução 1: SIGHASH_SINGLE | ANYONECANPAY (Correto para Atomic Swaps)
**Como funciona:**
- Vendedor assina com `SIGHASH_SINGLE | SIGHASH_ANYONECANPAY`
- Isso permite que outputs sejam modificados/adicionados
- É o padrão usado para atomic swaps reais

**Implementação:**
```javascript
// Vendedor assina com sighashType especial
psbt.signInput(0, keypair, [bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY]);
```

**Problema:** Requer mudanças no frontend (Unisat precisa suportar sighashType customizado)

---

### Solução 2: Vendedor assina JÁ com endereço do comprador (Simples)
**Como funciona:**
- Comprador informa seu endereço ANTES do vendedor assinar
- Vendedor assina PSBT já com `[inscription → comprador, payment → vendedor]`
- Backend NÃO modifica outputs, apenas adiciona inputs do comprador

**Implementação:**
1. Frontend: Comprador clica "Buy"
2. Backend cria PSBT **JÁ com endereço do comprador**
3. Vendedor assina (se ainda não assinou)
4. Backend adiciona inputs do comprador
5. Comprador assina seus inputs
6. Finaliza e broadcast

**Problema:** Vendedor precisa assinar para cada comprador (não pode pré-assinar)

---

### Solução 3: PSBTv2 com campos especiais (Complexo)
**Como funciona:**
- Usa PSBTv2 com campos que permitem modificações
- Requer bitcoinjs-lib atualizado e suporte de carteiras

**Problema:** Muito complexo, nem todas carteiras suportam

---

## 🎯 RECOMENDAÇÃO: Solução 2 (Mais Simples)

### Novo Fluxo:

```
1. Vendedor lista inscription (price, sem PSBT ainda)
   
2. Comprador clica "Buy Now"
   - Informa endereço
   
3. Backend cria PSBT:
   - Input: inscription (vendedor)
   - Output 0: inscription → COMPRADOR (conhecido!)
   - Output 1: payment → vendedor
   
4. Frontend pede vendedor assinar (modal/notificação)
   - "Buyer wants to purchase, please sign"
   
5. Vendedor assina com Unisat
   
6. Backend adiciona inputs do comprador
   
7. Comprador assina seus inputs
   
8. Finaliza e broadcast ✅
```

**Vantagem:** Simples, funciona com qualquer carteira
**Desvantagem:** Vendedor precisa estar online para cada venda

---

## 🔧 ALTERNATIVA: Usar Escrow/Marketplace Contract

Para vendas offline (vendedor não precisa estar presente):
- Usar contratos DLC ou similar
- Marketplace custodia a inscription
- Requer infraestrutura mais complexa

---

## 🎯 PRÓXIMO PASSO

Decidir qual solução implementar:

**A) Solução 1 (SIGHASH)?**
- Mais técnico
- Vendedor pode pré-assinar
- Requer suporte de carteira

**B) Solução 2 (Fluxo com comprador conhecido)?**
- Mais simples
- Vendedor assina por venda
- Funciona agora

**C) Manter como está e usar ordinals swap parciais?**
- Aceitar que vendedor não pré-assina
- Usar serviços de indexação externos

---

## 📊 STATUS ATUAL

- ✅ PSBT está sendo construído corretamente
- ✅ Unisat está assinando corretamente
- ✅ Finalização funciona
- ❌ **Assinatura do vendedor inválida por mudança de outputs**

**DECISÃO NECESSÁRIA:** Qual solução você prefere? 🤔



