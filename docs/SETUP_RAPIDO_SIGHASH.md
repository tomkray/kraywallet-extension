# 🚀 Setup Rápido: Atomic Swap com Bitcoin Core

## ✅ CORRIGIDO! Agora SEM expor private keys!

---

## 📋 Pré-requisitos:

1. ✅ Bitcoin Core instalado e sincronizado
2. ✅ Bitcoin Core RPC funcionando (já testado!)
3. ⏳ Wallet do Bitcoin Core configurada

---

## 🔧 Setup em 3 Passos:

### 1️⃣ Criar/Carregar Wallet no Bitcoin Core

Abra o terminal e execute:

```bash
# Opção A: Criar NOVA wallet
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli createwallet "marketplace"

# OU Opção B: Carregar wallet existente
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli loadwallet "marketplace"

# Verificar se carregou
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli listwallets
```

**Resultado esperado:**
```json
[
  "marketplace"
]
```

---

### 2️⃣ Gerar Endereço Taproot (bc1p...)

```bash
# Gerar endereço Taproot para o vendedor
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli -rpcwallet=marketplace getnewaddress "seller" "bech32m"
```

**Resultado:**
```
bc1p... (seu novo endereço Taproot)
```

✅ **IMPORTANTE**: Copie esse endereço! Você vai usar ele no passo 3.

---

### 3️⃣ Transferir Inscription para o Endereço Bitcoin Core

**No Unisat wallet:**

1. Abra sua inscription
2. Clique em "Send" / "Enviar"
3. Cole o endereço `bc1p...` gerado no passo 2
4. Confirme a transação
5. **Aguarde 1 confirmação** (importante!)

---

## 🧪 Testar Atomic Swap:

### 1. Resetar banco de dados
```bash
curl -X DELETE http://localhost:3000/api/offers
```

### 2. Criar Listing

**No browser:**
1. Abra `http://localhost:3000`
2. Conecte wallet Unisat
3. **IMPORTANTE**: No formulário, use o endereço `bc1p...` que você gerou (do Bitcoin Core!)
4. Preencha:
   - Inscription ID
   - Preço (ex: 1000 sats)
   - Taxa
5. Clique "Create Offer"

**O que vai acontecer:**
- Backend cria PSBT
- Backend pede Bitcoin Core para assinar (via RPC)
- Bitcoin Core assina com `SIGHASH_SINGLE|ANYONECANPAY`
- ✅ **SEM pedir private key!**
- Oferta é salva

### 3. Comprar

**Com outra conta:**
1. Conecte outra wallet
2. Veja a oferta
3. Clique "Buy Now"
4. Escolha taxa
5. Assine com Unisat
6. ✅ Broadcast!

---

## 🐛 Troubleshooting:

### "Wallet not found"
```bash
# Listar wallets disponíveis
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli listwalletdir

# Carregar wallet
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli loadwallet "marketplace"
```

### "Address not found in wallet"
- Verifique se você transferiu a inscription para o endereço `bc1p...` do Bitcoin Core
- Aguarde confirmação da transação
- Use `bitcoin-cli -rpcwallet=marketplace listunspent` para verificar

### "Bitcoin Core did not sign the PSBT"
```bash
# Verificar se wallet tem o endereço
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli -rpcwallet=marketplace getaddressinfo "bc1p..."

# Verificar UTXOs da wallet
/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli -rpcwallet=marketplace listunspent
```

---

## 🔐 Por que é Seguro Agora?

1. ✅ **Private keys NUNCA saem do Bitcoin Core**
2. ✅ **Ninguém digita ou vê private keys**
3. ✅ **Bitcoin Core assina via RPC**
4. ✅ **Arquitetura profissional**
5. ✅ **Como marketplaces reais funcionam**

---

## 📊 Fluxo Completo:

```
1. Gerar endereço no Bitcoin Core (bc1p...)
2. Transferir inscription da Unisat → Bitcoin Core
3. Criar listing no marketplace
4. Backend: Criar PSBT
5. Backend: Bitcoin Core assina via RPC (SIGHASH_SINGLE|ANYONECANPAY)
6. Backend: Salvar PSBT no banco
7. Comprador: Clicar "Buy Now"
8. Backend: Adicionar inputs/outputs do comprador
9. Comprador: Assinar com Unisat
10. Backend: Finalizar e broadcast
11. ✅ Transação confirmada!
```

---

## 🎉 Pronto!

Agora você tem um marketplace seguro e profissional! 🚀

**Private keys NUNCA são expostas!**

---

## 📚 Próximos Passos (Opcional):

- Automatizar importação de endereços
- UI para gerenciar wallets
- Suporte a múltiplos vendedores
- Notificações de confirmação

---

Dúvidas? Leia `BITCOIN_CORE_SETUP.md` para mais detalhes!
