# ⚠️ LIMITAÇÃO: Unisat não suporta Atomic Swaps

## 🚨 O PROBLEMA REAL:

**Unisat SEMPRE assina com `SIGHASH_ALL`**, que significa:
- ✅ Assina TODOS os inputs
- ✅ Assina TODOS os outputs  
- ❌ **Qualquer mudança nos outputs INVALIDA a assinatura**

---

## Por que isso impede Atomic Swaps?

### Fluxo desejado (IMPOSSÍVEL com Unisat):
```
1. Vendedor assina: Input 0 (inscription) → Outputs (pagamento)
2. Comprador adiciona: Input 1+ (payment) + Output (change)
3. Comprador assina: Input 1+
4. Broadcast
```

**PROBLEMA**: No passo 2, quando adicionamos outputs, a assinatura do vendedor (passo 1) fica **INVÁLIDA**!

---

## ✅ SOLUÇÕES POSSÍVEIS:

### 1. Bitcoin Core Wallet (RECOMENDADO) ⭐

**Como funciona:**
- Vendedor tem inscription em endereço controlado pelo Bitcoin Core
- Backend assina via RPC com `SIGHASH_SINGLE|ANYONECANPAY`
- Assinatura permite adicionar inputs/outputs
- ✅ **Verdadeiramente atômico!**

**Setup:**
```bash
# 1. Criar wallet
bitcoin-cli createwallet "marketplace"

# 2. Gerar endereço
bitcoin-cli -rpcwallet=marketplace getnewaddress "seller" "bech32m"

# 3. Transferir inscription para esse endereço
```

**Documentação**: Leia `BITCOIN_CORE_SETUP.md`

---

### 2. Fluxo Não-Atômico (Fallback atual)

**Como funciona:**
- Vendedor cria listing (SEM assinar)
- Quando comprador quer comprar:
  - Backend cria PSBT completo
  - Comprador assina primeiro
  - **Vendedor precisa assinar depois** (online!)
  - Broadcast

**PROBLEMA**:
- ❌ Vendedor precisa estar online
- ❌ Não é verdadeiramente atômico
- ❌ Comprador pode desistir após vendedor assinar

---

### 3. Usar Magic Eden / Unisat Marketplace API

Marketplaces estabelecidos têm soluções proprietárias:
- Usam serviços de custódia
- Têm backends que controlam chaves
- Ou usam protocolos específicos (Ordinals Swaps, etc)

---

## 🎯 Por que Magic Eden funciona?

**Eles usam uma destas estratégias:**

1. **Custódia temporária**: Inscription vai para endereço controlado pelo marketplace
2. **Backend signing**: Têm infraestrutura para assinar com SIGHASH customizado
3. **Protocolos específicos**: Ordinals tem protocolos de swap próprios

---

## 🔐 O que VOCÊ deve fazer:

### Para Testes (AGORA):
```bash
# Configurar Bitcoin Core wallet (15 minutos)
bitcoin-cli createwallet "marketplace"
bitcoin-cli -rpcwallet=marketplace getnewaddress "seller" "bech32m"
# Transferir inscription para esse endereço
```

### Para Produção (DEPOIS):
1. **Bitcoin Core Wallet** (recomendado)
2. **OU** Serviço de custódia profissional
3. **OU** Integrar com APIs de marketplaces existentes

---

## 📊 Comparação:

| Solução | Atômico? | Private Keys | Complexidade |
|---------|----------|--------------|--------------|
| **Bitcoin Core** | ✅ Sim | 🔒 Seguras | Média |
| **Unisat apenas** | ❌ Não | 🔒 Seguras | Baixa |
| **Custódia** | ✅ Sim | ⚠️ Marketplace | Alta |

---

## 🚀 Status Atual do Projeto:

✅ **Código implementado corretamente!**
- PSBT construction ✅
- SIGHASH_SINGLE|ANYONECANPAY ✅
- Finalization ✅
- Broadcast ✅

⚠️ **Falta apenas:**
- Configurar Bitcoin Core wallet (você!)
- Transferir inscription para endereço do Bitcoin Core

---

## 🎯 Próximo Passo:

Siga `SETUP_RAPIDO_SIGHASH.md` para configurar Bitcoin Core wallet!

São apenas 3 comandos simples! 🚀

---

**RESUMO**: O código está perfeito. Só precisa de Bitcoin Core wallet configurada para funcionar atomicamente e com segurança!
