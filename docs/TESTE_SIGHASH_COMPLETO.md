# 🎯 TESTE COMPLETO: Atomic Swap com SIGHASH_SINGLE|ANYONECANPAY

## ✅ O que foi implementado:

1. **PSBT do vendedor** agora tem apenas 1 output (pagamento ao vendedor)
2. **Assinatura com SIGHASH_SINGLE|ANYONECANPAY** no backend (JavaScript)
3. **Buyer flow** adiciona inputs e outputs sem invalidar assinatura do vendedor
4. **Finalization e broadcast** funcionam corretamente

---

## 🧪 Como Testar:

### 1. **Resetar o banco de dados**
```bash
# Resetar offers
curl -X DELETE http://localhost:3000/api/offers
```

### 2. **Vendedor cria listing**

**No browser (console):**
```javascript
// Conectar wallet
await connectWallet();

// Criar oferta
// Quando pedir, fornecer sua PRIVATE KEY (WIF format)
// ⚠️ APENAS PARA TESTE! Nunca use em produção!
createOffer();
```

**O que vai acontecer:**
1. PSBT será criado com:
   - Input 0: Inscription do vendedor
   - Output 0: Pagamento ao vendedor (1000 sats)
2. Backend vai pedir sua PRIVATE KEY (temporário, apenas para teste)
3. PSBT será assinado com `SIGHASH_SINGLE|ANYONECANPAY` (0x83)
4. Oferta será salva no banco

### 3. **Comprador compra inscription**

**No browser (outra conta):**
```javascript
// Conectar outra wallet
await connectWallet();

// Buscar inscription e clicar "Buy Now"
// Escolher taxa
// Assinar com Unisat
```

**O que vai acontecer:**
1. Backend cria PSBT COMPLETO:
   - Input 0: Inscription (com assinatura do vendedor - SIGHASH_SINGLE|ANYONECANPAY)
   - Input 1+: UTXOs do comprador (SEM assinatura)
   - Output 0: Pagamento ao vendedor (LOCKED pela assinatura)
   - Output 1: Inscription ao comprador
   - Output 2: Change ao comprador
2. Unisat assina APENAS inputs do comprador (1+)
3. PSBT é finalizado
4. Broadcast para mempool

### 4. **Verificar transação**
```javascript
// Ver TXID no console
// Abrir no mempool.space
https://mempool.space/tx/[TXID]
```

---

## 📋 Checklist de Teste:

- [ ] Vendedor consegue criar listing fornecendo private key
- [ ] PSBT do vendedor tem assinatura com SIGHASH_SINGLE|ANYONECANPAY
- [ ] Comprador vê a oferta no marketplace
- [ ] Comprador consegue clicar "Buy Now" e escolher taxa
- [ ] Unisat abre para assinar (apenas inputs do comprador)
- [ ] PSBT é finalizado sem erros
- [ ] Broadcast é bem-sucedido
- [ ] Transação aparece no mempool.space
- [ ] Após confirmação, inscription vai para comprador
- [ ] Pagamento vai para vendedor

---

## 🔐 Sobre a Private Key:

**⚠️ IMPORTANTE:**
- Este método (pedir private key no frontend) é APENAS PARA TESTE!
- Em produção, você deve:
  - Usar Bitcoin Core wallet com `walletprocesspsbt`
  - Ou usar um serviço de custódia seguro
  - NUNCA expor chaves privadas no frontend

---

## 🐛 Se der erro:

### "Invalid Schnorr signature"
- ✅ RESOLVIDO! A assinatura agora usa SIGHASH_SINGLE|ANYONECANPAY
- Outputs podem ser adicionados sem invalidar a assinatura

### "Can not modify transaction, signatures exist"
- ✅ RESOLVIDO! Agora salvamos a assinatura e reconstruímos o PSBT

### "PSBT not finalized"
- Verifique se `tapInternalKey` está presente em TODOS os inputs
- Verifique se o comprador realmente assinou

### "Insufficient funds"
- Comprador precisa ter saldo suficiente para:
  - Pagamento ao vendedor
  - Taxa de transação
  - Inscription (546 sats)

---

## 📊 Estrutura do PSBT Final:

```
INPUTS:
  [0] Inscription UTXO (vendedor) - ✅ SIGNED (SIGHASH_SINGLE|ANYONECANPAY)
  [1] Payment UTXO (comprador)    - ⏳ TO BE SIGNED
  [2] Payment UTXO (comprador)    - ⏳ TO BE SIGNED (se necessário)

OUTPUTS:
  [0] 1000 sats → Vendedor        - 🔒 LOCKED (pela assinatura do vendedor)
  [1]  546 sats → Comprador (inscription)
  [2] XXXX sats → Comprador (change)
```

---

## 🎉 Sucesso!

Se tudo funcionar, você verá:
1. ✅ PSBT criado e assinado pelo vendedor
2. ✅ Comprador assina seus inputs
3. ✅ PSBT finalizado
4. ✅ Transação broadcast
5. ✅ TXID retornado
6. ✅ Transação confirmada no mempool

---

## 🚀 Próximos Passos (Produção):

1. **Implementar Bitcoin Core wallet:**
   ```bash
   bitcoin-cli createwallet "marketplace"
   bitcoin-cli loadwallet "marketplace"
   ```

2. **Importar chaves do vendedor:**
   ```bash
   bitcoin-cli importprivkey "WIF_KEY" "seller"
   ```

3. **Usar `walletprocesspsbt` no backend:**
   ```javascript
   const signedPsbt = await bitcoinRpc.walletProcessPsbt(psbt, true, "SINGLE|ANYONECANPAY");
   ```

4. **Remover prompt de private key do frontend**

---

## 📚 Referências:

- BIP 174 (PSBT): https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
- BIP 341 (Taproot): https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
- SIGHASH Types: https://bitcoin.stackexchange.com/questions/3374/what-are-the-sighash-types
- bitcoinjs-lib: https://github.com/bitcoinjs/bitcoinjs-lib

---

Boa sorte! 🎲



