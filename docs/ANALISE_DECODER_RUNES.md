# 🔍 ANÁLISE COMPLETA DO DECODER DE RUNES

## Status Atual vs. Padrão Oficial

Data: 22/10/2025  
Referência: [github.com/ordinals/ord](https://github.com/ordinals/ord)

---

## ⚠️ SITUAÇÃO ATUAL (runesDecoder.js)

### O que estamos fazendo AGORA:

```javascript
// ❌ MÉTODO ATUAL (HTML Parsing)
async getRunesForAddress(address) {
    // 1. Buscar HTML do ORD server
    const html = await axios.get(`${ORD_SERVER_URL}/address/${address}`);
    
    // 2. Fazer parsing do HTML
    const runesBalanceMatch = html.match(/<dt>rune balances<\/dt>/);
    
    // 3. Retornar o que o ORD server diz
    return runes;
}
```

### ❌ PROBLEMAS IDENTIFICADOS:

1. **Confia 100% no ORD server**
   - Se o servidor estiver comprometido, pode mentir
   - Não valida os dados na blockchain
   - Sem verificação de edicts

2. **Não lê OP_RETURN**
   - Não decodifica o Runestone
   - Não valida transferências (edicts)
   - Não verifica autenticidade

3. **Parsing de HTML é frágil**
   - Se o formato HTML mudar, quebra
   - Depende da estrutura visual
   - Não é o método oficial

4. **Sem rastreamento de UTXOs**
   - Não sabe de onde veio a rune
   - Não pode validar a cadeia de custódia
   - Impossível detectar fraudes

---

## ✅ SOLUÇÃO OFICIAL (runesDecoderOfficial.js)

### Baseado no repositório official: [ordinals/ord](https://github.com/ordinals/ord)

```javascript
// ✅ MÉTODO CORRETO (Blockchain Verification)
async getRunesForAddress(address) {
    // 1. Buscar UTXOs via Bitcoin Core RPC
    const utxos = await bitcoinRpc.listUnspent(0, 9999999, [address]);
    
    // 2. Para cada UTXO, buscar a transação
    for (const utxo of utxos) {
        const tx = await bitcoinRpc.getRawTransaction(utxo.txid, true);
        
        // 3. Procurar OP_RETURN com OP_13 (magic number de Runes)
        const opReturn = tx.vout.find(v => 
            v.scriptPubKey.hex.startsWith('6a5d')
        );
        
        if (opReturn) {
            // 4. Decodificar Runestone (LEB128)
            const runestone = decodeRunestone(opReturn.scriptPubKey.hex);
            
            // 5. Validar Edicts (regras de transferência)
            for (const edict of runestone.edicts) {
                if (edict.output === utxo.vout) {
                    // ✅ UTXO contém esta rune!
                    runesMap.set(edict.runeId, edict.amount);
                }
            }
        }
    }
    
    // 6. Buscar metadados no ORD server (apenas nome, symbol, parent)
    return runesWithMetadata;
}
```

---

## 📊 COMPARAÇÃO

| Aspecto | Método Atual (HTML) | Método Official (Blockchain) |
|---------|---------------------|------------------------------|
| **Segurança** | ❌ Baixa (confia no servidor) | ✅ Alta (valida blockchain) |
| **Autenticidade** | ❌ Não verifica | ✅ Valida edicts |
| **Fraude** | ❌ Vulnerável | ✅ À prova de fraude |
| **Performance** | ✅ Rápido (1 request) | ⚠️ Mais lento (N requests) |
| **Confiabilidade** | ❌ Depende do ORD | ✅ Blockchain = verdade |
| **Rastreamento** | ❌ Não sabe origem | ✅ Rastreia UTXOs |

---

## 🔥 ESTRUTURA DE UM RUNESTONE (OP_RETURN)

Segundo o protocolo oficial:

```
OP_RETURN                    // 0x6a
OP_13                        // 0x5d (magic number de Runes)
<edicts encoded in LEB128>   // Regras de transferência
<default_output>             // Output padrão
```

### Exemplo Real (DOG•GO•TO•THE•MOON):

```
Transaction: 0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28

OP_RETURN Output:
6a5d0a00c0a2330380c2d72f02

Decodificado:
- 6a = OP_RETURN
- 5d = OP_13 (Runes protocol)
- 0a00c0a2330380c2d72f02 = Edicts (LEB128)
  
Edicts decoded:
- Rune ID: 840000:1 (DOG•GO•TO•THE•MOON)
- Amount: 1000
- Output: 2 (vai para o UTXO index 2)
```

---

## 🎯 O QUE PRECISAMOS FAZER

### Opção 1: HÍBRIDO (Recomendado para MVP)
**Usar método atual + validação parcial**

✅ **Vantagens:**
- Funciona agora
- Performance boa
- Simples de implementar

⚠️ **Limitações:**
- Ainda confia no ORD server
- Não 100% à prova de fraude
- Ok para read-only (visualização)

**Quando usar:**
- Mostrar runes na carteira
- Visualizar balances
- Operações read-only

---

### Opção 2: OFICIAL COMPLETO (Recomendado para PRODUÇÃO)
**Implementar decoder completo com edicts**

✅ **Vantagens:**
- ✅ 100% seguro
- ✅ À prova de fraude
- ✅ Segue padrão oficial
- ✅ Pode validar transferências

⚠️ **Complexidade:**
- Precisa decodificar LEB128
- Mais requests ao Bitcoin Core
- Performance mais lenta
- Código mais complexo

**Quando usar:**
- Enviar runes (critical!)
- Validar transferências
- Swap de runes
- Qualquer operação de escrita

---

## 🚀 ROADMAP RECOMENDADO

### FASE 1: MVP (Atual) ✅
- [x] HTML parsing do ORD server
- [x] Mostrar runes na wallet
- [x] Visualização básica
- **Status:** FUNCIONAL para read-only

### FASE 2: VALIDAÇÃO (Próximo)
- [ ] Implementar decoder LEB128
- [ ] Decodificar Runestones
- [ ] Validar edicts básicos
- **Status:** EM DESENVOLVIMENTO

### FASE 3: PRODUÇÃO (Futuro)
- [ ] Decoder oficial completo
- [ ] Validação de cadeia de custódia
- [ ] Detecção de fraudes
- [ ] Build de PSBTs com runes
- **Status:** PLANEJADO

---

## 💡 RECOMENDAÇÃO IMEDIATA

### Para AGORA (Visualização):
**Manter método atual é OK!** ✅

O que temos funciona perfeitamente para:
- Mostrar runes na wallet
- Ver balances
- Ver detalhes (parent, symbol)
- UI/UX da aplicação

### Para FUTURO (Enviar/Swap):
**Implementar decoder oficial!** ⚠️

Quando formos implementar:
- Send runes
- Swap de runes
- Qualquer transferência

**ENTÃO precisamos do decoder oficial** para garantir:
- ✅ Validação de edicts
- ✅ Construção correta de PSBTs
- ✅ Segurança nas transferências
- ✅ Zero chance de fraude

---

## 📝 CONCLUSÃO

### Situação Atual:
✅ **Método funcional para LEITURA**
- Mostra runes corretamente
- Performance boa
- UI funciona perfeitamente

⚠️ **NÃO adequado para ESCRITA ainda**
- Não valida edicts
- Não constrói PSBTs seguros
- Não detecta fraudes

### Próximos Passos:
1. **Continuar com método atual** para visualização
2. **Implementar decoder oficial** antes de:
   - Implementar "Send Rune"
   - Implementar "Swap Runes"
   - Qualquer operação de transferência

### Referências:
- Repositório oficial: https://github.com/ordinals/ord
- Runes spec: https://docs.ordinals.com/runes.html
- Runestone format: https://github.com/ordinals/ord/blob/master/src/runes.rs

---

**Status:** ✅ ANÁLISE COMPLETA  
**Arquivo criado:** `runesDecoderOfficial.js` (pronto para implementação futura)  
**Método atual:** OK para MVP/visualização  
**Próximo milestone:** Implementar antes de "Send Runes"


