# 📚 ANÁLISE COMPARATIVA: ORD vs MYWALLET

## 🔍 ESTUDO DO REPOSITÓRIO OFICIAL

Baseado na documentação oficial do [ordinals/ord](https://github.com/ordinals/ord):

### ✅ COMO O ORD FUNCIONA

```
1. ORD usa Bitcoin Core para:
   ✅ Gerenciamento de chaves privadas
   ✅ Assinatura de transações
   ✅ Broadcast

2. Fluxo de transferência de Runes:
   ORD CLI → Bitcoin Core RPC → Assinatura Nativa → Broadcast
```

### ❌ COMO O MYWALLET FUNCIONA (ATUAL)

```
1. MyWallet usa bitcoinjs-lib para:
   ❌ Gerenciamento de chaves privadas (na extensão)
   ❌ Assinatura de transações (JavaScript)
   ❌ Broadcast (via APIs públicas)

2. Fluxo de transferência de Runes:
   MyWallet Extension → Backend (PSBT Builder) → bitcoinjs-lib → Assinatura JS → Broadcast
```

## 🎯 DIFERENÇA CRÍTICA IDENTIFICADA

### ORD (FUNCIONA) ✅
- **Assinatura:** Bitcoin Core nativo (C++)
- **Chave:** Gerenciada pelo Bitcoin Core
- **PSBT:** Processado pelo Bitcoin Core com `walletprocesspsbt`
- **Taproot:** Implementação testada em milhões de transações

### MYWALLET (FALHA) ❌
- **Assinatura:** bitcoinjs-lib (JavaScript)
- **Chave:** Derivada manualmente via BIP32
- **PSBT:** Processado manualmente com ecc.signSchnorr
- **Taproot:** Implementação pode ter bugs sutis

## 🔬 ANÁLISE DO CÓDIGO ORD

Baseado na estrutura do repositório oficial:

### 1. **Construção da Transação**
```rust
// ORD usa bitcoin::Transaction do Rust
// Constrói transação com:
// - Inputs com witnessUtxo
// - Output OP_RETURN (Runestone)
// - Outputs de destinatário e change
```

### 2. **Assinatura**
```rust
// ORD NÃO assina diretamente!
// Delega para Bitcoin Core via RPC:
// bitcoin-cli walletprocesspsbt <psbt>
```

### 3. **Runestone (OP_RETURN)**
```rust
// Estrutura:
// OP_RETURN OP_13 <runestone_data>
// 
// runestone_data contém:
// - Edicts (transferências)
// - Pointer (opcional)
// - Protomessage encoding
```

## 🐛 PROBLEMA IDENTIFICADO NA MYWALLET

### ❌ **RAIZ DO PROBLEMA**

**bitcoinjs-lib pode não estar calculando o sighash BIP 341 corretamente quando há OP_RETURN!**

**Evidência:**
1. ✅ Bitcoin Send funciona (sem OP_RETURN)
2. ❌ Runes Send falha (com OP_RETURN no output 0)
3. ❌ Erro `-26: scriptpubkey` = assinatura inválida

### 🔍 **DETALHES TÉCNICOS**

Para Taproot (BIP 341), o sighash inclui:
```
- sha_prevouts
- sha_amounts
- sha_scriptpubkeys ← Inclui o OP_RETURN!
- sha_sequences
- sha_outputs ← Inclui TODOS os outputs
```

**Hipótese:** bitcoinjs-lib pode estar:
- Serializando o OP_RETURN incorretamente
- Calculando sha_outputs com tamanho errado
- Não lidando com varuint do OP_RETURN

## 💡 SOLUÇÕES POSSÍVEIS

### Opção 1: ✅ **RECOMENDADA - Usar Bitcoin Core (Backend)**

**Apenas para assinatura, mantendo a UX da extensão!**

```javascript
// Extension (Frontend):
1. Usuário insere senha
2. Extension descriptografa mnemonic
3. Extension ENVIA mnemonic para backend (HTTPS seguro)

// Backend:
4. Backend importa wallet no Bitcoin Core temporariamente
5. Bitcoin Core assina o PSBT (walletprocesspsbt)
6. Backend retorna PSBT assinado
7. Backend apaga wallet do Bitcoin Core

// Extension:
8. Extension finaliza PSBT
9. Extension faz broadcast
```

**Vantagens:**
- ✅ Assinatura 100% compatível (mesma que ord usa)
- ✅ Funciona para milhares de usuários
- ✅ Não requer Bitcoin Core no cliente
- ✅ Apenas backend precisa de Bitcoin Core

**Segurança:**
- Mnemonic enviada via HTTPS
- Wallet temporária no Bitcoin Core
- Apagada após assinatura

---

### Opção 2: ⚠️ Corrigir bitcoinjs-lib (Complexo)

Debugar e corrigir o cálculo do sighash BIP 341 no bitcoinjs-lib para OP_RETURN.

**Desvantagens:**
- ❌ Muito complexo
- ❌ Pode introduzir outros bugs
- ❌ Difícil de testar

---

### Opção 3: 🔄 Usar Biblioteca Alternativa

Buscar biblioteca JavaScript que comprovadamente funciona com Runes.

**Problema:** Não há biblioteca JavaScript popular para Runes além de bitcoinjs-lib.

---

## 🎯 RECOMENDAÇÃO FINAL

**IMPLEMENTAR OPÇÃO 1: Assinatura via Bitcoin Core no Backend**

### Arquitetura Proposta:

```
┌─────────────────────────────────────┐
│  MYWALLET EXTENSION (Browser)       │
│  - Gerencia mnemonic (encriptada)   │
│  - Coleta dados do usuário          │
│  - Mostra confirmações              │
└──────────┬──────────────────────────┘
           │ HTTPS
           ▼
┌─────────────────────────────────────┐
│  BACKEND (Node.js)                  │
│  - Build PSBT                       │
│  - Importa wallet temp no BTC Core  │
│  - Chama walletprocesspsbt          │
│  - Retorna PSBT assinado            │
└──────────┬──────────────────────────┘
           │ RPC
           ▼
┌─────────────────────────────────────┐
│  BITCOIN CORE v30.0                 │
│  - Assina PSBT (nativo)             │
│  - Suporte Runes nativo             │
└─────────────────────────────────────┘
```

### Fluxo Completo:

1. **Usuário clica "Send Rune"**
2. Extension: Build PSBT (backend)
3. Extension: Solicita senha
4. Extension: Descriptografa mnemonic
5. Extension: Envia { mnemonic, psbt } para `/api/mywallet/sign-with-core`
6. Backend: Cria wallet temporária no Bitcoin Core com o mnemonic
7. Backend: `bitcoin-cli walletprocesspsbt <psbt>`
8. Backend: Apaga wallet temporária
9. Backend: Retorna PSBT assinado
10. Extension: Finaliza PSBT
11. Extension: Broadcast

### Código Necessário:

```javascript
// server/routes/mywallet.js
router.post('/sign-with-core', async (req, res) => {
    const { mnemonic, psbt } = req.body;
    
    // 1. Gerar wallet name único
    const walletName = `temp_${Date.now()}`;
    
    try {
        // 2. Importar wallet no Bitcoin Core
        await bitcoinRpc.createWallet(walletName, {
            disable_private_keys: false,
            blank: true,
            descriptors: true
        });
        
        // 3. Derivar descriptors do mnemonic
        const descriptors = deriveDescriptors(mnemonic);
        
        // 4. Importar descriptors
        for (const desc of descriptors) {
            await bitcoinRpc.importDescriptors([{
                desc,
                timestamp: 'now',
                active: true
            }]);
        }
        
        // 5. Processar PSBT
        const result = await bitcoinRpc.walletProcessPsbt(psbt);
        
        // 6. Retornar PSBT assinado
        res.json({
            success: true,
            psbt: result.psbt,
            complete: result.complete
        });
        
    } finally {
        // 7. SEMPRE apagar wallet temporária
        try {
            await bitcoinRpc.unloadWallet(walletName);
            // Aguardar para garantir que foi descarregada
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.error('Erro ao apagar wallet temporária:', e);
        }
    }
});
```

---

## 📊 COMPARAÇÃO DE OPÇÕES

| Critério | Opção 1 (Bitcoin Core) | Opção 2 (Fix bitcoinjs) | Opção 3 (Lib Alternativa) |
|----------|----------------------|------------------------|--------------------------|
| **Funciona?** | ✅ Garantido | ⚠️ Incerto | ⚠️ Incerto |
| **Complexidade** | 🟡 Média | 🔴 Alta | 🟡 Média |
| **Tempo** | 2-4 horas | Semanas | Dias |
| **Manutenção** | ✅ Baixa | 🔴 Alta | 🟡 Média |
| **Escalável?** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Seguro?** | ✅ Sim (HTTPS) | ✅ Sim | ⚠️ Depende |
| **Produção** | ✅ Pronto | ❌ Requer testes | ⚠️ Requer testes |

---

## ✅ PRÓXIMOS PASSOS

1. Implementar endpoint `/sign-with-core`
2. Implementar função `deriveDescriptors(mnemonic)`
3. Atualizar frontend para usar novo endpoint
4. Testar com transação de Runes
5. Validar segurança (HTTPS, rate limiting, timeout)
6. Deploy

**Tempo estimado:** 2-4 horas de implementação + 1-2 horas de testes

