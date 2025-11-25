# 💰 Guia de Recuperação de Fundos Órfãos

## 🎯 O que aconteceu?

Você tentou criar uma pool Lightning DeFi e o processo falhou na etapa de finalização (`finalize-pool`). No entanto, a transação foi broadcast manualmente e confirmou na blockchain.

**Resultado:** 10,546 sats estão "presos" num endereço Taproot órfão.

---

## 📊 Detalhes da TX Órfã

| Campo | Valor |
|-------|-------|
| **TXID** | `d2aa25eac31db71e3e0a5ba0e0993093a1d12f01b8f7f52ac5ee85ddb1cfc866` |
| **VOUT** | `0` |
| **Valor** | `10,546 sats` |
| **Endereço** | `bc1pa88zj2kf2rysq8s7dnhh7upjdjqr2s8v5qcgvjmrhdzjp8t0uh2quhp9k9` |
| **Pool Pubkey** | `03ccd7f9e700490173470a08aa909e848d39dc08dc3c8f924e48c784233b137497` |
| **Explorador** | https://mempool.space/tx/d2aa25eac31db71e3e0a5ba0e0993093a1d12f01b8f7f52ac5ee85ddb1cfc866 |

---

## 🔧 Como Recuperar

### Método 1: Usar a Interface Web (Recomendado) ✅

1. **Abra o navegador com a KrayWallet instalada**

2. **Navegue para:**
   ```
   http://localhost:3000/recover-orphan.html
   ```

3. **Verifique os dados pré-preenchidos:**
   - UTXO TXID: `d2aa25eac31db71e3e0a5ba0e0993093a1d12f01b8f7f52ac5ee85ddb1cfc866`
   - UTXO VOUT: `0`
   - Pool Pubkey: `03ccd7f9e700490173470a08aa909e848d39dc08dc3c8f924e48c784233b137497`
   - Seu Endereço: (auto-preenchido da sua wallet)
   - Fee Rate: `10` sat/vB

4. **Clique em "🔓 Recover Funds"**

5. **Assine o PSBT na KrayWallet quando solicitado**

6. **Aguarde a confirmação!** 🎉

### Método 2: Via API (Avançado)

```bash
# Step 1: Criar PSBT de recuperação
curl -X POST http://localhost:3000/api/lightning-defi/recover-orphan \
  -H "Content-Type: application/json" \
  -d '{
    "utxoTxid": "d2aa25eac31db71e3e0a5ba0e0993093a1d12f01b8f7f52ac5ee85ddb1cfc866",
    "utxoVout": 0,
    "poolPubkey": "03ccd7f9e700490173470a08aa909e848d39dc08dc3c8f924e48c784233b137497",
    "userAddress": "bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx",
    "feeRate": 10
  }'

# Resposta:
# {
#   "success": true,
#   "psbt": "cHNidP8BAH...",
#   "recovery": {
#     "outputValue": 9046,
#     "fee": 1500
#   }
# }

# Step 2: Assinar PSBT (via KrayWallet)
# const signResult = await window.krayWallet.signPsbt(psbt)

# Step 3: Finalizar e broadcast
curl -X POST http://localhost:3000/api/lightning-defi/finalize-recovery \
  -H "Content-Type: application/json" \
  -d '{
    "psbt": "<PSBT_ASSINADO>"
  }'

# Resposta:
# {
#   "success": true,
#   "txid": "abc123...",
#   "explorerUrl": "https://mempool.space/tx/abc123...",
#   "message": "Funds recovered! 🎉"
# }
```

---

## 💰 Quanto vou recuperar?

| Item | Valor |
|------|-------|
| **UTXO Value** | 10,546 sats |
| **Fee (10 sat/vB)** | ~1,500 sats |
| **Você receberá** | ~9,046 sats |

*Nota: O valor exato da fee depende do tamanho final da transação.*

---

## ⚠️ O que causou o problema?

1. **Bug no OP_RETURN:** A pool foi criada com um OP_RETURN vazio, o que queimou as Runes.
2. **Bug no finalize-pool:** O frontend enviou um objeto ao invés de uma string PSBT.
3. **Broadcast manual:** A TX foi broadcast manualmente fora do fluxo esperado.

**✅ JÁ FOI CORRIGIDO!** As próximas pools usarão o Runestone correto.

---

## 🔍 Verificações de Segurança

✅ Você assina o PSBT com sua própria wallet
✅ Você controla a chave privada
✅ Você vê exatamente quanto vai receber
✅ Você pode escolher o endereço de destino
✅ Broadcast via Bitcoin RPC ou mempool.space

**Sem riscos!** Você está apenas movendo seus próprios fundos.

---

## 📞 Suporte

Se encontrar algum erro, verifique:

1. **Servidor rodando?**
   ```bash
   curl http://localhost:3000/api/lightning-defi/status
   ```

2. **KrayWallet conectada?**
   - Abra a extensão
   - Verifique se o endereço está visível

3. **UTXO ainda disponível?**
   - Confira em: https://mempool.space/tx/d2aa25eac31db71e3e0a5ba0e0993093a1d12f01b8f7f52ac5ee85ddb1cfc866

---

## 🎉 Após a Recuperação

Você pode tentar criar a pool novamente! Agora com o Runestone correto implementado, as Runes não serão queimadas.

**Boa sorte! 💪**

