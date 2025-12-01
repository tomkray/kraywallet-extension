# 🔗 Como Pegar o Endpoint do QuickNode

**Guia passo-a-passo com imagens mentais**

---

## 📍 Você Tem 2 Opções:

### Opção 1: Pegar do Seu Backend Atual (RÁPIDO - 2 minutos)

Seu backend no Render já usa QuickNode. Vamos pegar de lá!

#### Passo 1: Acessar Render Dashboard
```
1. Abra: https://dashboard.render.com
2. Faça login
3. Clique no seu serviço: "kraywallet-backend"
```

#### Passo 2: Ver as Variáveis de Ambiente
```
1. No serviço, clique em "Environment" (menu esquerdo)
   ou "Settings" → "Environment Variables"

2. Procure por: QUICKNODE_ENDPOINT

3. Você verá algo como:
   QUICKNODE_ENDPOINT = https://black-wider-sound.btc.quiknode.pro/e035aecc...
```

#### Passo 3: Verificar se é MAINNET ou TESTNET
```
Olhe a URL:
- Se tiver ".btc.quiknode.pro" = MAINNET
- Se tiver ".btc-testnet.quiknode.pro" = TESTNET

Para testar L2, você PRECISA de TESTNET!
```

**Se o endpoint for MAINNET:**  
❌ NÃO use para testar L2!  
✅ Vá para Opção 2 (criar endpoint testnet)

---

### Opção 2: Criar Novo Endpoint TESTNET (10 minutos)

#### Passo 1: Acessar QuickNode Dashboard
```
1. Abra: https://dashboard.quicknode.com
2. Faça login (mesma conta que você usa)
```

#### Passo 2: Criar Endpoint
```
1. Clique no botão "Create Endpoint" (azul, grande)

2. Escolha as opções:
   
   Chain: Bitcoin ⛓️
   
   Network: TESTNET ⚠️ (IMPORTANTE! Não mainnet!)
   
   Plan: Free (para testar) ou seu plano atual
   
3. Clique "Continue"

4. Aguarde ~2 minutos (QuickNode cria o endpoint)
```

#### Passo 3: Copiar o Endpoint
```
1. Quando o endpoint estiver pronto, você verá:
   
   📍 HTTP Provider
   https://something-random.btc-testnet.quiknode.pro/abc123def456...
   
   ↑↑↑ Esta é a URL que você precisa!

2. Clique no botão "Copy" ao lado da URL

3. COLE no seu .env:
   QUICKNODE_ENDPOINT=https://something-random.btc-testnet.quiknode.pro/abc123...
```

**Pronto! Endpoint configurado! ✅**

---

## 🔍 Como Verificar se Está Correto

### O endpoint deve:
```
✅ Começar com: https://
✅ Conter: .btc-testnet.quiknode.pro (para testnet)
   OU: .btc.quiknode.pro (para mainnet - não use para testar!)
✅ Terminar com: /letras-e-numeros-aleatorios
✅ Ser uma linha longa (tipo 100+ caracteres)
```

### Exemplo de endpoint CORRETO para testnet:
```
https://purple-fancy-mountain.btc-testnet.quiknode.pro/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/
```

### Exemplo de endpoint ERRADO (mainnet - não usar!):
```
https://black-wider-sound.btc.quiknode.pro/e035aecc...
                        ↑↑↑
                    Sem "-testnet" = MAINNET = Perigoso para testar!
```

---

## 🧪 Como Testar se o Endpoint Funciona

**No terminal:**
```bash
# Substitua YOUR_ENDPOINT pela URL que você copiou
curl -X POST https://your-endpoint.btc-testnet.quiknode.pro/your-key \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getblockchaininfo",
    "params": []
  }'
```

**Se funcionar, você verá:**
```json
{
  "result": {
    "chain": "test",
    "blocks": 2500000,
    "headers": 2500000,
    ...
  }
}
```

**Se ver `"chain": "test"`, está PERFEITO! ✅**

---

## ⚠️ IMPORTANTE: Mainnet vs Testnet

### TESTNET (Para testar - SEGURO):
```
URL: .btc-testnet.quiknode.pro
Moedas: Não valem nada (é de brincadeira)
Perder: Sem problema, é só teste
Use para: Testar sua L2 agora!
```

### MAINNET (Produção - PERIGOSO):
```
URL: .btc.quiknode.pro (sem "testnet")
Moedas: VALEM DINHEIRO REAL
Perder: Prejuízo real!
Use para: Só depois de MUITO teste e audit
```

**SEMPRE use testnet para testar! ⚠️**

---

## 📋 Checklist Final

Antes de colocar no .env, verifique:

- [ ] URL começa com `https://`
- [ ] URL contém `.btc-testnet.quiknode.pro` (TESTNET)
- [ ] URL termina com `/sua-chave-aleatoria`
- [ ] URL é longa (tipo 80-120 caracteres)
- [ ] Você testou com curl e funcionou

**Se todos ✅, pode usar! 🎉**

---

## 🆘 Ainda com Dúvida?

### Me mostre qual endpoint você tem:
```
1. Vá no Render dashboard
2. Veja o QUICKNODE_ENDPOINT
3. Me diga se tem "testnet" na URL ou não
```

**Se tiver testnet:** Pode usar!  
**Se NÃO tiver testnet:** Precisa criar um novo (Opção 2)

---

## 🎯 RESUMO ULTRA SIMPLES

**3 passos:**
1. Login no QuickNode: https://dashboard.quicknode.com
2. Create Endpoint → Bitcoin → **TESTNET**
3. Copiar URL → Colar no .env

**Pronto! ✅**

---

**Precisa de ajuda para criar o endpoint testnet ou já conseguiu?** 😊




