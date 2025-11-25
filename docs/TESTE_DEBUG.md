# 🐛 DEBUG PASSO A PASSO

## O QUE TESTAR AGORA:

### 1. ANTES DE TESTAR:
Abra o Console do navegador (F12) e deixe aberto durante TODO o processo.

### 2. TESTE VENDEDOR:
1. Connect Wallet (Unisat)
2. Create Offer:
   - Inscription ID: (uma real da sua wallet)
   - Price: 10000
   - Fee Rate: 5
3. **CRUCIAL:** Observe o console do navegador
4. Click "Sign and Submit"
5. **Unisat DEVE ABRIR** para assinar
6. Assine

**Console Esperado (BROWSER):**
```
✅ Custom PSBT returned from Unisat: 70736274ff...
📏 PSBT size check: ...
✅ PSBT size increased - signature likely present!
```

**Console Esperado (SERVIDOR - terminal):**
```
✅ Extracted tapInternalKey from P2TR script: 3e776a445e06cd84b2cbcd...
```

### 3. TESTE COMPRADOR:
1. **NOVA ABA ou perfil diferente no navegador**
2. Connect Wallet (Unisat - outra conta ou mesma para teste)
3. Refresh page (F5) - deve ver a oferta
4. Click "Buy Now"
5. Modal de fee abre - escolha "Custom" → 2 sat/vB
6. Click confirmar

**🚨 PONTO CRÍTICO - O QUE DEVE ACONTECER:**
- Console vai mostrar: "Signing ALL inputs for testing with same wallet..."
- **Unisat DEVE ABRIR** pedindo para assinar
- Se não abrir, copie TODO o console e me envie

7. Se Unisat abriu, assine
8. Aguarde...

**Console Esperado (SERVIDOR - quando `/psbt/finalize` é chamado):**
```
PSBT decoded successfully, has 2 inputs
🔍 Input 0 detailed check: {
  hasTapKeySig: true,
  tapKeySigLength: 64,
  hasTapInternalKey: true,
  tapInternalKeyHex: '3e776a445e06cd84b2cbcd...',
  hasWitnessUtxo: true,
  isP2TR: true,
  scriptPubKeyHex: '5120ffb530e67a3beb6f...'
}
✅ Input 0 IS signed!
🔍 Input 1 detailed check: {
  hasTapKeySig: true,
  tapKeySigLength: 64,
  hasTapInternalKey: true,
  tapInternalKeyHex: 'ccdb99d575a1e4286e64...',
  hasWitnessUtxo: true,
  isP2TR: true,
  scriptPubKeyHex: '51201b8cafdbee3a8362...'
}
✅ Input 1 IS signed!
Total inputs: 2, Signed: 2
🔧 Attempting to finalize all signed inputs...
✅ Input 0 finalized successfully
✅ Input 1 finalized successfully
PSBT fully finalized, extracted tx hex
```

---

## 🚨 SE DER ERRO:

### Erro: Unisat não abre para assinar
**Causa:** PSBT está com problema antes mesmo de chegar na Unisat

**O que fazer:**
1. Copiar TODO o console do browser
2. Procurar por "Available UTXOs" e contar quantos tem
3. Verificar se tem "Error" em vermelho antes de tentar abrir Unisat
4. Me enviar TODO o console

### Erro: "Failed to finalize PSBT"
**Causa:** Input não tem `tapInternalKey` ou assinatura está errada

**O que fazer:**
1. Copiar logs do SERVIDOR (terminal onde rodou `npm start`)
2. Procurar por `🔍 Input 0 detailed check:`
3. Verificar se `hasTapInternalKey: true`
4. Verificar se `hasTapKeySig: true`
5. Me enviar esses logs

### Erro: "Not finalized" da Unisat
**Causa:** bitcoinjs-lib não conseguiu finalizar

**O que fazer:**
1. Copiar logs do servidor
2. Procurar por "❌ Failed to finalize input"
3. Me enviar a mensagem de erro exata

---

## 📊 CHECKLIST:

Antes de testar, confirme:
- [ ] Servidor rodando (http://localhost:3000)
- [ ] Console do browser aberto (F12)
- [ ] Terminal com servidor visível
- [ ] Unisat wallet instalada e desbloqueada
- [ ] Pelo menos 1 inscription na wallet

---

## 🎯 PRÓXIMO PASSO:

**Teste EXATAMENTE como descrito acima e me envie:**
1. TODO o console do browser (copiar/colar)
2. Logs do servidor (especialmente as partes com 🔍 e ✅/❌)
3. Em que ponto falhou (vendedor assinar, comprador assinar, finalizar, ou broadcast)

Com esses logs vou saber EXATAMENTE onde está o problema! 🚀



