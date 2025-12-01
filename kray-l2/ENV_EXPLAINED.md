# 📝 Arquivo .env - Explicação Simples

**O que é o arquivo .env?**  
É um arquivo de configuração com as "senhas" e "ajustes" da sua L2.

---

## 🔧 CADA CONFIGURAÇÃO EXPLICADA

### 1. PORT=5000

**O que é:** Porta onde o servidor L2 vai rodar  
**Analogia:** Como o número da sua casa - as pessoas acessam em `localhost:5000`  
**Pode mudar?** Sim, se 5000 já estiver ocupado, use 5001, 5002, etc  
**Exemplo:** `PORT=5000`

---

### 2. NODE_ENV=development

**O que é:** Modo de operação (desenvolvimento ou produção)  
**Analogia:** Como "modo de teste" vs "modo ao vivo"  
**Valores possíveis:**
- `development` = Modo de teste (mostra mais logs, mais permissivo)
- `production` = Modo produção (mais seguro, menos logs)

**Para agora:** Use `development`  
**Exemplo:** `NODE_ENV=development`

---

### 3. BITCOIN_NETWORK=testnet

**O que é:** Qual rede Bitcoin usar  
**Analogia:** Dinheiro de verdade (mainnet) vs dinheiro de brinquedo (testnet)  
**Valores possíveis:**
- `testnet` = Bitcoin de teste (moedas não valem nada, só para testar)
- `mainnet` = Bitcoin real (dinheiro de verdade - CUIDADO!)

**Para agora:** Use `testnet` (seguro para testar)  
**Exemplo:** `BITCOIN_NETWORK=testnet`

**⚠️ IMPORTANTE:** SÓ mude para `mainnet` quando estiver 100% testado e auditado!

---

### 4. DB_PATH=./data/kray-l2.db

**O que é:** Onde salvar o banco de dados  
**Analogia:** Onde fica o "arquivo Excel" com todas as contas e transações  
**Pode mudar?** Sim, mas não precisa  
**Exemplo:** `DB_PATH=./data/kray-l2.db`

**O arquivo será criado automaticamente quando você iniciar o servidor**

---

### 5. VALIDATOR_1_MNEMONIC=palavra1 palavra2...

**O que é:** Frase secreta do validador 1 (12 palavras)  
**Analogia:** Como a senha da carteira, mas para o validador  
**Para que serve:** Uma das 3 "chaves" do cofre multisig

**JÁ GERAMOS PARA VOCÊ:**
```
VALIDATOR_1_MNEMONIC=vibrant winter bright else mixture cattle hard custom police pumpkin crime wage
```

**⚠️ NUNCA compartilhe essa frase!** É como a senha do banco!

---

### 6. VALIDATOR_2_MNEMONIC=palavra1 palavra2...

**O que é:** Frase secreta do validador 2  
**Para que serve:** Segunda "chave" do cofre (precisa 2 de 3 para abrir)

**JÁ GERAMOS:**
```
VALIDATOR_2_MNEMONIC=put era fly flame artist double trip border dream fruit flee tumble
```

**⚠️ NUNCA compartilhe!**

---

### 7. VALIDATOR_3_MNEMONIC=palavra1 palavra2...

**O que é:** Frase secreta do validador 3  
**Para que serve:** Terceira "chave" do cofre (backup caso perca uma)

**JÁ GERAMOS:**
```
VALIDATOR_3_MNEMONIC=bean cotton number thought razor stick note lunch cancel connect arm candy
```

**⚠️ NUNCA compartilhe!**

**Por que 3 chaves?**  
Sistema de segurança 2-of-3:
- Precisa de 2 chaves para mover KRAY
- Se perder 1 chave, ainda funciona
- Se alguém roubar 1 chave, não consegue roubar (precisa de 2)

---

### 8. QUICKNODE_ENDPOINT=https://...

**O que é:** Endereço do servidor Bitcoin que você usa (QuickNode)  
**Analogia:** Como o "provedor de internet" para acessar o Bitcoin  
**Para que serve:** Ver transações, enviar transações, etc

**VOCÊ JÁ TEM UM!** Olhe em:
```
backend-render/.env
```

Procure por: `QUICKNODE_ENDPOINT`

**⚠️ IMPORTANTE:** 
- Para testar: Use endpoint de **TESTNET**
- Para produção: Use endpoint de **MAINNET**

**Exemplo:**
```
QUICKNODE_ENDPOINT=https://black-wider-sound.btc-testnet.quiknode.pro/e035aecc...
```

**Se não tiver endpoint de testnet:**
1. Vá em https://dashboard.quicknode.com
2. Create endpoint
3. Escolha Bitcoin **Testnet**
4. Copie a URL

---

### 9. QUICKNODE_ENABLED=true

**O que é:** Liga/desliga o uso do QuickNode  
**Valores:**
- `true` = Usa QuickNode (normal)
- `false` = Não usa (só para debug)

**Deixe:** `true`  
**Exemplo:** `QUICKNODE_ENABLED=true`

---

### 10. RATE_LIMIT_WINDOW_MS=60000

**O que é:** Janela de tempo para limite de requisições (em milissegundos)  
**Analogia:** "A cada 1 minuto..."  
**Para que serve:** Prevenir spam/ataques

60000 = 60 segundos = 1 minuto

**Deixe como está:** `60000`

---

### 11. RATE_LIMIT_MAX_REQUESTS=100

**O que é:** Máximo de requisições permitidas na janela de tempo  
**Analogia:** "...pode fazer no máximo 100 operações"  
**Para que serve:** Prevenir abuso

Significa: Máximo 100 requisições por minuto por usuário

**Deixe como está:** `100`

---

### 12. WITHDRAWAL_CHALLENGE_PERIOD=86400

**O que é:** Tempo de espera para saques (em segundos)  
**Analogia:** Período de "cancelamento" do saque  
**Para que serve:** Segurança - dá tempo para detectar fraudes

86400 segundos = 24 horas

**Como funciona:**
1. Você pede saque da L2 → L1
2. Espera 24 horas
3. Se ninguém reclamar (fraud proof), saque é processado

**Deixe como está:** `86400` (24 horas)

---

### 13. LOG_LEVEL=info

**O que é:** Quanto detalhe mostrar nos logs  
**Valores possíveis:**
- `debug` = Mostra TUDO (muito detalhe)
- `info` = Mostra o importante (recomendado)
- `warn` = Só avisos
- `error` = Só erros

**Para testar:** Use `info`  
**Exemplo:** `LOG_LEVEL=info`

---

## 📝 RESUMO: O QUE VOCÊ PRECISA FAZER

### 1. Criar o arquivo .env

```bash
cd "/Volumes/D2/KRAY WALLET- V1/kray-l2"
cp env.example .env
```

### 2. Editar o .env

Abra o arquivo `.env` no editor e cole isto:

```bash
# Servidor
PORT=5000
NODE_ENV=development

# Rede Bitcoin (testnet = seguro para testar)
BITCOIN_NETWORK=testnet

# Banco de dados (será criado automaticamente)
DB_PATH=./data/kray-l2.db

# 3 Chaves dos validadores (já geramos para você)
VALIDATOR_1_MNEMONIC=vibrant winter bright else mixture cattle hard custom police pumpkin crime wage
VALIDATOR_2_MNEMONIC=put era fly flame artist double trip border dream fruit flee tumble
VALIDATOR_3_MNEMONIC=bean cotton number thought razor stick note lunch cancel connect arm candy

# QuickNode - SUBSTITUA com seu endpoint de TESTNET
QUICKNODE_ENDPOINT=https://SEU-ENDPOINT-TESTNET.quiknode.pro/SUA-CHAVE
QUICKNODE_ENABLED=true

# Segurança (deixe como está)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
WITHDRAWAL_CHALLENGE_PERIOD=86400

# Logs
LOG_LEVEL=info
```

### 3. ÚNICA COISA que você PRECISA MUDAR:

```
QUICKNODE_ENDPOINT=https://SEU-ENDPOINT-TESTNET.quiknode.pro/SUA-CHAVE
                    ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                    Cole seu endpoint de TESTNET aqui
```

**Onde encontrar seu endpoint:**
1. Vá em https://dashboard.quicknode.com
2. Procure seu endpoint de Bitcoin **Testnet**
3. Copie a URL completa
4. Cole no .env

**Se não tiver endpoint de testnet:**
1. Create Endpoint
2. Escolha Bitcoin
3. Escolha **Testnet**
4. Copie a URL

---

## ✅ CHECKLIST

Antes de iniciar o servidor:

- [ ] Arquivo `.env` criado (copiado de `env.example`)
- [ ] PORT configurado (5000)
- [ ] BITCOIN_NETWORK = testnet
- [ ] 3 VALIDATOR mnemonics copiados (já geramos)
- [ ] QUICKNODE_ENDPOINT **substituído** com seu endpoint real
- [ ] Salvo o arquivo

**Depois disso:**
```bash
npm start
```

**E pronto! Servidor rodando! ⚡**

---

## 🎯 TL;DR (Resumão)

**Você só precisa:**
1. Copiar env.example para .env
2. Trocar QUICKNODE_ENDPOINT pelo seu endpoint de testnet
3. Salvar
4. Rodar `npm start`

**Todo o resto já está configurado! ✅**

---

**Alguma dúvida sobre alguma configuração específica?** 😊






