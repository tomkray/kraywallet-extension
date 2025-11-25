# 🧪 TESTE TAG 10 (BODY) - ENVIO BÁSICO DE RUNES

## ✅ Servidor está rodando com o novo formato!

### 📋 **PASSO A PASSO PARA TESTAR:**

1. **Abrir MyWallet Extension**
   - Chrome → Extensions → MyWallet

2. **Ir para tab "Runes"**
   - Ver suas runes disponíveis
   - Clicar em "DOG•GO•TO•THE•MOON"

3. **Clicar em "Send"**

4. **Preencher formulário:**
   ```
   To Address: bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag
   Amount: 500
   Fee Rate: 1 sat/vB (ou deixar padrão)
   ```

5. **Clicar "Send"**

6. **Digitar senha** quando solicitado

7. **Aguardar resultado:**
   - ✅ Success → **FUNCIONOU!** Tag 10 está correta!
   - ❌ Error → Verificar logs do servidor

---

## 🔍 **O QUE VAI ACONTECER:**

### Runestone que será criado:
```
Hex: 6a5d0a00c0a23303f40301
Decoded: [10, 0, 840000, 3, 500, 1]
```

**Formato:**
- `10` = Tag Body (edicts section)
- `0` = Delimiter
- `840000:3` = Rune ID (DOG•GO•TO•THE•MOON)
- `500` = Amount
- `1` = Output destino

### Estrutura da transação:
```
Inputs:
  - Input 0: UTXO com a rune (546 sats + 1000 units DOG)
  - Input 1: UTXO BTC puro (para fees)

Outputs:
  - Output 0: OP_RETURN (Runestone) - 0 sats
  - Output 1: Destinatário - 546 sats + 500 units DOG
  - Output 2: Change - X sats + 500 units DOG (de volta pra você)
```

---

## 📊 **SE DER ERRO, VERIFICAR:**

```bash
# Ver logs do servidor
cd /Users/tomkray/Desktop/PSBT-Ordinals
tail -100 server-tag-format.log | grep "Building Runestone\|scriptpubkey\|BROADCAST"
```

---

## 🎯 **RESULTADO ESPERADO:**

✅ **Success:**
- Transação aceita pela mempool
- TXID gerado
- Runes transferidas com sucesso
- **Tag 10 está funcionando!**

❌ **Error:**
- Verificar logs
- Pode ser problema com:
  - Duplicate outputs (já corrigimos)
  - Formato do Runestone (agora está correto!)
  - Fees insuficientes
  - UTXOs indisponíveis

---

## 🚀 **APÓS O TESTE:**

Se funcionar, vamos implementar:
1. ✨ Tag 2 (Default Output) - Simplificar change
2. 🔥 Tag 4 (Burn) - Queimar runes
3. 🎨 Tag 6 (Etching) - Criar novas runes
4. 📍 Tag 8 (Pointer) - Casos avançados

**PODE TESTAR AGORA!** 🎯
