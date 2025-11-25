# 🔧 FIX: Cancel Button não funcionava na tela de assinatura PSBT

## 🐛 PROBLEMA

Quando o usuário clicava em "Create Listing", a tela de assinatura (`confirm-psbt-screen`) aparecia, mas:
- ❌ O botão **Cancel** não respondia (travado)
- ❌ O botão **Sign & Send** também não funcionava
- ❌ Usuário ficava preso na tela de assinatura

## 🔍 CAUSA RAIZ

### **Event Listeners Não Registrados**

Os event listeners dos botões estavam sendo registrados **dentro da função `showPsbtConfirmation()`**:

```javascript
async function showPsbtConfirmation() {
    // ... código ...
    
    // ❌ Event listeners registrados AQUI
    document.getElementById('psbt-sign-btn').addEventListener('click', async () => {
        await handlePsbtSign();
    });
    
    document.getElementById('psbt-cancel-btn').addEventListener('click', () => {
        handlePsbtCancel();
    });
}
```

### **Problema:**

No novo fluxo refatorado, `createMarketListing()` chama diretamente:
```javascript
showScreen('confirm-psbt');  // ❌ Não registra event listeners!
```

**Resultado:** A tela aparece, mas os botões não funcionam porque `showPsbtConfirmation()` nunca foi chamada.

---

## ✅ SOLUÇÃO

### **1. Mover Event Listeners para `DOMContentLoaded`**

Os event listeners agora são registrados **uma única vez** quando o popup é carregado:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Setting up PSBT signing listeners...');
    
    // Sign button
    const psbtSignBtn = document.getElementById('psbt-sign-btn');
    if (psbtSignBtn) {
        psbtSignBtn.addEventListener('click', async () => {
            console.log('✅ Sign button clicked');
            await handlePsbtSign();
        });
        console.log('   ✅ psbt-sign-btn listener added');
    }
    
    // Cancel button
    const psbtCancelBtn = document.getElementById('psbt-cancel-btn');
    if (psbtCancelBtn) {
        psbtCancelBtn.addEventListener('click', () => {
            console.log('❌ Cancel button clicked');
            handlePsbtCancel();
        });
        console.log('   ✅ psbt-cancel-btn listener added');
    }
});
```

### **2. Remover Listeners Duplicados**

Removido os event listeners de dentro de `showPsbtConfirmation()`:

```javascript
async function showPsbtConfirmation() {
    // ... código ...
    
    // ✅ Apenas foca no campo de senha
    // (Event listeners são registrados em DOMContentLoaded)
    document.getElementById('psbt-confirm-password').focus();
}
```

---

## 🎯 BENEFÍCIOS

### ✅ **Simplicidade**
- Event listeners registrados **uma única vez** no carregamento
- Não importa quantas vezes a tela é mostrada, sempre funcionam

### ✅ **Robustez**
- Funciona com `showScreen('confirm-psbt')` direto
- Funciona com `showPsbtConfirmation()` completa
- Sem duplicação de listeners

### ✅ **Debugging**
- Logs claros: `✅ Sign button clicked` e `❌ Cancel button clicked`
- Fácil identificar se o listener foi registrado

---

## 🧪 TESTE

### **1. Criar Listing**
1. Abrir wallet
2. Click em "📋 List" em uma inscription
3. Preencher preço
4. Click "Create Listing"

### **2. Testar Cancel**
1. ✅ Tela de assinatura deve aparecer
2. ✅ Click em "Cancel"
3. ✅ Deve aparecer log: `❌ Cancel button clicked`
4. ✅ Deve limpar storage
5. ✅ Deve voltar para tela da wallet
6. ✅ **NADA salvo no banco de dados**

### **3. Testar Sign**
1. ✅ Tela de assinatura aparece
2. ✅ Digitar password
3. ✅ Click em "Sign & Send"
4. ✅ Deve aparecer log: `✅ Sign button clicked`
5. ✅ Deve assinar PSBT
6. ✅ Deve salvar oferta no banco de dados
7. ✅ Deve mostrar sucesso

---

## 📝 ARQUIVOS MODIFICADOS

### `/Volumes/D2/KRAY WALLET/kraywallet-extension/popup/popup.js`

**Linhas 7811-7837:** Adicionado novo bloco `DOMContentLoaded` para registrar event listeners do PSBT

**Linhas 4532-4534:** Removidos event listeners duplicados de `showPsbtConfirmation()`

**Linhas 7498-7502:** Adicionado focus no campo de senha em `createMarketListing()`

---

## 🚀 STATUS

✅ **CORRIGIDO** - Cancel button agora funciona perfeitamente!

**Data:** 2024-10-24
**Versão:** KrayWallet Extension v1.0

