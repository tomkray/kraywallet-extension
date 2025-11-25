# 🧪 GUIA DE TESTES - Sistema Corrigido v2.0

## ✅ PRÉ-REQUISITOS

Antes de testar, certifique-se:

1. ✅ Servidor Node.js rodando (`http://localhost:3000`)
2. ✅ LND rodando e desbloqueado
3. ✅ KrayWallet instalada e conectada
4. ✅ Tem BTC + Runes no endereço Taproot

---

## 🎯 TESTE 1: Criar Pool (Feliz Path)

### **Passo 1: Abrir a interface**

```
http://localhost:3000/runes-swap.html
```

### **Passo 2: Conectar wallet**

- Clique em "Connect Wallet"
- Selecione KrayWallet
- Autorize a conexão

### **Passo 3: Ir para "Create Pool"**

- Clique na aba "CREATE"
- Veja seus Runes e BTC

### **Passo 4: Preencher formulário**

- **Rune:** Selecione uma (ex: DOG•GO•TO•THE•MOON)
- **Amount:** Digite quantidade (ex: 100)
- **BTC:** Digite sats (ex: 10000)
- **Pool Name:** Digite nome (ex: "TEST-V2")
- **Inscription (opcional):** Selecione uma imagem

### **Passo 5: Criar pool**

- Clique em "CREATE POOL"
- Aguarde o PSBT ser criado

### **Passo 6: Assinar PSBT**

- KrayWallet abrirá automaticamente
- **VERIFIQUE:**
  - ✅ Output 0 vai para SEU endereço (bc1pvz02...)
  - ✅ Valor está correto
  - ✅ Tem OP_RETURN (Output 1)
- Digite sua senha
- Clique em "SIGN"

### **Passo 7: Aguardar confirmação**

- Backend validará o Runestone
- Fará broadcast da TX
- Mostrará o TXID

### **Passo 8: Verificar no Explorer**

```
https://mempool.space/tx/<TXID>
```

**DEVE MOSTRAR:**
- ✅ Output 0: Seu endereço Taproot (bc1pvz02...) com X sats
- ✅ Output 1: OP_RETURN com dados (não vazio!)
- ✅ Output 2 (opcional): Change para seu endereço

**NO OP_RETURN, DEVE TER:**
- Bytes: `6a 5d XX YY ZZ ...` (não só `6a`!)
- `6a` = OP_RETURN
- `5d` = OP_13 (protocol identifier)
- `XX` = tamanho do payload
- `YY ZZ ...` = dados LEB128 do Runestone

---

## 🔍 TESTE 2: Validar Runestone

### **Usando o Explorer:**

1. Vá em: https://mempool.space/tx/<TXID>
2. Clique em "Details"
3. Procure o output com valor `0`
4. Veja o "ScriptPubKey (asm)"

**DEVE MOSTRAR algo como:**
```
OP_RETURN
OP_13
OP_PUSHBYTES_XX
<hex data aqui>
```

**NÃO DEVE MOSTRAR:**
```
OP_RETURN  ← SÓ ISSO = RUIM!
```

### **Usando curl:**

```bash
# Buscar TX
curl -s "https://mempool.space/api/tx/<TXID>" | python3 -c "
import sys, json
tx = json.load(sys.stdin)
for i, out in enumerate(tx['vout']):
    if out['value'] == 0:
        script = out['scriptpubkey']
        print(f'Output {i} (OP_RETURN):')
        print(f'  Script: {script}')
        print(f'  Length: {len(script)//2} bytes')
        print(f'  Starts with 6a5d: {script.startswith(\"6a5d\")}')
        if len(script) > 4:
            print(f'  ✅ NOT EMPTY!')
        else:
            print(f'  ❌ EMPTY!')
"
```

---

## 🛡️ TESTE 3: Verificar Controle das Chaves

### **Teste se você pode gastar o UTXO:**

1. Abra a KrayWallet
2. Vá em "Activity" ou histórico
3. Veja a TX recente
4. **DEVE MOSTRAR:**
   - ✅ Recebido em SEU endereço
   - ✅ Valor correto
   - ✅ Pode clicar para ver detalhes

### **Teste criar TX de "recuperação":**

1. Abra: `http://localhost:3000/find-orphan.html`
2. Clique em "Scan for Orphan UTXOs"
3. **DEVE MOSTRAR:**
   - ✅ UTXO da pool como "Plain BTC" (ou similar)
   - ✅ Botão "Recover" disponível
   - ✅ Você PODE assinar uma TX gastando ele

---

## ❌ TESTE 4: Validação de Segurança (Backend)

### **Teste 1: PSBT com Runestone vazio**

```bash
# Criar PSBT malicioso com OP_RETURN vazio
# Backend DEVE REJEITAR!

curl -X POST http://localhost:3000/api/lightning-defi/finalize-pool \
  -H "Content-Type: application/json" \
  -d '{
    "psbt": "<PSBT_COM_RUNESTONE_VAZIO>",
    "poolId": "test"
  }'

# RESPOSTA ESPERADA:
# {
#   "success": false,
#   "error": "CRITICAL: Runestone is empty..."
# }
```

### **Teste 2: TX sem OP_RETURN**

```bash
# Criar PSBT sem OP_RETURN
# Backend DEVE REJEITAR!

# RESPOSTA ESPERADA:
# {
#   "success": false,
#   "error": "CRITICAL: No OP_RETURN found..."
# }
```

### **Teste 3: Runestone com formato errado**

```bash
# OP_RETURN que não começa com OP_13
# Backend DEVE REJEITAR!

# RESPOSTA ESPERADA:
# {
#   "success": false,
#   "error": "CRITICAL: Not a valid Runestone format..."
# }
```

---

## 📊 TESTE 5: Comparação Antes vs Depois

### **Sistema ANTIGO (buggy):**

```bash
# Buscar TX antiga que deu problema
curl -s "https://mempool.space/api/tx/c72fdc2043602c04968a45e8efd51b27ee37f9f63357213d466eff35c03e0699" | python3 -c "
import sys, json
tx = json.load(sys.stdin)
print('TX ANTIGA (BUGGY):')
for i, out in enumerate(tx['vout']):
    addr = out.get('scriptpubkey_address', 'N/A')
    value = out['value']
    script = out['scriptpubkey'][:20]
    print(f'  Output {i}: {value} sats -> {addr}')
    print(f'    Script: {script}...')
    if value == 0:
        if len(out['scriptpubkey']) <= 4:
            print('    ❌ RUNESTONE VAZIO!')
        else:
            print(f'    Script length: {len(out[\"scriptpubkey\"])//2} bytes')
"
```

**RESULTADO ESPERADO:**
```
TX ANTIGA (BUGGY):
  Output 0: 10546 sats -> bc1pvpw5r3pa4ue... (endereço pool órfão!)
    Script: 51200d3...
  Output 1: 0 sats -> N/A
    Script: 6a...
    ❌ RUNESTONE VAZIO!  ← PROBLEMA!
```

### **Sistema NOVO (correto):**

```bash
# Buscar SUA TX nova
curl -s "https://mempool.space/api/tx/<SEU_TXID>" | python3 -c "
import sys, json
tx = json.load(sys.stdin)
print('TX NOVA (CORRIGIDA):')
for i, out in enumerate(tx['vout']):
    addr = out.get('scriptpubkey_address', 'N/A')
    value = out['value']
    if value == 0:
        script_len = len(out['scriptpubkey'])//2
        starts_with = out['scriptpubkey'][:4]
        print(f'  Output {i}: OP_RETURN')
        print(f'    Length: {script_len} bytes')
        print(f'    Starts with: {starts_with}')
        if starts_with == '6a5d':
            print('    ✅ RUNESTONE VÁLIDO!')
        else:
            print('    ❌ RUNESTONE INVÁLIDO!')
    else:
        print(f'  Output {i}: {value} sats -> {addr}')
"
```

**RESULTADO ESPERADO:**
```
TX NOVA (CORRIGIDA):
  Output 0: 10000 sats -> bc1pvz02... (SEU endereço!)
  Output 1: OP_RETURN
    Length: 15 bytes  ← NÃO ESTÁ VAZIO!
    Starts with: 6a5d
    ✅ RUNESTONE VÁLIDO!  ← CORRETO!
  Output 2: 5000 sats -> bc1pvz02... (change)
```

---

## ✅ CHECKLIST DE SUCESSO

Após criar uma pool, verifique:

- [ ] TX confirmou na blockchain
- [ ] Output 0 está no SEU endereço (bc1pvz02...)
- [ ] OP_RETURN NÃO está vazio (> 4 bytes)
- [ ] OP_RETURN começa com `6a5d` (OP_RETURN + OP_13)
- [ ] Você consegue ver o UTXO na sua wallet
- [ ] Pool aparece em `/api/lightning-defi/pools`
- [ ] Você PODE criar TX gastando esse UTXO
- [ ] Runes aparecem corretamente na wallet

---

## 🚨 SINAIS DE PROBLEMA

Se você ver QUALQUER um destes, **PARE E REPORTE:**

- ❌ Output vai para endereço diferente do seu
- ❌ OP_RETURN tem só 2 bytes (`6a`)
- ❌ OP_RETURN não começa com `6a5d`
- ❌ UTXO não aparece na sua wallet
- ❌ Você não consegue criar TX gastando o UTXO
- ❌ Runes não aparecem ou aparecem erradas

---

## 📞 SUPORTE

Se encontrar problemas:

1. Verifique os logs: `tail -100 server-output.log`
2. Verifique a TX no explorer
3. Capture screenshot do erro
4. Reporte com:
   - TXID
   - Logs do servidor
   - Screenshot
   - Passos para reproduzir

---

## 🎉 TESTE BEM-SUCEDIDO!

Se tudo funcionou:

- ✅ Sistema está SEGURO
- ✅ Você mantém controle dos fundos
- ✅ Runes são transferidas corretamente
- ✅ Pode criar pools sem medo!

**Parabéns! O sistema está funcionando perfeitamente! 🎊**

