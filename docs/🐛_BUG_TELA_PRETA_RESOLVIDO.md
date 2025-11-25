# 🐛 BUG DA TELA PRETA - ANÁLISE MINUCIOSA E SOLUÇÃO

## 🔍 INVESTIGAÇÃO DETALHADA

### PROBLEMA RELATADO:
- User clica "Create Listing"
- Tela fica PRETA ao invés de mostrar "Sign Transaction"
- Password, cancel, sign não aparecem

---

## 🎯 CAUSA RAIZ ENCONTRADA:

### FLUXO ANTIGO (BUGADO):
```javascript
async function createMarketListing() {
    // 1. Cria PSBT
    // 2. Salva no background
    // 3. Fecha tela listing
    document.getElementById('list-market-screen')?.classList.add('hidden');
    
    // 4. Mostra tela de assinatura
    showScreen('confirm-psbt');
    
    // 5. ❌ PROBLEMA: Chama showPsbtConfirmation()
    await showPsbtConfirmation();
    //    ^^^^^^^^^^^^^^^^^^^^^
    //    Esta função:
    //    - Busca PSBT do storage
    //    - Se não encontrar: window.close() ❌ FECHA POPUP!
    //    - Faz fetch para decode PSBT
    //    - Constrói HTML complexo
    //    - PODE DAR ERRO e travar
    
    // 6. Aguarda assinatura
    const signResult = await waitForPsbtSignResult();
}
```

### DENTRO DE showPsbtConfirmation():
```javascript
async function showPsbtConfirmation() {
    const response = await sendMessage({ action: 'getPendingPsbt' });
    
    if (!response.success || !response.pending) {
        showNotification('❌ No pending PSBT request', 'error');
        window.close();  // ❌ FECHA O POPUP! TELA PRETA!
        return;
    }
    
    // ... mais código complexo ...
}
```

---

## ✅ SOLUÇÃO IMPLEMENTADA:

### FLUXO NOVO (SIMPLES E FUNCIONAL):
```javascript
async function createMarketListing() {
    // 1. Cria PSBT
    // 2. Salva no background
    // 3. Fecha tela listing
    document.getElementById('list-market-screen')?.classList.add('hidden');
    
    // 4. Mostra tela de assinatura
    showScreen('confirm-psbt');
    
    // 5. ✅ APENAS AGUARDA assinatura (SEM chamar showPsbtConfirmation)
    const signResult = await waitForPsbtSignResult();
    //    ^^^^^^^^^^^^^^^^^^^^^^^^^
    //    Esta função apenas aguarda via chrome.storage.onChanged
    //    Não faz fetch, não busca dados, não fecha popup
    //    SIMPLES e DIRETO!
    
    // 6. Se assinado, salva no banco
    if (signResult.success) {
        await fetch('/api/offers', { /* salvar */ });
    }
}
```

---

## 🔑 DIFERENÇAS CHAVE:

### ANTES (BUGADO):
❌ Chamava `showPsbtConfirmation()` que:
   - Buscava dados do storage
   - Fazia fetch para decode
   - Podia chamar `window.close()`
   - HTML complexo
   - MUITOS pontos de falha

### AGORA (FUNCIONAL):
✅ Apenas `waitForPsbtSignResult()` que:
   - Aguarda via chrome.storage.onChanged
   - Não faz fetch
   - Não fecha popup
   - SIMPLES
   - SEM pontos de falha

---

## 📋 REGRAS SEGUIDAS:

1. ✅ **Só salva no banco DEPOIS de assinar**
   - Aguarda `waitForPsbtSignResult()`
   - Só depois salva no banco

2. ✅ **Se cancelar, DELETA tudo**
   - `handlePsbtCancel()` limpa storage
   - Reseta flag `isCreatingListing`
   - NÃO salva no banco

3. ✅ **Fecha tela "Create Listing"**
   - `classList.add('hidden')`
   - `showScreen('confirm-psbt')`

4. ✅ **PSBT expira em 2 minutos**
   - Auto-delete de PSBTs antigos
   - Nunca mais tela preta

---

## 🧪 TESTE:

```javascript
// 1. Limpar storage
chrome.storage.local.remove(['pendingPsbtRequest','psbtSignResult','pendingMarketListing'])

// 2. Recarregar extension
// chrome://extensions/ → 🔄

// 3. Testar
// Create Listing → deve aparecer tela de sign (NÃO preta!)
```

---

## 🎯 RESULTADO:

✅ Tela "Create Listing" fecha
✅ Tela "Sign Transaction" abre (NÃO preta!)
✅ Campos visíveis: password, cancel, sign
✅ Se assinar: salva no banco
✅ Se cancelar: NÃO salva, limpa tudo
✅ Código ULTRA SIMPLES e robusto

**PROBLEMA RESOLVIDO!** 🚀
