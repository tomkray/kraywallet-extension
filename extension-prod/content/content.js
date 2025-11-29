/**
 * 🔥 KrayWallet Extension - Content Script
 * Injeta window.krayWallet nas páginas web
 */

// Injetar script na página
const script = document.createElement('script');
script.src = chrome.runtime.getURL('content/injected.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listener de mensagens da página
window.addEventListener('message', async (event) => {
    // Apenas aceitar mensagens da mesma janela
    if (event.source !== window) return;
    
    // ✅ ADICIONAR INSCRIPTION PENDENTE AO CACHE
    if (event.data.type === 'MYWALLET_ADD_PENDING_INSCRIPTION') {
        console.log('📦 Adding pending inscription to cache:', event.data.data);
        try {
            await chrome.runtime.sendMessage({
                action: 'addPendingInscription',
                data: event.data.data
            });
            console.log('✅ Pending inscription added to cache');
        } catch (error) {
            console.error('❌ Error adding pending inscription:', error);
        }
        return;
    }
    
    // 🗑️  REMOVER INSCRIPTION DO CACHE (quando seller cria oferta)
    if (event.data.type === 'MYWALLET_REMOVE_PENDING_INSCRIPTION') {
        console.log('🗑️  Removing inscription from cache:', event.data.data);
        try {
            await chrome.runtime.sendMessage({
                action: 'removePendingInscription',
                data: event.data.data
            });
            console.log('✅ Inscription removed from cache');
        } catch (error) {
            console.error('❌ Error removing inscription:', error);
        }
        return;
    }
    
    // 🔄 FORÇAR RELOAD DAS INSCRIPTIONS NA CARTEIRA
    if (event.data.type === 'MYWALLET_RELOAD_INSCRIPTIONS') {
        console.log('🔄 Reloading inscriptions...');
        try {
            await chrome.runtime.sendMessage({
                action: 'reloadInscriptions'
            });
            console.log('✅ Inscriptions reload triggered');
        } catch (error) {
            console.error('❌ Error reloading inscriptions:', error);
        }
        return;
    }
    
    // Verificar se é mensagem do KrayWallet
    if (event.data.type && event.data.type === 'MYWALLET_REQUEST') {
        console.log('📨 KrayWallet request:', event.data.action);
        
        try {
            // Encaminhar para background script
            const response = await chrome.runtime.sendMessage({
                action: event.data.action,
                data: event.data.data
            });
            
            // Enviar resposta de volta para página
            window.postMessage({
                type: 'MYWALLET_RESPONSE',
                requestId: event.data.requestId,
                response
            }, '*');
        } catch (error) {
            console.error('Error handling krayWallet request:', error);
            window.postMessage({
                type: 'MYWALLET_RESPONSE',
                requestId: event.data.requestId,
                response: {
                    success: false,
                    error: error.message
                }
            }, '*');
        }
    }
});

// Listener para mensagens do popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 🔓 WALLET DESBLOQUEADA
    if (message.type === 'MYWALLET_UNLOCKED') {
        console.log('🔓 Wallet unlocked, notifying page...');
        
        // Disparar evento na página
        window.postMessage({
            type: 'MYWALLET_RESPONSE',
            requestId: -1, // Special ID for unlock event
            response: {
                success: true,
                address: message.address,
                event: 'unlocked'
            }
        }, '*');
        
        // Também disparar evento customizado direto
        const event = new CustomEvent('walletConnected', {
            detail: {
                address: message.address,
                walletType: 'kraywallet'
            }
        });
        window.dispatchEvent(event);
        
        console.log('✅ Page notified about unlock');
        sendResponse({ success: true });
    }
    
    // 🔒 WALLET LOCKED
    if (message.action === 'walletLocked') {
        console.log('🔒 Wallet locked, notifying page...');
        
        // Disparar evento na página
        const event = new CustomEvent('walletLocked', {
            detail: {
                walletType: 'kraywallet'
            }
        });
        window.dispatchEvent(event);
        
        console.log('✅ Page notified about lock');
        sendResponse({ success: true });
    }
    
    return true; // Keep channel open for async response
});

console.log('🔥 KrayWallet Content Script injected!');

