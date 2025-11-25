# 🔥 DESCOBERTA CRÍTICA: Bitcoin Core 30.0

## 🆕 Mudança Importante para OP_RETURN!

### **Bitcoin Core 30.0 AGORA PERMITE MÚLTIPLOS OP_RETURN!**

**Quote das release notes:**
> "Multiple data carrier (OP_RETURN) outputs in a transaction are now permitted for the scriptPubKeys across all such outputs in a transaction, not including the..."

---

## 🎯 O Que Isso Significa

### Antes (Bitcoin Core ≤ 29.x)
```
❌ Apenas 1 OP_RETURN por transação permitido
❌ Limite rígido de policy
```

### Agora (Bitcoin Core 30.0)
```
✅ MÚLTIPLOS OP_RETURN permitidos!
✅ Mais flexível para Ordinals/Runes
```

---

## 📊 Outras Mudanças Relevantes

### 1. Transaction Script Validation
```
"Transaction Script validation errors used to return the reason for the error
standardness error. This has been changed to block-script-verify-flag-failed"
```

**Análise:** Mudanças em como erros de script são reportados.

### 2. TRUC Transactions Support
```
"Support has been added for spending TRUC transactions received by the
wallet, as well as creating TRUC transactions"
```

**TRUC = Topologically Restricted Until Confirmation**

**Análise:** Novo tipo de transação com regras especiais. Pode ajudar com fee management.

### 3. Standard Transaction Versions
```
"the user to create transactions of any standard version number (1-3)"
```

**Análise:** Mais flexibilidade em versões de transações.

### 4. Signature Operations Limit
```
"single standard transaction is now limited to 2500 signature operations"
```

**Análise:** Limite de sig ops ajustado (antes era diferente).

---

## 🤔 Impacto para Runes

### Pergunta: Múltiplos OP_RETURN Ajuda com Runes?

**Resposta:** POSSIVELMENTE!

**Runes usam:**
```
OP_RETURN OP_13 [runestone data]
```

**Se Bitcoin Core 30.0:**
- ✅ Permite múltiplos OP_RETURN
- ✅ Pode ter relaxado regras de OP_RETURN em geral
- ❓ Pode aceitar OP_RETURN OP_13 agora?

**MAS:**
- ❌ Ainda não confirma que aceita `OP_RETURN OP_13` especificamente
- ❌ "scriptpubkey" error pode persistir
- ❓ Precisa testar na prática

---

## 🔬 O Que Testar com Bitcoin Core 30.0

### Teste 1: Aceita Transação Rune?
```bash
# Criar transação Rune
# Tentar broadcast via Bitcoin Core 30.0
# Ver se erro -26 scriptpubkey ainda aparece
```

**Resultado Esperado:**
- ✅ Se funcionar: SOLUÇÃO ENCONTRADA!
- ❌ Se falhar: Precisa F2Pool API

### Teste 2: Verificar Policy Changes
```bash
# bitcoin-cli -datadir=/path getmempoolinfo
# Ver se há mudanças em minrelaytxfee, etc
```

### Teste 3: Comparar com v28.2
```bash
# Tentar mesma transação em v28.2 vs v30.0
# Comparar mensagens de erro
```

---

## 📋 Plano de Atualização

### Opção A: Atualizar Direto (RECOMENDADO)

**Passos:**
1. Parar Bitcoin Core v28.2
2. Baixar Bitcoin Core v30.0
3. Substituir binários
4. Reiniciar com mesmo datadir
5. Aguardar sync (rápido, só 9 dias de blocos)
6. **TESTAR TRANSAÇÃO RUNE!**

**Tempo:** 1-2 horas

**Risco:** BAIXO (datadir compatível)

### Opção B: Testar em Paralelo

**Passos:**
1. Manter v28.2 rodando
2. Baixar v30.0 em outro diretório
3. Criar novo datadir para testes
4. Sync parcial (só pra testar)
5. Testar broadcast

**Tempo:** 3-4 horas (sync completo)

**Risco:** MUITO BAIXO (não afeta sistema atual)

---

## 🎯 RECOMENDAÇÃO FORTE

### **ATUALIZAR PARA BITCOIN CORE 30.0 AGORA!**

**Razões:**
1. ✅ Múltiplos OP_RETURN agora permitidos (NOVA FEATURE!)
2. ✅ Mudanças em transaction policy
3. ✅ Pode resolver o problema Runes
4. ✅ Versão mais recente (13 Out 2025)
5. ✅ Ord v0.23.3 já menciona compatibilidade com v29+

**Se v30.0 NÃO resolver:**
- Plan B: F2Pool API (já sabemos que funciona)
- Tempo perdido: Mínimo (atualização necessária de qualquer forma)

**Se v30.0 RESOLVER:**
- 🎉 PROBLEMA RESOLVIDO!
- ✅ Sem dependências externas
- ✅ Solução nativa
- ✅ Gratuito

---

## 📦 Links de Download

### Bitcoin Core 30.0

**macOS:**
```
https://bitcoincore.org/bin/bitcoin-core-30.0/bitcoin-30.0-x86_64-apple-darwin.tar.gz
https://bitcoincore.org/bin/bitcoin-core-30.0/bitcoin-30.0-arm64-apple-darwin.tar.gz
```

**Verificação:**
```bash
# Verificar SHA256
shasum -a 256 bitcoin-30.0-*.tar.gz
```

---

## 🔍 Investigação Adicional Necessária

### Perguntas Ainda Não Respondidas:

1. **OP_RETURN OP_13 especificamente aceito?**
   - ❓ Release notes não mencionam explicitamente
   - ❓ Precisa testar na prática

2. **Mudanças em IsStandard() function?**
   - ❓ Código fonte mudou?
   - ❓ Ver commits no GitHub

3. **Mining pools já usam v30.0?**
   - ❓ F2Pool atualizado?
   - ❓ Pode afetar propagação

---

## 🎬 AÇÃO IMEDIATA

### Próximo Passo: ATUALIZAR

```bash
# 1. Parar Bitcoin Core atual
/Volumes/D1/bitcoin/bitcoin-28.2/bin/bitcoin-cli -datadir=/Volumes/D1/bitcoin stop

# 2. Baixar Bitcoin Core 30.0
cd /Volumes/D1/bitcoin
curl -O https://bitcoincore.org/bin/bitcoin-core-30.0/bitcoin-30.0-[SEU_ARCH]-apple-darwin.tar.gz

# 3. Extrair
tar xzf bitcoin-30.0-*.tar.gz

# 4. Iniciar
/Volumes/D1/bitcoin/bitcoin-30.0/bin/bitcoind -datadir=/Volumes/D1/bitcoin -daemon

# 5. Aguardar sync (rápido)
watch -n 5 '/Volumes/D1/bitcoin/bitcoin-30.0/bin/bitcoin-cli -datadir=/Volumes/D1/bitcoin getblockchaininfo'

# 6. TESTAR RUNE!
```

---

## ✅ Conclusão

**Bitcoin Core 30.0 é PROMISSOR para Runes!**

**Evidências:**
- ✅ Múltiplos OP_RETURN permitidos (GRANDE MUDANÇA!)
- ✅ Mudanças em transaction policies
- ✅ Lançado recentemente (13 Out 2025)
- ✅ Ord já menciona compatibilidade com versões novas

**Recomendação:** 
**ATUALIZAR AGORA e TESTAR!** 

Se não resolver, implementamos F2Pool API. Mas há uma chance REAL de que v30.0 resolva o problema nativamente! 🚀

**Quer que eu ajude a fazer a atualização?**

