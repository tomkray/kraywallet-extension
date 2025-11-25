# 🔄 COMO RECARREGAR A EXTENSÃO MYWALLET

## 📋 PASSO A PASSO:

### **1. ABRIR PÁGINA DE EXTENSÕES**
```
Chrome → Barra de endereço → Digite: chrome://extensions
```
Ou:
```
Chrome → Menu (⋮) → Extensões → Gerenciar extensões
```

---

### **2. ATIVAR MODO DESENVOLVEDOR (se não estiver ativado)**
```
No topo da página, ative o toggle:
[ ] Modo do desenvolvedor  →  [✓] Modo do desenvolvedor
```

---

### **3. LOCALIZAR MYWALLET**
```
Procure o card da extensão:

┌────────────────────────────────────┐
│ MyWallet - Bitcoin Ordinals Runes  │
│                                     │
│ 🔄 Recarregar   📋 Detalhes   ❌    │
└────────────────────────────────────┘
```

---

### **4. CLICAR NO BOTÃO RECARREGAR**
```
Clique no ícone circular de RELOAD (🔄)

✅ A extensão será recarregada!
```

---

### **5. ABRIR DEVTOOLS (IMPORTANTE!)**
```
1. Clique com BOTÃO DIREITO no ícone da MyWallet (barra superior do Chrome)
2. Selecione "Inspecionar visualização pop-up" ou "Inspect popup"
3. Uma janela DevTools abrirá
4. Vá para a aba "Console"
```

---

### **6. ABRIR O POPUP DA MYWALLET**
```
1. Clique no ícone da MyWallet na barra superior
2. O popup abrirá
3. Clique na tab "Activity" (última tab)
```

---

### **7. VERIFICAR OS LOGS NO CONSOLE**
```
Você deve ver logs como:

📜 ========== LOADING ACTIVITY ==========
   Address: bc1p...
   ✅ Activity list element found
   🖼️  Fetching inscriptions for correlation...
   📦 Inscriptions response: {success: true, data: {...}}
   ✅ Found 1 inscriptions
   📋 Full inscriptions list: [{...}]
      🔍 Processing inscription: {...}
         - inscriptionId: 0f1519057f8704cb...
         - utxo: {txid: "bfc6bb52...", vout: 0, value: 600}
      ✅ Mapped inscription 0f1519057f... to bfc6bb5282...:0
   🗺️  Final inscriptionsMap size: 1
   🗺️  Map keys: ["bfc6bb5282...:0"]
   📡 Fetching from: https://mempool.space/api/address/bc1p...
   📡 Response status: 200 OK
   ✅ Response parsed successfully
   ✅ Found 3 transactions
   🔄 Processing transactions...

🔍 Processing TX: bfc6bb5282...
   My address: bc1pvz02d8z6c4d7r...
   ✅ Found my output: 600 sats
   📊 myInputs: 0, myOutputs: 600
   🔎 Checking TX for inscriptions...
      TX has 3 outputs, 2 inputs
      inscriptionsMap has 1 entries
      🔍 Checking OUTPUT 0: bfc6bb5282...:0
         Has in map? true
   ✅ 🖼️  Found inscription in OUTPUT 0: 0f1519057f8704cb...
   📋 Is inscription TX? true

✅ Activity loaded successfully!
=========================================
```

---

## 🎯 O QUE ESPERAR:

### **Se FUNCIONAR (com inscriptions):**
```
┌──────────────────────────────────────────────────┐
│ Activity Tab                                     │
├──────────────────────────────────────────────────┤
│                                                  │
│ [🖼️]  📥 Received Inscription       +600 sats   │
│        #78630547                    UTXO Value   │
│        From: bc1p...gx                           │
│        2 hours ago • ✓ Confirmed                 │
│                                                  │
│ [↓]   Received                      +5,000 sats  │
│       From: bc1q...                              │
│       1 day ago • ✓ Confirmed                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### **Se NÃO FUNCIONAR:**
```
Verifique no Console:
- Há erros (linhas vermelhas)?
- inscriptionsMap está vazio?
- As chaves do map batem com os TXs?
```

---

## 🐛 TROUBLESHOOTING:

### **Problema: "inscriptionsMap size: 0"**
**Causa**: Sem inscriptions na wallet ou UTXO não mapeado
**Solução**: 
1. Verifique se você tem inscriptions (tab Ordinals)
2. Verifique se `inscription.utxo` existe nos logs

---

### **Problema: "Has in map? false" para todas as TXs**
**Causa**: TXID:VOUT não bate entre inscription e TX
**Solução**:
1. Compare as chaves no log: `Map keys: ["abc:0"]`
2. Compare com: `Checking OUTPUT 0: xyz:0`
3. Se diferentes, é porque a inscription moveu de UTXO

---

### **Problema: Thumbnail não aparece**
**Causa**: ORD server não está rodando
**Solução**:
```bash
# Verificar se ORD server está rodando
curl http://localhost:80/

# Se não estiver, iniciar (como root):
sudo ord --bitcoin-rpc-url http://localhost:8332 \
         --bitcoin-rpc-username seu_usuario \
         --bitcoin-rpc-password sua_senha \
         server --http-port 80
```

---

## ✅ CHECKLIST FINAL:

- [ ] Extensão recarregada em chrome://extensions
- [ ] DevTools aberto (Inspect popup)
- [ ] Console aberto e visível
- [ ] Popup da MyWallet aberto
- [ ] Activity tab clicada
- [ ] Logs aparecem no console
- [ ] Transações aparecem na lista
- [ ] Inscriptions têm thumbnail
- [ ] Labels estão corretos (Received Inscription, UTXO Value, etc.)

---

## 📸 SE NÃO FUNCIONAR:

**Envie screenshots de:**
1. Console com os logs completos
2. Activity tab mostrando as transações
3. Tab Ordinals (para confirmar que tem inscriptions)

Isso me ajudará a identificar o problema exato! 🎯



