/**
 * 🧪 Script de teste para Auto-Lock
 * 
 * Cole este código no console do Background Script da extensão:
 * chrome://extensions/ → MyWallet → "Service Worker" → Console
 */

console.log('🧪 ========== TESTING AUTO-LOCK SYSTEM ==========');

// 1. Verificar alarmes ativos
chrome.alarms.getAll().then(alarms => {
    console.log('📋 Active alarms:', alarms);
    
    if (alarms.length === 0) {
        console.warn('⚠️  No alarms found! Wallet might be locked or timeout is 0.');
    } else {
        alarms.forEach(alarm => {
            const now = Date.now();
            const timeLeft = alarm.scheduledTime - now;
            const minutesLeft = Math.floor(timeLeft / 60000);
            const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
            
            console.log(`⏰ Alarm: ${alarm.name}`);
            console.log(`   Scheduled: ${new Date(alarm.scheduledTime).toLocaleTimeString()}`);
            console.log(`   Time left: ${minutesLeft}m ${secondsLeft}s`);
        });
    }
});

// 2. Verificar estado da wallet
console.log('🔐 Wallet state:', {
    unlocked: walletState?.unlocked,
    address: walletState?.address ? walletState.address.slice(0, 20) + '...' : null,
    hasMnemonic: !!walletState?.mnemonic,
    lockedAt: walletState?.lockedAt ? new Date(walletState.lockedAt).toLocaleTimeString() : null
});

// 3. Verificar timeout configurado
chrome.storage.local.get(['autolockTimeout']).then(result => {
    console.log('⚙️  Auto-lock timeout:', result.autolockTimeout || 15, 'minutes');
});

// 4. Testar criação de alarm manualmente
console.log('\n💡 Para testar com 1 minuto, execute:');
console.log('chrome.alarms.create("test-autolock", { delayInMinutes: 1 });');
console.log('chrome.alarms.getAll().then(console.log);');

console.log('\n💡 Para limpar todos os alarmes:');
console.log('chrome.alarms.clearAll();');

console.log('\n💡 Para forçar lock:');
console.log('lockWallet();');

console.log('\n✅ Auto-lock test complete!');

