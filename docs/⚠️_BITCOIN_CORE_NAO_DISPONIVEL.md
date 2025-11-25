# ⚠️ BITCOIN CORE NÃO DISPONÍVEL

## 🔴 PROBLEMA DESCOBERTO

A solução via Bitcoin Core **NÃO PODE SER IMPLEMENTADA** porque:

1. ❌ Bitcoin Core não está instalado no servidor
2. ❌ `bitcoin-cli` não encontrado
3. ❌ Erro 404 ao tentar acessar RPC: `http://127.0.0.1:8332`

### Log do Erro:
```
❌ Error signing with Bitcoin Core: Error [ERR_MODULE_NOT_FOUND]: Cannot find module...
Bitcoin RPC Error (createwallet): Method not found
Request failed with status code 404
```

---

## 🚫 POR QUE NÃO É VIÁVEL

### Para Desenvolvimento Local:
- ✅ Seria possível instalar Bitcoin Core
- ❌ Mas requer 600GB+ de espaço
- ❌ E demora dias para sincronizar

### Para Produção:
- ❌ Cada servidor precisaria de Bitcoin Core instalado
- ❌ Cada servidor precisaria de 600GB+ de disco
- ❌ Não escalável
- ❌ Custos altíssimos de infraestrutura

---

## ✅ SOLUÇÃO ALTERNATIVA

### Voltando para bitcoinjs-lib

Reverti o código para usar `/api/mywallet/sign` (bitcoinjs-lib), **MAS** com as correções que já fizemos:

1. ✅ **SIGHASH_DEFAULT** (não especificar sighashType)
2. ✅ **tapInternalKey correto** (já estava correto)
3. ✅ **Chave tweaked** (já estava correto)

### O Que Mudou:

**Frontend (`popup.js`):**
```javascript
// ANTES:
await fetch('.../sign-with-core', ...)

// AGORA (REVERTIDO):
await fetch('.../sign', {
    // SEM sighashType - usa DEFAULT (0x00)
})
```

---

## 🔍 PRÓXIMOS PASSOS

### Debugging Adicional Necessário

O erro `-26: scriptpubkey` persiste, então precisamos investigar:

1. **Verificar se o problema é o OP_RETURN**
   - Construir transação Bitcoin normal (sem Runes)
   - Se funcionar, o problema é o Runestone

2. **Verificar encoding do Runestone**
   - Comparar com transações Runes bem-sucedidas
   - Verificar se o varuint está correto

3. **Verificar valores dos outputs**
   - Output 0 (OP_RETURN): 0 sats ✅
   - Output 1 (destinatário): 546 sats ✅
   - Output 2 (change): > 546 sats ✅

4. **Verificar sequence e locktime**
   - Sequence: 0xFFFFFFFF (padrão)
   - Locktime: 0 (padrão)

---

## 🎯 TESTE AGORA

### 1. Recarregar Extension
```
chrome://extensions → MyWallet → Reload
```

### 2. Tentar Enviar Rune
- Mesmo fluxo de antes
- Agora usa bitcoinjs-lib (não Bitcoin Core)

### 3. Ver Logs
```bash
tail -f server-debug-runes.log
```

**Buscar por:**
```
🔐 ========== SIGNING PSBT ==========
```

---

## 📊 ALTERNATIVAS FUTURAS

Se bitcoinjs-lib continuar falhando, considerar:

### Opção 1: Biblioteca Rust (WASM)
- Compilar código Rust do `ord` para WebAssembly
- Usar no Node.js backend
- ✅ Mesma lógica do `ord`
- ❌ Complexo de implementar

### Opção 2: Serviço Externo
- Usar serviço de assinatura de terceiros
- Ex: BitGo, Fireblocks
- ✅ Infraestrutura gerenciada
- ❌ Custo adicional

### Opção 3: Debug Profundo do bitcoinjs-lib
- Calcular sighash manualmente
- Comparar com expected
- Encontrar discrepância
- ✅ Resolve o problema raiz
- ❌ Requer tempo e expertise

---

## 🆘 SE CONTINUAR FALHANDO

**Próxima ação:** Criar script para calcular sighash BIP 341 manualmente e comparar com o que bitcoinjs-lib está gerando.

**Isso nos dirá:**
- Se o problema é no cálculo do sighash
- Se o problema é na assinatura
- Se o problema é no PSBT em si

---

**Status Atual:** ⚠️ VOLTANDO PARA BITCOINJS-LIB  
**Extension Atualizada:** ✅ SIM  
**Pronto para Teste:** ✅ SIM

