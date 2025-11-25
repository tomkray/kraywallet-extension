# ✅ SOLUÇÃO FINAL: Atomic Swap com SIGHASH_SINGLE|ANYONECANPAY

## 🎯 Problema Original:

- Vendedor assinava PSBT com Unisat (SIGHASH_ALL padrão)
- Quando comprador adicionava outputs, a assinatura do vendedor ficava INVÁLIDA
- Erro: `Invalid Schnorr signature`

---

## 💡 Solução Implementada:

### 1. **Vendedor assina com SIGHASH_SINGLE | ANYONECANPAY**

**O que muda:**
- `SIGHASH_ALL` → `SIGHASH_SINGLE | ANYONECANPAY` (0x83)
- Assinatura do vendedor APENAS compromete:
  - ✅ Input 0 (inscription)
  - ✅ Output 0 (pagamento ao vendedor)
- Comprador pode adicionar:
  - ✅ Input 1+ (seus UTXOs)
  - ✅ Output 1+ (inscription + change)
- **SEM invalidar a assinatura do vendedor!**

### 2. **Backend assina com JavaScript (bitcoinjs-lib + ecpair)**

**Por que não Unisat?**
- Unisat não suporta SIGHASH customizado
- Sempre assina com SIGHASH_ALL (0x01)

**Solução:**
- Backend recebe private key do vendedor (TEMPORÁRIO - apenas para teste!)
- Usa `bitcoinjs-lib` + `ecpair` para assinar com SIGHASH customizado
- Em produção: usar Bitcoin Core wallet com `walletprocesspsbt`

### 3. **PSBT do vendedor TEM APENAS 1 OUTPUT**

**Estrutura no momento da assinatura:**
```
Input 0:  Inscription UTXO (vendedor)
Output 0: Pagamento ao vendedor (1000 sats)
```

**Depois que comprador adiciona:**
```
Input 0:  Inscription UTXO (vendedor) ✅ ASSINADO
Input 1:  Payment UTXO (comprador)    ⏳ TO SIGN
Output 0: Pagamento ao vendedor       🔒 LOCKED
Output 1: Inscription ao comprador    ✨ NOVO
Output 2: Change ao comprador         ✨ NOVO
```

### 4. **Buyer flow reconstrui PSBT corretamente**

**Fluxo:**
1. Decodifica PSBT do vendedor
2. **Salva a assinatura temporariamente**
3. Cria NOVO PSBT vazio
4. Adiciona Input 0 (vendedor) SEM assinatura
5. Adiciona Inputs 1+ (comprador)
6. Adiciona todos outputs
7. **Restaura assinatura do vendedor**
8. Retorna PSBT para comprador assinar

**Por que reconstruir?**
- `bitcoinjs-lib` é MUITO estrito
- Não permite adicionar inputs a PSBT assinado
- Mesmo com SIGHASH_ANYONECANPAY!

---

## 📦 Arquivos Modificados:

### 1. `server/utils/psbtBuilder.js`
- ✅ Adicionado `signPsbtWithSighashJS()` função
- ✅ Usa `ECPairFactory` + `tiny-secp256k1`
- ✅ Assina com `SIGHASH_SINGLE | ANYONECANPAY` (0x83)

### 2. `server/routes/sell.js`
- ✅ Endpoint `/sign-with-sighash` atualizado
- ✅ Recebe `privateKey` no body
- ✅ Chama `signPsbtWithSighashJS()`

### 3. `app.js` (Frontend)
- ✅ `createOffer()` atualizado
- ✅ Pede private key via `prompt()` (TEMPORÁRIO!)
- ✅ Envia para backend assinar com SIGHASH

### 4. `server/routes/purchase.js`
- ✅ `build-atomic-psbt` já estava correto!
- ✅ Salva assinatura do vendedor
- ✅ Reconstroi PSBT
- ✅ Restaura assinatura

---

## 🔧 Dependências Instaladas:

```bash
npm install ecpair
```

**O que faz:**
- Cria keypairs para assinar PSBTs
- Suporta SIGHASH customizado
- Funciona com `tiny-secp256k1`

---

## 🧪 Como Testar:

1. **Resetar banco:**
   ```bash
   curl -X DELETE http://localhost:3000/api/offers
   ```

2. **Vendedor: Criar listing**
   - Conectar wallet
   - Preencher formulário
   - **Quando pedir, colar sua PRIVATE KEY (WIF)**
   - ⚠️ APENAS PARA TESTE!

3. **Comprador: Comprar**
   - Conectar outra wallet
   - Clicar "Buy Now"
   - Escolher taxa
   - Assinar com Unisat

4. **Verificar:**
   - Console deve mostrar TXID
   - Abrir no mempool.space

---

## ⚠️ IMPORTANTE: Segurança

### Para Testes (AGORA):
- ✅ Pedir private key no frontend
- ✅ Backend assina com JavaScript
- ⚠️ **NUNCA usar em produção!**

### Para Produção (DEPOIS):
1. **Usar Bitcoin Core wallet:**
   ```bash
   bitcoin-cli createwallet "marketplace"
   bitcoin-cli importprivkey "WIF_KEY" "seller"
   ```

2. **Backend assina via RPC:**
   ```javascript
   const signedPsbt = await bitcoinRpc.walletProcessPsbt(
     psbt, 
     true, 
     "SINGLE|ANYONECANPAY"
   );
   ```

3. **Remover prompt de private key do frontend**

---

## 📊 Vantagens desta Solução:

1. ✅ **Verdadeiramente atômico**
   - Vendedor pré-assina
   - Comprador adiciona inputs/outputs
   - Broadcast instantâneo

2. ✅ **Compatível com Unisat/Xverse**
   - Comprador usa SIGHASH_ALL normal
   - Apenas vendedor precisa SIGHASH customizado

3. ✅ **Sem dependência de Bitcoin Core (temporário)**
   - Usa JavaScript puro
   - Fácil de testar

4. ✅ **Seguro para produção (com Bitcoin Core)**
   - Private keys nunca saem do servidor
   - Usa wallet controlada

---

## 🎉 Resultado Esperado:

```
✅ Vendedor cria listing e assina com SIGHASH_SINGLE|ANYONECANPAY
✅ PSBT salvo no banco de dados
✅ Comprador vê oferta no marketplace
✅ Comprador clica "Buy Now"
✅ Backend cria PSBT completo com assinatura do vendedor
✅ Comprador assina seus inputs com Unisat
✅ PSBT finalizado
✅ Broadcast bem-sucedido
✅ Transação confirmada
✅ Inscription vai para comprador
✅ Pagamento vai para vendedor
```

---

## 🚀 Próximos Passos:

1. **Testar com uma transação real**
2. **Verificar se funciona no mempool**
3. **Migrar para Bitcoin Core wallet (produção)**
4. **Adicionar UI melhor para entrada de private key**
5. **Implementar notificações de sucesso**

---

Boa sorte! 🎲

**Qualquer dúvida, leia `TESTE_SIGHASH_COMPLETO.md`**



