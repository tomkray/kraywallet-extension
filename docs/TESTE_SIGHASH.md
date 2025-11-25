# 🧪 TESTE COMPLETO: ATOMIC SWAP COM SIGHASH

## ⚙️ PRÉ-REQUISITOS

### 1. Bitcoin Core PRECISA estar rodando

```bash
# Verificar se Bitcoin Core está rodando
bitcoin-cli getblockchaininfo

# Se não estiver, iniciar:
bitcoind -daemon
```

### 2. Wallet precisa estar carregada

```bash
# Criar wallet de teste
bitcoin-cli createwallet "marketplace-test"

# Ou carregar wallet existente
bitcoin-cli loadwallet "marketplace-test"

# Verificar
bitcoin-cli listwallets
```

### 3. Importar chave privada do VENDEDOR (TEMPORARIAMENTE)

**⚠️ IMPORTANTE:** Isso é APENAS para teste! Em produção, o vendedor assinaria com sua própria wallet.

```bash
# Obter a chave privada da Unisat (vendedor)
# No browser console:
# window.unisat.getAccounts() -> pegar endereço
# Depois exportar private key da Unisat

# Importar no Bitcoin Core (só para teste!)
bitcoin-cli importprivkey "PRIVATE_KEY_HERE" "seller" false
```

**OU** usar `descriptors` se for carteira Taproot:

```bash
bitcoin-cli importdescriptors '[{"desc": "tr(INTERNAL_KEY)", "timestamp": "now", "label": "seller"}]'
```

---

## 🚀 FLUXO COMPLETO

### PASSO 1: Vendedor Lista Inscription

1. **Conectar wallet do vendedor** (Unisat)
2. **Ir para tab "Make Offer"**
3. **Preencher:**
   - Inscription ID: `f270ab6c6a849f83288e30ae075d2bb72bf4865846b6a53c6eca8d13ea655807i0` (ou outra)
   - Offer Amount: `1000` sats
   - Fee Rate: `2` sat/vB
4. **Click "Create Offer with PSBT"**

**O que acontece:**

```
Frontend → Backend: /api/sell/create-custom-psbt
  ↓
Backend: Cria PSBT com:
  - Input 0: Inscription UTXO (vendedor)
  - Output 0: Payment para vendedor (1000 sats)
  ↓
Backend → Bitcoin Core: /sign-with-sighash
  ↓
Bitcoin Core: Assina com SIGHASH_SINGLE | ANYONECANPAY
  ↓
PSBT assinado é salvo no banco
```

**Resultado esperado:**
```
✅ PSBT signed with SIGHASH_SINGLE|ANYONECANPAY
✅ Offer created and LIVE in marketplace!
```

**Se Bitcoin Core falhar:**
```
⚠️ Trying Unisat fallback (no SIGHASH)...
[Unisat abre para assinar]
```

---

### PASSO 2: Comprador Compra Inscription

1. **Conectar wallet do comprador** (Unisat - outra conta!)
2. **Ir para tab "Browse Ordinals"**
3. **Click "Buy Now" na inscription listada**
4. **Escolher taxa:** Custom `2` sat/vB
5. **Click "Confirm Purchase"**

**O que acontece:**

```
Frontend → Backend: /api/purchase/build-atomic-psbt
  ↓
Backend: Monta PSBT atômico:
  - Input 0: [JÁ ASSINADO] Inscription (vendedor)
  - Input 1+: UTXOs do comprador
  - Output 0: [LOCKED] Payment → vendedor (1000 sats)
  - Output 1: Inscription → comprador (546 sats)
  - Output 2: Change → comprador
  ↓
Backend: Copia assinatura do vendedor para Input 0
  ↓
Frontend: Unisat assina Input 1+ (comprador)
  ↓
Frontend → Backend: /api/psbt/finalize
  ↓
Backend: Finaliza PSBT
  ↓
Backend → Mempool: Broadcast
  ↓
✅ Transaction broadcasted!
```

**Resultado esperado:**
```
✅ Transaction broadcasted: [TXID]
🎉 Purchase complete! Check mempool.space
```

---

## 🔍 VERIFICAÇÃO

### Backend Console:

```
🔐 ========== SIGNING WITH SIGHASH ==========
SighashType: SINGLE|ANYONECANPAY

✅ PSBT SIGNED WITH SIGHASH!
Inputs: 1
Outputs: 1
Input 0 has signature: true
=========================================

🏗️  CONSTRUINDO PSBT ATÔMICO (BIP 174)...
1️⃣  Decodificando PSBT do vendedor...
✅ PSBT do vendedor validado
   Inscription value: 546 sats

2️⃣  Calculando valores...
   Inscription: 546 sats
   Pagamento: 1000 sats
   Fee: 500 sats
   Total in: 1546 sats
   Change: 46 sats

5️⃣  Adicionando outputs...
   ✅ Output 0: Payment → SELLER (1000 sats) [LOCKED]
   ✅ Output 1: Inscription → BUYER (546 sats)

6️⃣  Copiando assinatura do vendedor...
   ✅ tapKeySig copiado para Input 0

✅ PSBT ATÔMICO CONSTRUÍDO!
```

### Frontend Console:

```
✅ PSBT signed with SIGHASH_SINGLE|ANYONECANPAY
✅ Offer created and LIVE in marketplace!

[Comprador clica Buy Now]

✅ Atomic PSBT created: {totalInputs: 2, totalOutputs: 2, fee: 500}
PSBT has 2 inputs total (1 seller + 1 buyer)
Signing buyer inputs (indices 1+)...
✅ PSBT signed by Unisat
✅ Transaction finalized!
✅ Transaction broadcasted: abc123...
```

---

## ❌ TROUBLESHOOTING

### Error: "Bitcoin Core RPC signing failed"

**Causa:** Bitcoin Core não está rodando ou wallet não tem a chave privada.

**Solução:**
1. Iniciar Bitcoin Core: `bitcoind -daemon`
2. Importar chave privada do vendedor (ver pré-requisitos)
3. OU usar Unisat fallback (funciona mas SEM SIGHASH)

---

### Error: "PSBT do vendedor não está assinado"

**Causa:** Assinatura falhou no passo 1.

**Solução:**
1. Verificar logs do backend
2. Se Bitcoin Core falhou, usar Unisat fallback
3. Verificar se PSBT tem `tapKeySig` no Input 0

---

### Error: "Invalid Schnorr signature"

**Causa:** Outputs foram modificados após assinatura (problema antigo).

**Solução:**
- Com SIGHASH_SINGLE | ANYONECANPAY, isso NÃO deve mais acontecer!
- Output 0 é LOCKED (assinado pelo vendedor)
- Comprador só ADICIONA Output 1+

---

### Error: "Can not modify transaction, signatures exist"

**Causa:** Assinatura foi adicionada antes de construir o PSBT completo.

**Solução:**
- Código corrigido! Assinatura é adicionada DEPOIS de todos inputs/outputs.

---

## 📊 ESTRUTURA FINAL DO PSBT

```
PSBT ATÔMICO:

Inputs:
  0: Inscription UTXO (vendedor) [ASSINADO com SIGHASH_SINGLE|ANYONECANPAY]
  1: Payment UTXO (comprador) [ASSINADO com SIGHASH_ALL]

Outputs:
  0: 1000 sats → Vendedor [LOCKED - assinado pelo vendedor]
  1: 546 sats → Comprador (inscription)
  2: Change → Comprador (se houver)
```

**Como funciona:**
- Vendedor assina: `Input 0 → Output 0` (SIGHASH_SINGLE)
- `ANYONECANPAY` permite comprador adicionar Input 1+
- Comprador NÃO pode mudar Output 0 (está locked!)
- Comprador adiciona Output 1+ (inscription, change)

---

## ✅ SUCESSO!

Se tudo funcionar:

1. ✅ Vendedor pré-assina com SIGHASH
2. ✅ Comprador adiciona inputs/outputs
3. ✅ Transaction é broadcasted
4. ✅ Atomic swap completo!

**Verificar no mempool.space:**
```
https://mempool.space/tx/[TXID]
```

---

## 🎯 PRÓXIMOS PASSOS (PRODUÇÃO)

Para produção, NÃO usar Bitcoin Core RPC:

**Opção A:** Integrar com `ord` wallet
```bash
ord wallet sign --sighash=SINGLE|ANYONECANPAY
```

**Opção B:** Implementar SIGHASH no frontend com bibliotecas JavaScript
- Requer controle total da assinatura
- Complexo mas possível

**Opção C:** Usar serviço de escrow
- Marketplace custodia inscriptions
- Mais simples para usuários



