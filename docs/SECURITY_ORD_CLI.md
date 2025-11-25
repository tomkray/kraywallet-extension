# 🔒 ORD CLI Security Implementation

## ⚠️ Problema de Segurança Identificado

**NUNCA** expor comandos `ord wallet` via API pública em produção!

### Por quê?

```
❌ ord wallet create    → Criar wallets no servidor (RISCO CRÍTICO)
❌ ord wallet restore   → Restaurar seeds no servidor (RISCO CRÍTICO)
❌ ord wallet send      → Enviar transações (RISCO CRÍTICO)
❌ ord wallet balance   → Expor balanços privados
❌ ord wallet offer create → Requer acesso a chaves privadas
```

## ✅ Solução Implementada: Duas Abordagens

### Abordagem 1: KrayWallet Extension (Recomendado)

**Fluxo Totalmente Local:**
1. Usuário instala KrayWallet Extension
2. Extension gerencia chaves privadas **localmente** no navegador
3. Extension cria PSBTs **localmente**
4. Extension submete PSBT assinado para o marketplace
5. **0% service fee** (sem intermediários)

**Vantagens:**
- ✅ **Zero** risco de segurança
- ✅ Chaves privadas **nunca** saem do navegador do usuário
- ✅ UX perfeita - 1 clique para listar
- ✅ Gratuito (0% fee)
- ✅ Funciona offline para assinatura

---

### Abordagem 2: ORD CLI Manual (Para Wallets Externas)

**Fluxo Seguro:**
1. Usuário executa `ord wallet offer create` **localmente**
2. Usuário copia PSBT gerado
3. Usuário submete PSBT via API `/api/ord-offers/submit-psbt`
4. API valida e publica no marketplace
5. **1% service fee** (para cobrir custos)

**Vantagens:**
- ✅ Suporta **qualquer** wallet externa (Unisat, Xverse, Leather, etc.)
- ✅ Chaves privadas **nunca** tocam o servidor
- ✅ API **apenas** valida e publica PSBTs prontos
- ✅ Compatível com workflow ORD CLI padrão

---

## 🔐 Camada de Segurança Implementada

### Arquivo: `server/utils/ord-security.js`

**Whitelist de Comandos Seguros:**
```javascript
const SAFE_COMMANDS = {
    'inscription': {
        allowed: true,
        description: 'Query public inscription data',
        maxArgs: 1
    },
    'list': {
        allowed: true,
        description: 'List inscriptions (public data)'
    },
    'server-info': {
        allowed: true,
        description: 'Get ORD server information'
    }
};
```

**Blacklist de Comandos Proibidos:**
```javascript
const FORBIDDEN_COMMANDS = [
    'wallet',      // NUNCA
    'create',      // NUNCA
    'restore',     // NUNCA
    'send',        // NUNCA
    'receive',     // NUNCA
    'balance',     // NUNCA
    'inscribe',    // NUNCA
    'offer',       // NUNCA (requer wallet)
    'decode'       // Potencial info leak
];
```

---

## 📡 API Endpoints Seguros

### ✅ POST `/api/ord-offers/submit-psbt`

**Aceita PSBT pronto e publica no marketplace**

```javascript
{
    "psbt": "cHNidP8BAH...",  // PSBT em base64 (já assinado localmente)
    "inscriptionId": "55a082d4...i0",
    "price": 50000,
    "description": "My rare inscription"
}
```

**Resposta:**
```javascript
{
    "success": true,
    "offerId": "ord-1730000000-abc123",
    "message": "Offer published successfully on marketplace!",
    "marketplaceUrl": "http://localhost:3000/ordinals.html"
}
```

**Validações:**
1. ✅ PSBT é válido (base64)
2. ✅ Extrai endereço do seller do PSBT
3. ✅ Calcula service fee (1%)
4. ✅ Salva no banco de dados
5. ✅ Publica no marketplace

---

### ❌ POST `/api/ord-offers/create` (REMOVIDO)

**Este endpoint foi REMOVIDO por segurança.**

Ele executava `ord wallet offer create` no servidor, o que exporia:
- Chaves privadas da wallet do servidor
- Risco de acesso não autorizado
- Vulnerabilidade crítica em produção

---

## 🎯 Fluxo Completo: KrayWallet (0% fee)

```mermaid
User Device               KrayWallet Extension           Kray Station API
    |                              |                             |
    |---(1) Click "List"--->      |                             |
    |                              |                             |
    |                              |---(2) Create PSBT local---> |
    |                              |                             |
    |                              |---(3) Sign local)---------> |
    |                              |                             |
    |                              |---(4) POST /api/offers)---> |
    |                              |                             |
    |<---------------------------(5) Success)--------------------|
```

**Segurança:**
- 🔒 Chaves privadas no navegador (chrome.storage.local encrypted)
- 🔒 PSBT criado e assinado localmente
- 🔒 API recebe apenas PSBT final
- 🔒 Zero acesso a dados sensíveis no servidor

---

## 🎯 Fluxo Completo: ORD CLI (1% fee)

```mermaid
User Machine             User Terminal            Kray Station API
    |                         |                           |
    |-(1) Generate command--> |                           |
    |                         |                           |
    |-(2) Execute locally)--> |                           |
    |                         |                           |
    |<-(3) PSBT output)------ |                           |
    |                         |                           |
    |---------(4) Copy PSBT)----------------------->     |
    |                         |                           |
    |---------(5) POST /submit-psbt)------------------>  |
    |                         |                           |
    |<-------------------(6) Success)--------------------|
```

**Segurança:**
- 🔒 ORD wallet fica na máquina do usuário
- 🔒 Comando executado localmente
- 🔒 Servidor **nunca** acessa a wallet
- 🔒 API apenas valida e publica PSBT

---

## 🚫 O Que NÃO Fazer

### ❌ Executar comandos wallet no servidor

```javascript
// NUNCA FAÇA ISSO:
const { stdout } = await exec(`ord wallet offer create ${id} ${price}`);
```

**Por quê?**
- Expõe chaves privadas do servidor
- Vulnerabilidade crítica
- Acesso não autorizado
- Perda de fundos

---

### ❌ Armazenar seeds/mnemonic no servidor

```javascript
// NUNCA FAÇA ISSO:
const wallet = {
    mnemonic: "word1 word2 word3...",  // ❌ NUNCA!
    privateKey: "..."                    // ❌ NUNCA!
};
```

---

### ❌ Permitir comandos arbitrários via API

```javascript
// NUNCA FAÇA ISSO:
router.post('/exec', async (req, res) => {
    const command = req.body.command;
    const result = await exec(`ord ${command}`);  // ❌ RCE vulnerability!
    res.json(result);
});
```

---

## ✅ Boas Práticas Implementadas

### 1. Validação de Comandos
```javascript
function validateOrdCommand(command) {
    // Whitelist apenas comandos seguros
    // Blacklist todos os comandos de wallet
    // Validar argumentos
}
```

### 2. Submissão Segura de PSBTs
```javascript
router.post('/submit-psbt', async (req, res) => {
    const { psbt } = req.body;
    
    // Validar PSBT
    const psbtObj = bitcoin.Psbt.fromBase64(psbt);
    
    // Extrair dados públicos
    const sellerAddress = extractAddress(psbtObj);
    
    // Salvar no marketplace
    saveOffer(psbtObj, sellerAddress);
});
```

### 3. Separação de Responsabilidades
```
User Device (Client-Side):
- Gerenciar chaves privadas
- Criar transações
- Assinar PSBTs

Kray Station (Server-Side):
- Validar PSBTs
- Publicar ofertas
- Facilitar descoberta (marketplace)
- Coordenar atomic swaps
```

---

## 📚 Referências

- [Bitcoin PSBT](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)
- [ORD Documentation](https://docs.ordinals.com/)
- [BIP-322 Message Signing](https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

## 🎓 Conclusão

**Regra de Ouro:**
> Chaves privadas e comandos de wallet **NUNCA** devem ser executados no servidor.
> Sempre mantenha operações sensíveis **client-side**.

**Implementação Correta:**
1. ✅ KrayWallet Extension (local, 0% fee)
2. ✅ ORD CLI manual + submit PSBT (local, 1% fee)
3. ❌ Executar `ord wallet` no servidor (NUNCA!)

---

**Status:** ✅ **IMPLEMENTADO COM SEGURANÇA**

**Data:** 2025-10-25

**Revisado por:** Security Best Practices

