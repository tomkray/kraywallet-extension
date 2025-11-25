# 🔍 VERIFICAÇÃO COMPLETA DO ATOMIC SWAP - KRAY STATION

## 📋 CHECKLIST DE VERIFICAÇÃO

### ✅ 1. CRIAÇÃO DO PSBT DO SELLER
- [ ] PSBT criado SEM outputs (0 outputs)
- [ ] PSBT tem APENAS Input 0 (inscription)
- [ ] Input 0 tem witnessUtxo correto
- [ ] Input 0 tem tapInternalKey correto
- [ ] Assinatura com SIGHASH_NONE|ANYONECANPAY (0x82)
- [ ] Assinatura é Schnorr (64 ou 65 bytes)
- [ ] PSBT armazenado COM assinatura (não criptografado)

### ✅ 2. ARMAZENAMENTO NO BANCO
- [ ] PSBT armazenado na coluna `psbt`
- [ ] SIGHASH type armazenado (0x82 = 130 decimal)
- [ ] Preço armazenado em `offer_amount`
- [ ] Endereço do seller em `creator_address`
- [ ] Status = 'active'

### ✅ 3. BUYER BUSCA OFERTA
- [ ] Frontend busca oferta via API
- [ ] PSBT retornado JÁ TEM assinatura do seller
- [ ] Input 0 tem tapKeySig (65 bytes) OU (64 bytes + sighashType)

### ✅ 4. CONSTRUÇÃO DO PSBT ATÔMICO
- [ ] Backend adiciona inputs do buyer (1, 2, 3...)
- [ ] Backend constrói Output 0: Inscription → Buyer
- [ ] Backend constrói Output 1: Payment → Seller (preço correto!)
- [ ] Backend constrói Output 2+: Change → Buyer
- [ ] Input 0 MANTÉM assinatura do seller

### ✅ 5. BUYER ASSINA
- [ ] Buyer assina inputs 1, 2, 3... (seus UTXOs)
- [ ] SIGHASH_ALL (0x01) nos inputs do buyer
- [ ] Input 0 NÃO é assinado pelo buyer (já tem assinatura do seller)
- [ ] Assinaturas Schnorr (65 bytes cada)

### ✅ 6. VALIDAÇÃO ANTES DO BROADCAST
- [ ] Input 0: tapKeySig presente (seller)
- [ ] Input 0: sighashType = 0x82
- [ ] Inputs 1+: tapKeySig presente (buyer)
- [ ] Inputs 1+: sighashType = 0x01
- [ ] Output 1 value == offer.offer_amount
- [ ] Output 1 address == offer.creator_address

### ✅ 7. FINALIZAÇÃO
- [ ] Todos inputs finalizados
- [ ] finalScriptWitness presente em cada input
- [ ] Nenhum erro de "not finalized"

### ✅ 8. EXTRAÇÃO DA TRANSAÇÃO
- [ ] extractTransaction() bem-sucedido
- [ ] TXID gerado
- [ ] Raw transaction hex gerado

### ✅ 9. BROADCAST
- [ ] Bitcoin Core aceita (sem erros)
- [ ] OU Mempool.space aceita
- [ ] TXID retornado

### ✅ 10. ATOMIC SWAP COMPLETO
- [ ] Seller recebe pagamento
- [ ] Buyer recebe inscription
- [ ] Tudo ou nada (atomicidade)
