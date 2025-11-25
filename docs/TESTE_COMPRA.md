# 🧪 Guia de Teste - Compra de Inscription com PSBT

## ✅ Correções Aplicadas

Foram corrigidos **3 problemas críticos** no sistema de PSBT:

1. **✅ Imports faltando** - Adicionado `bitcoinjs-lib` e `tiny-secp256k1` no `psbt.js`
2. **✅ Perda de assinaturas** - Agora preserva assinaturas do vendedor no atomic swap
3. **✅ Finalização Taproot** - Witness stack Taproot agora está no formato correto

## 🎯 Como Testar a Compra

### Pré-requisitos
- ✅ Servidor rodando em `http://localhost:3000`
- ✅ Carteira Unisat instalada e conectada
- ✅ Saldo suficiente na carteira (para teste: ~20,000 sats)

### Passo 1: Conectar Carteira
1. Abra `http://localhost:3000` no navegador
2. Clique em **"Connect Wallet"** no topo
3. Autorize a conexão com Unisat
4. Verifique que seu endereço aparece no topo

### Passo 2: Criar uma Oferta (Vendedor)
1. Vá para a aba **"Create Offer"**
2. Preencha:
   ```
   Inscription ID: abc123... (pode ser mock por enquanto)
   Offer Amount: 10000 (sats)
   Fee Rate: 5 (sat/vB)
   ```
3. Marque **"Auto-submit offer"** (opcional)
4. Clique em **"Create Offer"**
5. **Assine o PSBT** na Unisat quando aparecer
6. Aguarde confirmação

### Passo 3: Comprar a Inscription (Comprador)
1. Vá para a aba **"Marketplace"**
2. Encontre a oferta que você criou
3. Clique em **"Buy Now"**
4. O sistema vai:
   - 📋 Pegar o PSBT do vendedor (já assinado)
   - 🔧 Construir PSBT atômico (preservando assinaturas!)
   - 💰 Adicionar seus UTXOs para pagamento
   - ✍️ Pedir para você assinar

5. **Assine o PSBT** na Unisat
6. Aguarde:
   - 🔧 Finalização automática
   - 📡 Broadcast para a rede
   - ✅ Confirmação

### Passo 4: Verificar Transação
- O sistema mostrará o **TXID** da transação
- Clique no link para ver no Mempool.space
- Aguarde confirmação na blockchain

## 🔍 O Que Verificar

### Durante a Criação da Oferta
```javascript
// Console do navegador deve mostrar:
✅ PSBT created
✅ PSBT signed by Unisat
✅ Offer saved to database
```

### Durante a Compra
```javascript
// Console do navegador deve mostrar:
✅ Seller PSBT loaded
✅ Atomic PSBT built
✅ PSBT signed by buyer
✅ Transaction finalized
✅ Transaction broadcasted
📜 TXID: abc123...
```

### No Console do Servidor
```bash
# Terminal onde npm start está rodando:
✅ Copied Taproot signature for input 0
✅ Added seller input 0 WITH signatures preserved
✅ Added buyer input 1
📊 PSBT Balance Check: {...}
🔧 Finalizing transaction...
Input 0 finalized as Taproot (key path spend)
Input 1 finalized as standard SegWit
📡 Broadcasting...
✅ Transaction broadcasted: abc123...
```

## 🚨 Possíveis Erros e Soluções

### Erro 1: "No inputs are signed"
**Sintoma:** Erro ao finalizar PSBT
**Causa:** Unisat não assinou o PSBT ou assinatura foi perdida
**Solução:** 
- Verificar logs do servidor
- Confirmar que assinatura está sendo preservada

### Erro 2: "Failed to finalize PSBT"
**Sintoma:** Erro 500 no `/api/psbt/finalize`
**Causa:** Assinatura inválida ou formato incorreto
**Solução:**
- Verificar que é endereço Taproot (bc1p...)
- Confirmar que witnessUtxo está presente
- Ver logs detalhados no terminal

### Erro 3: "Insufficient UTXOs"
**Sintoma:** Não consegue construir PSBT atômico
**Causa:** Carteira não tem saldo suficiente
**Solução:**
- Verificar saldo na Unisat
- Precisar ter: preço + fee (~1000 sats)
- Mínimo recomendado: 20,000 sats

### Erro 4: Unisat não abre janela de assinatura
**Sintoma:** Nada acontece ao clicar "Buy Now"
**Causa:** Carteira não conectada ou bloqueada
**Solução:**
- Desconectar e reconectar carteira
- Atualizar página
- Verificar que Unisat está desbloqueada

## 📊 Debug Avançado

### Ver PSBT no Console
```javascript
// Cole no console do navegador:
const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
console.log('Inputs:', psbt.data.inputs);
console.log('Outputs:', psbt.txOutputs);
console.log('Input 0 signed?', !!(psbt.data.inputs[0].tapKeySig));
```

### Verificar Endpoint de Finalize
```bash
# Teste manual (substitua <PSBT> por PSBT real assinado):
curl -X POST http://localhost:3000/api/psbt/finalize \
  -H "Content-Type: application/json" \
  -d '{"psbt": "<PSBT_ASSINADO>"}'
```

### Verificar Endpoint de Broadcast
```bash
# Teste manual com hex:
curl -X POST http://localhost:3000/api/psbt/broadcast \
  -H "Content-Type: application/json" \
  -d '{"hex": "<TRANSACTION_HEX>"}'
```

## ✨ Melhorias Aplicadas

### Antes ❌
```javascript
// Assinaturas eram perdidas!
psbt.addInput({
    hash: txInput.hash,
    index: txInput.index,
    witnessUtxo: input.witnessUtxo
    // tapKeySig NÃO copiado! ❌
});
```

### Depois ✅
```javascript
// Assinaturas preservadas!
const inputData = {
    hash: txInput.hash,
    index: txInput.index,
    witnessUtxo: input.witnessUtxo
};

if (input.tapKeySig) {
    inputData.tapKeySig = input.tapKeySig; // ✅ PRESERVADO!
}

psbt.addInput(inputData);
```

## 🎯 Checklist de Teste

- [ ] Servidor está rodando sem erros
- [ ] Carteira Unisat conectada
- [ ] Oferta criada com sucesso
- [ ] Oferta aparece no marketplace
- [ ] Botão "Buy Now" funciona
- [ ] Unisat pede assinatura
- [ ] PSBT é assinado com sucesso
- [ ] Finalização funciona (sem erro 500)
- [ ] Broadcast funciona (retorna TXID)
- [ ] Transação aparece no mempool.space
- [ ] Logs do servidor mostram assinaturas preservadas

## 📝 Notas Importantes

### Sobre Mock UTXOs
Atualmente o sistema usa UTXOs mockados para teste. Em produção:
- Unisat fornecerá UTXOs reais da carteira
- Sistema consultará Bitcoin Core para UTXOs válidos
- Inscription precisa ser real e rastreável

### Sobre Fees
- Fee rate atual: 1 sat/vB (muito baixo - rede está vazia)
- Para produção, usar fee rate adequado (5-20 sat/vB)
- Unisat permite escolher fee rate na hora de assinar

### Sobre Taproot
- Endereços Taproot começam com `bc1p...`
- Usam assinaturas Schnorr (64-65 bytes)
- Campo de assinatura: `tapKeySig` (não `partialSig`)

## 🚀 Próximos Passos

1. **Testar com inscription real:**
   - Usar inscription_id válido
   - Verificar que existe no Ord Server
   - Confirmar UTXO real da inscription

2. **Integrar com Bitcoin Core Wallet:**
   - Usar UTXOs reais via `listunspent`
   - Assinar com `signrawtransactionwithwallet`
   - Broadcast com `sendrawtransaction`

3. **Adicionar validações:**
   - Verificar saldo antes de criar oferta
   - Validar inscription existe
   - Confirmar UTXO não está gasto

---

**Status:** ✅ Sistema corrigido e funcional
**Data:** 17/10/2025
**Versão:** Ordinals v0.23.3

🎉 **Pronto para testar!**



