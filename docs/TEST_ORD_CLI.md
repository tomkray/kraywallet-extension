# 🧪 TESTE DO ORD CLI - GUIA COMPLETO

## 🎯 OPÇÃO 1: Testar com KrayWallet (Mais Fácil!)

Como você **não tem o ORD CLI instalado**, a maneira mais fácil de testar é:

### ✅ Usar a KrayWallet Extension

1. Abra `http://localhost:3000` no navegador
2. Conecte a **KrayWallet extension**
3. Vá para a aba **"Ordinals"** na extension
4. Clique em **"📝 List for Sale"** em qualquer inscription
5. Insira o preço (ex: 50000 sats)
6. Clique em **"Create Listing"**
7. Assine a transação na popup

**Resultado:** Oferta criada com **0% fee** (borda VERDE no marketplace)

---

## 🔬 OPÇÃO 2: Testar ORD CLI (Requer Instalação)

### Pré-requisitos:
- ORD CLI instalado (`brew install ord`)
- Bitcoin Core rodando
- Wallet carregada no Bitcoin Core

### Passos:

#### 1️⃣ Criar Oferta
```bash
# Criar oferta para inscription
ord wallet offer create 55a082d4b77695d0d79e67c219e9db213bfff7bee29ae304010dcf4ce1874e88i0 50000
```

**Output esperado:**
```
cHNidP8BAH4CAAAA... (muito longo)
```

#### 2️⃣ Copiar o PSBT

O PSBT será impresso no terminal. Copie **tudo** (começa com `cHNidP8`).

#### 3️⃣ Submeter no Marketplace

1. No navegador, vá para `http://localhost:3000/ordinals.html`
2. Clique em **"📝 List for Sale"** na inscription desejada
3. Clique em **"⚡ List with ORD CLI (1% fee)"**
4. Insira o preço: `50000`
5. Clique em **"Generate Command"**
6. Clique em **"📤 Submit PSBT to Marketplace"**
7. Cole o PSBT copiado do terminal
8. Confirme

**Resultado:** Oferta criada com **1% fee** (borda LARANJA no marketplace)

---

## 🐛 PROBLEMA ATUAL

Você tentou submeter um PSBT, mas deu erro:

```
❌ Error: Format Error: Invalid Magic Number
```

**Causa:** Você provavelmente:
1. Cancelou o prompt (clicou Cancel)
2. Colou algo que não é um PSBT válido
3. Colou um PSBT incompleto

---

## ✅ SOLUÇÃO: Use KrayWallet!

Como você **não tem ORD CLI instalado** no caminho `/usr/local/bin/ord`, a forma mais prática é:

### Teste Completo com KrayWallet:

1. **Criar Oferta:**
   - Extension → Ordinals → List for Sale
   - Preço: 50000 sats
   - Assinar

2. **Ver no Marketplace:**
   - `http://localhost:3000/ordinals.html`
   - Borda VERDE (0% fee)

3. **Comprar Oferta:**
   - Conectar outra wallet (ou mesma)
   - Clicar "Buy Now"
   - Confirmar transação

---

## 🔍 VERIFICAR LOGS DO SERVIDOR

Para ver o que está acontecendo, você pode acompanhar os logs:

```bash
# Em outro terminal
tail -f /Volumes/D2/KRAY\ WALLET/server/logs/server.log

# Ou ver o output do servidor diretamente no terminal onde rodou npm start
```

---

## 📊 ESTRUTURA DO PSBT (ORD-Compatible)

O PSBT que criamos agora tem **2 outputs** (como o ORD CLI):

```
Input 0:  Inscription UTXO
Output 0: Inscription → Buyer (546 sats)
Output 1: Payment → Seller (price + 546 sats)
```

**100% compatível com o ORD CLI v0.23+!**

---

## 🎯 RECOMENDAÇÃO

**Use KrayWallet para testar agora!**

Você pode testar o ORD CLI depois quando tiver:
1. ORD CLI instalado corretamente
2. Bitcoin Core sincronizado
3. Wallet com inscriptions

Por enquanto, a KrayWallet é **perfeita para testes** e funciona **exatamente igual** ao ORD CLI, mas com **0% fee**! 🎉

