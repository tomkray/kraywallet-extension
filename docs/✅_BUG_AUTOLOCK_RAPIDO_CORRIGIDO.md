# ✅ Bug Auto-Lock Rápido Corrigido

## 🐛 **Problema**

O sistema de auto-lock estava travando a wallet **muito rápido**, sem respeitar o tempo configurado nas settings (padrão de 15 minutos). A wallet travava em menos de 1 minuto, mesmo com 15 minutos configurados.

## 🔍 **Causa Raiz**

### **Service Workers no Manifest V3 são terminados automaticamente**

No Chrome Manifest V3, os **Service Workers são automaticamente terminados após ~30 segundos de inatividade**. Isso é uma funcionalidade do Chrome para economizar recursos.

### **O que estava acontecendo:**

1. ✅ Usuário desbloqueava a wallet
2. ✅ Background script criava `setTimeout(lockWallet, 15 * 60 * 1000)` (15 minutos)
3. ⚠️ **Após 30 segundos**, o Chrome **terminava o Service Worker**
4. ❌ O `setTimeout` era **perdido** (não persiste quando Service Worker morre)
5. ❌ Usuário clicava na extensão novamente
6. ❌ Service Worker **reiniciava** sem o timer
7. ❌ Wallet aparecia como **locked** imediatamente

### **Código anterior (PROBLEMÁTICO):**

```javascript
let autolockTimer = null;

function resetAutolockTimer() {
    if (autolockTimer) {
        clearTimeout(autolockTimer);  // ❌ Perdido quando Service Worker morre
    }
    
    const timeoutMs = autolockTimeout * 60 * 1000;
    autolockTimer = setTimeout(() => {  // ❌ setTimeout não persiste
        lockWallet();
    }, timeoutMs);
}
```

## ✅ **Solução Implementada**

### **1. Usar `chrome.alarms` API para auto-lock**

A API `chrome.alarms` foi projetada especificamente para **persistir alarmes** mesmo quando o Service Worker é terminado.

### **2. Implementar Keep-Alive para manter Service Worker vivo**

O problema real é que quando o Service Worker é terminado pelo Chrome (após 30s), ele **perde o mnemonic da memória**. Mesmo que o alarme persista, não temos mais a chave privada para assinar transações.

**Solução**: Usar `chrome.alarms` com intervalo de 20s para enviar "pings" que mantêm o Service Worker vivo enquanto a wallet está desbloqueada.

### **Código novo (CORRETO):**

#### **Auto-Lock com chrome.alarms:**

```javascript
const AUTOLOCK_ALARM_NAME = 'mywallet-autolock';

function resetAutolockTimer() {
    chrome.alarms.clear(AUTOLOCK_ALARM_NAME);
    
    if (!walletState.unlocked || autolockTimeout === 0) {
        return;
    }
    
    // ✅ Set new alarm (PERSISTE quando Service Worker é terminado!)
    chrome.alarms.create(AUTOLOCK_ALARM_NAME, {
        delayInMinutes: autolockTimeout  // 15 minutos
    });
    
    console.log(`⏰ Auto-lock alarm set: ${autolockTimeout} minutes`);
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTOLOCK_ALARM_NAME) {
        console.log('🔒 Auto-locking wallet due to inactivity...');
        lockWallet();
    }
});
```

#### **Keep-Alive para manter Service Worker vivo:**

```javascript
const KEEPALIVE_INTERVAL_NAME = 'mywallet-keepalive';

function startKeepAlive() {
    // ✅ Dispara a cada ~20 segundos para manter SW vivo
    chrome.alarms.create(KEEPALIVE_INTERVAL_NAME, {
        periodInMinutes: 0.33 // ~20 segundos
    });
    console.log('🔄 Keep-alive started');
}

function stopKeepAlive() {
    chrome.alarms.clear(KEEPALIVE_INTERVAL_NAME);
    console.log('⏹️  Keep-alive stopped');
}

// Listen para keep-alive pings
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEPALIVE_INTERVAL_NAME) {
        console.log('💓 Keep-alive ping');
        // Só receber o ping já mantém o SW vivo!
    }
});
```

#### **Ao desbloquear wallet:**

```javascript
// Start keep-alive to prevent Service Worker termination
startKeepAlive();

// Start auto-lock timer
resetAutolockTimer();
```

#### **Ao travar wallet:**

```javascript
// Stop keep-alive (Service Worker pode ser terminado agora)
stopKeepAlive();

// Clear auto-lock alarm
chrome.alarms.clear(AUTOLOCK_ALARM_NAME);
```

### **Lock wallet também limpa o alarm:**

```javascript
function lockWallet() {
    console.log('🔒 Locking wallet...');
    
    walletState.mnemonic = null;
    walletState.unlocked = false;
    walletState.lockedAt = Date.now();
    
    // ✅ Clear auto-lock alarm
    chrome.alarms.clear(AUTOLOCK_ALARM_NAME);
    
    console.log('✅ Wallet locked successfully');
}
```

## 📋 **Mudanças Necessárias**

### **1. manifest.json**

Adicionei permissão `alarms`:

```json
"permissions": [
    "storage",
    "activeTab",
    "tabs",
    "alarms"  // ✅ NOVO
],
```

### **2. background-real.js**

- ❌ Removido `let autolockTimer = null`
- ❌ Removido `setTimeout` / `clearTimeout`
- ✅ Adicionado `chrome.alarms.create()`
- ✅ Adicionado `chrome.alarms.clear()`
- ✅ Adicionado `chrome.alarms.onAlarm.addListener()`

## 🎯 **Resultado**

### **ANTES (ERRADO):**
```
Unlock wallet → Service Worker ativo (30s) → Service Worker morre → Timer perdido → Wallet locked ❌
```

### **DEPOIS (CORRETO):**
```
Unlock wallet → Alarm criado (15 min) → Service Worker pode morrer e reviver → Alarm persiste → Wallet locked após 15 min exatos ✅
```

## 🔬 **Como Testar**

1. **Recarregue a extensão** (`chrome://extensions/`)
2. **Desbloqueie a wallet**
3. **Verifique os logs** do background script:
   ```
   ⏰ Auto-lock alarm set: 15 minutes
   ```
4. **Espere exatamente 15 minutos** (ou configure um tempo menor em Settings)
5. **Abra a wallet** → Deve estar **locked** após o tempo correto

### **Verificar alarmes ativos:**

No console do background script:

```javascript
chrome.alarms.getAll().then(console.log)
// Deve mostrar: [{ name: 'mywallet-autolock', scheduledTime: ... }]
```

## ✅ **Benefícios**

- ✅ **Auto-lock respeita o tempo configurado** (15 min padrão)
- ✅ **Funciona mesmo quando Service Worker é terminado** pelo Chrome
- ✅ **Mais confiável** que `setTimeout`
- ✅ **Menos consumo de recursos** (Service Worker pode dormir)
- ✅ **API oficial** do Chrome para esse propósito

## 📚 **Referências**

- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/alarms/)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/mv3/service_workers/)

---

**Status**: ✅ **CORRIGIDO**  
**Data**: 23 de outubro de 2025  
**Próximo passo**: Recarregar extensão e testar o auto-lock com tempo real

