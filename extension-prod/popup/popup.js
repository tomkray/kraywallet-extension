console.log('🔥 POPUP.JS LOADED - VERSION: FIXED-v2 - 2024-11-26 03:00');
/**
 * 🔥 MyWallet Extension - Popup Script
 * Gerencia a interface da extensão
 */

// Estado global
let currentScreen = 'no-wallet';
let wallet = null;

// 💾 CACHE SYSTEM - Evita recarregar dados toda vez que troca de tab
const dataCache = {
    ordinals: {
        data: null,
        timestamp: null,
        loaded: false
    },
    runes: {
        data: null,
        timestamp: null,
        loaded: false
    },
    activity: {
        data: null,
        timestamp: null,
        loaded: false,
        lastTxid: null  // 🔄 Último TXID para detectar mudanças
    }
};

// Tempo de validade do cache
const CACHE_VALIDITY = {
    ordinals: 5 * 60 * 1000,   // 5 minutos (dados estáticos)
    runes: 5 * 60 * 1000,      // 5 minutos (dados estáticos)
    activity: 10 * 60 * 1000   // 10 minutos (reduzir requisições QuickNode)
};

// Verificar se cache é válido
function isCacheValid(cacheType) {
    const cache = dataCache[cacheType];
    if (!cache.loaded || !cache.timestamp) return false;
    
    const age = Date.now() - cache.timestamp;
    return age < CACHE_VALIDITY[cacheType];
}

// Limpar cache (usado quando unlock wallet ou refresh)
function clearAllCache() {
    console.log('🗑️ Clearing all cache...');
    dataCache.ordinals = { data: null, timestamp: null, loaded: false };
    dataCache.runes = { data: null, timestamp: null, loaded: false };
    dataCache.activity = { data: null, timestamp: null, loaded: false, lastTxid: null };
}

// 🔄 Limpar apenas cache de Activity (para forçar refresh após transação)
function clearActivityCache() {
    console.log('🔄 Clearing activity cache (transaction detected)...');
    dataCache.activity = { data: null, timestamp: null, loaded: false, lastTxid: null };
}

// 🔍 Verificar se há novas transações (RÁPIDO - só busca última TX)
async function checkForNewTransactions(address) {
    try {
        // Buscar apenas a última transação (muito mais rápido!)
        const response = await fetch(`https://mempool.space/api/address/${address}/txs/chain/0`);
        if (!response.ok) return false;
        
        const txs = await response.json();
        if (!txs || txs.length === 0) return false;
        
        const latestTxid = txs[0].txid;
        
        // Comparar com último TXID conhecido
        if (!dataCache.activity.lastTxid) {
            dataCache.activity.lastTxid = latestTxid;
            return false;
        }
        
        // Se TXID mudou = nova transação!
        if (latestTxid !== dataCache.activity.lastTxid) {
            console.log('   🆕 New TXID detected:', latestTxid.substring(0, 16) + '...');
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn('   ⚠️ Check failed:', error.message);
        return false;
    }
}

// Helper function para enviar mensagens ao background
async function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

// 🔄 RESET AUTO-LOCK TIMER EM QUALQUER INTERAÇÃO (throttle)
let lastResetTime = 0;
const RESET_INTERVAL = 30000; // 30 segundos (só chama a cada 30s)

function resetAutolockTimer() {
    const now = Date.now();
    
    // Só chama se passou mais de 30 segundos desde última chamada
    if (now - lastResetTime < RESET_INTERVAL) {
        return;
    }
    
    lastResetTime = now;
    
    chrome.runtime.sendMessage({ action: 'resetAutolockTimer' }).catch(() => {
        // Ignore error if background is busy
    });
    
    console.log('⏰ Auto-lock timer reset');
}

// ⏰ DETECTAR INTERAÇÕES DO USUÁRIO (só click e keypress)
['click', 'keypress'].forEach(eventType => {
    document.addEventListener(eventType, () => {
        resetAutolockTimer();
    }, { passive: true, capture: true });
});

// EVENT DELEGATION GLOBAL - Configurar ANTES de tudo!
console.log('🔥 Setting up GLOBAL event delegation...');
document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    
    console.log('🎯 Button clicked:', target.id);
    
    if (target.id === 'copy-address-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Copy Address clicked!');
        handleCopyAddress();
        return;
    }
    
    if (target.id === 'send-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Send clicked!');
        showScreen('send');
        return;
    }
    
    if (target.id === 'receive-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Receive clicked!');
        showScreen('receive');
        return;
    }
    
    if (target.id === 'settings-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Settings clicked!');
        showScreen('settings');
        return;
    }
    
    if (target.id === 'send-confirm-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Send Transaction clicked!');
        handleSend();
        return;
    }
    
    if (target.id === 'send-inscription-confirm-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Send Inscription clicked!');
        handleSendInscription();
        return;
    }
    
    if (target.id === 'close-password-modal' || target.id === 'cancel-send-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Cancel/Close modal clicked!');
        closePasswordModal();
        return;
    }
    
    if (target.id === 'confirm-send-btn') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Confirm Send clicked!');
        confirmAndSend();
        return;
    }
}, true);
console.log('✅ GLOBAL event delegation configured!');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🔥 MyWallet Extension initialized');
        
        // 🧹 LIMPEZA AGRESSIVA: Verificar idade de todos PSBTs no storage
        console.log('🧹 Checking for old/corrupted PSBTs in storage...');
        const storageCheck = await chrome.storage.local.get(['pendingPsbtRequest', 'psbtSignResult']);
        
        if (storageCheck.pendingPsbtRequest) {
            const age = Date.now() - (storageCheck.pendingPsbtRequest.timestamp || 0);
            const maxAge = 2 * 60 * 1000; // 2 minutos
            
            if (age > maxAge || !storageCheck.pendingPsbtRequest.timestamp) {
                console.warn('⚠️  Found OLD/CORRUPTED PSBT in storage (age:', Math.round(age / 1000), 's)');
                console.warn('   Deleting old PSBT data...');
                await chrome.storage.local.remove(['pendingPsbtRequest', 'psbtSignResult', 'pendingMarketListing']);
                await chrome.runtime.sendMessage({ action: 'cancelPsbtSign' });
                console.log('✅ Old PSBT data DELETED');
            }
        }
        
        // 🔍 PRIORIDADE: Verificar se há PSBT pendente via chrome.storage
        // (URL params não funcionam com chrome.windows.create popup)
        // Tentar múltiplas vezes para evitar race condition
        let response = await chrome.runtime.sendMessage({ action: 'getPendingPsbt' });
        
        console.log('   Pending PSBT check (1st try):', response);
        
        // Se não encontrou na primeira tentativa, esperar 100ms e tentar novamente
        if (!response.pending) {
            console.log('   Waiting 100ms and retrying...');
            await new Promise(resolve => setTimeout(resolve, 100));
            response = await chrome.runtime.sendMessage({ action: 'getPendingPsbt' });
            console.log('   Pending PSBT check (2nd try):', response);
        }
        
        // Se ainda não encontrou, esperar mais 200ms e tentar uma última vez
        if (!response.pending) {
            console.log('   Waiting 200ms and retrying...');
            await new Promise(resolve => setTimeout(resolve, 200));
            response = await chrome.runtime.sendMessage({ action: 'getPendingPsbt' });
            console.log('   Pending PSBT check (3rd try):', response);
        }
        
        if (response.success && response.pending) {
            console.log('🔏 PSBT signing request detected via storage!');
            console.log('   PSBT details:', {
            inputs: response.pending.inputsToSign?.length || 'all',
            sighash: response.pending.sighashType,
            autoFinalized: response.pending.autoFinalized,
            timestamp: response.pending.timestamp,
            psbtLength: response.pending.psbt?.length || 0
        });
        
        // ✅ Verificar se PSBT é muito antigo (mais de 2 minutos) ou inválido
        const age = Date.now() - (response.pending.timestamp || 0);
        const maxAge = 2 * 60 * 1000; // 2 minutos (reduzido para ser mais agressivo)
        
        if (age > maxAge || !response.pending.timestamp || !response.pending.psbt) {
            console.warn('⚠️  PSBT is INVALID:');
            console.warn('   - Age:', Math.round(age / 1000), 's');
            console.warn('   - Has timestamp:', !!response.pending.timestamp);
            console.warn('   - Has PSBT data:', !!response.pending.psbt);
            console.warn('   → DELETING...');
            
            // 🔥 LIMPAR TUDO (agressivo)
            await chrome.storage.local.remove([
                'pendingPsbtRequest', 
                'psbtSignResult',
                'pendingMarketListing'
            ]);
            await chrome.runtime.sendMessage({ action: 'cancelPsbtSign' });
            
            console.log('✅ Invalid PSBT DELETED from storage, showing normal wallet');
            // NÃO mostrar PSBT, continuar para wallet normal
        } else {
            // PSBT é válido (< 2 minutos), esconder loading e mostrar PSBT
            console.log('✅ PSBT is VALID:');
            console.log('   - Age:', Math.round(age / 1000), 's');
            console.log('   - PSBT length:', response.pending.psbt?.length || 0);
            console.log('   → Showing sign screen...');
            
            // 🎯 MOSTRAR TELA DE ASSINATURA IMEDIATAMENTE
            document.getElementById('loading-screen')?.classList.add('hidden');
            
            console.log('🔄 Calling showScreen(confirm-psbt)...');
            showScreen('confirm-psbt');
            console.log('✅ Screen changed to confirm-psbt');
            
            try {
                console.log('🔄 Calling showPsbtConfirmation()...');
                await showPsbtConfirmation();
                console.log('✅ showPsbtConfirmation() completed successfully');
            } catch (psbtError) {
                console.error('❌ ERROR in showPsbtConfirmation():', psbtError);
                console.error('   Stack:', psbtError.stack);
                // Em caso de erro, mostrar wallet normal
                showScreen('wallet');
                await loadWalletData();
            }
            return;
        }
        } else {
            console.log('ℹ️  No pending PSBT found after 3 attempts, showing normal wallet');
        }
        
        // 🔍 VERIFICAR SE HÁ MESSAGE PENDENTE (para likes)
        const messageCheck = await chrome.storage.local.get(['pendingMessageRequest']);
        if (messageCheck.pendingMessageRequest) {
            const messageAge = Date.now() - (messageCheck.pendingMessageRequest.timestamp || 0);
            const maxAge = 60 * 1000; // 1 minuto
            
            if (messageAge < maxAge && messageCheck.pendingMessageRequest.message) {
                console.log('✅ Found pending message request, showing sign message screen');
                document.getElementById('loading-screen')?.classList.add('hidden');
                showSignMessageScreen(messageCheck.pendingMessageRequest.message);
                return;
            } else {
                console.log('⚠️  Old message request found, deleting...');
                await chrome.storage.local.remove('pendingMessageRequest');
            }
        }
        
        // 🔍 VERIFICAR SE HÁ LIGHTNING PAYMENT PENDENTE
        console.log('🔍 Checking for pending Lightning payment...');
        const lightningCheck = await chrome.storage.local.get(['pendingPaymentRequest']);
        if (lightningCheck.pendingPaymentRequest) {
            const paymentAge = Date.now() - (lightningCheck.pendingPaymentRequest.timestamp || 0);
            const maxAge = 2 * 60 * 1000; // 2 minutos
            
            if (paymentAge < maxAge && lightningCheck.pendingPaymentRequest.invoice) {
                console.log('✅ Found pending Lightning payment, showing confirmation screen');
                console.log('   Payment details:', {
                    amount: lightningCheck.pendingPaymentRequest.decoded?.amount,
                    description: lightningCheck.pendingPaymentRequest.decoded?.description
                });
                document.getElementById('loading-screen')?.classList.add('hidden');
                showScreen('confirm-lightning-payment');
                await showLightningPaymentConfirmation(lightningCheck.pendingPaymentRequest);
                return;
            } else {
                console.log('⚠️  Old Lightning payment request found, deleting...');
                await chrome.storage.local.remove(['pendingPaymentRequest', 'paymentResult']);
            }
        }
        
        // Verificar status da wallet (exists, unlocked)
        const walletStatus = await sendMessage({ action: 'checkWalletStatus' });
        console.log('Wallet status:', walletStatus);
        
        // Esconder loading screen
        document.getElementById('loading-screen').classList.add('hidden');
        
        if (walletStatus.success && walletStatus.exists) {
            if (walletStatus.unlocked) {
                // Wallet desbloqueada, mostrar tela normal
                console.log('✅ Wallet is unlocked');
                showScreen('wallet');
                await loadWalletData();
                
                // ⚡ Initialize KRAY L2 (new!)
                if (window.krayL2) {
                    // Register showScreen function with L2 module
                    if (typeof window.krayL2.setShowScreen === 'function') {
                        window.krayL2.setShowScreen(showScreen);
                    }
                    // Initialize L2
                    if (typeof window.krayL2.initL2 === 'function') {
                        setTimeout(() => window.krayL2.initL2(), 1000);
                    }
                }
            } else {
                // Wallet bloqueada, mostrar tela de unlock
                console.log('🔒 Wallet is locked, showing unlock screen');
                showScreen('unlock');
            }
        } else {
            // Nenhuma wallet, mostrar tela de boas-vindas
            console.log('ℹ️  No wallet found');
            showScreen('no-wallet');
        }
        
        // Event Listeners
        console.log('🔗 Calling setupEventListeners...');
        try {
            setupEventListeners();
            console.log('✅ Event listeners setup complete');
        } catch (listenerError) {
            console.error('❌ Error setting up event listeners:', listenerError);
            console.error('   Stack:', listenerError.stack);
        }
        
        // GARANTIR que botões da wallet sejam vinculados após 1 segundo
        console.log('⏰ Setting up delayed rebind as backup...');
        setTimeout(() => {
            console.log('⏰ Delayed rebind executing now...');
            try {
                rebindWalletButtons();
            } catch (rebindError) {
                console.error('❌ Error in delayed rebind:', rebindError);
            }
        }, 1000);
        
        // 🔥 LISTENER PARA pendingMessageRequest (detecta quando cancel/update price é clicado)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.pendingMessageRequest) {
                const newValue = changes.pendingMessageRequest.newValue;
                
                if (newValue && newValue.message) {
                    console.log('🔔 pendingMessageRequest detected!', newValue.action);
                    console.log('   Message:', newValue.message);
                    
                    // Verificar idade (max 1 minuto)
                    const messageAge = Date.now() - (newValue.timestamp || 0);
                    const maxAge = 60 * 1000;
                    
                    if (messageAge < maxAge) {
                        console.log('✅ Opening sign message screen automatically!');
                        showSignMessageScreen(newValue.message);
                    } else {
                        console.log('⚠️  Message too old, ignoring');
                    }
                }
            }
        });
        console.log('🎧 pendingMessageRequest listener active!');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showNotification('Failed to initialize wallet: ' + error.message, 'error');
    }
});

// Setup Event Listeners
function setupEventListeners() {
    console.log('🔗 ========== SETUP EVENT LISTENERS ==========');
    console.log('   Function called at:', new Date().toISOString());
    
    // No Wallet Screen
    console.log('🔍 Setting up No Wallet Screen buttons...');
    const createBtn = document.getElementById('create-wallet-btn');
    console.log('   create-wallet-btn element:', createBtn);
    console.log('   createBtn exists:', !!createBtn);
    console.log('   createBtn visible:', createBtn?.offsetParent !== null);
    console.log('   createBtn disabled:', createBtn?.disabled);
    
    if (createBtn) {
        // Remover listeners antigos se existirem
        createBtn.replaceWith(createBtn.cloneNode(true));
        const newCreateBtn = document.getElementById('create-wallet-btn');
        
        // Usar onclick direto (mais confiável)
        newCreateBtn.onclick = function(e) {
            console.log('🔘 CREATE WALLET BUTTON CLICKED!');
            console.log('   Event:', e);
            e.preventDefault();
            e.stopPropagation();
            showScreen('create-wallet');
        };
        console.log('✅ Create wallet button listener added (onclick)');
    } else {
        console.error('❌ create-wallet-btn NOT FOUND!');
    }
    
    const restoreBtn = document.getElementById('restore-wallet-btn');
    console.log('   restore-wallet-btn element:', restoreBtn);
    console.log('   restoreBtn exists:', !!restoreBtn);
    console.log('   restoreBtn visible:', restoreBtn?.offsetParent !== null);
    console.log('   restoreBtn disabled:', restoreBtn?.disabled);
    
    if (restoreBtn) {
        // Remover listeners antigos
        restoreBtn.replaceWith(restoreBtn.cloneNode(true));
        const newRestoreBtn = document.getElementById('restore-wallet-btn');
        
        newRestoreBtn.onclick = function(e) {
            console.log('🔘 RESTORE WALLET BUTTON CLICKED!');
            console.log('   Event:', e);
            e.preventDefault();
            e.stopPropagation();
            showScreen('restore-wallet');
        };
        console.log('✅ Restore wallet button listener added (onclick)');
    } else {
        console.error('❌ restore-wallet-btn NOT FOUND!');
    }
    
    // Unlock Screen
    console.log('🔍 Setting up Unlock Screen button...');
    const unlockBtn = document.getElementById('unlock-wallet-btn');
    if (unlockBtn) {
        unlockBtn.onclick = async function(e) {
            console.log('🔘 Unlock button clicked!');
            e.preventDefault();
            e.stopPropagation();
            await handleUnlockWallet();
        };
        console.log('✅ Unlock wallet button listener added');
    }
    
    // Unlock password Enter key
    const unlockPasswordInput = document.getElementById('unlock-password');
    if (unlockPasswordInput) {
        unlockPasswordInput.addEventListener('keypress', async function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                await handleUnlockWallet();
            }
        });
        console.log('✅ Unlock password Enter key listener added');
    }
    
    // Forgot password link
    const forgotBtn = document.getElementById('forgot-wallet-btn');
    if (forgotBtn) {
        forgotBtn.onclick = function(e) {
            console.log('🔘 Forgot password clicked!');
            e.preventDefault();
            e.stopPropagation();
            showScreen('restore-wallet');
        };
        console.log('✅ Forgot password listener added');
    }
    
    // Create Wallet
    const generateBtn = document.getElementById('generate-mnemonic-btn');
    console.log('🔍 Looking for generate button...');
    console.log('   Button element:', generateBtn);
    console.log('   Button visible:', generateBtn?.offsetParent !== null);
    
    if (generateBtn) {
        // Adicionar onclick direto no elemento via JavaScript (não viola CSP!)
        generateBtn.onclick = async function(e) {
            console.log('🔘 Generate button clicked!');
            e.preventDefault();
            e.stopPropagation();
            await handleGenerateMnemonic();
        };
        
        console.log('✅ Generate mnemonic button listener added (onclick)');
    } else {
        console.warn('⚠️  Generate mnemonic button not found!');
    }
    
    const backFromCreateBtn = document.getElementById('back-from-create-btn');
    if (backFromCreateBtn) {
        backFromCreateBtn.addEventListener('click', () => {
            showScreen('no-wallet');
        });
        console.log('✅ Back from create button listener added');
    }
    
    // Show Mnemonic
    document.getElementById('mnemonic-saved-check')?.addEventListener('change', (e) => {
        document.getElementById('mnemonic-saved-btn').disabled = !e.target.checked;
    });
    
    document.getElementById('mnemonic-saved-btn')?.addEventListener('click', handleMnemonicSaved);
    
    // Restore Wallet
    document.getElementById('restore-btn')?.addEventListener('click', handleRestoreWallet);
    document.getElementById('back-from-restore-btn')?.addEventListener('click', () => {
        showScreen('no-wallet');
    });
    
    // Wallet Screen
    console.log('🔍 Setting up Wallet Screen buttons...');
    
    const copyAddressBtn = document.getElementById('copy-address-btn');
    console.log('   copy-address-btn:', !!copyAddressBtn);
    if (copyAddressBtn) {
        copyAddressBtn.onclick = async () => {
            console.log('🔘 Copy Address clicked!');
            await handleCopyAddress();
        };
        console.log('✅ Copy address listener added');
    }
    
    const sendBtn = document.getElementById('send-btn');
    console.log('   send-btn:', !!sendBtn);
    if (sendBtn) {
        sendBtn.onclick = () => {
            console.log('🔘 Send clicked!');
            showScreen('send');
        };
        console.log('✅ Send listener added');
    }
    
    const receiveBtn = document.getElementById('receive-btn');
    console.log('   receive-btn:', !!receiveBtn);
    if (receiveBtn) {
        receiveBtn.onclick = () => {
            console.log('🔘 Receive clicked!');
            showScreen('receive');
        };
        console.log('✅ Receive listener added');
    }
    
    const settingsBtn = document.getElementById('settings-btn');
    console.log('   settings-btn:', !!settingsBtn);
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            console.log('🔘 Settings clicked!');
            showScreen('settings');
        };
        console.log('✅ Settings listener added');
    }
    
    const createRuneBtn = document.getElementById('create-rune-btn');
    console.log('   create-rune-btn:', !!createRuneBtn);
    if (createRuneBtn) {
        createRuneBtn.onclick = () => {
            console.log('🎨 Create Rune clicked!');
            showCreateRuneScreen();
        };
        console.log('✅ Create Rune listener added');
    }
    
    // Send Screen
    document.getElementById('send-confirm-btn')?.addEventListener('click', handleSend);
    document.getElementById('back-from-send-btn')?.addEventListener('click', () => showScreen('wallet'));
    
    // Send Inscription Screen
    document.getElementById('send-inscription-confirm-btn')?.addEventListener('click', handleSendInscription);
    document.getElementById('back-from-send-inscription-btn')?.addEventListener('click', () => showScreen('wallet'));
    
    // Receive Screen
    document.getElementById('copy-receive-address-btn')?.addEventListener('click', handleCopyAddress);
    document.getElementById('back-from-receive-btn')?.addEventListener('click', () => showScreen('wallet'));
    
    // Settings Screen
    document.getElementById('view-mnemonic-btn')?.addEventListener('click', () => showScreen('view-mnemonic-security'));
    document.getElementById('view-private-key-btn')?.addEventListener('click', () => showScreen('view-private-key'));
    document.getElementById('export-wallet-btn')?.addEventListener('click', handleExportWallet);
    document.getElementById('lock-wallet-btn')?.addEventListener('click', handleLockWallet);
    document.getElementById('autolock-timeout')?.addEventListener('change', handleAutolockTimeoutChange);
    document.getElementById('reset-wallet-btn')?.addEventListener('click', handleResetWallet);
    document.getElementById('back-from-settings-btn')?.addEventListener('click', () => showScreen('wallet'));
    
    // View Mnemonic Security Screen
    document.getElementById('reveal-mnemonic-btn')?.addEventListener('click', handleRevealMnemonic);
    document.getElementById('copy-mnemonic-btn')?.addEventListener('click', handleCopyMnemonic);
    document.getElementById('back-from-mnemonic-view-btn')?.addEventListener('click', () => showScreen('settings'));
    
    // View Private Key Screen
    document.getElementById('reveal-key-btn')?.addEventListener('click', handleRevealPrivateKey);
    document.getElementById('copy-key-btn')?.addEventListener('click', handleCopyPrivateKey);
    document.getElementById('back-from-key-view-btn')?.addEventListener('click', () => showScreen('settings'));
    
    // ⚡ Network Selector (Mainnet/Lightning/Testnet)
    console.log('⚡ Setting up Network Selector...');
    const networkDropdownBtn = document.getElementById('network-dropdown-btn');
    const networkDropdownMenu = document.getElementById('network-dropdown-menu');
    const networkOptions = document.querySelectorAll('.network-option');
    
    console.log('   🔍 networkDropdownBtn:', networkDropdownBtn);
    console.log('   🔍 networkDropdownMenu:', networkDropdownMenu);
    console.log('   🔍 networkOptions count:', networkOptions.length);
    
    if (!networkDropdownBtn) {
        console.error('   ❌ Network dropdown button NOT FOUND!');
        console.error('   📍 Checking if element exists in DOM...');
        const allButtons = document.querySelectorAll('button');
        console.error('   📊 Total buttons in DOM:', allButtons.length);
    }
    
    if (networkDropdownBtn) {
        console.log('   ✅ Network dropdown button found!');
        console.log('   🎯 Network dropdown menu found:', networkDropdownMenu);
        
        // Toggle dropdown
        networkDropdownBtn.addEventListener('click', (e) => {
            console.log('   🖱️  Network dropdown clicked!');
            e.stopPropagation();
            
            const isOpen = networkDropdownBtn.classList.contains('open');
            console.log('   📊 Current state - isOpen:', isOpen);
            
            networkDropdownBtn.classList.toggle('open');
            networkDropdownMenu.classList.toggle('hidden');
            
            console.log('   📊 New state - open:', networkDropdownBtn.classList.contains('open'));
            console.log('   📊 New state - hidden:', networkDropdownMenu.classList.contains('hidden'));
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!networkDropdownBtn.contains(e.target) && !networkDropdownMenu.contains(e.target)) {
                networkDropdownBtn.classList.remove('open');
                networkDropdownMenu.classList.add('hidden');
            }
        });
        
        console.log('   ✅ Network dropdown configured');
    }
    
    // Network option clicks
    networkOptions.forEach(option => {
        option.addEventListener('click', () => {
            const network = option.dataset.network;
            console.log(`🔗 Switching to ${network}...`);
            switchNetwork(network);
            
            // Close dropdown
            networkDropdownBtn.classList.remove('open');
            networkDropdownMenu.classList.add('hidden');
        });
    });
    
    console.log(`   ✅ ${networkOptions.length} network options configured`);
    
    // Lightning Action Buttons
    const openChannelBtn = document.getElementById('open-channel-btn');
    const depositLightningBtn = document.getElementById('deposit-lightning-btn');
    const withdrawLightningBtn = document.getElementById('withdraw-lightning-btn');
    
    if (openChannelBtn) {
        openChannelBtn.addEventListener('click', handleOpenChannel);
        console.log('   ✅ Open Channel button configured');
    }
    
    if (depositLightningBtn) {
        depositLightningBtn.addEventListener('click', handleDepositToLightning);
        console.log('   ✅ Deposit button configured');
    }
    
    if (withdrawLightningBtn) {
        withdrawLightningBtn.addEventListener('click', handleWithdrawFromLightning);
        console.log('   ✅ Withdraw button configured');
    }
    
    // Tabs
    console.log('🔗 Setting up tab listeners...');
    const tabs = document.querySelectorAll('.tab');
    console.log('   Found tabs:', tabs.length);
    
    tabs.forEach((tab, index) => {
        const tabName = tab.dataset.tab;
        console.log(`   Tab ${index}:`, tabName, tab);
        
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const clickedTabName = e.target.dataset.tab || e.currentTarget.dataset.tab;
            console.log('🔘 Tab clicked:', clickedTabName);
            
            if (clickedTabName) {
                switchTab(clickedTabName);
            } else {
                console.error('❌ No tab name found on click!');
            }
        });
    });
    
    console.log('✅ Tab listeners configured');
}

// Re-bind Tab Listeners (chamado após mostrar wallet screen)
function rebindTabListeners() {
    console.log('🔄 Re-binding tab listeners...');
    
    const tabs = document.querySelectorAll('.tab');
    console.log('   Found tabs:', tabs.length);
    
    tabs.forEach((tab, index) => {
        // Remover listeners antigos clonando o elemento
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        const tabName = newTab.dataset.tab;
        console.log(`   Re-binding Tab ${index}:`, tabName);
        
        newTab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const clickedTabName = e.target.dataset.tab || e.currentTarget.dataset.tab;
            console.log('🔘 Tab clicked:', clickedTabName);
            
            if (clickedTabName) {
                switchTab(clickedTabName);
            } else {
                console.error('❌ No tab name found on click!');
            }
        });
    });
    
    console.log('✅ Tab listeners re-bound');
}

// Screen Management
function showScreen(screenName) {
    console.log('📱 Switching to screen:', screenName);
    
    try {
        // Esconder todas as screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Mostrar screen desejada
        const screen = document.getElementById(`${screenName}-screen`);
        if (screen) {
            screen.classList.remove('hidden');
            currentScreen = screenName;
            console.log('✅ Screen shown:', screenName);
            
            // Se é a wallet screen, re-vincular listeners das tabs e inicializar Network Selector
            if (screenName === 'wallet') {
                console.log('🔄 Wallet screen shown, re-binding tab listeners...');
                setTimeout(() => {
                    rebindTabListeners();
                    initializeNetworkSelector(); // ⚡ Initialize Network Selector
                }, 100); // Pequeno delay para garantir que DOM está pronto
            }
            
            // Se é a send screen, carregar fees dinâmicas
            if (screenName === 'send') {
                console.log('📊 Loading fees for Send Bitcoin screen...');
                loadBitcoinSendFees();
            }
        } else {
            console.error('❌ Screen not found:', `${screenName}-screen`);
        }
    } catch (error) {
        console.error('❌ Error showing screen:', error);
    }
}

// Tab Management
async function switchTab(tabName) {
    console.log('🔄 switchTab called:', tabName);
    
    // Atualizar tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const targetTab = document.getElementById(`${tabName}-tab`);
    console.log('  Target element:', targetTab ? 'Found' : 'NOT FOUND', `(#${tabName}-tab)`);
    
    if (targetTab) {
        targetTab.classList.remove('hidden');
        console.log('  ✅ Tab switched to:', tabName);
        
        // Se for a tab de Activity, carregar transações
        if (tabName === 'activity') {
            console.log('  🔄 Activity tab selected, loading transactions...');
            
            // 🔄 MOSTRAR LOADING IMEDIATAMENTE
            const activityList = document.getElementById('activity-list');
            if (activityList) {
                activityList.innerHTML = `
                    <div class="loading-container">
                        <img src="../assets/logo.png" alt="MyWallet" class="logo-medium" />
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Loading transactions...</p>
                    </div>
                `;
            }
            
            // Buscar endereço da wallet
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getWalletInfo'
                });
                
                if (response && response.success && response.data) {
                    const address = response.data.address;
                    console.log('  📍 Got wallet address:', address);
                    await loadActivity(address);
                } else {
                    console.error('  ❌ Failed to get wallet address');
                    if (activityList) {
                        activityList.innerHTML = `
                            <div class="empty-state">
                                <span class="empty-icon">⚠️</span>
                                <p>Failed to load wallet address</p>
                            </div>
                        `;
                    }
                }
            } catch (error) {
                console.error('  ❌ Error getting wallet info:', error);
                if (activityList) {
                    activityList.innerHTML = `
                        <div class="empty-state">
                            <span class="empty-icon">⚠️</span>
                            <p>Error loading transactions</p>
                        </div>
                    `;
                }
            }
        }
        
        // Se for a tab de Ordinals, carregar inscriptions
        if (tabName === 'ordinals') {
            console.log('  🖼️  Ordinals tab selected, loading inscriptions...');
            
            // 🔄 MOSTRAR LOADING IMEDIATAMENTE
            const ordinalsList = document.getElementById('ordinals-list');
            if (ordinalsList) {
                ordinalsList.innerHTML = `
                    <div class="loading-container">
                        <img src="../assets/logo.png" alt="MyWallet" class="logo-medium" />
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Loading inscriptions...</p>
                    </div>
                `;
            }
            
            // Buscar endereço da wallet
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getWalletInfo'
                });
                
                if (response && response.success && response.data) {
                    const address = response.data.address;
                    console.log('  📍 Got wallet address:', address);
                    await loadOrdinals(address);
                } else {
                    console.error('  ❌ Failed to get wallet address');
                    if (ordinalsList) {
                        ordinalsList.innerHTML = `
                            <div class="empty-state">
                                <span class="empty-icon">⚠️</span>
                                <p>Failed to load wallet address</p>
                            </div>
                        `;
                    }
                }
            } catch (error) {
                console.error('  ❌ Error getting wallet info:', error);
                if (ordinalsList) {
                    ordinalsList.innerHTML = `
                        <div class="empty-state">
                            <span class="empty-icon">⚠️</span>
                            <p>Error loading inscriptions</p>
                        </div>
                    `;
                }
            }
        }
        
        // Se for a tab de Runes, carregar runes
        if (tabName === 'runes') {
            console.log('  🪙 Runes tab selected, loading runes...');
            
            // 🔄 MOSTRAR LOADING IMEDIATAMENTE
            const runesList = document.getElementById('runes-list');
            if (runesList) {
                runesList.innerHTML = `
                    <div class="loading-container">
                        <img src="../assets/logo.png" alt="MyWallet" class="logo-medium" />
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Loading runes...</p>
                    </div>
                `;
            }
            
            // Buscar endereço da wallet
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getWalletInfo'
                });
                
                if (response && response.success && response.data) {
                    const address = response.data.address;
                    console.log('  📍 Got wallet address:', address);
                    await loadRunes(address);
                } else {
                    console.error('  ❌ Failed to get wallet address');
                    if (runesList) {
                        runesList.innerHTML = `
                            <div class="empty-state">
                                <span class="empty-icon">⚠️</span>
                                <p>Failed to load wallet address</p>
                            </div>
                        `;
                    }
                }
            } catch (error) {
                console.error('  ❌ Error getting wallet info:', error);
                if (runesList) {
                    runesList.innerHTML = `
                        <div class="empty-state">
                            <span class="empty-icon">⚠️</span>
                            <p>Error loading runes</p>
                        </div>
                    `;
                }
            }
        }
    } else {
        console.error('  ❌ Tab element not found:', `${tabName}-tab`);
    }
}

// Verificar se tem wallet
async function checkWallet() {
    const result = await chrome.storage.local.get(['walletEncrypted']);
    return !!result.walletEncrypted;
}

// Gerar Mnemonic
async function handleGenerateMnemonic() {
    console.log('🔥 handleGenerateMnemonic called!');
    
    try {
        const wordCountEl = document.getElementById('mnemonic-length');
        const passwordEl = document.getElementById('create-password');
        const confirmPasswordEl = document.getElementById('confirm-password');
        
        console.log('   Elements found:', {
            wordCountEl: !!wordCountEl,
            passwordEl: !!passwordEl,
            confirmPasswordEl: !!confirmPasswordEl
        });
        
        const wordCount = parseInt(wordCountEl?.value || '12');
        const password = passwordEl?.value || '';
        const confirmPassword = confirmPasswordEl?.value || '';
        
        console.log('   Values:', {
            wordCount,
            password: password ? `***${password.length} chars` : '(empty)',
            confirmPassword: confirmPassword ? `***${confirmPassword.length} chars` : '(empty)'
        });
        
        if (!password || password.length < 6) {
            console.error('❌ Password too short');
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            console.error('❌ Passwords do not match');
            showNotification('Passwords do not match', 'error');
            return;
        }
        
        console.log('✅ Validation passed, generating wallet...');
        console.log('   Showing loading...');
        showLoading('Generating wallet...');
        
        console.log('📨 Sending message to background script...');
        console.log('   Action: generateWallet');
        console.log('   Data:', { wordCount, password: '***' });
        
        // Enviar mensagem para background script gerar wallet
        const response = await chrome.runtime.sendMessage({
            action: 'generateWallet',
            data: { wordCount, password }
        });
        
        console.log('📨 Response received:', response);
        
        if (response && response.success) {
            console.log('✅ Wallet generated successfully!');
            console.log('   Mnemonic length:', response.mnemonic?.split(' ').length, 'words');
            console.log('   Address:', response.address);
            
            // Salvar mnemonic temporariamente para usar após mudar de tela
            const mnemonicToShow = response.mnemonic;
            
            console.log('   Switching to show-mnemonic screen...');
            showScreen('show-mnemonic');
            console.log('✅ Screen switched!');
            
            // Usar requestAnimationFrame + setTimeout para garantir que o DOM foi atualizado
            requestAnimationFrame(() => {
                setTimeout(() => {
                    console.log('🔍 Trying to find mnemonic-display element...');
                    const mnemonicDisplay = document.getElementById('mnemonic-display');
                    console.log('   Element found:', !!mnemonicDisplay);
                    console.log('   Element visible:', mnemonicDisplay?.offsetParent !== null);
                    
                    if (mnemonicDisplay) {
                        // Quebrar em palavras e criar grid
                        const words = mnemonicToShow.split(' ');
                        mnemonicDisplay.innerHTML = '';
                        
                        words.forEach((word, index) => {
                            const wordCard = document.createElement('div');
                            wordCard.className = 'mnemonic-word';
                            wordCard.innerHTML = `<span class="mnemonic-word-number">${index + 1}.</span>${word}`;
                            mnemonicDisplay.appendChild(wordCard);
                        });
                        
                        console.log('✅ Mnemonic set in display:', words.length, 'words');
                    } else {
                        console.error('❌ mnemonic-display element still not found!');
                        console.error('   Available screens:', 
                            Array.from(document.querySelectorAll('.screen'))
                                .map(s => s.id));
                    }
                }, 200);
            });
        } else {
            console.error('❌ Generate failed:', response?.error || 'No response');
            showNotification(response?.error || 'Failed to generate wallet', 'error');
        }
    } catch (error) {
        console.error('❌ Error generating wallet:', error);
        console.error('   Error stack:', error.stack);
        showNotification('Failed to generate wallet: ' + error.message, 'error');
    } finally {
        console.log('🔄 Hiding loading...');
        hideLoading();
        console.log('✅ handleGenerateMnemonic completed');
    }
}

// Mnemonic Saved
async function handleMnemonicSaved() {
    showScreen('wallet');
    await loadWalletData();
    
    // 📊 Track wallet creation
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        if (response?.success) {
            trackUserAction(response.data.address, 'wallet_created', {
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.warn('⚠️  Failed to track wallet creation:', error);
    }
}

// Restore Wallet
async function handleRestoreWallet() {
    const mnemonic = document.getElementById('restore-mnemonic').value.trim();
    const password = document.getElementById('restore-password').value;
    
    if (!mnemonic) {
        showNotification('Please enter your mnemonic phrase', 'error');
        return;
    }
    
    if (!password || password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    showLoading('Restoring wallet...');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'restoreWallet',
            data: { mnemonic, password }
        });
        
        if (response.success) {
            showNotification('Wallet restored successfully!', 'success');
            showScreen('wallet');
            await loadWalletData();
            
            // 📊 Track wallet restore
            try {
                const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
                if (walletInfo?.success) {
                    trackUserAction(walletInfo.data.address, 'wallet_restored', {
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.warn('⚠️  Failed to track wallet restore:', error);
            }
        } else {
            showNotification(response.error || 'Failed to restore wallet', 'error');
        }
    } catch (error) {
        console.error('Error restoring wallet:', error);
        showNotification('Failed to restore wallet', 'error');
    } finally {
        hideLoading();
    }
}

// Re-bind Wallet Buttons (chamado após carregar dados)
function rebindWalletButtons() {
    console.log('🔗 ========== REBINDING WALLET BUTTONS (EVENT DELEGATION) ==========');
    
    // Usar EVENT DELEGATION no documento
    // Isso captura cliques nos botões E seus filhos!
    
    document.addEventListener('click', (e) => {
        // Encontrar o botão clicado (pode ser filho do botão)
        const target = e.target.closest('button');
        
        if (!target) return;
        
        // Copy Address
        if (target.id === 'copy-address-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Copy Address clicked!');
            handleCopyAddress();
            return;
        }
        
        // Send
        if (target.id === 'send-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Send clicked!');
            showScreen('send');
            return;
        }
        
        // Receive
        if (target.id === 'receive-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Receive clicked!');
            showScreen('receive');
            return;
        }
        
        // Settings
        if (target.id === 'settings-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Settings clicked!');
            showScreen('settings');
            return;
        }
        
        // ⚡ L2 Buttons (NEW!)
        if (target.id === 'l2-deposit-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 L2 Deposit clicked!');
            if (window.krayL2 && window.krayL2.showL2DepositScreen) {
                window.krayL2.showL2DepositScreen();
            }
            return;
        }
        
        if (target.id === 'l2-withdraw-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 L2 Withdraw clicked!');
            if (window.krayL2 && window.krayL2.showL2WithdrawScreen) {
                window.krayL2.showL2WithdrawScreen();
            }
            return;
        }
        
        if (target.id === 'l2-transfer-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 L2 Transfer clicked!');
            if (window.krayL2 && window.krayL2.showL2TransferScreen) {
                window.krayL2.showL2TransferScreen();
            }
            return;
        }
        
        if (target.id === 'l2-swap-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 L2 Swap clicked!');
            if (window.krayL2 && window.krayL2.showL2SwapScreen) {
                window.krayL2.showL2SwapScreen();
            }
            return;
        }
        
        if (target.id === 'l2-marketplace-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 L2 Marketplace clicked!');
            if (window.krayL2 && window.krayL2.showL2MarketplaceScreen) {
                window.krayL2.showL2MarketplaceScreen();
            }
            return;
        }
        
        if (target.id === 'l2-rewards-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 L2 Rewards clicked!');
            if (window.krayL2 && window.krayL2.showL2RewardsScreen) {
                window.krayL2.showL2RewardsScreen();
            }
            return;
        }
        
        // ⚡ L2 BACK Buttons (NEW!) - Return to wallet screen in L2 mode
        if (target.id === 'back-from-l2-deposit-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Back from L2 Deposit');
            showScreen('wallet'); // Volta para wallet screen
            // Reativar L2 content
            document.getElementById('kray-l2-content')?.classList.remove('hidden');
            return;
        }
        
        if (target.id === 'back-from-l2-transfer-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Back from L2 Transfer');
            showScreen('wallet');
            document.getElementById('kray-l2-content')?.classList.remove('hidden');
            return;
        }
        
        if (target.id === 'back-from-l2-swap-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Back from L2 Swap');
            showScreen('wallet');
            document.getElementById('kray-l2-content')?.classList.remove('hidden');
            return;
        }
        
        if (target.id === 'back-from-l2-withdraw-btn') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Back from L2 Withdraw');
            showScreen('wallet');
            document.getElementById('kray-l2-content')?.classList.remove('hidden');
            return;
        }
    }, true); // true = capture phase (pega antes de qualquer outro)
    
    console.log('✅ Event delegation configured for all wallet buttons!');
}

// Global flag para prevenir chamadas duplicadas
let isLoadingActivity = false;

// Load Activity (Transaction History) com Enriched UTXOs
async function loadActivity(address) {
    try {
        // 🛡️ PREVENIR DUPLICAÇÃO
        if (isLoadingActivity) {
            console.warn('⚠️  loadActivity already running, skipping duplicate call');
            return;
        }
        
        isLoadingActivity = true;
        
        console.log('📜 ========== LOADING ACTIVITY ==========');
        console.log('   Address:', address);
        
        if (!address) {
            console.error('❌ No address provided to loadActivity!');
            isLoadingActivity = false;
            return;
        }
        
        const activityList = document.getElementById('activity-list');
        if (!activityList) {
            console.warn('⚠️  Activity list element not found');
            isLoadingActivity = false;
            return;
        }
        
        // 💾 VERIFICAR CACHE PRIMEIRO
        if (isCacheValid('activity')) {
            console.log('⚡ Using cached activity data');
            const cachedHTML = dataCache.activity.data;
            
            // Mostrar cache imediatamente (substitui loading)
            if (cachedHTML) {
                activityList.innerHTML = cachedHTML;
                // ✅ REATTACH EVENT LISTENERS para abrir KrayScan
                attachActivityClickHandlers();
            } else {
                activityList.innerHTML = '<div class="empty-state">No transactions yet</div>';
            }
            
            isLoadingActivity = false;
            return;
        }
        
        // 🔄 SEM CACHE - loading já está visível (colocado no tab switch)
        
        // 🎯 BUSCAR UTXOS ENRIQUECIDOS (mesmo sistema do Split)
        console.log('   📦 Fetching enriched UTXOs from backend...');
        let enrichedUtxosMap = new Map(); // txid:vout -> {inscription, runes}
        let runesThumbnailsMap = new Map(); // runeName -> thumbnail URL
        let runesSymbolsMap = new Map(); // runeName -> emoji symbol
        let runesIdToNameMap = new Map(); // runeId -> runeName
        
        try {
            const utxosResponse = await fetch(`https://kraywallet-backend.onrender.com/api/wallet/utxos/${address}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (utxosResponse.ok) {
                const utxosData = await utxosResponse.json();
                console.log(`   ✅ Fetched ${utxosData.utxos.length} enriched UTXOs`);
                
                // Mapear UTXOs por txid:vout
                for (const utxo of utxosData.utxos) {
                    const key = `${utxo.txid}:${utxo.vout}`;
                    enrichedUtxosMap.set(key, {
                        inscription: utxo.inscription || null,
                        runes: utxo.runes || null,
                        hasInscription: utxo.hasInscription,
                        hasRunes: utxo.hasRunes,
                        value: utxo.value
                    });
                    
                    if (utxo.hasInscription || utxo.hasRunes) {
                        console.log(`      📍 ${key}: ${utxo.hasInscription ? '📜 Inscription' : ''} ${utxo.hasRunes ? '🪙 Runes' : ''}`);
                    }
                }
                
                console.log(`   🗺️  Enriched UTXOs map size: ${enrichedUtxosMap.size}`);
            } else {
                console.warn('   ⚠️  Failed to fetch enriched UTXOs:', utxosResponse.status);
            }
        } catch (enrichError) {
            console.error('   ❌ Error fetching enriched UTXOs:', enrichError);
        }
        
        // 🎯 BUSCAR THUMBNAILS E SYMBOLS DAS RUNES (do endpoint /fast)
        try {
            const runesResponse = await fetch(`https://kraywallet-backend.onrender.com/api/runes/fast/${address}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (runesResponse.ok) {
                const runesData = await runesResponse.json();
                if (runesData.success && runesData.runes) {
                    console.log(`   ✅ Fetched ${runesData.runes.length} runes with thumbnails & symbols`);
                    
                    // Mapear thumbnails, symbols, IDs E DIVISIBILITY por nome da rune
                    window.runesDivisibilityMap = window.runesDivisibilityMap || new Map();
                    
                    for (const rune of runesData.runes) {
                        const runeName = rune.spacedName || rune.name;
                        
                        if (rune.thumbnail) {
                            runesThumbnailsMap.set(runeName, rune.thumbnail);
                            console.log(`      🖼️  ${runeName}: ${rune.thumbnail.substring(0, 50)}...`);
                        }
                        if (rune.symbol) {
                            runesSymbolsMap.set(runeName, rune.symbol);
                            console.log(`      ${rune.symbol} ${runeName}`);
                        }
                        if (rune.runeId) {
                            runesIdToNameMap.set(rune.runeId, runeName);
                            console.log(`      🆔 ${rune.runeId} → ${runeName}`);
                        }
                        if (rune.divisibility !== undefined) {
                            window.runesDivisibilityMap.set(runeName, rune.divisibility);
                            console.log(`      💰 ${runeName} divisibility: ${rune.divisibility}`);
                        }
                    }
                }
            }
        } catch (runesError) {
            console.error('   ❌ Error fetching runes thumbnails:', runesError);
        }
        
        // DEPRECATED: Old inscriptions map logic (keeping for fallback)
        let inscriptionsMap = new Map(); // txid:vout -> inscription details
        
        try {
            const inscriptionsResponse = await chrome.runtime.sendMessage({
                action: 'getInscriptions',
                data: { address }
            });
            
            console.log('   📦 Inscriptions response:', inscriptionsResponse);
            
            if (inscriptionsResponse && inscriptionsResponse.success) {
                const inscriptionsList = inscriptionsResponse.inscriptions || [];
                console.log(`   ✅ Found ${inscriptionsList.length} inscriptions`);
                console.log('   📋 Full inscriptions list:', inscriptionsList);
                
                // Mapear inscriptions por UTXO (txid:vout)
                for (const inscription of inscriptionsList) {
                    // ✅ Normalizar: backend retorna "id", não "inscriptionId"
                    const inscriptionId = inscription.inscriptionId || inscription.id;
                    
                    console.log(`      🔍 Processing inscription:`, inscription);
                    console.log(`         - inscriptionId: ${inscriptionId}`);
                    console.log(`         - utxo:`, inscription.utxo);
                    
                    if (inscription.utxo) {
                        const key = `${inscription.utxo.txid}:${inscription.utxo.vout}`;
                        inscriptionsMap.set(key, inscription);
                        console.log(`      ✅ Mapped inscription ${inscriptionId?.substring(0, 16) || 'unknown'}... to ${key}`);
                    } else {
                        console.warn(`      ⚠️  Inscription ${inscriptionId?.substring(0, 16) || 'unknown'}... has NO UTXO!`);
                    }
                }
                
                console.log(`   🗺️  Final inscriptionsMap size: ${inscriptionsMap.size}`);
                console.log(`   🗺️  Map keys:`, Array.from(inscriptionsMap.keys()));
            } else {
                console.warn('   ⚠️  Inscriptions response invalid or failed:', inscriptionsResponse);
            }
        } catch (inscError) {
            console.error('   ❌ Error fetching inscriptions:', inscError);
            console.error('   ❌ Stack:', inscError.stack);
        }
        
        // Buscar transações via Mempool.space (CONFIRMADAS + MEMPOOL)
        // 🚀 OTIMIZAÇÃO: Carregar apenas as primeiras 25 TXs (muito mais rápido!)
        
        // 1️⃣ Buscar transações PENDENTES (mempool)
        console.log('   📡 Fetching mempool txs...');
        const mempoolUrl = `https://mempool.space/api/address/${address}/txs/mempool`;
        const mempoolResponse = await fetch(mempoolUrl);
        const mempoolTxs = mempoolResponse.ok ? await mempoolResponse.json() : [];
        console.log(`   ✅ Found ${mempoolTxs.length} mempool transactions`);
        
        // 2️⃣ Buscar transações CONFIRMADAS
        const chainUrl = `https://mempool.space/api/address/${address}/txs/chain`;
        console.log('   📡 Fetching confirmed txs...');
        
        const response = await fetch(chainUrl);
        console.log('   📡 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch transactions: ${response.status}`);
        }
        
        const chainTxs = await response.json();
        console.log(`   ✅ Found ${chainTxs.length} confirmed transactions`);
        
        // 3️⃣ COMBINAR: Mempool primeiro, depois confirmadas (DEDUPLICAR!)
        const seenTxids = new Set();
        const transactions = [];
        
        // Adicionar mempool TXs
        for (const tx of mempoolTxs) {
            if (!seenTxids.has(tx.txid)) {
                seenTxids.add(tx.txid);
                transactions.push(tx);
            }
        }
        
        // Adicionar chain TXs (só se não duplicado)
        for (const tx of chainTxs) {
            if (!seenTxids.has(tx.txid)) {
                seenTxids.add(tx.txid);
                transactions.push(tx);
            }
        }
        
        const duplicatesRemoved = (mempoolTxs.length + chainTxs.length) - transactions.length;
        if (duplicatesRemoved > 0) {
            console.log(`   🗑️  Removed ${duplicatesRemoved} duplicate(s)`);
        }
        
        console.log('   ✅ Response parsed successfully');
        console.log(`   ✅ Total: ${transactions.length} transactions (${mempoolTxs.length} pending + ${chainTxs.length} confirmed)`);
        
        if (transactions.length > 0) {
            console.log('   📋 First transaction:', transactions[0]);
        }
        
        if (transactions.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📜</span>
                    <p>No transactions yet</p>
                </div>
            `;
            isLoadingActivity = false;
            return;
        }
        
        // Limpar lista
        activityList.innerHTML = '';
        
        // ✅ OTIMIZAÇÃO: Processar TODAS as transações em PARALELO
        console.log('   🔄 Processing transactions in PARALLEL...');
        const txItemPromises = transactions.map(tx => 
            createTransactionItem(tx, address, enrichedUtxosMap, runesThumbnailsMap, runesSymbolsMap, runesIdToNameMap, inscriptionsMap)
        );
        
        // Esperar todas terminarem
        const txItems = await Promise.all(txItemPromises);
        
        // Adicionar todos os items de uma vez
        txItems.forEach(txItem => activityList.appendChild(txItem));
        
        console.log('   ✅ Activity loaded successfully!');
        console.log('=========================================');
        
        // 💾 SALVAR HTML E ÚLTIMO TXID NO CACHE
        dataCache.activity.data = activityList.innerHTML;
        dataCache.activity.timestamp = Date.now();
        dataCache.activity.loaded = true;
        dataCache.activity.lastTxid = transactions[0]?.txid || null;  // Salvar último TXID
        console.log('💾 Activity cached for 10 minutes');
        console.log('   Last TXID:', dataCache.activity.lastTxid?.substring(0, 16) + '...');
        
        // Setup auto-refresh se houver transações pending
        const hasPending = transactions.some(tx => !tx.status.confirmed);
        if (hasPending) {
            console.log('   ⏰ Found pending transactions, auto-refresh will update in 30s');
            // Auto-refresh a cada 30 segundos
            setTimeout(() => {
                if (document.getElementById('activity-tab')?.classList.contains('tab-content') && 
                    !document.getElementById('activity-tab')?.classList.contains('hidden')) {
                    console.log('🔄 Auto-refreshing activity...');
                    clearAllCache(); // Limpar cache antes de auto-refresh
                    loadActivity(address);
                }
            }, 30000);
        }
        
    } catch (error) {
        console.error('❌ ========== ERROR LOADING ACTIVITY ==========');
        console.error('   Error:', error);
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        console.error('=============================================');
        
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⚠️</span>
                    <p>Failed to load transactions</p>
                    <small>${error.message}</small>
                    <br><br>
                    <button onclick="location.reload()" style="padding: 8px 16px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    } finally {
        // 🛡️ SEMPRE liberar flag no final
        isLoadingActivity = false;
    }
}

// Reattach Click Handlers para Activity Items (após carregar do cache)
function attachActivityClickHandlers() {
    console.log('🔗 Attaching click handlers to activity items...');
    const activityItems = document.querySelectorAll('.activity-item');
    
    activityItems.forEach(item => {
        // Extrair TXID do data attribute (vamos adicionar isso)
        const txid = item.getAttribute('data-txid');
        
        if (txid) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                const url = `https://kraywallet-backend.onrender.com/krayscan.html?txid=${txid}`;
                console.log(`🔗 Opening TX in KrayScan: ${url}`);
                chrome.tabs.create({ url });
            });
        }
    });
    
    console.log(`✅ Attached click handlers to ${activityItems.length} items`);
}

// Create Transaction Item com Enriched UTXOs e Runes Thumbnails
async function createTransactionItem(tx, myAddress, enrichedUtxosMap = new Map(), runesThumbnailsMap = new Map(), runesSymbolsMap = new Map(), runesIdToNameMap = new Map(), inscriptionsMap = new Map()) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    
    // ✅ Adicionar TXID como data attribute para reattach listeners depois
    item.setAttribute('data-txid', tx.txid);
    
    // Determinar tipo de transação (Received/Sent)
    let type = 'unknown';
    let amount = 0;
    let otherAddress = '';
    
    // Calcular entrada/saída para este endereço
    let myInputs = 0;
    let myOutputs = 0;
    
    // DEBUG
    console.log(`\n🔍 Processing TX: ${tx.txid.substring(0, 16)}...`);
    console.log(`   My address: ${myAddress.substring(0, 20)}...`);
    
    // Verificar inputs (se este endereço está enviando)
    for (const vin of tx.vin) {
        if (vin.prevout && vin.prevout.scriptpubkey_address === myAddress) {
            myInputs += vin.prevout.value;
            console.log(`   ✅ Found my input: ${vin.prevout.value} sats`);
        }
    }
    
    // Verificar outputs (se este endereço está recebendo)
    for (const vout of tx.vout) {
        if (vout.scriptpubkey_address === myAddress) {
            myOutputs += vout.value;
            console.log(`   ✅ Found my output: ${vout.value} sats`);
        }
    }
    
    console.log(`   📊 myInputs: ${myInputs}, myOutputs: ${myOutputs}`);
    
    // Determinar tipo e pegar endereço relevante
    if (myInputs > 0 && myOutputs === 0) {
        // Enviamos tudo (sem change)
        type = 'sent';
        amount = myInputs;
        
        // Pegar o primeiro output que não é nosso (destinatário)
        for (const vout of tx.vout) {
            if (vout.scriptpubkey_address && vout.scriptpubkey_address !== myAddress) {
                otherAddress = vout.scriptpubkey_address;
                amount = vout.value; // Valor enviado
                break;
            }
        }
    } else if (myInputs === 0 && myOutputs > 0) {
        // Recebemos
        type = 'received';
        amount = myOutputs;
        
        // Pegar endereço de origem (primeiro input)
        if (tx.vin.length > 0 && tx.vin[0].prevout) {
            otherAddress = tx.vin[0].prevout.scriptpubkey_address || 'Unknown';
        }
    } else if (myInputs > 0 && myOutputs > 0) {
        // Enviamos com change
        type = 'sent';
        amount = myInputs - myOutputs; // Diferença = valor enviado + fee
        console.log(`   🔄 Type: SENT with change`);
        
        // Encontrar endereço de destino (output que não é nosso)
        // Nota: Não verificamos dust limit aqui, pois pode haver outputs válidos < 546
        for (const vout of tx.vout) {
            console.log(`      Checking output: ${vout.value} sats to ${vout.scriptpubkey_address?.substring(0, 20)}...`);
            console.log(`      Is mine? ${vout.scriptpubkey_address === myAddress}`);
            
            if (vout.scriptpubkey_address && vout.scriptpubkey_address !== myAddress) {
                otherAddress = vout.scriptpubkey_address;
                amount = vout.value; // Valor real enviado
                console.log(`      ✅ FOUND RECIPIENT: ${otherAddress.substring(0, 20)}... (${amount} sats)`);
                break;
            }
        }
        console.log(`   📍 Final otherAddress: ${otherAddress ? otherAddress.substring(0, 20) + '...' : 'NONE'}`);
    } else if (myInputs === 0 && myOutputs === 0) {
        // Caso especial: TX pending sem dados de prevout (ainda propagando)
        // Tentar determinar pelo que vemos nos outputs
        type = 'unknown';
        
        // Se há um output que não é para meu endereço, provavelmente estamos enviando
        for (const vout of tx.vout) {
            if (vout.scriptpubkey_address && vout.scriptpubkey_address !== myAddress) {
                type = 'sent';
                otherAddress = vout.scriptpubkey_address;
                amount = vout.value;
                break;
            } else if (vout.scriptpubkey_address === myAddress) {
                type = 'received';
                amount = vout.value;
            }
        }
    }
    
    // 🎯 DETECTAR SE É UMA TRANSAÇÃO DE INSCRIPTION (usando enriched data)
    let inscription = null;
    let inscriptionInfo = null;
    let enrichedData = null;
    
    console.log(`   🔎 Checking TX for inscriptions/runes (ENRICHED)...`);
    console.log(`      TX has ${tx.vout.length} outputs, ${tx.vin.length} inputs`);
    console.log(`      enrichedUtxosMap has ${enrichedUtxosMap.size} entries`);
    
    // Verificar nos outputs se há inscription/runes (usando enriched data)
    for (let i = 0; i < tx.vout.length; i++) {
        const key = `${tx.txid}:${i}`;
        console.log(`      🔍 Checking OUTPUT ${i}: ${key}`);
        
        if (enrichedUtxosMap.has(key)) {
            enrichedData = enrichedUtxosMap.get(key);
            console.log(`         ✅ Found enriched data:`, enrichedData);
            
            if (enrichedData.hasInscription && enrichedData.inscription) {
                inscription = enrichedData.inscription;
                inscriptionInfo = { vout: i, isOutput: true };
                console.log(`   ✅ 🖼️  Found inscription in OUTPUT ${i}:`, inscription.id || inscription.inscription_id);
                break;
            }
        }
        
        // Fallback: usar o mapa antigo de inscriptions
        if (!inscription && inscriptionsMap.has(key)) {
            inscription = inscriptionsMap.get(key);
            inscriptionInfo = { vout: i, isOutput: true };
            console.log(`   ✅ 🖼️  Found inscription in OUTPUT ${i} (fallback):`, inscription.inscriptionId?.substring(0, 16));
            break;
        }
    }
    
    // Se não encontrou nos outputs, verificar nos inputs (inscription sendo enviada)
    if (!inscription) {
        console.log(`      No inscription in outputs, checking inputs...`);
        for (let i = 0; i < tx.vin.length; i++) {
            if (tx.vin[i].txid && tx.vin[i].vout !== undefined) {
                const key = `${tx.vin[i].txid}:${tx.vin[i].vout}`;
                console.log(`      🔍 Checking INPUT ${i}: ${key}`);
                console.log(`         Has in map? ${inscriptionsMap.has(key)}`);
                
                if (inscriptionsMap.has(key)) {
                    inscription = inscriptionsMap.get(key);
                    inscriptionInfo = { vin: i, isInput: true };
                    console.log(`   ✅ 🖼️  Found inscription in INPUT ${i}:`, inscription.inscriptionId.substring(0, 16));
                    break;
                }
                
                // 🔥 NOVO: Se não confirmada, buscar input via backend para detectar inscription
                if (!tx.status?.confirmed) {
                    try {
                        const inputCheckResponse = await fetch(`https://kraywallet-backend.onrender.com/api/output/${tx.vin[i].txid}:${tx.vin[i].vout}`, {
                            signal: AbortSignal.timeout(2000)
                        });
                        
                        if (inputCheckResponse.ok) {
                            const inputData = await inputCheckResponse.json();
                            
                            if (inputData.success && inputData.inscriptions?.length > 0) {
                                const inscriptionId = inputData.inscriptions[0];
                                console.log(`   ✅ Found inscription in UNCONFIRMED TX input: ${inscriptionId}`);
                                
                                // Buscar detalhes
                                try {
                                    const detailsResponse = await fetch(`https://kraywallet-backend.onrender.com/api/ordinals/${inscriptionId}`, {
                                        signal: AbortSignal.timeout(2000)
                                    });
                                    
                                    if (detailsResponse.ok) {
                                        const inscData = await detailsResponse.json();
                                        
                                        inscription = {
                                            inscriptionId: inscriptionId,
                                            inscriptionNumber: inscData.number || inscData.inscription_number || 'N/A',
                                            number: inscData.number || inscData.inscription_number,  // ✅ Add for consistency
                                            inscription_number: inscData.number || inscData.inscription_number,  // ✅ Add all variants
                                            preview: `https://ordinals.com/preview/${inscriptionId}`,
                                            outputValue: tx.vin[i].prevout?.value || 555
                                        };
                                        inscriptionInfo = { vin: i, isInput: true };
                                        console.log(`   ✅ Inscription #${inscription.inscriptionNumber} (MEMPOOL TX)`);
                                        break;
                                    }
                                } catch (e) {
                                    console.warn(`   ⚠️  Could not fetch inscription details: ${e.message}`);
                                }
                            }
                        }
                    } catch (e) {
                        // Continuar
                    }
                }
            }
        }
    }
    
        // 🔍 Se não encontrou no mapa local, tentar detectar por valor típico (600 sats)
        // e buscar na API do Unisat
        if (!inscription) {
            console.log(`   🔍 No inscription in map, checking ALL outputs in ord server...`);
            
            for (let i = 0; i < tx.vout.length; i++) {
                const vout = tx.vout[i];
                
                // ⏸️ DELAY para evitar Chrome throttling
                if (i > 0) {
                    await new Promise(r => setTimeout(r, 100));  // 100ms entre cada output
                }
                
                // 🔍 Buscar QUALQUER output no ord server (não filtrar por valor)
                try {
                    console.log(`   📡 Checking ord server: ${tx.txid}:${i} (${vout.value} sats)`);
                
                // RETRY LOGIC: Tentar até 2x se falhar
                let ordResponse = null;
                let attempts = 0;
                const maxAttempts = 2;
                
                while (attempts < maxAttempts && !ordResponse) {
                    attempts++;
                    
                    try {
                        ordResponse = await fetch(`https://kraywallet-backend.onrender.com/api/output/${tx.txid}:${i}`, {
                            method: 'GET',
                            headers: { 'Accept': 'application/json' },
                            signal: AbortSignal.timeout(15000)  // 15 seg (aumentado!)
                        });
                        
                        if (!ordResponse.ok) {
                            console.warn(`      ⚠️  Attempt ${attempts}: API returned ${ordResponse.status}`);
                            ordResponse = null;  // Retry
                            
                            // Delay antes de retry (150ms)
                            if (attempts < maxAttempts) {
                                await new Promise(r => setTimeout(r, 150));
                            }
                        }
                    } catch (fetchError) {
                        console.warn(`      ⚠️  Attempt ${attempts} failed:`, fetchError.message);
                        ordResponse = null;
                        
                        // Delay antes de retry
                        if (attempts < maxAttempts) {
                            await new Promise(r => setTimeout(r, 150));
                        }
                    }
                }
                
                if (ordResponse.ok) {
                    const outputData = await ordResponse.json();
                    
                    // Verificar se tem inscription (QuickNode retorna array de IDs)
                    if (outputData.success && outputData.inscriptions && outputData.inscriptions.length > 0) {
                        const inscriptionId = outputData.inscriptions[0]; // Primeira inscription
                        console.log(`   ✅ Found inscription in output ${i}: ${inscriptionId}`);
                        
                        // Buscar DETAILS COMPLETOS via QuickNode (sempre!)
                        let inscriptionDetails = null;
                        
                        // RETRY para buscar details (crítico!)
                        let detailsAttempts = 0;
                        const maxDetailsAttempts = 3;  // 3 tentativas
                        
                        while (detailsAttempts < maxDetailsAttempts && !inscriptionDetails) {
                            detailsAttempts++;
                            
                            try {
                                const detailsResponse = await fetch(`https://kraywallet-backend.onrender.com/api/ordinals/${inscriptionId}`, {
                                    signal: AbortSignal.timeout(15000)  // 15 seg
                                });
                            
                                if (detailsResponse.ok) {
                                    const responseData = await detailsResponse.json();
                                    
                                    // /api/explorer/inscription retorna { success: true, inscription: {...} }
                                    inscriptionDetails = responseData.inscription || responseData;
                                    
                                    console.log(`   ✅ Got inscription details (attempt ${detailsAttempts}):`, inscriptionDetails);
                                    break;  // Success!
                                } else {
                                    console.warn(`      ⚠️  Attempt ${detailsAttempts}: Details API ${detailsResponse.status}`);
                                    
                                    // Delay antes de retry
                                    if (detailsAttempts < maxDetailsAttempts) {
                                        await new Promise(r => setTimeout(r, 200));
                                    }
                                }
                            } catch (e) {
                                console.error(`      ❌ Attempt ${detailsAttempts} failed:`, e.message);
                                
                                // Delay antes de retry
                                if (detailsAttempts < maxDetailsAttempts) {
                                    await new Promise(r => setTimeout(r, 200));
                                }
                            }
                        }
                        
                        // DEBUG: Ver o que veio do API
                        console.log(`   🔍 Details response:`, inscriptionDetails);
                        console.log(`   🔍 inscriptionDetails?.number:`, inscriptionDetails?.number);
                        console.log(`   🔍 inscriptionDetails?.inscription_number:`, inscriptionDetails?.inscription_number);
                        
                        // Extrair número (tentar TODOS os campos possíveis)
                        const extractedNumber = inscriptionDetails?.number || 
                                              inscriptionDetails?.inscription_number || 
                                              inscriptionDetails?.inscriptionNumber ||
                                              inscriptionDetails?.data?.number ||
                                              inscriptionDetails?.inscription?.number ||
                                              null;
                        
                        console.log(`   🔍 Extracted number:`, extractedNumber);
                        
                        // Criar inscription object com TODOS os campos
                        inscription = {
                            inscriptionId: inscriptionId,
                            id: inscriptionId,
                            inscriptionNumber: extractedNumber,
                            number: extractedNumber,
                            inscription_number: extractedNumber,
                            preview: `https://ordinals.com/preview/${inscriptionId}`,  // SEMPRE setar!
                            contentUrl: `https://ordinals.com/content/${inscriptionId}`,  // SEMPRE setar!
                            thumbnail: `/api/rune-thumbnail/${inscriptionId}`,  // Para backend
                            outputValue: vout.value,
                            value: vout.value,
                            utxo: { value: vout.value, txid: tx.txid, vout: i }
                        };
                        inscriptionInfo = { vout: i, isOutput: true };
                        console.log(`   ✅ 🖼️  Inscription created: #${extractedNumber || '?'}, preview: ${inscription.preview}`);
                        break;
                    }
                }
            } catch (error) {
                if (error.name === 'TimeoutError') {
                    console.warn(`   ⏱️  Timeout checking output ${i}`);
                } else {
                    console.error(`   ⚠️ Error checking output ${i}:`, error.message);
                }
            }
        }
    }
    
    const isInscriptionTx = !!inscription;
    console.log(`   📋 Is inscription TX? ${isInscriptionTx}`);
    
    // 🎯 DETECTAR SE É TRANSAÇÃO DE RUNES (usando enriched data)
    let isRunesTx = false;
    let runeInfo = null;
    let runesData = [];
    
    console.log(`   🪙 Checking for RUNES in outputs...`);
    
    // Verificar se algum output tem runes (usando enriched data)
    for (let i = 0; i < tx.vout.length; i++) {
        const key = `${tx.txid}:${i}`;
        
        if (enrichedUtxosMap.has(key)) {
            const data = enrichedUtxosMap.get(key);
            
            if (data.hasRunes && data.runes && data.runes.length > 0) {
                isRunesTx = true;
                runesData = data.runes;
                
                // 🔄 CONVERTER RUNE IDs PARA NOMES (se necessário)
                runesData = runesData.map(r => {
                    // Se 'name' parece ser um ID (formato block:tx), converter para nome
                    if (r.name && r.name.includes(':')) {
                        const runeId = r.name;
                        const actualName = runesIdToNameMap.get(runeId) || r.name;
                        const symbol = runesSymbolsMap.get(actualName) || r.symbol || '⧈';
                        
                        console.log(`      🔄 Converting ID ${runeId} → ${actualName} ${symbol}`);
                        
                        return {
                            ...r,
                            name: actualName,
                            symbol: symbol,
                            runeId: runeId
                        };
                    }
                    return r;
                });
                
                // Montar runeInfo com todas as runes
                const runeNames = runesData.map(r => r.name).join(', ');
                const totalAmount = runesData.reduce((sum, r) => sum + parseInt(r.amount || 0), 0);
                
                runeInfo = {
                    name: runesData.length === 1 ? runesData[0].name : `${runesData.length} Runes`,
                    amount: runesData.length === 1 ? runesData[0].amount : totalAmount.toString(),
                    runes: runesData
                };
                
                console.log(`   ✅ 🪙 Found ${runesData.length} rune(s) in OUTPUT ${i}:`, runeNames);
                break;
            }
        }
    }
    
    // 🎯 FALLBACK: Detectar OP_RETURN com Runestone (para PENDING e CONFIRMED)
    // Runestone sempre começa com OP_RETURN (6a) + OP_PUSHNUM_13 (5d)
    if (!isRunesTx) {
        const txStatus = tx.status.confirmed ? 'CONFIRMED' : 'PENDING';
        console.log(`   🔍 TX is ${txStatus} - checking for Runestone in OP_RETURN...`);
        
        for (const vout of tx.vout) {
            const script = vout.scriptpubkey;
            
            // Verificar se é OP_RETURN com Runestone (6a5d = OP_RETURN + OP_PUSHNUM_13)
            if (script && script.startsWith('6a5d')) {
                console.log(`   ✅ Found Runestone OP_RETURN: ${script.substring(0, 20)}...`);
                
                // Marcar como transação de Runes
                isRunesTx = true;
                
                // 🎯 BUSCAR INFO DA RUNE NO CACHE LOCAL ou do runesThumbnailsMap
                let runeName = 'Rune Transfer';
                let runeAmount = '';
                let runeThumbnail = null;
                let runeSymbol = '⧈';
                
                // 1. Tentar pegar do cache de lastSentRune (se disponível)
                if (window.lastSentRune && window.lastSentRune.txid === tx.txid) {
                    runeName = window.lastSentRune.name;
                    runeAmount = window.lastSentRune.amount;
                    runeSymbol = window.lastSentRune.symbol || '⧈';
                    runeThumbnail = window.lastSentRune.thumbnail;
                    console.log(`   📌 Using cached lastSentRune: ${runeName} • ${runeAmount}`);
                } else {
                    // 2. Decode Runestone from OP_RETURN to get Rune ID, then fetch details
                    console.log(`   🔍 Trying to decode Runestone from OP_RETURN...`);
                    try {
                        // Decodificar o Runestone do OP_RETURN
                        const opReturnHex = script;
                        const payload = opReturnHex.substring(6); // Pular 6a5d e length byte
                        
                        // Decodificar LEB128 para extrair Rune ID (block:tx)
                        const buffer = [];
                        for (let i = 0; i < payload.length; i += 2) {
                            buffer.push(parseInt(payload.substring(i, i + 2), 16));
                        }
                        
                        // Função para decodificar LEB128
                        function decodeLEB128(bytes, offset = 0) {
                            let result = 0;
                            let shift = 0;
                            let i = offset;
                            
                            while (i < bytes.length) {
                                const byte = bytes[i++];
                                result |= (byte & 0x7F) << shift;
                                shift += 7;
                                
                                if (!(byte & 0x80)) {
                                    break;
                                }
                            }
                            
                            return { value: result, nextOffset: i };
                        }
                        
                        // Decodificar valores: Tag, Block, TxIndex, Amount, Output
                        let offset = 0;
                        const values = [];
                        while (offset < buffer.length && values.length < 6) {
                            const decoded = decodeLEB128(buffer, offset);
                            values.push(decoded.value);
                            offset = decoded.nextOffset;
                        }
                        
                        const tag = values[0];
                        console.log(`   🏷️  Tag: ${tag} (${tag === 0 ? 'Edicts ✅' : tag === 10 ? 'INVALID (Cenotaph) ⚠️' : 'Unknown'})`);
                        
                        // Determine rune ID based on tag type
                        let runeId = null;
                        
                        if (tag !== 0) {
                            // Cenotaph (burn) - values are shifted
                            console.log(`   ⚠️  CENOTAPH DETECTED! Invalid Tag ${tag} - Runes were BURNED!`);
                            if (values.length >= 4) {
                                runeId = `${values[2]}:${values[3]}`;
                            }
                            runeName = '🔥 Burned Rune';
                            runeSymbol = '🔥';
                        } else if (values.length >= 3) {
                            // Normal transfer - tag 0
                            runeId = `${values[1]}:${values[2]}`;
                        }
                        
                        if (runeId) {
                            console.log(`   🆔 Decoded Rune ID: ${runeId}`);
                            
                            // Try to get rune name from cache first
                            if (runesIdToNameMap.has(runeId)) {
                                const cachedName = runesIdToNameMap.get(runeId);
                                runeName = tag !== 0 ? `🔥 ${cachedName}` : cachedName;
                                runeThumbnail = runesThumbnailsMap.get(cachedName);
                                runeSymbol = tag !== 0 ? '🔥' : (runesSymbolsMap.get(cachedName) || '⧈');
                                console.log(`   ✅ Found in cache: ${runeName} ${runeSymbol}`);
                            } else {
                                // Fetch rune details from backend
                                console.log(`   🔍 Rune ID ${runeId} not in cache, fetching...`);
                                try {
                                    const runeResponse = await fetch(`https://kraywallet-backend.onrender.com/api/rune/${runeId}`, {
                                        method: 'GET',
                                        headers: { 'Accept': 'application/json' },
                                        signal: AbortSignal.timeout(5000)
                                    });
                                    
                                    if (runeResponse.ok) {
                                        const runeData = await runeResponse.json();
                                        if (runeData.success) {
                                            const fetchedName = runeData.name;
                                            runeName = tag !== 0 ? `🔥 ${fetchedName}` : fetchedName;
                                            runeSymbol = tag !== 0 ? '🔥' : (runeData.symbol || '⧈');
                                            runeThumbnail = runeData.thumbnail;
                                            
                                            // Cache it
                                            runesIdToNameMap.set(runeId, fetchedName);
                                            runesSymbolsMap.set(fetchedName, runeData.symbol || '⧈');
                                            if (runeThumbnail) runesThumbnailsMap.set(fetchedName, runeThumbnail);
                                            if (runeData.divisibility !== undefined) {
                                                window.runesDivisibilityMap = window.runesDivisibilityMap || new Map();
                                                window.runesDivisibilityMap.set(fetchedName, runeData.divisibility);
                                            }
                                            console.log(`   ✅ Fetched: ${runeName} ${runeSymbol}`);
                                        }
                                    }
                                } catch (fetchError) {
                                    console.error(`   ❌ Error fetching rune:`, fetchError.message);
                                }
                            }
                            
                            // 🔥 NOW fetch the AMOUNT from explorer (QuickNode has accurate amounts)
                            try {
                                console.log(`   💰 Fetching amount from explorer...`);
                                const txResponse = await fetch(`https://kraywallet-backend.onrender.com/api/explorer/tx/${tx.txid}`, {
                                    method: 'GET',
                                    signal: AbortSignal.timeout(5000)
                                });
                                
                                if (txResponse.ok) {
                                    const txData = await txResponse.json();
                                    if (txData.success && txData.tx && txData.tx.vout) {
                                        for (const vout of txData.tx.vout) {
                                            const enrichment = vout.enrichment;
                                            if (enrichment?.type === 'rune' && enrichment.data?.amount) {
                                                const voutAddress = vout.scriptpubkey_address || vout.scriptPubKey?.address;
                                                const isOurAddress = voutAddress === myAddress;
                                                
                                                // For SENT: use recipient's output (not ours)
                                                // For RECEIVED: use our output
                                                if ((type === 'received' && isOurAddress) || 
                                                    (type === 'sent' && !isOurAddress)) {
                                                    runeAmount = enrichment.data.amount.toString();
                                                    console.log(`   ✅ Amount: ${runeAmount} (${type} to ${voutAddress?.slice(0,12)}...)`);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (amountError) {
                                console.warn(`   ⚠️ Could not fetch amount:`, amountError.message);
                            }
                        }
                    } catch (decodeError) {
                        console.error(`   ❌ Error decoding Runestone:`, decodeError);
                        
                        // Fallback: Se tivermos runes no runesThumbnailsMap, usar a primeira
                        if (runesThumbnailsMap.size > 0) {
                            const firstRune = Array.from(runesThumbnailsMap.keys())[0];
                            runeName = firstRune;
                            runeThumbnail = runesThumbnailsMap.get(firstRune);
                            runeSymbol = runesSymbolsMap.get(firstRune) || '⧈';
                            console.log(`   🎯 Fallback to first rune from thumbnailsMap: ${runeName} ${runeSymbol}`);
                        }
                    }
                }
                
                // Adicionar thumbnail ao map se tiver
                if (runeThumbnail) {
                    runesThumbnailsMap.set(runeName, runeThumbnail);
                }
                
                // Criar dados da rune para array
                runesData = [{
                    name: runeName,
                    amount: runeAmount,
                    symbol: runeSymbol
                }];
                
                runeInfo = {
                    name: runeName,
                    amount: runeAmount,
                    runes: runesData
                };
                
                console.log(`   🪙 Detected ${txStatus} Runes transaction: ${runeName}`);
                break;
            }
        }
    }
    
    // ==========================================
    // 🎨 RENDERIZAR UI
    // ==========================================
    
    if (isInscriptionTx) {
        // ✅ TRANSAÇÃO DE INSCRIPTION (com thumbnail e detalhes)
        item.classList.add('inscription-tx');
        item.style.minHeight = '80px';
        
        // Thumbnail da inscription
        const thumbnail = document.createElement('div');
        thumbnail.className = 'activity-thumbnail';
        thumbnail.style.cssText = `
            width: 60px;
            height: 60px;
            border-radius: 8px;
            background: #1a1a1a;
            overflow: hidden;
            flex-shrink: 0;
            margin-right: 12px;
        `;
        
        const contentUrl = `https://kraywallet-backend.onrender.com/api/rune-thumbnail/${inscription.inscriptionId}`;
        thumbnail.innerHTML = `<img src="${contentUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◉</text></svg>'">`;
        
        // Info
        const info = document.createElement('div');
        info.className = 'activity-info';
        info.style.flex = '1';
        
        // Título
        const title = document.createElement('div');
        title.className = 'activity-title';
        title.style.fontWeight = '600';
        title.style.fontSize = '13px'; // Reduzir 1px para caber melhor
        title.style.lineHeight = '1.2';
        
        if (type === 'received') {
            title.innerHTML = '<span style="white-space: nowrap;">📥 <span style="color: #00ff88;">Received</span> <span style="color: #9333ea;">Inscription</span></span>';
        } else if (type === 'sent') {
            title.innerHTML = '<span style="white-space: nowrap;">📤 <span style="color: #ff6b6b;">Sent</span> <span style="color: #9333ea;">Inscription</span></span>';
        } else {
            title.innerHTML = '<span style="white-space: nowrap;">◉ <span style="color: #9333ea;">Inscription</span> Transaction</span>';
        }
        
        // TAG: Número da Inscription
        const inscIdEl = document.createElement('div');
        inscIdEl.className = 'activity-inscription-id';
        inscIdEl.style.cssText = `
            font-size: 11px;
            color: #f59e0b;
            margin-top: 4px;
            font-weight: 600;
        `;
        // ✅ SEMPRE mostrar número (buscar se necessário)
        console.log(`🔍 Inscription data:`, inscription);
        
        const inscriptionNum = inscription.inscriptionNumber || 
                              inscription.inscription_number || 
                              inscription.number;
        
        console.log(`🔍 Inscription number found:`, inscriptionNum);
        
        if (inscriptionNum && inscriptionNum !== 'Pending') {
            inscIdEl.textContent = `#${inscriptionNum}`;
            console.log(`   ✅ Showing number: #${inscriptionNum}`);
        } else {
            // Não tem número - mostrar loading e buscar
            inscIdEl.textContent = `#...`;
            inscIdEl.style.opacity = '0.7';
            
            console.warn(`   ⚠️  No inscription number! Fetching now...`);
            
            // Buscar AGORA (não async) - garantir que aparece
            const inscId = inscription.id || inscription.inscriptionId;
            
            if (inscId) {
                console.log(`   📡 Fetching number for ${inscId.substring(0, 16)}...`);
                
                (async () => {
                    try {
                        const response = await fetch(`https://kraywallet-backend.onrender.com/api/explorer/inscription/${inscId}`);
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            // /api/explorer/inscription retorna { inscription: {...} }
                            const inscData = data.inscription || data;
                            const number = inscData.number || inscData.inscriptionNumber || inscData.inscription_number;
                            
                            if (number) {
                                inscIdEl.textContent = `#${number}`;
                                inscIdEl.style.opacity = '1';
                                console.log(`   ✅ Got number: #${number}`);
                                
                                // Atualizar objeto também
                                inscription.number = number;
                                inscription.inscriptionNumber = number;
                            } else {
                                console.error(`   ❌ API returned no number`);
                                inscIdEl.textContent = `#?`;
                            }
                        } else {
                            console.error(`   ❌ API error ${response.status}`);
                            inscIdEl.textContent = `#?`;
                        }
                    } catch (error) {
                        console.error(`   ❌ Fetch failed:`, error);
                        inscIdEl.textContent = `#?`;
                    }
                })();
            } else {
                console.error(`   ❌ No inscription ID to fetch!`);
                inscIdEl.textContent = `#?`;
            }
        }
        
        // Address
        const addressEl = document.createElement('div');
        addressEl.className = 'activity-address';
        addressEl.style.fontSize = '12px';
        addressEl.style.color = '#666';
        addressEl.style.marginTop = '4px';
        
        if (otherAddress) {
            const prefix = type === 'received' ? 'From: ' : 'To: ';
            addressEl.textContent = prefix + (otherAddress.slice(0, 10) + '...' + otherAddress.slice(-6));
        } else {
            addressEl.textContent = 'Internal Transfer';
        }
        
        // Meta (data e status)
        const meta = document.createElement('div');
        meta.className = 'activity-meta';
        meta.style.fontSize = '11px';
        meta.style.color = '#888';
        meta.style.marginTop = '4px';
        
        let timeAgo = 'Just now';
        if (tx.status.block_time) {
            const date = new Date(tx.status.block_time * 1000);
            timeAgo = getTimeAgo(date);
        }
        
        const confirmations = tx.status.confirmed ? '✓ Confirmed' : '⏳ Pending';
        meta.textContent = `${timeAgo} • ${confirmations}`;
        
        info.appendChild(title);
        info.appendChild(inscIdEl);
        info.appendChild(addressEl);
        info.appendChild(meta);
        
        // Amount (UTXO value + possível inscription price)
        const amountEl = document.createElement('div');
        amountEl.className = 'activity-amount';
        amountEl.style.textAlign = 'right';
        amountEl.style.marginLeft = '8px';
        
        const sign = type === 'received' ? '+' : type === 'sent' ? '-' : '';
        const color = type === 'received' ? '#00ff88' : type === 'sent' ? '#ff6b6b' : '#888';
        
        // UTXO value (inscription sat value)
        const inscriptionValue = inscription.outputValue || inscription.utxo?.value || 600;
        
        amountEl.innerHTML = `
            <div style="color: ${color}; font-weight: 600; font-size: 14px;">${sign}${inscriptionValue} <span style="font-size: 11px; font-weight: 400;">sats</span></div>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">UTXO Value</div>
        `;
        
        // TODO: Se tivéssemos o preço de venda do marketplace, mostraríamos aqui
        // Por exemplo: "Sold for: 10,000 sats"
        
        // Montar item
        item.appendChild(thumbnail);
        item.appendChild(info);
        item.appendChild(amountEl);
        
        // Adicionar borda especial se pending
        if (!tx.status.confirmed) {
            item.style.opacity = '0.8';
            item.style.border = '1px solid rgba(255, 193, 7, 0.4)';
            item.style.background = 'rgba(255, 193, 7, 0.02)';
        }
        
    } else {
        // ✅ TRANSAÇÃO NORMAL DE BITCOIN OU RUNES (sem inscription)
        
        // Ícone ou Thumbnail (para Runes)
        const icon = document.createElement('div');
        icon.className = 'activity-icon';
        
        if (isRunesTx && runesData && runesData.length > 0) {
            // Para RUNES: Mostrar thumbnail do parent (igual às inscriptions)
            
            // Verificar se é Cenotaph (runes queimadas)
            const isCenotaph = runeInfo && runeInfo.name && runeInfo.name.startsWith('🔥');
            
            icon.style.cssText = `
                width: 50px;
                height: 50px;
                border-radius: 8px;
                background: #1a1a1a;
                overflow: hidden;
                flex-shrink: 0;
                margin-right: 12px;
                border: 1.5px solid ${isCenotaph ? '#ff4444' : '#f59e0b'};
            `;
            
            // 🔥 Se for BURNED (Cenotaph), mostrar caixão
            if (isCenotaph) {
                icon.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; background: linear-gradient(135deg, rgba(255, 68, 68, 0.3), rgba(139, 0, 0, 0.2));">⚰️</div>`;
            } else {
                // Buscar thumbnail da primeira rune
                const firstRune = runesData[0];
                const runeName = firstRune.name;
                const runeSymbol = firstRune.symbol || '⧈';
                const thumbnailUrl = runesThumbnailsMap.get(runeName);
                
                if (thumbnailUrl) {
                    // ✅ Mostrar SOMENTE thumbnail real do parent (sem fallback emoji)
                    icon.innerHTML = `<img src="${thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover; background: #1a1a1a;" onerror="this.style.background='linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(251, 191, 36, 0.1))';">`;
                } else {
                    // Fallback: Se não tem thumbnail, mostrar placeholder neutro (não emoji)
                    icon.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #f59e0b; background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(251, 191, 36, 0.1));">🪙</div>`;
                }
            }
            
        } else {
            // Para BTC normal: Ícone circular
            icon.style.cssText = `
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                flex-shrink: 0;
                margin-right: 12px;
            `;
            
            if (type === 'received') {
                icon.innerHTML = '<span style="color: #00ff88;">↓</span>';
                icon.style.background = 'rgba(0, 255, 136, 0.1)';
            } else if (type === 'sent') {
                icon.innerHTML = '<span style="color: #ff6b6b;">↑</span>';
                icon.style.background = 'rgba(255, 107, 107, 0.1)';
            } else {
                icon.innerHTML = '<span style="color: #888;">↔</span>';
                icon.style.background = 'rgba(136, 136, 136, 0.1)';
            }
        }
        
        // Info
        const info = document.createElement('div');
        info.className = 'activity-info';
        info.style.flex = '1';
        
        // Título
        const title = document.createElement('div');
        title.className = 'activity-title';
        title.style.fontWeight = '600';
        
        if (isRunesTx) {
            // Transação de RUNES - verificar se é Cenotaph (queimada)
            const isCenotaph = runeInfo && runeInfo.name && runeInfo.name.startsWith('🔥');
            
            if (isCenotaph) {
                // Cenotaph: Runes foram queimadas acidentalmente
                title.innerHTML = '🔥 <span style="color: #ff6b6b;">Runes BURNED (Cenotaph)</span>';
            } else if (type === 'received') {
                title.innerHTML = '📥 <span style="color: #00ff88;">Received Runes</span>';
            } else if (type === 'sent') {
                title.innerHTML = '📤 <span style="color: #ff6b6b;">Sent Runes</span>';
            } else {
                title.textContent = 'Runes Transaction';
            }
        } else {
            // Transação normal de Bitcoin - SEM TAG
            if (type === 'received') {
                title.innerHTML = '📥 <span style="color: #00ff88;">Received</span>';
            } else if (type === 'sent') {
                title.innerHTML = '📤 <span style="color: #ff6b6b;">Sent</span>';
            } else {
                title.textContent = 'Transaction';
            }
        }
        
        info.appendChild(title);
        
        // Se for Runes, adicionar info da Rune logo após o título
        if (isRunesTx && runeInfo) {
            const runeInfoEl = document.createElement('div');
            runeInfoEl.style.cssText = `
                font-size: 12px;
                margin-top: 4px;
                font-weight: 600;
            `;
            
            // Formatar display: Nome (branco) + Amount (verde) + Symbol (grande)
            let displayHTML = `<span style="color: #fff;">${runeInfo.name}</span>`;
            
            if (runeInfo.amount && runeInfo.amount !== '') {
                // Buscar divisibility do map
                const divisibility = (window.runesDivisibilityMap && window.runesDivisibilityMap.get(runeInfo.name)) || 0;
                const formattedAmount = formatRuneAmount(runeInfo.amount, divisibility);
                
                // Symbol ao lado do amount
                const symbol = (runesData && runesData.length > 0 && runesData[0].symbol) || '⧈';
                
                displayHTML += ` <span style="color: #888;">•</span> <span style="color: #10b981;">${formattedAmount} ${symbol}</span>`;
            }
            
            runeInfoEl.innerHTML = displayHTML;
            info.appendChild(runeInfoEl);
        }
        
        const addressEl = document.createElement('div');
        addressEl.className = 'activity-address';
        addressEl.style.fontSize = '12px';
        addressEl.style.color = '#666';
        addressEl.style.marginTop = '4px';
        
        if (otherAddress) {
            const prefix = type === 'received' ? 'From: ' : 'To: ';
            addressEl.textContent = prefix + (otherAddress.slice(0, 12) + '...' + otherAddress.slice(-8));
        } else {
            addressEl.textContent = 'Internal';
        }
        
        // Data e confirmações
        const meta = document.createElement('div');
        meta.className = 'activity-meta';
        meta.style.fontSize = '11px';
        meta.style.color = '#888';
        meta.style.marginTop = '4px';
        
        let timeAgo = 'Just now';
        if (tx.status.block_time) {
            const date = new Date(tx.status.block_time * 1000);
            timeAgo = getTimeAgo(date);
        }
        
        const confirmations = tx.status.confirmed ? '✓ Confirmed' : '⏳ Pending';
        meta.textContent = `${timeAgo} • ${confirmations}`;
        
        // Adicionar classe pending se não confirmado
        if (!tx.status.confirmed) {
            item.classList.add('pending-tx');
            item.style.opacity = '0.7';
            item.style.border = '1px solid rgba(255, 193, 7, 0.3)';
        }
        
        info.appendChild(addressEl);
        info.appendChild(meta);
        
        // Amount
        const amountEl = document.createElement('div');
        amountEl.className = 'activity-amount';
        amountEl.style.textAlign = 'right';
        amountEl.style.marginLeft = '8px';
        
        const sign = type === 'received' ? '+' : type === 'sent' ? '-' : '';
        const color = type === 'received' ? '#00ff88' : type === 'sent' ? '#ff6b6b' : '#888';
        
        amountEl.innerHTML = `
            <span style="color: ${color}; font-weight: 600;">${sign}${amount.toLocaleString()}</span>
            <span style="font-size: 12px; color: #666;"> sats</span>
        `;
        
        // Montar item
        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(amountEl);
    }
    
    // Click handler: abrir no explorador apropriado
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
        // 🚀 KRAYSCAN - Nosso explorador próprio!
        const url = `https://kraywallet-backend.onrender.com/krayscan.html?txid=${tx.txid}`;
        console.log(`🔗 Opening TX in KrayScan: ${url}`);
        chrome.tabs.create({ url });
    });
    
    return item;
}

// Helper: Time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    
    return date.toLocaleDateString();
}

// ============================================================================
// ANALYTICS TRACKING
// ============================================================================

async function trackUserAction(address, actionType, actionData = {}) {
    try {
        const API_URL = 'https://kraywallet-backend.onrender.com/api';
        
        const response = await fetch(`${API_URL}/analytics/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: address,
                action_type: actionType,
                action_data: actionData,
                offer_id: actionData.offer_id || null,
                inscription_id: actionData.inscription_id || null,
                rune_id: actionData.rune_id || null,
                amount: actionData.amount || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`✅ Tracked action: ${actionType}`, data);
        }
        
        return data;
    } catch (error) {
        console.warn('⚠️  Failed to track action:', error.message);
        // Não bloquear a UI se o tracking falhar
        return null;
    }
}

// Load Wallet Data
async function loadWalletData() {
    try {
        console.log('📊 Loading wallet data...');
        
        // 🔥 VERIFICAR REDE PRIMEIRO - antes de carregar qualquer coisa
        const activeNetworkResult = await chrome.storage.local.get(['activeNetwork']);
        const isKrayL2 = activeNetworkResult.activeNetwork === 'kray-l2';
        
        console.log(`📡 Current network: ${activeNetworkResult.activeNetwork || 'mainnet'}`);
        
        const response = await chrome.runtime.sendMessage({
            action: 'getWalletInfo'
        });
        
        console.log('📨 Wallet info response:', response);
        
        if (response && response.success) {
            const { address, balance } = response.data;
            
            // 📊 Track wallet open
            trackUserAction(address, 'wallet_open', {
                balance: balance
            });
            
            console.log('✅ Address:', address);
            console.log('✅ Balance:', balance);
            
            // Atualizar UI com verificação
            const walletAddressEl = document.getElementById('wallet-address');
            if (walletAddressEl) {
                walletAddressEl.textContent = address.slice(0, 12) + '...' + address.slice(-8);
                walletAddressEl.setAttribute('data-full-address', address); // Guardar endereço completo
            }
            
            const receiveAddressEl = document.getElementById('receive-address');
            if (receiveAddressEl) {
                receiveAddressEl.textContent = address;
            }
            
            // 🔥 SÓ MOSTRAR BALANCE DO MAINNET SE NÃO ESTIVER EM L2!
            if (!isKrayL2) {
                const balanceEl = document.getElementById('wallet-balance');
                if (balanceEl) {
                    balanceEl.textContent = balance.total.toLocaleString() + ' sats';
                }
                
                const balanceBtcEl = document.getElementById('wallet-balance-btc');
                if (balanceBtcEl) {
                    balanceBtcEl.textContent = (balance.total / 100000000).toFixed(8) + ' BTC';
                }
            }
            
            // Gerar QR Code para o endereço
            generateQRCode(address);
            
            // 🔥 SE ESTIVER EM L2, CARREGAR L2 DATA E APLICAR SWITCH
            if (isKrayL2) {
                console.log('⚡ Starting in KRAY L2 mode - loading L2 data...');
                
                // Register showScreen first
                if (window.krayL2 && typeof window.krayL2.setShowScreen === 'function') {
                    window.krayL2.setShowScreen(showScreen);
                }
                
                // Apply L2 network switch (hide mainnet UI, show L2 UI)
                await switchNetwork('kray-l2');
                
            } else {
                // Carregar Ordinals, Runes e Activity (só no mainnet)
                await loadOrdinals(address);
                await loadRunes(address);
                await loadActivity(address);
                
                // ⚡ Pre-load L2 data in background (without updating UI!)
                if (window.krayL2) {
                    // Register showScreen first
                    if (typeof window.krayL2.setShowScreen === 'function') {
                        window.krayL2.setShowScreen(showScreen);
                    }
                    // Load L2 data in background (updateUI = false to prevent overwriting mainnet balance!)
                    if (typeof window.krayL2.loadL2Data === 'function') {
                        window.krayL2.loadL2Data(false).catch(e => console.warn('L2 preload error:', e));
                    }
                }
            }
            
            console.log('✅ Wallet data loaded successfully');
            
            // Garantir que event listeners estão vinculados
            console.log('🔗 Re-binding event listeners after data load...');
            rebindWalletButtons();
        } else {
            console.error('❌ Failed to get wallet info:', response?.error);
            showNotification(response?.error || 'Failed to load wallet', 'error');
        }
    } catch (error) {
        console.error('❌ Error loading wallet data:', error);
        showNotification('Error loading wallet: ' + error.message, 'error');
    }
}

// Gerar QR Code
function generateQRCode(address) {
    try {
        console.log('🔲 Generating QR Code for address:', address);
        
        const qrContainer = document.getElementById('qr-code');
        
        if (!qrContainer) {
            console.warn('⚠️  QR Code container not found');
            return;
        }
        
        // Limpar conteúdo anterior
        qrContainer.innerHTML = '<div class="qr-placeholder">⏳ Loading...</div>';
        
        // Criar imagem do QR Code usando API gratuita
        const qrImg = document.createElement('img');
        
        // API 1: QRServer.com (mais rápida)
        // Formato: bitcoin:ADDRESS para wallets reconhecerem automaticamente
        const qrUrl1 = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=bitcoin:${address}`;
        
        // API 2: Quickchart.io (fallback)
        const qrUrl2 = `https://quickchart.io/qr?text=bitcoin:${address}&size=200`;
        
        qrImg.src = qrUrl1;
        qrImg.alt = 'QR Code';
        qrImg.style.width = '200px';
        qrImg.style.height = '200px';
        qrImg.style.borderRadius = '8px';
        qrImg.style.display = 'block';
        
        // Sucesso ao carregar
        qrImg.onload = () => {
            console.log('✅ QR Code loaded successfully');
            qrContainer.innerHTML = '';
            qrContainer.appendChild(qrImg);
        };
        
        // Se falhar, tentar API alternativa
        qrImg.onerror = () => {
            console.log('⚠️  Primary QR API failed, trying alternative...');
            
            const qrImgFallback = document.createElement('img');
            qrImgFallback.src = qrUrl2;
            qrImgFallback.alt = 'QR Code';
            qrImgFallback.style.width = '200px';
            qrImgFallback.style.height = '200px';
            qrImgFallback.style.borderRadius = '8px';
            qrImgFallback.style.display = 'block';
            
            qrImgFallback.onload = () => {
                console.log('✅ QR Code loaded from fallback API');
                qrContainer.innerHTML = '';
                qrContainer.appendChild(qrImgFallback);
            };
            
            qrImgFallback.onerror = () => {
                console.error('❌ All QR APIs failed');
                qrContainer.innerHTML = '<div class="qr-placeholder">❌ Failed to load</div>';
            };
        };
        
    } catch (error) {
        console.error('❌ Error generating QR Code:', error);
        const qrContainer = document.getElementById('qr-code');
        qrContainer.innerHTML = '<div class="qr-placeholder">❌ Error</div>';
    }
}

// Load Ordinals (Inscriptions)
async function loadOrdinals(address) {
    const container = document.getElementById('ordinals-list');
    
    if (!container) {
        console.error('❌ ordinals-list container not found!');
        return;
    }
    
    // 🔄 SEMPRE mostrar loading primeiro
    container.innerHTML = `
        <div class="loading-container">
            <img src="../assets/logo.png" alt="MyWallet" class="logo-medium" />
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading inscriptions...</p>
        </div>
    `;
    
    // 💾 VERIFICAR CACHE PRIMEIRO
    if (isCacheValid('ordinals')) {
        console.log('⚡ Using cached ordinals data (saved API call & energy)');
        const cachedData = dataCache.ordinals.data;
        
        if (cachedData && cachedData.length > 0) {
            container.innerHTML = '';
            cachedData.forEach(inscription => {
                const item = createOrdinalItem(inscription);
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">◉</span><p>No inscriptions yet</p></div>';
        }
        return;
    }
    
    try {
        console.log('═══════════════════════════════════════════════════');
        console.log('🔧 POPUP.JS VERSION: 2024-FIXED-MULTIPLE-CALLS ✅');
        console.log('═══════════════════════════════════════════════════');
        console.log('🖼️  Loading ordinals for address:', address);
        
        // Buscar inscriptions via API
        const response = await chrome.runtime.sendMessage({
            action: 'getInscriptions',
            data: { address }
        });
        
        console.log('📦 Inscriptions response:', response);
        console.log('   response.success:', response?.success);
        console.log('   response.inscriptions:', response?.inscriptions);
        console.log('   inscriptions.length:', response?.inscriptions?.length);
        
        if (response && response.success && response.inscriptions && response.inscriptions.length > 0) {
            console.log(`✅ Found ${response.inscriptions.length} inscriptions`);
            
            // 💾 SALVAR NO CACHE
            dataCache.ordinals.data = response.inscriptions;
            dataCache.ordinals.timestamp = Date.now();
            dataCache.ordinals.loaded = true;
            console.log('💾 Ordinals cached for 5 minutes');
            
            container.innerHTML = '';
            
            response.inscriptions.forEach(inscription => {
                console.log('   Creating container for:', inscription.id);
                const item = createOrdinalItem(inscription);
                container.appendChild(item);
            });
            
            console.log('✅ All containers created!');
        } else {
            console.log('ℹ️  No inscriptions found - Reason:');
            console.log('   response exists?', !!response);
            console.log('   response.success?', response?.success);
            console.log('   response.inscriptions exists?', !!response?.inscriptions);
            console.log('   inscriptions.length > 0?', (response?.inscriptions?.length || 0) > 0);
            
            // 💾 SALVAR CACHE VAZIO
            dataCache.ordinals.data = [];
            dataCache.ordinals.timestamp = Date.now();
            dataCache.ordinals.loaded = true;
            
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">◉</span><p>No inscriptions yet</p></div>';
        }
    } catch (error) {
        console.error('❌ Error loading ordinals:', error);
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><p>Failed to load inscriptions</p></div>';
    }
}

/**
 * Load Inscription Buttons State (verificar se está listado e mostrar botões corretos)
 */
async function loadInscriptionButtonsState(inscription, buttonsContainer) {
    try {
        // Buscar wallet address
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        const address = result?.data?.address || walletState.address;
        
        if (!address) {
            // Sem wallet, mostrar botões padrão desabilitados
            buttonsContainer.innerHTML = '<p style="color: #888; font-size: 11px; text-align: center;">Connect wallet</p>';
            return;
        }
        
        // Marketplace disabled in production - show default buttons directly
        // const response = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/?seller_address=${address}`);
        // const data = await response.json();
        const data = { listings: [] }; // No listings in production
        
        // Verificar se esta inscrição está listada
        const activeListing = data.listings?.find(listing => 
            listing.inscription_id === inscription.id &&
            (listing.status === 'PENDING_SIGNATURES' || listing.status === 'OPEN')
        );
        
        if (activeListing) {
            // ✅ LISTADO - Mostrar botões "Change Price" e "Cancel"
            buttonsContainer.innerHTML = '';
            
            // Badge "Listed"
            const badge = document.createElement('div');
            badge.style.cssText = `
                width: 100%;
                padding: 6px 8px;
                background: rgba(76, 175, 80, 0.1);
                border: 1px solid #4CAF50;
                border-radius: 6px;
                margin-bottom: 8px;
                text-align: center;
            `;
            badge.innerHTML = `<span style="color: #4CAF50; font-size: 10px; font-weight: 600;">✅ LISTED: ${activeListing.price_sats.toLocaleString()} sats</span>`;
            buttonsContainer.appendChild(badge);
            
            // Botão: Change Price (se PENDING_SIGNATURES)
            if (activeListing.status === 'PENDING_SIGNATURES') {
                const changePriceBtn = document.createElement('button');
                changePriceBtn.innerHTML = '💰 Change Price';
                changePriceBtn.style.cssText = `
                    flex: 1;
                    padding: 8px 12px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                `;
                changePriceBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showUpdatePriceModal(activeListing);
                });
                buttonsContainer.appendChild(changePriceBtn);
            }
            
            // Botão: Cancel Listing
            const cancelBtn = document.createElement('button');
            cancelBtn.innerHTML = '❌ Cancel';
            cancelBtn.style.cssText = `
                flex: 1;
                padding: 8px 12px;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
            `;
            cancelBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Vai direto para assinatura (sem confirm)
                await cancelAtomicListing(activeListing.order_id);
                // Recarregar ordinals após cancelar
                await loadOrdinals();
            });
            buttonsContainer.appendChild(cancelBtn);
            
        } else {
            // ❌ NÃO LISTADO - Mostrar botões "List" e "Send" normais
            buttonsContainer.innerHTML = '';
            
            // Botão: List
            const listBtn = document.createElement('button');
            listBtn.innerHTML = '🛒 List';
            listBtn.style.cssText = `
                flex: 1;
                padding: 10px 16px;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
            `;
            listBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showListMarketModal(inscription);
            });
            buttonsContainer.appendChild(listBtn);
            
            // Botão: Send
            const sendBtn = document.createElement('button');
            sendBtn.innerHTML = '📤 Send';
            sendBtn.style.cssText = `
                flex: 1;
                padding: 10px 16px;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
            `;
            sendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showSendInscriptionScreen(inscription);
            });
            buttonsContainer.appendChild(sendBtn);
        }
        
    } catch (error) {
        console.error('❌ Error loading buttons state:', error);
        // Fallback: mostrar botões padrão
        buttonsContainer.innerHTML = '<p style="color: #ef4444; font-size: 10px; text-align: center;">Error loading</p>';
    }
}

// Create Ordinal Item
function createOrdinalItem(inscription) {
    const item = document.createElement('div');
    item.className = 'ordinal-item';
    
    const preview = document.createElement('div');
    preview.className = 'ordinal-preview';
    
    // Determinar URL do conteúdo - Usar ORD local se disponível, senão ordinals.com
    const contentUrl = inscription.preview || `https://ordinals.com/content/${inscription.id}`;
    const contentType = (inscription.content_type || '').toLowerCase();
    
    console.log('🎨 Creating ordinal item:', {
        id: inscription.id,
        number: inscription.number,
        type: contentType,
        url: contentUrl
    });
    
    // ✅ SUPORTE COMPLETO PARA TODOS OS TIPOS DE CONTEÚDO
    
    // ⚠️ FALLBACK UNIVERSAL: Se content_type for 'unknown' ou vazio, SEMPRE tentar carregar como imagem primeiro!
    const isUnknown = !contentType || contentType === 'unknown' || contentType === '';
    
    // 1. IMAGENS (png, jpeg, jpg, webp, avif, gif, svg, bmp) OU UNKNOWN
    if (isUnknown || 
        contentType.includes('image/') || 
        contentType.includes('png') || 
        contentType.includes('jpeg') || 
        contentType.includes('jpg') || 
        contentType.includes('webp') || 
        contentType.includes('avif') || 
        contentType.includes('gif') || 
        contentType.includes('svg') ||
        contentType.includes('bmp')) {
        
        const img = document.createElement('img');
        img.src = contentUrl;
        img.alt = `Inscription #${inscription.number}`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        
        img.onload = () => {
            preview.style.background = 'transparent';
            console.log('✅ Image loaded:', contentUrl);
        };
        
        img.onerror = () => {
            console.error('❌ Image failed to load, trying iframe fallback:', contentUrl);
            
            // FALLBACK: Tentar carregar em iframe (funciona para HTML/inscriptions complexas)
            preview.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.src = contentUrl;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '8px';
            iframe.style.background = '#1a1a1a';
            
            // Se iframe também falhar, mostrar link direto
            iframe.onerror = () => {
                console.error('❌ Iframe also failed, showing link');
                preview.innerHTML = `
                    <a href="${contentUrl}" target="_blank" style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        height: 100%;
                        text-decoration: none;
                        color: #888;
                    ">
                        <span style="font-size: 32px;">◉</span>
                        <span style="font-size: 10px; margin-top: 8px;">Click to view</span>
                    </a>
                `;
            };
            
            preview.appendChild(iframe);
        };
        
        preview.appendChild(img);
    }
    // 2. VÍDEOS (mp4, webm, ogg)
    else if (contentType.includes('video/') || 
             contentType.includes('mp4') || 
             contentType.includes('webm') || 
             contentType.includes('ogg')) {
        
        const video = document.createElement('video');
        video.src = contentUrl;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.borderRadius = '8px';
        video.controls = true;
        video.muted = true;
        video.autoplay = false;
        
        preview.appendChild(video);
    }
    // 3. HTML/TEXT
    else if (contentType.includes('html') || contentType.includes('text/html')) {
        
        const iframe = document.createElement('iframe');
        iframe.src = contentUrl;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        
        preview.appendChild(iframe);
    }
    // 4. TEXTO (text/plain, json, etc)
    else if (contentType.includes('text/')) {
        
        const textPreview = document.createElement('div');
        textPreview.style.padding = '12px';
        textPreview.style.fontSize = '10px';
        textPreview.style.fontFamily = 'monospace';
        textPreview.style.overflow = 'hidden';
        textPreview.style.textOverflow = 'ellipsis';
        textPreview.style.whiteSpace = 'pre-wrap';
        textPreview.style.maxHeight = '100%';
        textPreview.textContent = '📄 Text content';
        
        preview.appendChild(textPreview);
    }
    // 5. ÁUDIO (mp3, wav, ogg)
    else if (contentType.includes('audio/') || 
             contentType.includes('mp3') || 
             contentType.includes('wav')) {
        
        preview.innerHTML = '<span style="font-size: 32px;">🎵</span>';
        preview.style.display = 'flex';
        preview.style.alignItems = 'center';
        preview.style.justifyContent = 'center';
        
        const audio = document.createElement('audio');
        audio.src = contentUrl;
        audio.controls = true;
        audio.style.width = '90%';
        audio.style.marginTop = '8px';
        preview.appendChild(audio);
    }
    // 6. FALLBACK - Mostrar ícone genérico
    else {
        console.log('⚠️  Unknown content type, using fallback icon');
        preview.innerHTML = '<span style="font-size: 32px;">📦</span>';
        preview.style.display = 'flex';
        preview.style.alignItems = 'center';
        preview.style.justifyContent = 'center';
    }
    
    const info = document.createElement('div');
    info.className = 'ordinal-info';
    info.style.cssText = `
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;
    
    // ✨ LINHA 1: Inscription Number (destaque)
    const number = document.createElement('div');
    number.className = 'ordinal-number';
    number.style.cssText = `
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: 2px;
    `;
    number.textContent = `Inscription #${inscription.number || '?'}`;
    
    // ⏰ BADGE "PENDING" se a inscription ainda não foi indexada pela API
    if (inscription.pending) {
        const pendingBadge = document.createElement('span');
        pendingBadge.style.cssText = `
            display: inline-block;
            margin-left: 8px;
            padding: 2px 8px;
            background: #ff9800;
            color: white;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 600;
            vertical-align: middle;
        `;
        pendingBadge.textContent = '⏰ Pending';
        pendingBadge.title = 'Awaiting blockchain confirmation';
        number.appendChild(pendingBadge);
    }
    
    // 🌟 SAT RARITY BADGE - Detect and show rare sat indicator
    if (inscription.sat && typeof SatRarity !== 'undefined') {
        const rarity = SatRarity.detect(inscription.sat);
        if (rarity && rarity.isRare) {
            const rarityBadge = document.createElement('span');
            rarityBadge.style.cssText = `
                display: inline-block;
                margin-left: 6px;
                padding: 2px 6px;
                background: ${rarity.primaryColor}20;
                color: ${rarity.primaryColor};
                border: 1px solid ${rarity.primaryColor}40;
                border-radius: 8px;
                font-size: 9px;
                font-weight: 600;
                vertical-align: middle;
                cursor: help;
            `;
            rarityBadge.textContent = rarity.rarities.slice(0, 2).map(r => r.emoji).join('');
            rarityBadge.title = rarity.description;
            number.appendChild(rarityBadge);
        }
    }
    
    // ✨ LINHA 2: Value (sats) - ao invés de content_type
    const valueDiv = document.createElement('div');
    valueDiv.className = 'ordinal-value';
    valueDiv.style.cssText = `
        font-size: 11px;
        color: #4CAF50;
        font-weight: 500;
    `;
    const satsValue = inscription.outputValue || inscription.value || 600; // ✅ Use real UTXO value from backend!
    console.log(`🔍 Creating ordinal item #${inscription.number}: outputValue=${inscription.outputValue}, value=${inscription.value}, using=${satsValue}`);
    valueDiv.textContent = `UTXO: ${satsValue.toLocaleString()} sats`;
    
    // ✨ LINHA 3: ID truncado (small)
    const id = document.createElement('div');
    id.className = 'ordinal-id';
    id.style.cssText = `
        font-size: 9px;
        color: var(--color-text-secondary);
        font-family: monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;
    const fullId = inscription.id || 'Unknown ID';
    id.textContent = fullId.length > 24 ? fullId.substring(0, 12) + '...' + fullId.substring(fullId.length - 8) : fullId;
    id.title = fullId; // Tooltip com ID completo
    
    info.appendChild(number);
    info.appendChild(valueDiv);
    info.appendChild(id);
    
    item.appendChild(preview);
    item.appendChild(info);
    
    // ✅ CONTAINER DE BOTÕES (embaixo da info - dois botões lado a lado)
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        padding: 8px 12px;
        padding-top: 4px;
        display: flex;
        gap: 8px;
        border-top: 1px solid var(--color-border);
    `;
    
    // 🔍 VERIFICAR SE ESTÁ LISTADO (carregar dinamicamente - async)
    (async () => {
        await loadInscriptionButtonsState(inscription, buttonsContainer);
    })();
    
    item.appendChild(buttonsContainer);
    
    // Click handler do card (mostrar detalhes internos)
    item.addEventListener('click', () => {
        showInscriptionDetails(inscription);
    });
    
    // Tornar o item posicionável para o botão absoluto
    item.style.position = 'relative';
    
    return item;
}

// Show Send Inscription Screen
async function showSendInscriptionScreen(inscription) {
    console.log('📤 Opening send inscription screen for:', inscription.id);
    
    // Esconder todas as screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    
    // Mostrar tela de envio
    const sendInscriptionScreen = document.getElementById('send-inscription-screen');
    if (sendInscriptionScreen) {
        sendInscriptionScreen.classList.remove('hidden');
        
        // Preencher detalhes da inscription (agora é async)
        await populateSendInscriptionForm(inscription);
        
        // Verificar se o botão existe
        const confirmBtn = document.getElementById('send-inscription-confirm-btn');
        console.log('   🔍 Confirm button found:', !!confirmBtn);
        console.log('   🔍 Button has click listener:', confirmBtn?._clickListener ? 'YES' : 'NO');
    } else {
        console.error('❌ Send inscription screen not found!');
    }
}

// Populate Send Inscription Form
async function populateSendInscriptionForm(inscription) {
    console.log('📋 Populating form with inscription:', inscription);
    
    // ✅ CONVERTER OUTPUT PARA UTXO (backend retorna "output": "txid:vout")
    if (!inscription.utxo || !inscription.utxo.txid) {
        console.log('   🔄 Converting output to UTXO format...');
        
        if (inscription.output) {
            const parts = inscription.output.split(':');
            if (parts.length >= 2) {
                inscription.utxo = {
                    txid: parts[0],
                    vout: parseInt(parts[1]),
                    value: inscription.outputValue || inscription.value || 600
                };
                console.log('   ✅ UTXO created from output:', inscription.utxo);
            }
        } else {
            console.error('   ❌ Inscription has no output/utxo!', inscription);
        }
    }
    
    // Preview da inscription
    const previewEl = document.getElementById('send-inscription-preview');
    if (previewEl) {
        const contentUrl = inscription.preview || `https://ordinals.com/content/${inscription.id}`;
        previewEl.innerHTML = `<img src="${contentUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◉</text></svg>'">`;
    }
    
    // Inscription ID
    const inscIdEl = document.getElementById('send-inscription-id');
    if (inscIdEl) {
        inscIdEl.textContent = `#${inscription.number || '?'}`;
    }
    
    // Inscription details
    const detailsEl = document.getElementById('send-inscription-details');
    if (detailsEl) {
        detailsEl.innerHTML = `
            <div style="font-size: 10px; color: #888; word-break: break-all;">
                ${inscription.id}
            </div>
            <div style="font-size: 11px; color: #aaa; margin-top: 4px;">
                Type: ${inscription.content_type || 'unknown'}
            </div>
            ${inscription.utxo ? `
                <div style="font-size: 10px; color: #666; margin-top: 4px;">
                    UTXO: ${inscription.utxo.txid.substring(0, 16)}...
                </div>
            ` : ''}
        `;
    }
    
    // Mostrar valor da inscription
    const inscValueEl = document.getElementById('send-inscription-value');
    if (inscValueEl && inscription.utxo) {
        inscValueEl.textContent = `${inscription.utxo.value} sats`;
    }
    
    // Limpar campos
    const recipientInput = document.getElementById('send-inscription-recipient');
    if (recipientInput) {
        recipientInput.value = '';
    }
    
    // Armazenar inscription globalmente para o envio
    window.currentSendingInscription = inscription;
    
    console.log('   ✅ Form populated, stored inscription:', window.currentSendingInscription);
}

// Load Runes
async function loadRunes(address) {
    console.log('🪙 loadRunes called with address:', address);
    const container = document.getElementById('runes-list');
    
    if (!container) {
        console.error('❌ runes-list container not found!');
        return;
    }
    
    console.log('   Container found:', container);
    
    // 🔄 SEMPRE mostrar loading primeiro
    container.innerHTML = `
        <div class="loading-container">
            <img src="../assets/logo.png" alt="MyWallet" class="logo-medium" />
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading runes...</p>
        </div>
    `;
    
    // 💾 VERIFICAR CACHE PRIMEIRO
    if (isCacheValid('runes')) {
        console.log('⚡ Using cached runes data (saved API call & energy)');
        const cachedData = dataCache.runes.data;
        
        if (cachedData && cachedData.length > 0) {
            container.innerHTML = '';
            cachedData.forEach(rune => {
                const item = createRuneItem(rune);
                container.appendChild(item);
            });
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⧈</span>
                    <p>No runes yet</p>
                    <small>Send runes to this address to see them here</small>
                </div>
            `;
        }
        return;
    }
    
    try {
        console.log('   📡 Sending message to background script...');
        
        // Buscar runes via API
        const response = await chrome.runtime.sendMessage({
            action: 'getRunes',
            data: { address }
        });
        
        console.log('   📦 Response received:', response);
        
        if (response && response.success && response.runes && response.runes.length > 0) {
            console.log(`   ✅ Found ${response.runes.length} runes`);
            
            // 💾 SALVAR NO CACHE
            dataCache.runes.data = response.runes;
            dataCache.runes.timestamp = Date.now();
            dataCache.runes.loaded = true;
            console.log('💾 Runes cached for 5 minutes');
            
            container.innerHTML = '';
            
            response.runes.forEach(rune => {
                console.log('   🪙 Creating rune item:', rune.displayName || rune.name);
                const item = createRuneItem(rune);
                container.appendChild(item);
            });
        } else {
            console.log('   ℹ️  No runes found');
            
            // 💾 SALVAR CACHE VAZIO
            dataCache.runes.data = [];
            dataCache.runes.timestamp = Date.now();
            dataCache.runes.loaded = true;
            
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⧈</span>
                    <p>No runes yet</p>
                    <small>Send runes to this address to see them here</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading runes:', error);
        container.innerHTML = '<div class="empty-state">Failed to load runes</div>';
    }
}

// 🔐 RUNES VERIFICADAS - MyWallet Proprietary Feature
// 
// Esta é uma FEATURE PROPRIETÁRIA da MyWallet para dar credibilidade e segurança.
// Mesmo sendo uma wallet DESCENTRALIZADA, oferecemos features CENTRALIZADAS OPCIONAIS
// que agregam VALOR e CONFIANÇA ao produto.
//
// 🎯 Propósito:
// - Proteger usuários contra scams e runes falsas
// - Diferencial competitivo vs Unisat/Xverse/Leather
// - Posicionar MyWallet como autoridade no ecossistema Runes
// - Criar oportunidade de monetização futura (verificação paga)
//
// 📋 Critérios para Verificação:
// ✅ Projeto legítimo com comunidade ativa
// ✅ Parent inscription válido
// ✅ Rune ID oficial confirmado
// ✅ Sem histórico de scam
//
// ⚠️ SOMENTE O ADMIN PODE ADICIONAR RUNES AQUI
// Para adicionar, insira o nome EXATO da rune:
//
const VERIFIED_RUNES = [
    'DOG•GO•TO•THE•MOON',
    'LOBO•THE•WOLF•PUP'
];

// Função auxiliar para verificar se uma rune é verificada
function isRuneVerified(runeName) {
    return VERIFIED_RUNES.includes(runeName);
}

// Create Rune Item
function createRuneItem(rune) {
    const item = document.createElement('div');
    item.className = 'rune-item';
    item.dataset.runeName = rune.name;
    
    // ✨ GRID LAYOUT: 4 colunas alinhadas
    // Coluna 1: Thumbnail → Coluna 2: Nome → Coluna 3: Amount → Coluna 4: Emoji
    
    // 1️⃣ COLUNA 1: Thumbnail (52px fixo)
    const thumbnail = document.createElement('div');
    thumbnail.className = 'rune-thumbnail';
    
    const thumbnailUrl = rune.thumbnail || rune.parentPreview;
    
    if (thumbnailUrl) {
        const img = document.createElement('img');
        img.src = thumbnailUrl;
        img.alt = rune.displayName || rune.name;
        img.onerror = () => {
            thumbnail.innerHTML = `<div class="rune-thumbnail-fallback">${rune.symbol || '⧈'}</div>`;
        };
        thumbnail.appendChild(img);
    } else {
        thumbnail.innerHTML = `<div class="rune-thumbnail-fallback">${rune.symbol || '⧈'}</div>`;
    }
    
    // ✅ Adicionar badge de verificado se a rune estiver na lista
    if (isRuneVerified(rune.name)) {
        const verifiedBadge = document.createElement('div');
        verifiedBadge.className = 'rune-verified-badge';
        verifiedBadge.title = 'Verified by MyWallet';
        thumbnail.appendChild(verifiedBadge);
    }
    
    // 2️⃣ COLUNA 2: Nome (flex-grow)
    const nameContainer = document.createElement('div');
    nameContainer.className = 'rune-info';
    
    const nameSpan = document.createElement('div');
    nameSpan.className = 'rune-name';
    // Limpar o nome (remover emoji do final)
    const cleanName = (rune.displayName || rune.name).replace(/\s*[🐕🪙🔥💎⚡🌟🚀🌙🐂🐻🦁🐶🦴🎯🎨🎭🎪🎡🎢🎠🎰⧈]+\s*$/g, '');
    nameSpan.textContent = cleanName;
    
    nameContainer.appendChild(nameSpan);
    
    // 3️⃣ COLUNA 3: Amount (alinhado à direita)
    const amountDiv = document.createElement('div');
    amountDiv.className = 'rune-amount';
    amountDiv.textContent = formatRuneAmount(rune.amount);
    
    // 4️⃣ COLUNA 4: Emoji GRANDE (40px fixo)
    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'rune-arrow';
    emojiDiv.textContent = rune.symbol || '⧈';
    
    // ✅ Montar Grid (ordem: thumb → nome → amount → emoji)
    item.appendChild(thumbnail);
    item.appendChild(nameContainer);
    item.appendChild(amountDiv);
    item.appendChild(emojiDiv);
    
    // Click handler
    item.addEventListener('click', () => {
        showRuneDetails(rune);
    });
    
    return item;
}

// Get Rune Emoji baseado no nome
function getRuneEmoji(name) {
    const nameLower = (name || '').toLowerCase();
    
    // Mapear nomes comuns para emojis
    if (nameLower.includes('dog')) return '🐕';
    if (nameLower.includes('cat')) return '🐱';
    if (nameLower.includes('uncommon')) return '💎';
    if (nameLower.includes('goods')) return '📦';
    if (nameLower.includes('fehu')) return '⚡';
    if (nameLower.includes('moon')) return '🌙';
    if (nameLower.includes('rocket')) return '🚀';
    if (nameLower.includes('fire')) return '🔥';
    if (nameLower.includes('water')) return '💧';
    if (nameLower.includes('gold')) return '🏆';
    if (nameLower.includes('silver')) return '🥈';
    if (nameLower.includes('bronze')) return '🥉';
    if (nameLower.includes('king')) return '👑';
    if (nameLower.includes('queen')) return '👸';
    if (nameLower.includes('dragon')) return '🐉';
    if (nameLower.includes('bear')) return '🐻';
    if (nameLower.includes('bull')) return '🐂';
    if (nameLower.includes('lion')) return '🦁';
    if (nameLower.includes('tiger')) return '🐯';
    if (nameLower.includes('wolf')) return '🐺';
    if (nameLower.includes('fox')) return '🦊';
    if (nameLower.includes('eagle')) return '🦅';
    if (nameLower.includes('pepe')) return '🐸';
    if (nameLower.includes('satoshi')) return '₿';
    if (nameLower.includes('bitcoin')) return '₿';
    if (nameLower.includes('ordinal')) return '⚙️';
    if (nameLower.includes('rune')) return '🔮';
    
    // Default: primeiro emoji ou símbolo genérico
    return '⭐';
}

// Format Rune Amount
function formatRuneAmount(rawAmount, divisibility = 0) {
    // Converter raw amount para display amount usando divisibility
    if (divisibility === 0) {
        // Sem divisibility, mostra inteiro
        const num = parseFloat(rawAmount);
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toLocaleString();
    }
    
    const amount = parseFloat(rawAmount);
    const displayAmount = amount / Math.pow(10, divisibility);
    
    // Se o valor for inteiro (sem decimais reais), mostra sem casas decimais
    if (displayAmount % 1 === 0) {
        const num = Math.floor(displayAmount);
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }
    
    // Se tiver decimais, mostra apenas decimais significativos (remove zeros à direita)
    return displayAmount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: divisibility
    });
}

// Copy Address
async function handleCopyAddress() {
    const response = await chrome.runtime.sendMessage({
        action: 'getWalletInfo'
    });
    
    if (response.success) {
        const address = response.data.address;
        await navigator.clipboard.writeText(address);
        showNotification('Address copied!', 'success');
    }
}

// Send - Show Password Modal First
async function handleSend() {
    console.log('💸 ========== HANDLE SEND CALLED ==========');
    
    const toAddress = document.getElementById('send-address').value.trim();
    const amount = parseInt(document.getElementById('send-amount').value);
    const feeSelect = document.getElementById('send-fee').value;
    
    // Determinar fee rate (custom ou preset)
    let feeRate;
    if (feeSelect === 'custom') {
        const customFee = document.getElementById('send-fee-custom').value;
        if (!customFee || customFee < 1) {
            showNotification('Please enter a valid custom fee rate (minimum 1 sat/vB)', 'error');
            return;
        }
        feeRate = parseInt(customFee);
    } else {
        feeRate = parseInt(feeSelect);
    }
    
    console.log('   To Address:', toAddress);
    console.log('   Amount:', amount);
    console.log('   Fee Rate:', feeRate);
    
    if (!toAddress || !amount || !feeRate) {
        console.error('   ❌ Missing fields!');
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    console.log('   ✅ All fields valid');
    
    // Mostrar modal de confirmação com resumo da transação
    showPasswordModal(toAddress, amount, feeRate);
}

// Show Password Confirmation Modal
function showPasswordModal(toAddress, amount, feeRate) {
    console.log('🔐 Showing password confirmation modal...');
    
    // Preencher resumo da transação
    document.getElementById('confirm-to-address').textContent = 
        toAddress.slice(0, 20) + '...' + toAddress.slice(-10);
    document.getElementById('confirm-amount').textContent = 
        amount.toLocaleString() + ' sats';
    document.getElementById('confirm-fee-rate').textContent = 
        feeRate + ' sat/vB';
    
    // Limpar senha anterior
    document.getElementById('confirm-password-input').value = '';
    
    // Mostrar modal
    const modal = document.getElementById('password-modal');
    modal.classList.remove('hidden');
    
    // Focar no campo de senha
    setTimeout(() => {
        document.getElementById('confirm-password-input').focus();
    }, 100);
    
    // Armazenar dados da transação para uso posterior
    window.pendingTransaction = { toAddress, amount, feeRate };
}

// Handle Send Inscription
async function handleSendInscription() {
    console.log('📤 ========== HANDLE SEND INSCRIPTION CALLED ==========');
    console.log('   🔍 Function entered successfully!');
    
    const recipientAddress = document.getElementById('send-inscription-recipient').value.trim();
    console.log('   📝 Recipient from input:', recipientAddress);
    const feeRate = parseInt(document.getElementById('send-inscription-fee').value);
    const inscription = window.currentSendingInscription;
    
    console.log('   Inscription:', inscription);
    console.log('   Recipient:', recipientAddress);
    console.log('   Fee Rate:', feeRate);
    
    // Validações
    if (!inscription) {
        console.error('   ❌ No inscription selected!');
        showNotification('No inscription selected', 'error');
        return;
    }
    
    if (!recipientAddress) {
        console.error('   ❌ No recipient address!');
        showNotification('Please enter recipient address', 'error');
        return;
    }
    
    if (!feeRate || feeRate < 1) {
        console.error('   ❌ Invalid fee rate!');
        showNotification('Please enter a valid fee rate (min: 1 sat/vB)', 'error');
        return;
    }
    
    // Validar formato do endereço (Taproot)
    if (!recipientAddress.startsWith('bc1p') && !recipientAddress.startsWith('tb1p')) {
        console.error('   ❌ Invalid Taproot address!');
        showNotification('Please enter a valid Taproot address (bc1p...)', 'error');
        return;
    }
    
    console.log('   ✅ All fields valid');
    console.log('=========================================');
    
    // 🔐 SOLICITAR SENHA (modal de confirmação)
    // Armazenar dados da transação para uso posterior
    window.pendingInscriptionTransaction = { inscription, recipientAddress, feeRate };
    
    // Mostrar modal de senha
    document.getElementById('password-modal').classList.remove('hidden');
    document.getElementById('confirm-password-input').value = '';
    
    // Preencher resumo
    document.getElementById('confirm-to-address').textContent = 
        recipientAddress.slice(0, 20) + '...' + recipientAddress.slice(-10);
    document.getElementById('confirm-amount').textContent = 
        `Inscription #${inscription.number}`;
    document.getElementById('confirm-fee-rate').textContent = 
        feeRate + ' sat/vB';
    
    // Focar no campo de senha
    setTimeout(() => {
        document.getElementById('confirm-password-input').focus();
    }, 100);
}

// Confirm and Send Inscription (chamado quando o usuário confirma a senha)
async function confirmAndSendInscription(password) {
    console.log('🔐 ========== CONFIRMING INSCRIPTION SEND ==========');
    
    const pending = window.pendingInscriptionTransaction;
    
    if (!pending) {
        console.error('❌ No pending inscription transaction!');
        showNotification('No pending transaction', 'error');
        return;
    }
    
    const { inscription, recipientAddress, feeRate } = pending;
    
    console.log('   Inscription:', inscription.id);
    console.log('   Recipient:', recipientAddress);
    console.log('   Fee Rate:', feeRate);
    console.log('   Password provided:', password ? 'YES ✅' : 'NO ❌');
    
    try {
        // Fechar modal
        closePasswordModal();
        
        // Mostrar notificação de processamento
        showNotification('🔧 Creating transaction...', 'info');
        
        // Verificar se a wallet está desbloqueada
        const walletResponse = await chrome.runtime.sendMessage({
            action: 'getWalletInfo'
        });
        
        if (!walletResponse || !walletResponse.success || !walletResponse.data || !walletResponse.data.address) {
            console.error('   ❌ Wallet locked or not found!');
            showNotification('Please unlock your wallet first', 'error');
            return;
        }
        
        console.log('   ✅ Wallet unlocked:', walletResponse.data.address);
        
        // 🔓 DESBLOQUEAR WALLET COM A SENHA
        console.log('   🔓 Unlocking wallet with password...');
        
        const unlockResult = await chrome.runtime.sendMessage({
            action: 'unlockWallet',
            data: { password }
        });
        
        if (!unlockResult || !unlockResult.success) {
            throw new Error('Failed to unlock wallet with provided password');
        }
        
        console.log('   ✅ Wallet unlocked successfully');
        
        // Solicitar ao backend para criar e assinar a transação
        const sendResult = await chrome.runtime.sendMessage({
            action: 'sendInscription',
            data: {
                inscription: inscription,
                recipientAddress: recipientAddress,
                feeRate: feeRate,
                password: password
            }
        });
        
        console.log('   📡 Send result:', sendResult);
        
        if (sendResult && sendResult.success) {
            console.log('   ✅ Transaction broadcasted!');
            console.log('      TXID:', sendResult.txid);
            
            showNotification(`✅ Inscription sent! TXID: ${sendResult.txid.substring(0, 16)}...`, 'success');
            
            // 📤 ADICIONAR PENDING INSCRIPTION PARA O DESTINATÁRIO
            console.log('📤 Adding pending inscription to recipient cache...');
            
            // Enviar mensagem para adicionar ao cache do destinatário
            const pendingInscription = {
                id: inscription.id,
                number: inscription.number,
                address: recipientAddress, // Endereço do destinatário
                content_type: inscription.content_type || 'unknown',
                timestamp: Date.now(),
                genesis_transaction: sendResult.txid,
                pending: true
            };
            
            // ⚠️ Nota: Isso só funciona se o destinatário também usar MyWallet
            // Se for outra carteira, a inscription aparecerá após confirmação no blockchain
            window.postMessage({
                type: 'MYWALLET_ADD_PENDING_INSCRIPTION',
                data: pendingInscription
            }, '*');
            
            console.log('   ✅ Pending inscription sent to cache');
            
            // Abrir transaction no KrayScan
            chrome.tabs.create({ url: `https://kraywallet-backend.onrender.com/krayscan.html?txid=${sendResult.txid}` });
            
            // Limpar pending transaction
            window.pendingInscriptionTransaction = null;
            
            // Voltar para wallet screen
            setTimeout(() => {
                showScreen('wallet');
                // Recarregar ordinals
                loadWalletData();
            }, 2000);
            
        } else {
            console.error('   ❌ Send failed:', sendResult?.error || 'Unknown error');
            showNotification(`❌ Failed to send: ${sendResult?.error || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('   ❌ Error sending inscription:', error);
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
    
    console.log('=========================================');
}

// Close Password Modal
function closePasswordModal() {
    console.log('🔐 Closing password modal...');
    const modal = document.getElementById('password-modal');
    modal.classList.add('hidden');
    document.getElementById('confirm-password-input').value = '';
    delete window.pendingTransaction;
}

// Confirm and Send Transaction
async function confirmAndSend() {
    console.log('✅ Confirming and sending transaction...');
    
    const password = document.getElementById('confirm-password-input').value.trim();
    
    if (!password) {
        showNotification('Please enter your password', 'error');
        return;
    }
    
    // 🎯 DETECTAR TIPO DE TRANSAÇÃO
    if (window.pendingInscriptionTransaction) {
        // É uma transação de INSCRIPTION
        console.log('   📤 Detected INSCRIPTION transaction');
        await confirmAndSendInscription(password);
        return;
    }
    
    if (!window.pendingTransaction) {
        showNotification('Transaction data not found', 'error');
        return;
    }
    
    // É uma transação NORMAL de Bitcoin
    console.log('   💸 Detected BITCOIN transaction');
    const { toAddress, amount, feeRate } = window.pendingTransaction;
    
    // Fechar modal
    closePasswordModal();
    
    // Mostrar loading
    showLoading('Creating transaction...');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'sendBitcoin',
            data: { toAddress, amount, feeRate, password }
        });
        
        hideLoading();
        
        if (response.success) {
            // Mostrar notificação de sucesso CLICÁVEL com TXID completo
            const txid = response.txid;
            const txidShort = txid.slice(0, 8) + '...' + txid.slice(-8);
            
            // Criar notificação customizada clicável
            showTransactionNotification(txid, txidShort);
            
            // Voltar para a tela principal e ir direto para Activity tab
            showScreen('wallet');
            switchTab('activity');
            
            // Recarregar dados da wallet
            await loadWalletData();
        } else {
            showNotification(response.error || 'Failed to send transaction', 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error sending:', error);
        showNotification('Failed to send transaction: ' + error.message, 'error');
    }
}

// Loading Overlay
function showLoading(message = 'Loading...') {
    const loadingMessage = document.getElementById('loading-message') || document.getElementById('loading-text');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (loadingMessage && loadingOverlay) {
        loadingMessage.textContent = message;
        loadingOverlay.classList.remove('hidden');
    } else {
        console.warn('⚠️ Loading overlay elements not found');
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

/**
 * Load Inscription Actions (dynamic buttons based on listing status)
 */
async function loadInscriptionActions(fullDetails, inscription, detailsScreen) {
    const actionsContainer = document.getElementById('inscription-actions');
    if (!actionsContainer) return;
    
    try {
        // Verificar se a inscrição está listada
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        const address = result?.data?.address || walletState.address;
        
        if (!address) {
            actionsContainer.innerHTML = '<p style="color: #888; text-align: center;">Wallet not connected</p>';
            return;
        }
        
        // Buscar listings do usuário
        const response = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/?seller_address=${address}`);
        const data = await response.json();
        
        // Verificar se esta inscrição específica está listada
        const activeListing = data.listings?.find(listing => 
            listing.inscription_id === fullDetails.id &&
            (listing.status === 'PENDING_SIGNATURES' || listing.status === 'OPEN')
        );
        
        // Renderizar botões
        if (activeListing) {
            // ✅ INSCRIÇÃO ESTÁ LISTADA - BOTÕES DINÂMICOS
            actionsContainer.innerHTML = `
                <!-- Info Box: Listada -->
                <div style="padding: 12px; background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; border-radius: 8px; margin-bottom: 12px;">
                    <div style="font-size: 12px; color: #4CAF50; font-weight: 600; margin-bottom: 4px;">✅ Listed on Market</div>
                    <div style="font-size: 16px; color: white; font-weight: 700;">${activeListing.price_sats.toLocaleString()} sats</div>
                    <div style="font-size: 11px; color: #888; margin-top: 4px;">Status: ${activeListing.status}</div>
                </div>
                
                <!-- Botão: Change Price (substitui "List") -->
                ${activeListing.status === 'PENDING_SIGNATURES' ? `
                <button class="rune-action-btn" id="update-price-btn" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border: none; color: white;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M17 12l-5 5-5-5"/>
                    </svg>
                    💰 Change Price
                </button>
                ` : ''}
                
                <!-- Botão: Cancel Listing (substitui "Send") -->
                <button class="rune-action-btn primary" id="cancel-listing-btn" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M15 9l-6 6M9 9l6 6"/>
                    </svg>
                    ❌ Cancel Listing
                </button>
                
                <!-- Botão: View on Ordinals.com -->
                <button class="rune-action-btn" id="view-ordinals-btn" style="background: rgba(255, 136, 0, 0.1); border-color: #ff8800;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <path d="M15 3h6v6M10 14L21 3"/>
                    </svg>
                    View on Ordinals.com
                </button>
            `;
            
            // Event listeners
            if (activeListing.status === 'PENDING_SIGNATURES') {
                document.getElementById('update-price-btn')?.addEventListener('click', () => {
                    showUpdatePriceModal(activeListing);
                });
            }
            
            document.getElementById('cancel-listing-btn')?.addEventListener('click', async () => {
                // Vai direto para assinatura (sem confirm)
                await cancelAtomicListing(activeListing.order_id);
                detailsScreen.remove(); // Fechar detalhes após cancelar
                showNotification('✅ Listing cancelled!', 'success');
            });
            
        } else {
            // ❌ INSCRIÇÃO NÃO ESTÁ LISTADA - BOTÕES PADRÃO
            actionsContainer.innerHTML = `
                <!-- Botão: Send -->
                <button class="rune-action-btn primary" id="send-inscription-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                    🚀 Send
                </button>
                
                <!-- Botão: List on Market -->
                <button class="rune-action-btn" id="list-inscription-btn" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border: none; color: white;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 3h18v18H3z"/>
                        <path d="M3 9h18M9 21V9"/>
                    </svg>
                    📜 List on Market
                </button>
                
                <!-- Botão: View on Ordinals.com -->
                <button class="rune-action-btn" id="view-ordinals-btn" style="background: rgba(255, 136, 0, 0.1); border-color: #ff8800;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <path d="M15 3h6v6M10 14L21 3"/>
                    </svg>
                    View on Ordinals.com
                </button>
            `;
            
            // Event listeners
            document.getElementById('send-inscription-btn')?.addEventListener('click', () => {
                detailsScreen.remove();
                showSendInscriptionScreen(inscription);
            });
            
            document.getElementById('list-inscription-btn')?.addEventListener('click', () => {
                alert('🏪 List on Market feature coming soon!\n\nThis will allow you to list your inscription on marketplaces like Magic Eden, Unisat, etc.');
            });
        }
        
        // Event listener comum (View on Ordinals.com)
        document.getElementById('view-ordinals-btn')?.addEventListener('click', () => {
            const url = `https://ordinals.com/inscription/${fullDetails.id}`;
            chrome.tabs.create({ url });
        });
        
    } catch (error) {
        console.error('❌ Error loading inscription actions:', error);
        actionsContainer.innerHTML = `
            <p style="color: #ef4444; text-align: center; font-size: 12px;">
                Failed to load actions
            </p>
        `;
    }
}

// Show Inscription Details (tela completa após clicar na inscription)
async function showInscriptionDetails(inscription) {
    console.log('🖼️  Showing inscription details:', inscription.id);
    
    // Criar tela de detalhes (loading state)
    const detailsScreen = document.createElement('div');
    detailsScreen.className = 'rune-details-screen'; // Reusar o mesmo estilo das runes
    detailsScreen.id = 'inscription-details-screen';
    
    detailsScreen.innerHTML = `
        <div class="rune-details-header">
            <button class="rune-details-back" id="inscription-details-back-temp">←</button>
            <div class="rune-details-title">Loading...</div>
        </div>
        <div class="rune-details-content" style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div class="spinner"></div>
        </div>
    `;
    
    document.body.appendChild(detailsScreen);
    
    // Event listener temporário para voltar
    document.getElementById('inscription-details-back-temp').addEventListener('click', () => {
        detailsScreen.remove();
    });
    
    try {
        // Use inscription data we already have (backend details endpoint may not be available)
        console.log('   📡 Using cached inscription data...');
        
        const fullDetails = {
            id: inscription.id || inscription.inscriptionId,
            number: inscription.number || inscription.inscription_number,
            content_type: inscription.content_type || inscription.type || 'unknown',
            address: inscription.address || 'unknown',
            output: inscription.output || inscription.utxo,
            preview: `https://ordinals.com/preview/${inscription.id || inscription.inscriptionId}`,
            inscriptionUrl: `https://ordinals.com/inscription/${inscription.id || inscription.inscriptionId}`
        };
        console.log('   ✅ Details ready:', fullDetails);
        
        // Atualizar UI com detalhes completos
        const contentUrl = fullDetails.preview || inscription.preview || `https://ordinals.com/content/${inscription.id}`;
        const contentType = (fullDetails.content_type || inscription.content_type || '').toLowerCase();
        
        detailsScreen.innerHTML = `
            <div class="rune-details-header">
                <button class="rune-details-back" id="inscription-details-back">←</button>
                <div class="rune-details-title">Inscription #${fullDetails.number || inscription.number || 'N/A'}</div>
            </div>
            
            <div class="rune-details-content">
                <!-- Content Preview (Thumbnail GRANDE) -->
                <div class="rune-parent-preview" style="position: relative;">
                    <img src="${contentUrl}" 
                         alt="Inscription #${fullDetails.number || inscription.number}" 
                         style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="rune-thumbnail-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 64px;">◉</div>
                </div>
                
                <!-- Inscription Info Grid -->
                <div class="rune-info-grid">
                    <div class="rune-info-item">
                        <div class="rune-info-label">Inscription ID</div>
                        <div class="rune-info-value" style="font-size: 12px; font-family: var(--font-mono); word-break: break-all;">${fullDetails.id}</div>
                    </div>
                    
                    <div class="rune-info-item">
                        <div class="rune-info-label">Inscription Number</div>
                        <div class="rune-info-value" style="color: #8b5cf6;">#${(fullDetails.number || inscription.number || 'N/A').toLocaleString()}</div>
                    </div>
                    
                    <div class="rune-info-item">
                        <div class="rune-info-label">Content Type</div>
                        <div class="rune-info-value">${fullDetails.content_type || 'unknown'}</div>
                    </div>
                    
                    ${fullDetails.content_length ? `
                    <div class="rune-info-item">
                        <div class="rune-info-label">Content Length</div>
                        <div class="rune-info-value">${fullDetails.content_length.toLocaleString()} bytes</div>
                    </div>
                    ` : ''}
                    
                    ${fullDetails.output ? `
                    <div class="rune-info-item">
                        <div class="rune-info-label">Output (Location)</div>
                        <div class="rune-info-value" style="font-size: 12px; font-family: var(--font-mono); word-break: break-all;">${fullDetails.output}</div>
                    </div>
                    ` : ''}
                    
                    ${fullDetails.genesis_height ? `
                    <div class="rune-info-item">
                        <div class="rune-info-label">Genesis Height</div>
                        <div class="rune-info-value">${fullDetails.genesis_height.toLocaleString()}</div>
                    </div>
                    ` : ''}
                    
                    ${fullDetails.genesis_fee ? `
                    <div class="rune-info-item">
                        <div class="rune-info-label">Genesis Fee</div>
                        <div class="rune-info-value">${fullDetails.genesis_fee.toLocaleString()} sats</div>
                    </div>
                    ` : ''}
                    
                    ${fullDetails.timestamp ? `
                    <div class="rune-info-item">
                        <div class="rune-info-label">Timestamp</div>
                        <div class="rune-info-value">${fullDetails.timestamp}</div>
                    </div>
                    ` : ''}
                    
                    ${fullDetails.sat ? `
                    <div class="rune-info-item">
                        <div class="rune-info-label">Sat Number</div>
                        <div class="rune-info-value">${fullDetails.sat.toLocaleString()}</div>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Actions (será populado dinamicamente) -->
                <div class="rune-actions" id="inscription-actions">
                    <!-- Carregando botões... -->
                </div>
            </div>
        `;
        
        // Event listeners
        document.getElementById('inscription-details-back').addEventListener('click', () => {
            detailsScreen.remove();
        });
        
        // Carregar botões dinâmicos (verificar se está listado)
        await loadInscriptionActions(fullDetails, inscription, detailsScreen);
        
    } catch (error) {
        console.error('❌ Error loading inscription details:', error);
        
        // Mostrar erro na UI
        detailsScreen.innerHTML = `
            <div class="rune-details-header">
                <button class="rune-details-back" id="inscription-details-back-error">←</button>
                <div class="rune-details-title">Error</div>
            </div>
            <div class="rune-details-content" style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="color: #ef4444; font-weight: 600; margin-bottom: 8px;">Failed to load inscription details</div>
                <div style="color: #888; font-size: 14px;">${error.message}</div>
            </div>
        `;
        
        document.getElementById('inscription-details-back-error').addEventListener('click', () => {
            detailsScreen.remove();
        });
    }
}

// Show Rune Details (tela completa após clicar na rune)
function showRuneDetails(rune) {
    console.log('🪙 Showing rune details:', rune.name);
    
    // Criar tela de detalhes
    const detailsScreen = document.createElement('div');
    detailsScreen.className = 'rune-details-screen';
    detailsScreen.id = 'rune-details-screen';
    
    detailsScreen.innerHTML = `
        <div class="rune-details-header">
            <button class="rune-details-back" id="rune-details-back">←</button>
            <div class="rune-details-title">${rune.displayName || rune.name}</div>
        </div>
        
        <div class="rune-details-content">
            <!-- Parent Preview (Thumbnail) com Badge de Verificado -->
            <div class="rune-parent-preview" style="position: relative;">
                ${(rune.thumbnail || rune.parentPreview)
                    ? `<img src="${rune.thumbnail || rune.parentPreview}" alt="${rune.displayName || rune.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="rune-parent-preview-fallback" style="display: none;">${rune.symbol || '⧈'}</div>`
                    : `<div class="rune-parent-preview-fallback">${rune.symbol || '⧈'}</div>`
                }
                ${isRuneVerified(rune.name) 
                    ? `<div class="rune-verified-badge-large" style="position: absolute; top: 12px; right: 12px; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid var(--color-bg-primary); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.6); z-index: 10;">
                        <span style="font-size: 28px; color: white; font-weight: bold;">✓</span>
                       </div>`
                    : ''
                }
            </div>
            
            <!-- Rune Info Grid -->
            <div class="rune-info-grid">
                <div class="rune-info-item">
                    <div class="rune-info-label">Rune Name</div>
                    <div class="rune-info-value">${rune.displayName || rune.name}</div>
                </div>
                
                <div class="rune-info-item">
                    <div class="rune-info-label">Your Balance</div>
                    <div class="rune-info-value">${formatRuneAmount(rune.amount)} ${rune.symbol || ''}</div>
                </div>
                
                ${rune.supply ? `
                <div class="rune-info-item">
                    <div class="rune-info-label">Total Supply</div>
                    <div class="rune-info-value">${rune.supply}</div>
                </div>
                ` : ''}
                
                ${rune.etching ? `
                <div class="rune-info-item">
                    <div class="rune-info-label">Etching</div>
                    <div class="rune-info-value" style="font-size: 12px; font-family: var(--font-mono);">${rune.etching}</div>
                </div>
                ` : ''}
                
                ${rune.runeId ? `
                <div class="rune-info-item">
                    <div class="rune-info-label">Rune ID</div>
                    <div class="rune-info-value" style="font-size: 14px; font-family: var(--font-mono); color: #f59e0b;">${rune.runeId}</div>
                </div>
                ` : ''}
                
                ${rune.parent ? `
                <div class="rune-info-item">
                    <div class="rune-info-label">Parent Inscription</div>
                    <div class="rune-info-value" style="font-size: 12px; font-family: var(--font-mono);">${rune.parent}</div>
                </div>
                ` : ''}
                
                <div class="rune-info-item">
                    <div class="rune-info-label">UTXOs</div>
                    <div class="rune-info-value">${rune.utxos ? rune.utxos.length : 0} UTXO(s)</div>
                </div>
            </div>
            
            <!-- Actions -->
            <div class="rune-actions">
                <button class="rune-action-btn primary" id="send-rune-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                    Send
                </button>
                
                <button class="rune-action-btn" id="receive-rune-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                    </svg>
                    Receive
                </button>
                
                <button class="rune-action-btn" id="swap-rune-btn" disabled>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                    </svg>
                    Swap
                    <span class="coming-soon-badge">Soon</span>
                </button>
                
                <button class="rune-action-btn burn" id="burn-rune-btn" style="background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); color: white;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2c-4 4-6 8-6 12a6 6 0 0 0 12 0c0-4-2-8-6-12z"/>
                        <path d="M12 11l-2 3h4l-2 3"/>
                    </svg>
                    🔥 Burn
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(detailsScreen);
    
    // Event listeners
    document.getElementById('rune-details-back').addEventListener('click', () => {
        detailsScreen.remove();
    });
    
    document.getElementById('send-rune-btn').addEventListener('click', () => {
        detailsScreen.remove();
        showSendRuneScreen(rune);
    });
    
    document.getElementById('receive-rune-btn').addEventListener('click', () => {
        detailsScreen.remove();
        showScreen('receive');
    });
    
    document.getElementById('burn-rune-btn').addEventListener('click', () => {
        detailsScreen.remove();
        showBurnRuneScreen(rune);
    });
}

// Show Send Rune Screen
function showSendRuneScreen(rune) {
    console.log('🪙 Preparing to send rune:', rune.name);
    
    // Criar tela de envio
    const sendScreen = document.createElement('div');
    sendScreen.className = 'rune-details-screen';
    sendScreen.id = 'send-rune-screen';
    
    sendScreen.innerHTML = `
        <div class="rune-details-header">
            <button class="rune-details-back" id="send-rune-back">←</button>
            <div class="rune-details-title">Send ${rune.symbol || '⧈'} ${rune.displayName || rune.name}</div>
        </div>
        
        <div class="rune-details-content" style="padding: 20px;">
            <!-- Rune Info Summary com Thumbnail e Badge -->
            <div class="send-rune-summary">
                <div class="send-rune-icon" style="position: relative;">
                    ${(rune.thumbnail || rune.parentPreview)
                        ? `<img src="${rune.thumbnail || rune.parentPreview}" alt="${rune.displayName || rune.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div class="rune-thumbnail-fallback" style="font-size: 48px; display: none;">${rune.symbol || '⧈'}</div>`
                        : `<div class="rune-thumbnail-fallback" style="font-size: 48px;">${rune.symbol || '⧈'}</div>`
                    }
                    ${isRuneVerified(rune.name) 
                        ? `<div class="rune-verified-badge" style="position: absolute; top: -4px; right: -4px;"></div>`
                        : ''
                    }
                </div>
                <div class="send-rune-balance">
                    <div class="label">Available Balance</div>
                    <div class="value">${formatRuneAmount(rune.amount)} ${rune.symbol || ''}</div>
                </div>
            </div>
            
            <!-- Send Form -->
            <form id="send-rune-form" class="send-form">
                <div class="form-group">
                    <label for="send-rune-address">Recipient Address</label>
                    <input 
                        type="text" 
                        id="send-rune-address" 
                        class="form-input" 
                        placeholder="bc1p..." 
                        required
                    />
                    <small class="form-hint">Enter a valid Bitcoin address</small>
                </div>
                
                <div class="form-group">
                    <label for="send-rune-amount">Amount</label>
                    <div class="input-with-max">
                        <input 
                            type="number" 
                            id="send-rune-amount" 
                            class="form-input" 
                            placeholder="0" 
                            min="0"
                            step="any"
                            max="${rune.amount}"
                            required
                        />
                        <button type="button" class="max-btn" id="send-rune-max-btn">MAX</button>
                    </div>
                    <small class="form-hint">Max: ${formatRuneAmount(rune.amount)}</small>
                </div>
                
                <div class="form-group">
                    <label for="send-rune-fee">Fee Rate (sat/vB)</label>
                    <select id="send-rune-fee" class="form-select">
                        <option value="loading" disabled selected>Loading fees...</option>
                    </select>
                    <div class="fee-custom-input" id="fee-custom-container" style="display: none;">
                        <input 
                            type="number" 
                            id="send-rune-fee-custom" 
                            class="form-input" 
                            placeholder="Enter custom fee rate" 
                            min="1"
                        />
                        <small class="form-hint">Minimum: 1 sat/vB</small>
                    </div>
                </div>
                
                <div class="fee-estimate" id="send-rune-fee-estimate">
                    <div class="fee-label">Estimated Fee:</div>
                    <div class="fee-value">Calculating...</div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="send-rune-cancel">Cancel</button>
                    <button type="submit" class="btn-primary" id="send-rune-submit">
                        <span class="btn-text">Send Rune</span>
                        <span class="btn-loading" style="display: none;">
                            <span class="spinner"></span>
                            Sending...
                        </span>
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(sendScreen);
    
    // Load dynamic fees from mempool.space
    loadMempoolFees();
    
    // Event Listeners
    document.getElementById('send-rune-back').addEventListener('click', () => {
        sendScreen.remove();
        showRuneDetails(rune);
    });
    
    document.getElementById('send-rune-cancel').addEventListener('click', () => {
        sendScreen.remove();
        showRuneDetails(rune);
    });
    
    // MAX button
    document.getElementById('send-rune-max-btn').addEventListener('click', () => {
        // ✅ NÃO DIVIDIR! Preencher com o valor RAW
        document.getElementById('send-rune-amount').value = rune.amount;
    });
    
    // Fee selector change (mostrar/ocultar custom input + calcular fee)
    document.getElementById('send-rune-fee').addEventListener('change', (e) => {
        const customContainer = document.getElementById('fee-custom-container');
        if (e.target.value === 'custom') {
            customContainer.style.display = 'block';
        } else {
            customContainer.style.display = 'none';
        }
        // Atualizar estimativa de fee
        updateRuneFeeEstimate();
    });
    
    // Custom fee input change
    document.getElementById('send-rune-fee-custom')?.addEventListener('input', () => {
        updateRuneFeeEstimate();
    });
    
    // Form submission
    document.getElementById('send-rune-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const address = document.getElementById('send-rune-address').value.trim();
        const amount = document.getElementById('send-rune-amount').value;
        const feeSelect = document.getElementById('send-rune-fee').value;
        
        // Determinar fee rate (custom ou preset)
        let feeRate;
        if (feeSelect === 'custom') {
            const customFee = document.getElementById('send-rune-fee-custom').value;
            if (!customFee || customFee < 1) {
                showNotification('Please enter a valid custom fee rate (minimum 1 sat/vB)', 'error');
                return;
            }
            feeRate = parseInt(customFee);
        } else {
            feeRate = parseInt(feeSelect);
        }
        
        // Validações
        if (!address) {
            showNotification('Please enter a recipient address', 'error');
            return;
        }
        
        if (!amount || amount <= 0) {
            showNotification('Please enter a valid amount', 'error');
            return;
        }
        
        if (parseInt(amount) > parseInt(rune.amount)) {
            showNotification('Insufficient balance', 'error');
            return;
        }
        
        // Mostrar loading
        const submitBtn = document.getElementById('send-rune-submit');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        
        try {
            console.log('📤 Sending rune:', {
                rune: rune.name,
                to: address,
                amount: amount,
                feeRate: feeRate
            });
            
            // Chamar função de envio
            await sendRuneTransaction(rune, address, amount, feeRate);
            
            // Sucesso!
            showNotification(`Rune sent successfully!`, 'success');
            sendScreen.remove();
            
            // Recarregar runes
            const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
            if (walletInfo.success) {
                loadRunes(walletInfo.data.address);
            }
            
        } catch (error) {
            console.error('❌ Error sending rune:', error);
            showNotification(`Failed to send rune: ${error.message}`, 'error');
            
            // Restaurar botão
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
        }
    });
}

// Update Rune Fee Estimate
function updateRuneFeeEstimate() {
    try {
        const feeSelect = document.getElementById('send-rune-fee');
        const feeValue = document.getElementById('send-rune-fee-estimate')?.querySelector('.fee-value');
        
        if (!feeSelect || !feeValue) return;
        
        let feeRate;
        if (feeSelect.value === 'custom') {
            const customFee = document.getElementById('send-rune-fee-custom')?.value;
            feeRate = customFee ? parseInt(customFee) : 0;
        } else if (feeSelect.value !== 'loading') {
            feeRate = parseInt(feeSelect.value);
        } else {
            return; // Still loading
        }
        
        if (!feeRate || feeRate < 1) {
            feeValue.textContent = 'Enter fee rate';
            return;
        }
        
        // Estimativa de tamanho de TX para Rune send
        // Típico: 1-2 inputs + 3 outputs (receiver, change, OP_RETURN) = ~250-350 vBytes
        const estimatedSize = 300; // vBytes (média)
        const estimatedFeeSats = feeRate * estimatedSize;
        const estimatedFeeBTC = (estimatedFeeSats / 100000000).toFixed(8);
        
        feeValue.textContent = `~${estimatedFeeSats.toLocaleString()} sats (~${estimatedFeeBTC} BTC)`;
        
    } catch (error) {
        console.error('Error updating fee estimate:', error);
    }
}

// Load fees for Bitcoin Send screen (via backend API - uses QuickNode first!)
async function loadBitcoinSendFees() {
    try {
        console.log('📊 Loading fees via backend API...');
        
        // Use backend API which uses QuickNode first, then Mempool.space as fallback
        let fees;
        try {
            const backendResponse = await fetch('https://kraywallet-backend.onrender.com/api/wallet/fees');
            const backendData = await backendResponse.json();
            if (backendData.success) {
                fees = {
                    minimumFee: backendData.fees.minimum,
                    hourFee: backendData.fees.low,
                    halfHourFee: backendData.fees.medium,
                    fastestFee: backendData.fees.high
                };
                console.log(`✅ Fees from backend (${backendData.source}):`, fees);
            }
        } catch (backendError) {
            console.log('⚠️ Backend failed, trying mempool.space directly...');
            const response = await fetch('https://mempool.space/api/v1/fees/recommended');
            fees = await response.json();
            console.log('✅ Fees from mempool.space fallback:', fees);
        }
        
        console.log('✅ Fees loaded:', fees);
        
        const feeSelect = document.getElementById('send-fee');
        
        if (!feeSelect) {
            console.error('❌ send-fee select not found');
            return;
        }
        
        // Limpar options anteriores
        feeSelect.innerHTML = '';
        
        // Adicionar opções com fees dinâmicas
        const options = [
            { 
                value: fees.minimumFee || 1, 
                label: `🐢 Economy (${fees.minimumFee || 1} sat/vB)`
            },
            { 
                value: fees.hourFee || 5, 
                label: `⏱️  Normal (${fees.hourFee || 5} sat/vB)`
            },
            { 
                value: fees.halfHourFee || 10, 
                label: `⚡ Fast (${fees.halfHourFee || 10} sat/vB)`,
                selected: true
            },
            { 
                value: fees.fastestFee || 20, 
                label: `🚀 Priority (${fees.fastestFee || 20} sat/vB)`
            },
            { 
                value: 'custom', 
                label: '⚙️  Custom'
            }
        ];
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.selected) {
                option.selected = true;
            }
            feeSelect.appendChild(option);
        });
        
        // Add change listener
        feeSelect.addEventListener('change', (e) => {
            const customContainer = document.getElementById('send-fee-custom-container');
            if (e.target.value === 'custom') {
                customContainer.style.display = 'block';
            } else {
                customContainer.style.display = 'none';
            }
        });
        
    } catch (error) {
        console.error('❌ Error loading mempool fees:', error);
        
        // Fallback para fees estáticas se API falhar
        const feeSelect = document.getElementById('send-fee');
        if (feeSelect) {
            feeSelect.innerHTML = `
                <option value="1">🐢 Economy (1 sat/vB)</option>
                <option value="5">⏱️  Normal (5 sat/vB)</option>
                <option value="10" selected>⚡ Fast (10 sat/vB)</option>
                <option value="20">🚀 Priority (20 sat/vB)</option>
                <option value="custom">⚙️  Custom</option>
            `;
        }
    }
}

// Load recommended fees for Runes (via backend API - uses QuickNode first!)
async function loadMempoolFees() {
    try {
        console.log('📊 Loading fees via backend API...');
        
        // Use backend API which uses QuickNode first, then Mempool.space as fallback
        let fees;
        try {
            const backendResponse = await fetch('https://kraywallet-backend.onrender.com/api/wallet/fees');
            const backendData = await backendResponse.json();
            if (backendData.success) {
                fees = {
                    minimumFee: backendData.fees.minimum,
                    hourFee: backendData.fees.low,
                    halfHourFee: backendData.fees.medium,
                    fastestFee: backendData.fees.high
                };
                console.log(`✅ Fees from backend (${backendData.source}):`, fees);
            }
        } catch (backendError) {
            console.log('⚠️ Backend failed, trying mempool.space directly...');
            const response = await fetch('https://mempool.space/api/v1/fees/recommended');
            fees = await response.json();
            console.log('✅ Fees from mempool.space fallback:', fees);
        }
        
        const feeSelect = document.getElementById('send-rune-fee');
        
        // Limpar options anteriores
        feeSelect.innerHTML = '';
        
        // Adicionar opções com fees dinâmicas
        const options = [
            { 
                value: fees.minimumFee || 1, 
                label: `🐢 Economy (${fees.minimumFee || 1} sat/vB)`
            },
            { 
                value: fees.hourFee || 5, 
                label: `⏱️  Normal (${fees.hourFee || 5} sat/vB)`
            },
            { 
                value: fees.halfHourFee || 10, 
                label: `⚡ Fast (${fees.halfHourFee || 10} sat/vB)`,
                selected: true
            },
            { 
                value: fees.fastestFee || 20, 
                label: `🚀 Priority (${fees.fastestFee || 20} sat/vB)`
            },
            { 
                value: 'custom', 
                label: '⚙️  Custom'
            }
        ];
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.selected) {
                option.selected = true;
            }
            feeSelect.appendChild(option);
        });
        
        // Calcular estimativa inicial com fee selecionada (Fast)
        setTimeout(() => updateRuneFeeEstimate(), 100);
        
    } catch (error) {
        console.error('❌ Error loading mempool fees:', error);
        
        // Fallback para fees estáticas se API falhar
        const feeSelect = document.getElementById('send-rune-fee');
        feeSelect.innerHTML = `
            <option value="1">🐢 Economy (1 sat/vB)</option>
            <option value="5">⏱️  Normal (5 sat/vB)</option>
            <option value="10" selected>⚡ Fast (10 sat/vB)</option>
            <option value="20">🚀 Priority (20 sat/vB)</option>
            <option value="custom">⚙️  Custom</option>
        `;
        
        showNotification('Using default fee rates (mempool.space unavailable)', 'warning');
        
        // Calcular estimativa inicial com fee padrão
        setTimeout(() => updateRuneFeeEstimate(), 100);
    }
}

// Send Rune Transaction (chamada ao backend + sign + broadcast)
async function sendRuneTransaction(rune, toAddress, amount, feeRate) {
    try {
        console.log('\n🚀 ========== SEND RUNE TRANSACTION ==========');
        
        // 1. Get wallet info
        const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        
        if (!walletInfo.success || !walletInfo.data.address) {
            throw new Error('Wallet not unlocked');
        }
        
        const fromAddress = walletInfo.data.address;
        console.log('From:', fromAddress);
        console.log('To:', toAddress);
        console.log('Rune:', rune.name);
        console.log('Amount:', amount);
        
        // ✅ VALIDAÇÃO: Verificar decimais permitidos
        const divisibility = rune.divisibility || 0;
        const amountNum = parseFloat(amount);
        
        // Calcular raw amount
        const rawAmount = amountNum * Math.pow(10, divisibility);
        
        console.log('   Divisibility:', divisibility);
        console.log('   Raw amount:', rawAmount);
        
        // Validar que raw amount é inteiro (respeitando divisibility)
        if (!Number.isInteger(rawAmount)) {
            throw new Error(
                `Invalid amount precision. ${rune.name} has ${divisibility} decimals. ` +
                `Maximum precision: ${divisibility} decimal places.`
            );
        }
        
        // Validar que amount é positivo
        if (rawAmount <= 0) {
            throw new Error('Amount must be greater than 0');
        }
        
        console.log('   ✅ Amount validation passed');
        
        // 2. Build PSBT via backend
        console.log('\n📦 Step 1: Building PSBT...');
        console.log('   ✅ Sending rune data to backend (from QuickNode):');
        console.log('      runeId:', rune.runeId);
        console.log('      divisibility:', divisibility);
        console.log('      runeUtxos:', rune.utxos?.length || 0);
        
        const buildResponse = await fetch('https://kraywallet-backend.onrender.com/api/runes/build-send-psbt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromAddress: fromAddress,
                toAddress: toAddress,
                runeName: rune.name,
                amount: amountNum,  // ✅ Usar float para suportar decimais (ex: 499.995)
                feeRate: feeRate,
                // ✅ PRODUÇÃO: Enviar dados que backend precisa (sem ORD server!)
                runeId: rune.runeId,
                divisibility: divisibility,
                runeUtxos: rune.utxos || []
            })
        });
        
        const buildData = await buildResponse.json();
        
        if (!buildData.success) {
            throw new Error(buildData.error || 'Failed to build PSBT');
        }
        
        console.log('✅ PSBT built:', buildData.psbt);
        console.log('   Fee:', buildData.fee, 'sats');
        
        // 3. Sign PSBT (mostrar modal de confirmação de senha)
        console.log('\n✍️  Step 2: Requesting password for signing...');
        
        // Criar modal de confirmação inline
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        confirmModal.innerHTML = `
            <div style="background: #1a1a1a; border-radius: 16px; padding: 24px; width: 90%; max-width: 400px; border: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #fff; font-size: 18px;">🔏 Confirm Transaction</h3>
                    <button id="confirm-close-btn" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px;">×</button>
                </div>
                
                <div style="background: #2a2a2a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <div style="color: #ff9500; font-weight: 600; margin-bottom: 12px;">⧈ Rune Transfer</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #888;">Rune:</span>
                        <span style="color: #fff;">${rune.name}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #888;">Amount:</span>
                        <span style="color: #fff;">${amount}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #888;">To:</span>
                        <span style="color: #fff; font-size: 11px;">${toAddress.substring(0,20)}...</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Fee:</span>
                        <span style="color: #fff;">${buildData.fee} sats</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 500;">Password</label>
                    <input type="password" id="rune-confirm-password-input" placeholder="Enter your password" 
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px; box-sizing: border-box;" />
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <button id="confirm-cancel-btn" style="flex: 1; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button id="confirm-sign-btn" style="flex: 1; padding: 12px; background: #ff9500; border: none; border-radius: 8px; color: #000; font-weight: 600; cursor: pointer;">Sign & Send</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        // Aguardar assinatura do usuário
        const signResult = await new Promise((resolve, reject) => {
            const signBtn = document.getElementById('confirm-sign-btn');
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            const closeBtn = document.getElementById('confirm-close-btn');
            const passwordInput = document.getElementById('rune-confirm-password-input');
            
            // Focus no campo de senha após modal estar no DOM
            setTimeout(() => {
                if (passwordInput) {
                    passwordInput.focus();
                    console.log('✅ Password input focused');
                }
            }, 100);
            
            // Permitir Enter para submeter
            if (passwordInput) {
                passwordInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        signBtn.click();
                    }
                });
            }
            
            const cleanup = () => {
                confirmModal.remove();
            };
            
            signBtn.onclick = async () => {
                const passwordInput = document.getElementById('rune-confirm-password-input');
                const password = passwordInput ? passwordInput.value : '';
                
                console.log('🔐 Password input element:', passwordInput);
                console.log('🔐 Password value:', password ? '***' : '(empty)');
                console.log('🔐 Password length:', password.length);
                
                if (!password || password.length === 0) {
                    showNotification('❌ Please enter your password', 'error');
                    return;
                }
                
                try {
                    showLoading('Signing transaction...');
                    
                    // Descriptografar wallet
                    let mnemonic;
                    try {
                        const decrypted = await sendMessage({ action: 'decryptWallet', data: { password } });
                        if (!decrypted.success) {
                            throw new Error('Incorrect password');
                        }
                        mnemonic = decrypted.mnemonic;
                    } catch (error) {
                        hideLoading();
                        showNotification('❌ Incorrect password', 'error');
                        return;
                    }
                    
                    // ✅ ASSINAR PSBT COM BITCOINJS-LIB (TAPROOT CORRETO)
                    console.log('🔐 Signing PSBT...');
                    const signResponse = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/sign', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            mnemonic,
                            psbt: buildData.psbt,
                            network: 'mainnet'
                            // ✅ NÃO especificar sighashType - usar DEFAULT (0x00) para Taproot
                        })
                    });
                    
                    const signData = await signResponse.json();
                    
                    if (!signData.success) {
                        hideLoading();
                        showNotification('❌ ' + (signData.error || 'Failed to sign PSBT'), 'error');
                        return;
                    }
                    
                    console.log('✅ PSBT signed successfully');
                    
                    cleanup();
                    resolve({ success: true, signedPsbt: signData.signedPsbt });
                    
                } catch (error) {
                    hideLoading();
                    showNotification('❌ ' + error.message, 'error');
                }
            };
            
            cancelBtn.onclick = () => {
                cleanup();
                reject(new Error('User cancelled'));
            };
            
            closeBtn.onclick = () => {
                cleanup();
                reject(new Error('User cancelled'));
            };
        });
        
        if (!signResult.success) {
            throw new Error('Failed to sign PSBT');
        }
        
        console.log('✅ PSBT signed:', signResult.signedPsbt ? 'Yes' : 'No');
        
        // Mostrar loading novamente para finalização
        showLoading('Finalizing transaction...');
        
        // 3.5. Finalizar PSBT e extrair hex (chamar backend)
        console.log('\n🔨 Step 2.5: Finalizing PSBT...');
        const finalizeResponse = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/finalize-psbt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                psbt: signResult.signedPsbt
            })
        });
        
        const finalizeData = await finalizeResponse.json();
        
        if (!finalizeData.success) {
            throw new Error(finalizeData.error || 'Failed to finalize PSBT');
        }
        
        console.log('✅ PSBT finalized');
        console.log('   Hex length:', finalizeData.hex?.length || 0);
        
        // 4. Broadcast transaction
        console.log('\n📡 Step 3: Broadcasting transaction...');
        const broadcastResult = await chrome.runtime.sendMessage({
            action: 'broadcastTransaction',
            hex: finalizeData.hex
        });
        
        if (!broadcastResult.success) {
            throw new Error(broadcastResult.error || 'Failed to broadcast transaction');
        }
        
        console.log('✅ Transaction broadcast!');
        console.log('   TXID:', broadcastResult.txid);
        console.log('========== SEND COMPLETE ==========\n');
        
        // 💾 SALVAR INFO DA RUNE PARA ENRICHMENT NO ACTIVITY
        window.lastSentRune = {
            name: rune.displayName || rune.name,
            amount: amount.toString(),
            thumbnail: rune.thumbnail || rune.parentPreview,
            symbol: rune.symbol,
            txid: broadcastResult.txid,
            timestamp: Date.now()
        };
        console.log('💾 Saved rune info for activity enrichment:', window.lastSentRune);
        
        // 🔄 LIMPAR CACHE DE ACTIVITY E RUNES (nova transação!)
        clearActivityCache();
        console.log('🔔 Activity cache cleared - will refresh on next view');
        
        // 🔄 ATUALIZAÇÃO OTIMISTA: Atualizar saldo IMEDIATAMENTE (sem esperar confirmação)
        console.log('🔄 Optimistic update: Updating rune balance immediately...');
        
        // Atualizar cache de runes com novo saldo
        if (dataCache.runes && dataCache.runes.data) {
            try {
                // Parse do cache HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = dataCache.runes.data;
                
                // Encontrar o item da rune e atualizar o amount
                const runeItems = tempDiv.querySelectorAll('.rune-item');
                let updated = false;
                
                runeItems.forEach(item => {
                    const runeName = item.dataset.runeName;
                    if (runeName === rune.name) {
                        const amountDiv = item.querySelector('.rune-amount');
                        if (amountDiv) {
                            const divisibility = rune.divisibility || 0;
                            const currentAmount = parseInt(rune.amount) || 0;
                            const sentAmount = parseInt(amount) || 0;
                            const newAmount = currentAmount - sentAmount;
                            
                            console.log(`  📊 ${runeName}: ${currentAmount} - ${sentAmount} = ${newAmount}`);
                            
                            if (newAmount > 0) {
                                amountDiv.textContent = formatRuneAmount(newAmount);
                            } else {
                                // Remove o item se o saldo for 0
                                item.remove();
                            }
                            
                            updated = true;
                        }
                    }
                });
                
                if (updated) {
                    dataCache.runes.data = tempDiv.innerHTML;
                    console.log('  ✅ Rune balance updated optimistically');
                    
                    // Se estamos na tab de runes, atualizar a UI imediatamente
                    const runesList = document.getElementById('runes-list');
                    if (runesList && !runesList.classList.contains('hidden')) {
                        runesList.innerHTML = dataCache.runes.data;
                        console.log('  ✅ UI updated immediately!');
                    }
                }
            } catch (updateError) {
                console.warn('⚠️  Failed optimistic update:', updateError);
                // Se falhar, limpar cache para forçar refresh
                dataCache.runes = { data: null, timestamp: null, loaded: false };
            }
        } else {
            // Se não tem cache, apenas limpar
            dataCache.runes = { data: null, timestamp: null, loaded: false };
            console.log('🔔 Runes cache cleared - will refresh on next view');
        }
        
        // Esconder loading
        hideLoading();
        
        // Mostrar notificação de sucesso
        showTransactionNotification(
            broadcastResult.txid,
            broadcastResult.txid.substring(0, 8) + '...' + broadcastResult.txid.substring(56)
        );
        
        // Voltar para a tela de wallet
        showScreen('wallet');
        
        return {
            success: true,
            txid: broadcastResult.txid,
            fee: buildData.fee
        };
        
    } catch (error) {
        console.error('❌ Error in sendRuneTransaction:', error);
        throw error;
    }
}

// 🔥 Show Burn Rune Screen
function showBurnRuneScreen(rune) {
    console.log('🔥 Preparing to burn rune:', rune.name);
    
    const burnScreen = document.createElement('div');
    burnScreen.className = 'rune-details-screen';
    burnScreen.id = 'burn-rune-screen';
    
    burnScreen.innerHTML = `
        <div class="rune-details-header">
            <button class="rune-details-back" id="burn-rune-back">←</button>
            <div class="rune-details-title">🔥 Burn ${rune.symbol || '⧈'} ${rune.displayName || rune.name}</div>
        </div>
        
        <div class="rune-details-content" style="padding: 24px;">
            <!-- Thumbnail da Rune -->
            <div style="display: flex; justify-content: center; margin-bottom: 24px;">
                <div style="width: 120px; height: 120px; border-radius: 12px; overflow: hidden; border: 2px solid #ff4444; position: relative;">
                    ${(rune.thumbnail || rune.parentPreview)
                        ? `<img src="${rune.thumbnail || rune.parentPreview}" alt="${rune.displayName || rune.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div class="rune-thumbnail-fallback" style="width: 100%; height: 100%; display: none; font-size: 64px; align-items: center; justify-content: center; background: #2a2a2a;">${rune.symbol || '⧈'}</div>`
                        : `<div class="rune-thumbnail-fallback" style="width: 100%; height: 100%; display: flex; font-size: 64px; align-items: center; justify-content: center; background: #2a2a2a;">${rune.symbol || '⧈'}</div>`
                    }
                    ${isRuneVerified(rune.name) 
                        ? `<div class="rune-verified-badge" style="position: absolute; top: -4px; right: -4px;"></div>`
                        : ''
                    }
                </div>
            </div>
            
            <div class="burn-warning" style="background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                <div style="font-size: 48px; text-align: center; margin-bottom: 12px;">⚠️</div>
                <div style="color: white; text-align: center; font-weight: 600; margin-bottom: 8px;">PERMANENT ACTION</div>
                <div style="color: rgba(255,255,255,0.9); text-align: center; font-size: 14px;">
                    Burned runes are <strong>permanently destroyed</strong> and cannot be recovered. This action is irreversible!
                </div>
            </div>
            
            <div class="rune-info-grid" style="margin-bottom: 24px;">
                <div class="rune-info-item">
                    <div class="rune-info-label">Your Balance</div>
                    <div class="rune-info-value">${formatRuneAmount(rune.amount)} ${rune.symbol || ''}</div>
                </div>
            </div>
            
            <form id="burn-rune-form">
                <div class="form-group">
                    <label>Amount to Burn</label>
                    <input type="number" id="burn-amount" min="0" step="any" max="${rune.amount}" placeholder="Enter amount" required 
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #ff4444; border-radius: 8px; color: #fff; font-size: 16px;">
                    <div style="color: #888; font-size: 12px; margin-top: 8px;">
                        Max: ${formatRuneAmount(rune.amount)}
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Fee Rate (sat/vB)</label>
                    <input type="number" id="burn-fee-rate" min="1" value="1" required
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 16px;">
                </div>
                
                <div class="form-group" style="margin-top: 24px;">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                        <input type="checkbox" id="burn-confirm" required style="width: 20px; height: 20px;">
                        <span>I understand this action is permanent and cannot be undone</span>
                    </label>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); margin-top: 24px; padding: 16px; font-weight: 600;">
                    🔥 Burn Runes Permanently
                </button>
            </form>
        </div>
    `;
    
    document.body.appendChild(burnScreen);
    
    // Event listeners
    document.getElementById('burn-rune-back').addEventListener('click', () => {
        burnScreen.remove();
    });
    
    document.getElementById('burn-rune-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = document.getElementById('burn-amount').value;
        const feeRate = document.getElementById('burn-fee-rate').value;
        const confirmed = document.getElementById('burn-confirm').checked;
        
        if (!confirmed) {
            showNotification('❌ Please confirm you understand this action is permanent', 'error');
            return;
        }
        
        try {
            showLoading('🔥 Burning runes...');
            
            // TODO: Implementar burnRuneTransaction
            showNotification('🚧 Burn feature coming soon! Backend ready, testing in progress.', 'info');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            showNotification('❌ ' + error.message, 'error');
        }
    });
}

// 🎨 Show Create New Rune Screen (Etching)
function showCreateRuneScreen() {
    console.log('🎨 Opening Create New Rune screen');
    
    const createScreen = document.createElement('div');
    createScreen.className = 'rune-details-screen';
    createScreen.id = 'create-rune-screen';
    
    createScreen.innerHTML = `
        <div class="rune-details-header">
            <button class="rune-details-back" id="create-rune-back">←</button>
            <div class="rune-details-title">🎨 Create New Rune</div>
        </div>
        
        <div class="rune-details-content" style="padding: 24px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
                <div style="color: white; font-weight: 600; margin-bottom: 8px;">Launch Your Own Rune</div>
                <div style="color: rgba(255,255,255,0.9); font-size: 14px;">
                    Create a fungible token on Bitcoin using the Runes protocol
                </div>
            </div>
            
            <form id="create-rune-form">
                <div class="form-group">
                    <label>Rune Name *</label>
                    <input type="text" id="rune-name" placeholder="MY•AWESOME•RUNE" required
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #6366f1; border-radius: 8px; color: #fff; font-size: 16px; text-transform: uppercase;">
                    <div style="color: #888; font-size: 12px; margin-top: 8px;">
                        Use bullets (•) to separate words. Only A-Z allowed.
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Symbol/Emoji *</label>
                    <input type="text" id="rune-symbol" placeholder="🚀" maxlength="2" required
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 24px; text-align: center;">
                    <div style="color: #888; font-size: 12px; margin-top: 8px;">
                        Single character or emoji
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Decimals</label>
                    <input type="number" id="rune-decimals" min="0" max="38" value="0"
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 16px;">
                    <div style="color: #888; font-size: 12px; margin-top: 8px;">
                        Number of decimal places (0-38)
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Total Supply</label>
                    <input type="number" id="rune-supply" min="0" placeholder="0 = unlimited" value="1000000"
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 16px;">
                    <div style="color: #888; font-size: 12px; margin-top: 8px;">
                        0 = unlimited (open mint)
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Premine</label>
                    <input type="number" id="rune-premine" min="0" value="0"
                           style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 16px;">
                    <div style="color: #888; font-size: 12px; margin-top: 8px;">
                        Amount minted to your address immediately
                    </div>
                </div>
                
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                        <input type="checkbox" id="rune-turbo" style="width: 20px; height: 20px;">
                        <span>⚡ Turbo Mode (fast minting)</span>
                    </label>
                </div>
                
                <div style="background: #2a2a2a; padding: 16px; border-radius: 8px; margin-top: 24px;">
                    <div style="color: #ff9500; font-weight: 600; margin-bottom: 8px;">💰 Estimated Cost</div>
                    <div style="color: #888; font-size: 14px;">
                        • Etching Fee: ~0.001 BTC<br>
                        • Network Fee: Variable (based on congestion)
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); margin-top: 24px; padding: 16px; font-weight: 600;">
                    ✨ Create Rune
                </button>
            </form>
        </div>
    `;
    
    document.body.appendChild(createScreen);
    
    // Event listeners
    document.getElementById('create-rune-back').addEventListener('click', () => {
        createScreen.remove();
    });
    
    document.getElementById('create-rune-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('rune-name').value;
        const symbol = document.getElementById('rune-symbol').value;
        const decimals = parseInt(document.getElementById('rune-decimals').value);
        const supply = parseInt(document.getElementById('rune-supply').value);
        const premine = parseInt(document.getElementById('rune-premine').value);
        const turbo = document.getElementById('rune-turbo').checked;
        
        try {
            showLoading('🎨 Creating your rune...');
            
            // TODO: Implementar createRuneTransaction
            showNotification('🚧 Create Rune feature coming soon! Backend ready, testing in progress.', 'info');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            showNotification('❌ ' + error.message, 'error');
        }
    });
}

// Notifications
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    
    if (!notification) {
        console.error('❌ Notification element not found!');
        console.error('   Message was:', message);
        // Fallback: usar console
        if (type === 'error') {
            console.error('🔴', message);
        } else if (type === 'success') {
            console.log('✅', message);
        } else {
            console.log('ℹ️', message);
        }
        return;
    }
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

/**
 * Tela de sucesso para listagem no marketplace (dentro do popup)
 */
function showListingSuccessScreen(inscriptionId, price, orderId) {
    // Atualizar preço na tela
    const priceEl = document.getElementById('listing-success-price');
    if (priceEl) {
        priceEl.textContent = `${price.toLocaleString()} sats`;
    }
    
    // Configurar botão View on KrayScan
    const viewBtn = document.getElementById('listing-success-view-btn');
    if (viewBtn) {
        viewBtn.onclick = () => {
            const krayscanUrl = `https://kraywallet-backend.onrender.com/krayscan.html?inscription=${inscriptionId}`;
            window.open(krayscanUrl, '_blank');
        };
    }
    
    // Configurar botão Done
    const doneBtn = document.getElementById('listing-success-done-btn');
    if (doneBtn) {
        doneBtn.onclick = () => {
            showScreen('wallet');
            loadWalletData();
        };
    }
    
    // Mostrar tela de sucesso
    showScreen('listing-success');
}

/**
 * 🎉 Show Buy Now Success Modal
 * Beautiful success modal for completed Buy Now sales
 */
function showBuyNowSuccessModal(txid, orderId) {
    console.log('🎉 Showing Buy Now success modal');
    console.log('   TXID:', txid);
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'buynow-success-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 20px;
            padding: 30px;
            max-width: 360px;
            width: 90%;
            text-align: center;
            border: 1px solid #3d5a80;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: slideUp 0.4s ease;
        ">
            <div style="
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                animation: pulse 2s infinite;
            ">
                <span style="font-size: 40px;">✅</span>
            </div>
            
            <h2 style="
                color: #fff;
                font-size: 24px;
                margin: 0 0 10px 0;
                font-weight: 700;
            ">Sale Complete!</h2>
            
            <p style="
                color: #94a3b8;
                font-size: 14px;
                margin: 0 0 20px 0;
            ">The inscription has been transferred successfully.</p>
            
            <div style="
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
            ">
                <div style="color: #94a3b8; font-size: 12px; margin-bottom: 5px;">Transaction ID</div>
                <div style="
                    color: #22c55e;
                    font-size: 13px;
                    font-family: monospace;
                    word-break: break-all;
                ">${txid}</div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="window.open('https://mempool.space/tx/${txid}', '_blank')" style="
                    flex: 1;
                    background: transparent;
                    border: 1px solid #3d5a80;
                    color: #fff;
                    padding: 12px;
                    border-radius: 10px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    🔗 Mempool
                </button>
                <button onclick="window.open('https://krayspace.com/krayscan.html?txid=${txid}', '_blank')" style="
                    flex: 1;
                    background: transparent;
                    border: 1px solid #3d5a80;
                    color: #fff;
                    padding: 12px;
                    border-radius: 10px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    🔍 KrayScan
                </button>
            </div>
            
            <button id="buynow-success-done-btn" style="
                width: 100%;
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                border: none;
                color: #fff;
                padding: 14px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 15px;
                transition: all 0.2s;
            ">
                ✅ Done
            </button>
        </div>
        
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    // Done button closes modal and returns to wallet
    document.getElementById('buynow-success-done-btn').onclick = () => {
        modal.remove();
        showScreen('wallet');
        loadWalletData();
    };
}

// Notificação especial para transações (clicável)
function showTransactionNotification(txid, txidShort) {
    const notification = document.getElementById('notification');
    
    if (!notification) {
        console.error('❌ Notification element not found!');
        return;
    }
    
    // Limpar conteúdo anterior
    notification.innerHTML = '';
    notification.className = 'notification success';
    notification.classList.remove('hidden');
    
    // Criar conteúdo clicável
    const content = document.createElement('div');
    content.style.cursor = 'pointer';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '4px';
    
    const title = document.createElement('div');
    title.textContent = '✅ Transaction Broadcasted!';
    title.style.fontWeight = '600';
    
    const txidEl = document.createElement('div');
    txidEl.textContent = `TXID: ${txidShort}`;
    txidEl.style.fontSize = '12px';
    txidEl.style.opacity = '0.9';
    
    const hint = document.createElement('div');
    hint.textContent = '👆 Click to view on mempool.space';
    hint.style.fontSize = '11px';
    hint.style.opacity = '0.7';
    hint.style.marginTop = '2px';
    
    content.appendChild(title);
    content.appendChild(txidEl);
    content.appendChild(hint);
    
    // Adicionar click handler
    content.addEventListener('click', () => {
        const url = `https://kray-station.vercel.app/krayscan.html?txid=${txid}`;
        chrome.tabs.create({ url });
        notification.classList.add('hidden');
    });
    
    notification.appendChild(content);
    
    // Auto-hide após 5 segundos
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
}

// ==========================================
// 🔧 SETTINGS HANDLERS
// ==========================================

// Reset Wallet
async function handleResetWallet() {
    const confirmed = confirm(
        '⚠️ Are you sure you want to reset your wallet?\n\n' +
        'This will DELETE all data including:\n' +
        '- Your mnemonic phrase\n' +
        '- Your private keys\n' +
        '- All wallet data\n\n' +
        'Make sure you have SAVED your mnemonic!\n\n' +
        'This action CANNOT be undone!'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = confirm(
        '⚠️ FINAL WARNING!\n\n' +
        'This will permanently delete your wallet.\n\n' +
        'Have you saved your mnemonic?\n\n' +
        'Click OK to proceed with deletion.'
    );
    
    if (!doubleConfirm) return;
    
    showLoading('Resetting wallet...');
    
    try {
        // Limpar storage
        await chrome.storage.local.clear();
        
        // Limpar estado
        wallet = null;
        
        showNotification('✅ Wallet reset successfully!', 'success');
        
        // Voltar para tela inicial
        setTimeout(() => {
            showScreen('no-wallet');
            hideLoading();
        }, 1000);
        
    } catch (error) {
        console.error('Error resetting wallet:', error);
        showNotification('❌ Failed to reset wallet', 'error');
        hideLoading();
    }
}

// Reveal Mnemonic
async function handleRevealMnemonic() {
    const password = document.getElementById('view-mnemonic-password').value;
    
    if (!password) {
        showNotification('Please enter your password', 'error');
        return;
    }
    
    showLoading('Decrypting...');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getMnemonic',
            data: { password }
        });
        
        if (response.success) {
            document.getElementById('mnemonic-display-security').textContent = response.mnemonic;
            document.getElementById('mnemonic-display-security').classList.remove('hidden');
            document.getElementById('copy-mnemonic-btn').classList.remove('hidden');
            document.getElementById('reveal-mnemonic-btn').classList.add('hidden');
            showNotification('✅ Mnemonic revealed', 'success');
        } else {
            showNotification('❌ ' + (response.error || 'Invalid password'), 'error');
        }
    } catch (error) {
        console.error('Error revealing mnemonic:', error);
        showNotification('❌ Failed to reveal mnemonic', 'error');
    } finally {
        hideLoading();
    }
}

// Copy Mnemonic
async function handleCopyMnemonic() {
    const mnemonic = document.getElementById('mnemonic-display-security').textContent;
    
    try {
        await navigator.clipboard.writeText(mnemonic);
        showNotification('✅ Mnemonic copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying:', error);
        showNotification('❌ Failed to copy', 'error');
    }
}

// Reveal Private Key
async function handleRevealPrivateKey() {
    const password = document.getElementById('view-key-password').value;
    
    if (!password) {
        showNotification('Please enter your password', 'error');
        return;
    }
    
    showLoading('Decrypting...');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getPrivateKey',
            data: { password }
        });
        
        if (response.success) {
            document.getElementById('private-key-display').textContent = response.privateKey;
            document.getElementById('private-key-display').classList.remove('hidden');
            document.getElementById('copy-key-btn').classList.remove('hidden');
            document.getElementById('reveal-key-btn').classList.add('hidden');
            showNotification('✅ Private key revealed', 'success');
        } else {
            showNotification('❌ ' + (response.error || 'Invalid password'), 'error');
        }
    } catch (error) {
        console.error('Error revealing private key:', error);
        showNotification('❌ Failed to reveal private key', 'error');
    } finally {
        hideLoading();
    }
}

// Copy Private Key
async function handleCopyPrivateKey() {
    const privateKey = document.getElementById('private-key-display').textContent;
    
    try {
        await navigator.clipboard.writeText(privateKey);
        showNotification('✅ Private key copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying:', error);
        showNotification('❌ Failed to copy', 'error');
    }
}

// ==========================================
// 🔏 PSBT CONFIRMATION SCREEN
// ==========================================

/**
 * Setup fee selector for atomic swap
 */
function setupFeeSelector(pendingPsbt) {
    console.log('💰 Setting up fee selector...');
    
    // Buscar fees disponíveis
    fetch('https://kraywallet-backend.onrender.com/api/wallet/fees')
        .then(r => r.json())
        .then(data => {
            const fees = data.fees;
            let selectedFee = pendingPsbt.feeRate || fees.high;
            
            // Event listeners para botões
            const feeButtons = document.querySelectorAll('.fee-btn');
            feeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const feeType = btn.dataset.feeType;
                    
                    // Remover active de todos
                    feeButtons.forEach(b => {
                        b.classList.remove('fee-btn-active');
                        b.style.border = '1px solid #444';
                        b.style.background = '#2a2a2a';
                        b.style.color = '#fff';
                        b.textContent = b.dataset.feeType.charAt(0).toUpperCase() + b.dataset.feeType.slice(1);
                    });
                    
                    // Ativar o clicado
                    btn.classList.add('fee-btn-active');
                    btn.style.border = '1px solid #FFC107';
                    btn.style.background = 'rgba(255,193,7,0.2)';
                    btn.style.color = '#FFC107';
                    btn.textContent = feeType.charAt(0).toUpperCase() + feeType.slice(1) + ' ✓';
                    
                    // Atualizar fee selecionada
                    selectedFee = fees[feeType];
                    pendingPsbt.feeRate = selectedFee;
                    
                    console.log(`💰 Fee changed to ${feeType}: ${selectedFee} sat/vB`);
                    
                    document.querySelector('.fee-info div:first-child').textContent = 
                        `⚡ Network Fee: ${selectedFee} sat/vB`;
                });
            });
            
            // Custom fee input
            const customInput = document.getElementById('custom-fee-input');
            if (customInput) {
                customInput.addEventListener('input', (e) => {
                    const customFee = parseInt(e.target.value);
                    if (customFee && customFee > 0) {
                        selectedFee = customFee;
                        pendingPsbt.feeRate = selectedFee;
                        
                        console.log(`💰 Custom fee: ${selectedFee} sat/vB`);
                        
                        // Desativar botões
                        feeButtons.forEach(b => {
                            b.classList.remove('fee-btn-active');
                            b.style.border = '1px solid #444';
                            b.style.background = '#2a2a2a';
                            b.style.color = '#fff';
                            b.textContent = b.dataset.feeType.charAt(0).toUpperCase() + b.dataset.feeType.slice(1);
                        });
                        
                        document.querySelector('.fee-info div:first-child').textContent = 
                            `⚡ Network Fee: ${selectedFee} sat/vB (Custom)`;
                    }
                });
            }
        })
        .catch(err => console.warn('⚠️  Failed to fetch fees for selector:', err));
}

async function showPsbtConfirmation() {
    try {
        console.log('🔏 Loading PSBT confirmation DATA (screen already shown)...');
        
        // NÃO chama showScreen aqui - a tela JÁ foi trocada antes!
        // showScreen('confirm-psbt'); // ❌ REMOVIDO - causa conflito!
        
        // Buscar pending PSBT do background
        const response = await sendMessage({ action: 'getPendingPsbt' });
        
        if (!response.success || !response.pending) {
            console.warn('⚠️ No pending PSBT found in showPsbtConfirmation');
            // NÃO FECHAR O POPUP! Apenas voltar para a tela da wallet
            showScreen('wallet');
            await loadWalletData();
            return;
        }
        
        const pendingPsbt = response.pending;
        console.log('📋 Pending PSBT:', pendingPsbt);
        
        // Decodificar PSBT para extrair informações
        let psbtDetails = null;
        try {
            const decodeResponse = await fetch('https://kraywallet-backend.onrender.com/api/psbt/decode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ psbt: pendingPsbt.psbt })
            });
            psbtDetails = await decodeResponse.json();
            console.log('📊 PSBT decoded:', psbtDetails);
        } catch (decodeError) {
            console.warn('⚠️ Could not decode PSBT:', decodeError);
        }
        
        // Construir visualização detalhada do PSBT (design profissional)
        const detailsContainer = document.getElementById('psbt-details-container');
        
        // Verificar tipo de transação
        const isRuneTransfer = pendingPsbt.isRuneTransfer || false;
        const isAtomicSwap = pendingPsbt.type === 'createOffer' || pendingPsbt.type === 'buyAtomicSwap';
        const isSeller = pendingPsbt.type === 'createOffer';
        const isBuyer = pendingPsbt.type === 'buyAtomicSwap';
        
        // 🛡️ DESIGN PROFISSIONAL PARA ATOMIC SWAP (VENDEDOR E COMPRADOR)
        if (isAtomicSwap) {
            const sighashDisplay = pendingPsbt.sighashType || (isSeller ? 'NONE|ANYONECANPAY' : 'ALL');
            const roleEmoji = isSeller ? '🏷️' : '🛒';
            const roleText = isSeller ? 'List Inscription' : 'Buy Inscription';
            const roleDescription = isSeller 
                ? 'You are listing your inscription for sale on the marketplace.'
                : 'You are purchasing an inscription from the marketplace.';
            
            let html = `
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="font-size: 32px;">${roleEmoji}</div>
                        <div>
                            <div style="font-size: 18px; font-weight: 700; color: #fff;">${roleText}</div>
                            <div style="font-size: 12px; color: #888; margin-top: 4px;">${roleDescription}</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 12px;">
                            <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px;">Security</div>
                            <div style="font-size: 14px; color: #10B981; font-weight: 600;">🛡️ Guardian Protected</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 12px;">
                            <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px;">SIGHASH</div>
                            <div style="font-size: 12px; color: #FFC107; font-weight: 600; font-family: monospace;">${sighashDisplay}</div>
                        </div>
                    </div>
            `;
            
            // Info específica para vendedor
            if (isSeller && pendingPsbt.seller_value) {
                html += `
                    <div style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 12px; padding: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 12px; color: #8B5CF6;">Inscription Value</span>
                            <span style="font-size: 14px; color: #fff; font-weight: 600;">${pendingPsbt.seller_value} sats</span>
                        </div>
                        ${pendingPsbt.price ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(139,92,246,0.2);">
                            <span style="font-size: 12px; color: #8B5CF6;">Listing Price</span>
                            <span style="font-size: 16px; color: #10B981; font-weight: 700;">${pendingPsbt.price} sats</span>
                        </div>
                        ` : ''}
                    </div>
                `;
            }
            
            // Info específica para comprador
            if (isBuyer && pendingPsbt.breakdown) {
                const b = pendingPsbt.breakdown;
                html += `
                    <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 12px; color: #10B981;">Price</span>
                            <span style="font-size: 14px; color: #fff;">${b.price || 0} sats</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 12px; color: #10B981;">Market Fee (2%)</span>
                            <span style="font-size: 14px; color: #fff;">${b.marketFee || 0} sats</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid rgba(16,185,129,0.2);">
                            <span style="font-size: 12px; color: #10B981; font-weight: 600;">Total</span>
                            <span style="font-size: 16px; color: #10B981; font-weight: 700;">${b.totalRequired || 0} sats</span>
                        </div>
                    </div>
                `;
            }
            
            html += `</div>`;
            
            detailsContainer.innerHTML = html;
        } else if (isRuneTransfer) {
            // Transação de Runes - mostrar info simplificada
            detailsContainer.innerHTML = `
                <div class="alert alert-info" style="margin-bottom: 16px;">
                    <strong>⧈ Rune Transfer</strong>
                    <p>You are about to send a Rune token.</p>
                </div>
                <div class="detail-row">
                    <span class="label">Transaction Type:</span>
                    <span class="value">Rune Transfer</span>
                </div>
                <div class="detail-row">
                    <span class="label">SIGHASH Type:</span>
                    <span class="value">${pendingPsbt.sighashType || 'ALL'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Inputs to sign:</span>
                    <span class="value">All</span>
                </div>
                <div class="detail-row">
                    <span class="label">Network:</span>
                    <span class="value">Bitcoin Mainnet</span>
                </div>
            `;
        } else if (psbtDetails && psbtDetails.inputs && psbtDetails.outputs) {
            // Calcular totais
            const totalInput = psbtDetails.inputs.reduce((sum, inp) => sum + (inp.value || 0), 0);
            const totalOutput = psbtDetails.outputs.reduce((sum, out) => sum + out.value, 0);
            const fee = totalInput - totalOutput;
            
            // Construir HTML detalhado
            let html = `
                <div class="psbt-section">
                    <h3>📥 Inputs (${psbtDetails.inputs.length})</h3>
            `;
            
            // Listar cada input
            psbtDetails.inputs.forEach((input, index) => {
                const addressShort = input.address 
                    ? input.address.slice(0, 8) + '...' + input.address.slice(-8)
                    : 'Unknown';
                const isSigning = pendingPsbt.inputsToSign?.find(i => i.index === index);
                
                html += `
                    <div class="psbt-item ${isSigning ? 'highlight' : ''}">
                        <div class="psbt-item-label">
                            Input #${index} ${isSigning ? '✍️ (You sign)' : '✅ (Signed)'}
                        </div>
                        <div class="psbt-item-value">
                            ${input.value || 0} sats
                        </div>
                        <div class="psbt-item-address">
                            ${addressShort}
                        </div>
                    </div>
                `;
            });
            
            html += `</div><div class="psbt-section">
                    <h3>📤 Outputs (${psbtDetails.outputs.length})</h3>
            `;
            
            // Listar cada output
            psbtDetails.outputs.forEach((output, index) => {
                const addressShort = output.address
                    ? output.address.slice(0, 8) + '...' + output.address.slice(-8)
                    : 'Script';
                    
                html += `
                    <div class="psbt-item">
                        <div class="psbt-item-label">
                            Output #${index}
                        </div>
                        <div class="psbt-item-value">
                            ${output.value} sats
                        </div>
                        <div class="psbt-item-address">
                            → ${addressShort}
                        </div>
                    </div>
                `;
            });
            
            html += `</div><div class="psbt-summary">
                    <div class="summary-row">
                        <span>Total Input:</span>
                        <span>${totalInput} sats</span>
                    </div>
                    <div class="summary-row">
                        <span>Total Output:</span>
                        <span>${totalOutput} sats</span>
                    </div>
                    <div class="summary-row fee-row">
                        <span>Network Fee:</span>
                        <span>${fee} sats${pendingPsbt.feeRate ? ` (${pendingPsbt.feeRate} sat/vB)` : ''}</span>
                    </div>
                </div>
                
                ${pendingPsbt.type === 'buyAtomicSwap' && pendingPsbt.feeRate ? `
                <div class="fee-info" style="margin-top: 12px; padding: 8px; background: rgba(255,193,7,0.1); border-radius: 8px; font-size: 11px;">
                    <div style="margin-bottom: 4px; font-weight: 600; color: #FFC107;">⚡ Network Fee: ${pendingPsbt.feeRate} sat/vB</div>
                    <div style="color: #888;">Using HIGH priority for atomic swap (fast confirmation)</div>
                </div>
                
                <div class="fee-selector" style="margin-top: 12px;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 6px;">Adjust fee (optional):</div>
                    <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                        <button class="fee-btn" data-fee-type="low" style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #444; background: #2a2a2a; color: #fff; border-radius: 6px; cursor: pointer;">Low</button>
                        <button class="fee-btn" data-fee-type="medium" style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #444; background: #2a2a2a; color: #fff; border-radius: 6px; cursor: pointer;">Medium</button>
                        <button class="fee-btn fee-btn-active" data-fee-type="high" style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #FFC107; background: rgba(255,193,7,0.2); color: #FFC107; border-radius: 6px; cursor: pointer; font-weight: 600;">High ✓</button>
                    </div>
                    <input type="number" id="custom-fee-input" placeholder="Custom fee (sat/vB)" min="1" max="1000" style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 12px;" />
                </div>
                ` : ''}
            `;
            
            detailsContainer.innerHTML = html;
            
            // 🎯 Adicionar event listeners para fee buttons (se for atomic swap)
            if (pendingPsbt.type === 'buyAtomicSwap') {
                setupFeeSelector(pendingPsbt);
            }
            
        } else {
            // Fallback se não conseguir decodificar
            detailsContainer.innerHTML = `
                <div class="detail-row">
                    <span class="label">Type:</span>
                    <span class="value">Atomic Swap</span>
                </div>
                <div class="detail-row">
                    <span class="label">Inputs to sign:</span>
                    <span class="value">${pendingPsbt.inputsToSign?.length || 'All'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Network:</span>
                    <span class="value">Bitcoin Mainnet</span>
                </div>
            `;
        }
        
        // Focus no campo de senha
        // (Event listeners são registrados em DOMContentLoaded)
        document.getElementById('psbt-confirm-password').focus();
        
    } catch (error) {
        console.error('❌ Error showing PSBT confirmation:', error);
        showNotification('❌ Error loading PSBT request', 'error');
        window.close();
    }
}

// ==========================================
// ⚡ LIGHTNING PAYMENT CONFIRMATION
// ==========================================

async function showLightningPaymentConfirmation(paymentRequest) {
    try {
        console.log('⚡ Loading Lightning payment confirmation...');
        
        // Se não foi passado paymentRequest, buscar do storage
        if (!paymentRequest) {
            const lightningCheck = await chrome.storage.local.get(['pendingPaymentRequest']);
            paymentRequest = lightningCheck.pendingPaymentRequest;
        }
        
        if (!paymentRequest || !paymentRequest.invoice) {
            console.warn('⚠️  No pending Lightning payment found');
            showScreen('wallet');
            await loadWalletData();
            return;
        }
        
        const decoded = paymentRequest.decoded;
        console.log('⚡ Payment details:', decoded);
        
        // Preencher detalhes do pagamento
        document.getElementById('lightning-amount').textContent = 
            `${decoded.amount?.toLocaleString() || '?'} sats`;
        
        document.getElementById('lightning-description').textContent = 
            decoded.description || 'No description';
        
        document.getElementById('lightning-destination').textContent = 
            decoded.destination ? 
            decoded.destination.substring(0, 20) + '...' + decoded.destination.substring(decoded.destination.length - 20) :
            'Unknown';
        
        document.getElementById('lightning-payment-hash').textContent = 
            decoded.paymentHash ? 
            decoded.paymentHash.substring(0, 20) + '...' + decoded.paymentHash.substring(decoded.paymentHash.length - 20) :
            'Unknown';
        
        // Formatar expiry
        if (decoded.expiry) {
            const expiryDate = new Date(decoded.expiry * 1000);
            const now = new Date();
            const diff = expiryDate - now;
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            
            if (diff > 0) {
                document.getElementById('lightning-expiry').textContent = 
                    `${minutes}m ${seconds}s`;
            } else {
                document.getElementById('lightning-expiry').textContent = 
                    '⚠️  Expired';
                document.getElementById('lightning-expiry').style.color = '#f44336';
            }
        } else {
            document.getElementById('lightning-expiry').textContent = 'No expiry';
        }
        
        // Focus no campo de senha
        document.getElementById('lightning-payment-password').focus();
        
    } catch (error) {
        console.error('❌ Error showing Lightning payment confirmation:', error);
        showNotification('❌ Error loading Lightning payment request', 'error');
        showScreen('wallet');
        await loadWalletData();
    }
}

async function handleLightningPaymentConfirm() {
    const password = document.getElementById('lightning-payment-password').value;
    
    if (!password) {
        showNotification('❌ Please enter your password', 'error');
        return;
    }
    
    try {
        // Mostrar status de loading
        const statusDiv = document.getElementById('lightning-payment-status');
        const statusText = document.getElementById('lightning-payment-status-text');
        statusDiv.classList.remove('hidden');
        statusDiv.className = 'alert alert-info';
        statusText.textContent = '⏳ Processing Lightning payment...';
        
        // Desabilitar botão
        const confirmBtn = document.getElementById('lightning-payment-confirm-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = '⏳ Processing...';
        
        console.log('⚡ Confirming Lightning payment...');
        
        // Buscar pending payment
        const lightningCheck = await chrome.storage.local.get(['pendingPaymentRequest']);
        const paymentRequest = lightningCheck.pendingPaymentRequest;
        
        if (!paymentRequest || !paymentRequest.invoice) {
            throw new Error('No pending payment found');
        }
        
        // Chamar backend para pagar
        console.log('📡 Calling /api/lightning/pay...');
        const response = await fetch('https://kraywallet-backend.onrender.com/api/lightning/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoice: paymentRequest.invoice
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Payment failed');
        }
        
        console.log('✅ Payment successful!');
        console.log('   Preimage:', result.preimage);
        console.log('   Payment Hash:', result.paymentHash);
        
        // Salvar resultado no storage
        await chrome.storage.local.set({
            paymentResult: {
                success: true,
                preimage: result.preimage,
                paymentHash: result.paymentHash,
                amountSats: result.amountSats,
                timestamp: result.timestamp
            }
        });
        
        // Mostrar sucesso
        statusDiv.className = 'alert alert-success';
        statusText.textContent = '✅ Payment successful!';
        
        // Aguardar 1 segundo e fechar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Limpar pending payment
        await chrome.storage.local.remove('pendingPaymentRequest');
        
        // Voltar para wallet
        showScreen('wallet');
        await loadWalletData();
        showNotification('✅ Lightning payment sent successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Error processing Lightning payment:', error);
        
        // Mostrar erro
        const statusDiv = document.getElementById('lightning-payment-status');
        const statusText = document.getElementById('lightning-payment-status-text');
        statusDiv.classList.remove('hidden');
        statusDiv.className = 'alert alert-error';
        statusText.textContent = `❌ ${error.message}`;
        
        // Salvar erro no storage
        await chrome.storage.local.set({
            paymentResult: {
                success: false,
                error: error.message
            }
        });
        
        // Reabilitar botão
        const confirmBtn = document.getElementById('lightning-payment-confirm-btn');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '⚡ Pay Invoice';
    }
}

async function handleLightningPaymentCancel() {
    console.log('❌ Lightning payment cancelled by user');
    
    // Salvar cancelamento no storage
    await chrome.storage.local.set({
        paymentResult: {
            success: false,
            error: 'User cancelled'
        }
    });
    
    // Limpar pending payment
    await chrome.storage.local.remove('pendingPaymentRequest');
    
    // Voltar para wallet
    showScreen('wallet');
    await loadWalletData();
}

async function handlePsbtSign() {
    const password = document.getElementById('psbt-confirm-password').value;
    
    if (!password) {
        showNotification('❌ Please enter your password', 'error');
        return;
    }
    
    try {
        showLoading('Signing transaction...');
        
        console.log('✍️  Confirming PSBT sign...');
        
        const response = await sendMessage({
            action: 'confirmPsbtSign',
            data: { password }
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to sign PSBT');
        }
        
        console.log('✅ PSBT signed successfully!');
        
        // 🔍 Buscar pendingPsbtRequest para ver o tipo
        const pendingResponse = await sendMessage({ action: 'getPendingPsbt' });
        const pendingPsbt = pendingResponse?.pending;
        
        console.log('📋 Pending PSBT type:', pendingPsbt?.type);
        
        // 🎯 SE FOR createOffer, enviar para /api/atomic-swap/:id/sign automaticamente!
        if (pendingPsbt?.type === 'createOffer') {
            console.log('🛒 ===== CREATE OFFER FLOW (ATOMIC SWAP) =====');
            console.log('   Sending signed PSBT to /api/atomic-swap/:id/sign...');
            console.log('   Order ID:', pendingPsbt.order_id);
            console.log('   SIGHASH: NONE|ANYONECANPAY (0x82) - ARA MODEL');
            
            showLoading('Publishing atomic swap listing...');
            
            // Verificar se temos order_id
            if (!pendingPsbt.order_id) {
                throw new Error('Missing order_id from listing creation');
            }
            
            // Enviar para /api/atomic-swap/:id/sign (endpoint correto!)
            const offerResponse = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/${pendingPsbt.order_id}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signed_psbt_base64: response.signedPsbt
                })
            });
            
            if (!offerResponse.ok) {
                const errorData = await offerResponse.json();
                throw new Error(`Failed to publish listing: ${errorData.error || 'Unknown error'}`);
            }
            
            const offerResult = await offerResponse.json();
            console.log('✅ Atomic swap listing published:', offerResult);
            console.log('   Status:', offerResult.status);
            console.log('   Order ID:', offerResult.order_id);
            
            // Limpar pending PSBT
            await sendMessage({ action: 'cancelPsbtSign', data: { cancelled: false } });
            
            hideLoading();
            
            // Mostrar tela de sucesso (dentro do popup, padrão KrayWallet)
            const inscriptionId = pendingPsbt.inscriptionId;
            const price = pendingPsbt.price;
            showListingSuccessScreen(inscriptionId, price, offerResult.order_id);
            
        } else if (pendingPsbt?.type === 'buyAtomicSwap') {
            console.log('🛒 ===== BUY ATOMIC SWAP FLOW =====');
            console.log('   Sending signed PSBT to /api/atomic-swap/:id/broadcast...');
            console.log('   Order ID:', pendingPsbt.orderId);
            console.log('   Buyer Address:', pendingPsbt.buyerAddress);
            
            showLoading('Broadcasting purchase (with consensus validation)...');
            
            // 🔍 DEBUG: Log what we're sending
            console.log('📤 Sending to GUARDIAN BUILD broadcast:');
            console.log(`   signed_psbt_base64: ${response.signedPsbt?.length || 0} chars`);
            console.log(`   buyer_address: ${pendingPsbt.buyerAddress}`);
            console.log(`   seller_signature_hex: ${pendingPsbt.sellerSignatureHex ? `${pendingPsbt.sellerSignatureHex.length} chars` : 'NOT FOUND!'}`);
            console.log(`   seller_tx_context: ${pendingPsbt.sellerTxContext ? 'PROVIDED' : 'NOT FOUND!'}`);
            console.log(`   model: ${pendingPsbt.model || 'GUARDIAN_BUILD'}`);
            
            // Enviar para /api/atomic-swap/:orderId/broadcast (Guardians will BUILD final TX!)
            const broadcastResponse = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/${pendingPsbt.orderId}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signed_psbt_base64: response.signedPsbt,
                    buyer_address: pendingPsbt.buyerAddress,
                    seller_signature_hex: pendingPsbt.sellerSignatureHex,
                    seller_tx_context: pendingPsbt.sellerTxContext // 🔐 Full seller TX context
                })
            });
            
            const broadcastResult = await broadcastResponse.json();
            
            if (!broadcastResponse.ok || !broadcastResult.success) {
                // Check if it was a consensus rejection
                if (broadcastResult.consensus && !broadcastResult.consensus.approved) {
                    console.error('❌ Consensus rejected:', broadcastResult.consensus.errors);
                    throw new Error(`Consensus validation failed: ${broadcastResult.consensus.errors.join(', ')}`);
                }
                throw new Error(broadcastResult.error || 'Failed to broadcast purchase');
            }
            
            console.log('✅ Purchase broadcast!', broadcastResult);
            console.log('   TXID:', broadcastResult.txid);
            console.log('   Consensus:', broadcastResult.consensus);
            
            // Limpar pending PSBT
            await sendMessage({ action: 'cancelPsbtSign', data: { cancelled: false } });
            
            hideLoading();
            
            // 🔄 IMEDIATAMENTE voltar para wallet (antes da notificação)
            showScreen('wallet');
            
            // Mostrar sucesso com detalhes do consenso
            const consensusInfo = broadcastResult.consensus ? 
                `\n🗳️ Validated by ${broadcastResult.consensus.votes.approvals}/${broadcastResult.consensus.votes.totalVotes} validators` : '';
            
            showNotification(`✅ Purchase successful!${consensusInfo}\n\n📋 TXID: ${broadcastResult.txid.slice(0, 16)}...\n\n🎨 The inscription is now yours!`, 'success');
            
            // Recarregar dados da wallet
            await loadWalletData();
            
        } else if (pendingPsbt?.type === 'buyNow') {
            // 🛒 BUY NOW FLOW - Buyer signs and confirms
            console.log('🛒 ===== BUY NOW FLOW =====');
            console.log('   Confirming purchase with backend...');
            console.log('   Order ID:', pendingPsbt.orderId);
            console.log('   Purchase ID:', pendingPsbt.purchaseId);
            
            showLoading('Confirming purchase...');
            
            // Send signed PSBT to confirm endpoint
            const confirmResponse = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/buy-now/${pendingPsbt.orderId}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyer_signed_psbt: response.signedPsbt,
                    purchase_id: pendingPsbt.purchaseId
                })
            });
            
            const confirmResult = await confirmResponse.json();
            
            if (!confirmResponse.ok || !confirmResult.success) {
                throw new Error(confirmResult.error || 'Failed to confirm purchase');
            }
            
            console.log('✅ Purchase confirmed!', confirmResult);
            
            // Clear pending PSBT
            await sendMessage({ action: 'cancelPsbtSign', data: { cancelled: false } });
            
            hideLoading();
            showScreen('wallet');
            
            showNotification(`✅ Purchase confirmed!\n\n⏳ Waiting for seller to accept.\n\n📋 Order: ${pendingPsbt.orderId.slice(0, 20)}...`, 'success');
            
            await loadWalletData();
            
        } else if (pendingPsbt?.type === 'acceptBuyNow') {
            // 🎉 ACCEPT BUY NOW FLOW - Seller signs and broadcasts
            console.log('🎉 ===== ACCEPT BUY NOW FLOW =====');
            console.log('   Broadcasting sale...');
            console.log('   Order ID:', pendingPsbt.orderId);
            console.log('   Purchase ID:', pendingPsbt.purchaseId);
            
            showLoading('Broadcasting sale...');
            
            // Send signed PSBT to accept endpoint (broadcasts automatically!)
            const acceptResponse = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/buy-now/${pendingPsbt.orderId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seller_signed_psbt: response.signedPsbt,
                    purchase_id: pendingPsbt.purchaseId
                })
            });
            
            const acceptResult = await acceptResponse.json();
            
            if (!acceptResponse.ok || !acceptResult.success) {
                throw new Error(acceptResult.error || 'Failed to broadcast sale');
            }
            
            console.log('✅ Sale broadcast!', acceptResult);
            console.log('   TXID:', acceptResult.txid);
            
            // Clear pending PSBT
            await sendMessage({ action: 'cancelPsbtSign', data: { cancelled: false } });
            
            hideLoading();
            
            // Show success modal
            showBuyNowSuccessModal(acceptResult.txid, pendingPsbt.orderId);
            
        } else {
            // 🎯 FLUXO NORMAL (outros): Salvar resultado no storage
            console.log('🛍️ Default flow: saving result to storage');
            await chrome.storage.local.set({
                psbtSignResult: response
            });
        }
        
    } catch (error) {
        console.error('❌ Error signing PSBT:', error);
        showNotification('❌ ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function handlePsbtCancel() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ USER CANCELLED - CLEANING EVERYTHING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Notificar background que foi cancelado (limpa memória)
    try {
        await chrome.runtime.sendMessage({
            action: 'cancelPsbtSign',
            data: { cancelled: true }
        });
        console.log('✅ Background notified');
    } catch (error) {
        console.warn('⚠️  Could not notify background:', error);
    }
    
    // 2. 🔥 LIMPAR TUDO DO STORAGE (agressivo)
    await chrome.storage.local.remove([
        'psbtSignResult',
        'pendingPsbtRequest',
        'pendingMarketListing'
    ]);
    console.log('✅ Storage cleaned');
    
    // 3. Resetar flag de criação de listing
    if (typeof isCreatingListing !== 'undefined') {
        isCreatingListing = false;
        console.log('✅ isCreatingListing reset');
    }
    
    showNotification('❌ Transaction cancelled', 'info');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Verificar se popup é uma janela separada ou popup da extensão
    const isStandaloneWindow = window.opener === null && window.location.href.includes('popup.html');
    
    if (isStandaloneWindow) {
        // Se for popup da extensão, voltar para tela principal
        console.log('📱 Popup window, returning to main screen...');
        showScreen('wallet');
    } else {
        // Se for janela separada, fechar
        console.log('🪟 Separate window, closing...');
        setTimeout(() => {
            window.close();
        }, 100);
    }
}

/**
 * Wait for PSBT Sign Result (via chrome.storage)
 */
function waitForPsbtSignResult() {
    return new Promise((resolve, reject) => {
        console.log('⏳ Waiting for PSBT sign result...');
        
        const timeout = setTimeout(() => {
            console.error('⏱️  Timeout waiting for signature');
            reject(new Error('Signature timeout'));
        }, 120000); // 2 minutos
        
        // Listener para mudanças no storage
        const listener = (changes, namespace) => {
            if (namespace === 'local' && changes.psbtSignResult) {
                clearTimeout(timeout);
                chrome.storage.onChanged.removeListener(listener);
                
                const result = changes.psbtSignResult.newValue;
                console.log('✅ PSBT sign result received:', result);
                
                // Limpar resultado do storage
                chrome.storage.local.remove('psbtSignResult');
                
                resolve(result);
            }
        };
        
        chrome.storage.onChanged.addListener(listener);
    });
}

// Export Wallet
async function handleExportWallet() {
    showNotification('Export wallet feature coming soon!', 'info');
}

// ========================================
// DEX - LIQUIDITY POOLS
// ========================================

/**
 * Carregar e exibir liquidity pools
 */
async function loadLiquidityPools() {
    console.log('🏊 Loading liquidity pools...');
    
    const container = document.getElementById('pools-list');
    if (!container) {
        console.error('❌ Pools container not found');
        return;
    }

    try {
        // Buscar pools do backend
        const response = await fetch('https://kraywallet-backend.onrender.com/api/dex/pools?sortBy=tvl');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load pools');
        }

        const pools = data.pools || [];
        console.log(`✅ Loaded ${pools.length} pools`);

        if (pools.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center;">
                    <span style="font-size: 48px;">🏊</span>
                    <p style="margin-top: 16px; color: #888;">No liquidity pools yet</p>
                    <p style="margin-top: 8px; color: #666; font-size: 14px;">Create the first pool and start earning fees!</p>
                </div>
            `;
            return;
        }

        // Renderizar pools
        container.innerHTML = pools.map(pool => {
            // Determinar imagem da pool
            let poolImageHTML;
            if (pool.use_inscription && pool.pool_image) {
                // Usar inscription
                poolImageHTML = `
                    <div style="position: relative;">
                        <img src="${pool.pool_image}" 
                             style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 2px solid #f59e0b;" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                        <div style="display: none; width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;">💎</div>
                        <div style="position: absolute; bottom: -4px; right: -4px; background: #f59e0b; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid #2a2a2a;">💎</div>
                    </div>
                `;
            } else if (pool.pool_image) {
                // Usar URL normal
                poolImageHTML = `<img src="${pool.pool_image}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span style="display: none; font-size: 32px;">🏊</span>`;
            } else {
                // Emoji padrão
                poolImageHTML = '<span style="font-size: 32px;">🏊</span>';
            }

            return `
            <div class="pool-card" data-pool-id="${pool.id}" style="background: #2a2a2a; border-radius: 12px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${poolImageHTML}
                        <div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-weight: 600; font-size: 16px;">${pool.pool_name}</span>
                                ${pool.use_inscription ? '<span style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">ORDINAL</span>' : ''}
                            </div>
                            <div style="font-size: 12px; color: #888;">${pool.rune_a_name} / ${pool.rune_b_name || 'BTC'}</div>
                            ${pool.pool_inscription_number ? `<div style="font-size: 10px; color: #f59e0b; margin-top: 2px;">Inscription #${pool.pool_inscription_number}</div>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: 700; color: #10b981;">${pool.apr}%</div>
                        <div style="font-size: 12px; color: #888;">APR</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-top: 12px; border-top: 1px solid #333;">
                    <div>
                        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">TVL</div>
                        <div style="font-size: 14px; font-weight: 600;">${(pool.tvl / 100000000).toFixed(4)} BTC</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Volume 24h</div>
                        <div style="font-size: 14px; font-weight: 600;">${(pool.volume_24h / 100000000).toFixed(4)} BTC</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Fee</div>
                        <div style="font-size: 14px; font-weight: 600;">${pool.fee_percentage}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Swaps</div>
                        <div style="font-size: 14px; font-weight: 600;">${pool.swap_count || 0}</div>
                    </div>
                </div>

                <button class="swap-in-pool-btn" data-pool-id="${pool.id}" style="width: 100%; margin-top: 12px; padding: 10px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                    Swap
                </button>
            </div>
        `;
        }).join('');

        // Adicionar event listeners para cada pool
        container.querySelectorAll('.pool-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('swap-in-pool-btn')) {
                    e.stopPropagation();
                    const poolId = e.target.dataset.poolId;
                    showSwapScreen(poolId);
                } else {
                    const poolId = card.dataset.poolId;
                    showPoolDetails(poolId);
                }
            });
        });

    } catch (error) {
        console.error('❌ Error loading pools:', error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px; text-align: center;">
                <span style="font-size: 48px;">❌</span>
                <p style="margin-top: 16px; color: #ff4444;">Failed to load pools</p>
                <p style="margin-top: 8px; color: #666; font-size: 14px;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Mostrar tela de criação de pool
 */
async function showCreatePoolScreen() {
    console.log('🏊 ===== CREATE POOL SCREEN OPENING =====');
    console.log('   📍 User wants to create a new liquidity pool');
    console.log('   🔄 Loading user runes dynamically...');
    
    const existingScreen = document.querySelector('.create-pool-screen');
    if (existingScreen) {
        console.log('   🗑️ Removing existing screen');
        existingScreen.remove();
    }

    const screen = document.createElement('div');
    screen.className = 'create-pool-screen';
    screen.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #1a1a1a; z-index: 10000; overflow-y: auto;';

    screen.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                <button class="btn-back" id="create-pool-back-btn">←</button>
                <h2 style="margin: 0; font-size: 20px;">🏊 Create Liquidity Pool</h2>
            </div>

            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px;">💰 Earn Trading Fees</h3>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Provide liquidity and earn a share of all trading fees in your pool</p>
            </div>

            <form id="create-pool-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #888;">Pool Name</label>
                    <input type="text" id="pool-name" placeholder="e.g., DOG/BTC Official Pool" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px;">
                </div>

                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 16px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 24px;">💎</span>
                        <div>
                            <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Use Your Ordinal Inscription!</h4>
                            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Give value to your NFT by making it represent your pool</p>
                        </div>
                    </div>
                    
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                        <input type="checkbox" id="use-inscription" style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 14px; font-weight: 500;">🖼️ Use My Inscription as Pool Image</span>
                    </label>
                </div>

                <div id="inscription-inputs" style="display: none; background: #2a2a2a; border-radius: 12px; padding: 16px; border: 2px solid #f59e0b;">
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #f59e0b; font-weight: 600;">🖼️ Select Your Inscription</label>
                        
                        <!-- Campo de Busca -->
                        <div style="position: relative; margin-bottom: 12px;">
                            <input type="text" id="inscription-search" placeholder="🔍 Search by inscription number or ID..." style="width: 100%; padding: 12px 12px 12px 36px; background: #1a1a1a; border: 1px solid #f59e0b; border-radius: 8px; color: #fff; font-size: 14px;">
                            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 16px;">🔍</span>
                        </div>
                        
                        <!-- Info sobre quantidade -->
                        <div id="inscription-count-info" style="margin-bottom: 8px; font-size: 12px; color: #888; display: none;">
                            Showing <span id="inscription-shown-count">0</span> of <span id="inscription-total-count">0</span> inscriptions
                        </div>
                        
                        <!-- Dropdown Dinâmico de Inscriptions -->
                        <select id="inscription-select" size="6" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #f59e0b; border-radius: 8px; color: #fff; font-size: 14px; cursor: pointer; max-height: 240px; overflow-y: auto;">
                            <option value="">Loading your inscriptions...</option>
                        </select>
                        
                        <!-- Preview da Inscription Selecionada -->
                        <div id="inscription-preview" style="display: none; margin-top: 12px; padding: 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; border-radius: 8px;">
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <div id="inscription-preview-image" style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid #f59e0b; background: #1a1a1a; display: flex; align-items: center; justify-content: center;">
                                    <div class="spinner" style="width: 20px; height: 20px;"></div>
                                </div>
                                <div style="flex: 1;">
                                    <div id="inscription-preview-number" style="font-weight: 600; color: #f59e0b; font-size: 14px;">#0</div>
                                    <div id="inscription-preview-id" style="font-size: 11px; color: #888; margin-top: 4px; word-break: break-all;">ID: ...</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Hidden inputs para o form -->
                        <input type="hidden" id="pool-inscription-id" />
                        <input type="hidden" id="pool-inscription-number" />
                    </div>
                </div>

                <div id="image-url-input">
                    <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #888;">
                        <span>Pool Image URL</span>
                        <span style="font-size: 12px; opacity: 0.7;"> (or use inscription above)</span>
                    </label>
                    <input type="url" id="pool-image" placeholder="https://..." style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #888;">First Token</label>
                    
                    <!-- Dropdown de Runes -->
                    <select id="rune-a-select" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px; cursor: pointer;">
                        <option value="">Loading your runes...</option>
                    </select>
                    
                    <!-- Info da Rune Selecionada -->
                    <div id="rune-a-info" style="display: none; margin-top: 8px; padding: 12px; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div id="rune-a-name-display" style="font-weight: 600; color: #10b981; font-size: 14px;"></div>
                                <div id="rune-a-id-display" style="font-size: 12px; color: #888; margin-top: 2px;"></div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 12px; color: #888;">Your Balance</div>
                                <div id="rune-a-balance-display" style="font-weight: 700; color: #10b981; font-size: 16px;">0</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hidden inputs para o form -->
                    <input type="hidden" id="rune-a" />
                    <input type="hidden" id="rune-a-name" />
                </div>

                <div>
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px;">
                        <input type="checkbox" id="is-btc-pair" checked>
                        <span style="color: #888;">Pair with BTC (leave unchecked for Rune/Rune pair)</span>
                    </label>
                </div>

                <div id="rune-b-container" style="display: none;">
                    <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #888;">Second Token</label>
                    
                    <!-- Dropdown de Runes -->
                    <select id="rune-b-select" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px; cursor: pointer;">
                        <option value="">Loading your runes...</option>
                    </select>
                    
                    <!-- Info da Rune Selecionada -->
                    <div id="rune-b-info" style="display: none; margin-top: 8px; padding: 12px; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div id="rune-b-name-display" style="font-weight: 600; color: #10b981; font-size: 14px;"></div>
                                <div id="rune-b-id-display" style="font-size: 12px; color: #888; margin-top: 2px;"></div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 12px; color: #888;">Your Balance</div>
                                <div id="rune-b-balance-display" style="font-weight: 700; color: #10b981; font-size: 16px;">0</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hidden inputs -->
                    <input type="hidden" id="rune-b" />
                    <input type="hidden" id="rune-b-name" />
                </div>

                <div>
                    <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 14px; color: #888;">Initial Amount (Token A)</span>
                        <button type="button" id="max-amount-a-btn" style="padding: 4px 8px; background: #3b82f6; border: none; border-radius: 4px; color: white; font-size: 12px; cursor: pointer; display: none;">MAX</button>
                    </label>
                    <input type="number" id="initial-amount-a" placeholder="0" min="1" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px;">
                    <div id="amount-a-warning" style="display: none; margin-top: 6px; padding: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 6px; font-size: 12px; color: #ef4444;">
                        ⚠️ Amount exceeds your balance!
                    </div>
                </div>

                <div>
                    <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 14px; color: #888;">Initial Amount (Token B / BTC sats)</span>
                        <button type="button" id="max-amount-b-btn" style="padding: 4px 8px; background: #3b82f6; border: none; border-radius: 4px; color: white; font-size: 12px; cursor: pointer; display: none;">MAX</button>
                    </label>
                    <input type="number" id="initial-amount-b" placeholder="0" min="1" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px;">
                    <div id="amount-b-warning" style="display: none; margin-top: 6px; padding: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 6px; font-size: 12px; color: #ef4444;">
                        ⚠️ Amount exceeds your balance!
                    </div>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #888;">Fee Rate (%)</label>
                    <select id="fee-rate" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; color: #fff; font-size: 14px;">
                        <option value="5">0.05%</option>
                        <option value="10">0.10%</option>
                        <option value="30" selected>0.30%</option>
                        <option value="100">1.00%</option>
                    </select>
                </div>

                <button type="submit" style="padding: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; border-radius: 8px; color: white; font-weight: 600; font-size: 16px; cursor: pointer;">
                    🏊 Create Pool
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(screen);

    // ✅ Event listener para botão de voltar (CSP-safe)
    const backBtn = screen.querySelector('#create-pool-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            screen.remove();
        });
    }

    // 🔥 CARREGAR RUNES DO USUÁRIO
    await loadUserRunesForPool(screen);

    // Toggle inscription inputs
    const useInscription = screen.querySelector('#use-inscription');
    const inscriptionInputs = screen.querySelector('#inscription-inputs');
    const imageUrlInput = screen.querySelector('#image-url-input');
    
    useInscription.addEventListener('change', () => {
        if (useInscription.checked) {
            inscriptionInputs.style.display = 'block';
            imageUrlInput.style.opacity = '0.5';
            imageUrlInput.style.pointerEvents = 'none';
        } else {
            inscriptionInputs.style.display = 'none';
            imageUrlInput.style.opacity = '1';
            imageUrlInput.style.pointerEvents = 'auto';
        }
    });

    // Toggle rune-b inputs based on checkbox
    const isBtcPair = screen.querySelector('#is-btc-pair');
    const runeBContainer = screen.querySelector('#rune-b-container');
    
    isBtcPair.addEventListener('change', () => {
        runeBContainer.style.display = isBtcPair.checked ? 'none' : 'block';
    });

    // Handle form submission
    screen.querySelector('#create-pool-form').addEventListener('submit', handleCreatePool);
}

/**
 * Carregar runes do usuário para o form de criar pool
 */
async function loadUserRunesForPool(screen) {
    console.log('🔥 ===== LOADING USER RUNES FOR POOL =====');
    console.log('   📊 Fetching wallet info...');
    
    try {
        // Buscar endereço do usuário
        const walletInfo = await sendMessage({ action: 'getWalletInfo' });
        if (!walletInfo.success || !walletInfo.data || !walletInfo.data.address) {
            console.error('❌ Wallet not found or not unlocked');
            throw new Error('Wallet not found');
        }

        const userAddress = walletInfo.data.address;
        console.log(`   ✅ User address: ${userAddress}`);

        // 🖼️ CARREGAR INSCRIPTIONS DO USUÁRIO (em paralelo com runes)
        loadUserInscriptionsForPool(screen, userAddress);

        // Buscar runes do usuário
        const response = await sendMessage({ 
            action: 'getRunes',
            address: userAddress 
        });

        if (!response.success || !response.runes) {
            throw new Error('Failed to load runes');
        }

        const runes = response.runes;
        console.log(`   ✅ Loaded ${runes.length} runes for pool`);
        console.log(`   📋 Runes:`, runes.map(r => `${r.name} (${r.amount})`).join(', '));

        // Preencher dropdown de Rune A
        const runeASelect = screen.querySelector('#rune-a-select');
        runeASelect.innerHTML = '<option value="">Select a rune...</option>';
        
        runes.forEach(rune => {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                id: rune.runeId,
                name: rune.name,
                symbol: rune.symbol,
                balance: rune.amount
            });
            option.textContent = `${rune.name} ${rune.symbol} (${rune.amount.toLocaleString()})`;
            runeASelect.appendChild(option);
        });

        // Preencher dropdown de Rune B (mesmas runes)
        const runeBSelect = screen.querySelector('#rune-b-select');
        runeBSelect.innerHTML = '<option value="">Select a rune...</option>';
        
        runes.forEach(rune => {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                id: rune.runeId,
                name: rune.name,
                symbol: rune.symbol,
                balance: rune.amount
            });
            option.textContent = `${rune.name} ${rune.symbol} (${rune.amount.toLocaleString()})`;
            runeBSelect.appendChild(option);
        });

        // Event listener para Rune A
        runeASelect.addEventListener('change', () => {
            if (runeASelect.value) {
                const runeData = JSON.parse(runeASelect.value);
                
                // Preencher hidden inputs
                screen.querySelector('#rune-a').value = runeData.id;
                screen.querySelector('#rune-a-name').value = runeData.name;
                
                // Mostrar info
                const infoDiv = screen.querySelector('#rune-a-info');
                infoDiv.style.display = 'block';
                screen.querySelector('#rune-a-name-display').textContent = `${runeData.name} ${runeData.symbol}`;
                screen.querySelector('#rune-a-id-display').textContent = `ID: ${runeData.id}`;
                screen.querySelector('#rune-a-balance-display').textContent = runeData.balance.toLocaleString();
                
                // Mostrar botão MAX
                const maxBtn = screen.querySelector('#max-amount-a-btn');
                maxBtn.style.display = 'block';
                maxBtn.onclick = () => {
                    screen.querySelector('#initial-amount-a').value = runeData.balance;
                };
                
                // Validação em tempo real
                const amountInput = screen.querySelector('#initial-amount-a');
                const warningDiv = screen.querySelector('#amount-a-warning');
                
                amountInput.addEventListener('input', () => {
                    const amount = parseInt(amountInput.value);
                    if (amount > runeData.balance) {
                        warningDiv.style.display = 'block';
                        amountInput.style.borderColor = '#ef4444';
                    } else {
                        warningDiv.style.display = 'none';
                        amountInput.style.borderColor = '#444';
                    }
                });
            } else {
                screen.querySelector('#rune-a-info').style.display = 'none';
                screen.querySelector('#max-amount-a-btn').style.display = 'none';
            }
        });

        // Event listener para Rune B
        runeBSelect.addEventListener('change', () => {
            if (runeBSelect.value) {
                const runeData = JSON.parse(runeBSelect.value);
                
                // Preencher hidden inputs
                screen.querySelector('#rune-b').value = runeData.id;
                screen.querySelector('#rune-b-name').value = runeData.name;
                
                // Mostrar info
                const infoDiv = screen.querySelector('#rune-b-info');
                infoDiv.style.display = 'block';
                screen.querySelector('#rune-b-name-display').textContent = `${runeData.name} ${runeData.symbol}`;
                screen.querySelector('#rune-b-id-display').textContent = `ID: ${runeData.id}`;
                screen.querySelector('#rune-b-balance-display').textContent = runeData.balance.toLocaleString();
                
                // Mostrar botão MAX
                const maxBtn = screen.querySelector('#max-amount-b-btn');
                maxBtn.style.display = 'block';
                maxBtn.onclick = () => {
                    screen.querySelector('#initial-amount-b').value = runeData.balance;
                };
                
                // Validação em tempo real
                const amountInput = screen.querySelector('#initial-amount-b');
                const warningDiv = screen.querySelector('#amount-b-warning');
                
                amountInput.addEventListener('input', () => {
                    const amount = parseInt(amountInput.value);
                    if (amount > runeData.balance) {
                        warningDiv.style.display = 'block';
                        amountInput.style.borderColor = '#ef4444';
                    } else {
                        warningDiv.style.display = 'none';
                        amountInput.style.borderColor = '#444';
                    }
                });
            } else {
                screen.querySelector('#rune-b-info').style.display = 'none';
                screen.querySelector('#max-amount-b-btn').style.display = 'none';
            }
        });

        console.log('✅ Rune dropdowns configured!');

    } catch (error) {
        console.error('❌ Error loading runes:', error);
        const runeASelect = screen.querySelector('#rune-a-select');
        runeASelect.innerHTML = '<option value="">Error loading runes</option>';
    }
}

/**
 * Carregar inscriptions do usuário para o form de criar pool
 */
async function loadUserInscriptionsForPool(screen, userAddress) {
    console.log('🖼️ Loading user inscriptions for pool creation...');
    
    try {
        // Buscar inscriptions do usuário
        const response = await sendMessage({ 
            action: 'getInscriptions',
            data: { address: userAddress }
        });

        console.log('📦 Inscriptions response:', response);

        if (!response || !response.success) {
            throw new Error('Failed to load inscriptions');
        }

        const allInscriptions = response.inscriptions || [];
        console.log(`✅ Loaded ${allInscriptions.length} inscriptions for pool`);

        const inscriptionSelect = screen.querySelector('#inscription-select');
        const inscriptionSearch = screen.querySelector('#inscription-search');
        const countInfo = screen.querySelector('#inscription-count-info');
        const shownCount = screen.querySelector('#inscription-shown-count');
        const totalCount = screen.querySelector('#inscription-total-count');
        
        if (allInscriptions.length === 0) {
            inscriptionSelect.innerHTML = '<option value="">You have no inscriptions yet</option>';
            return;
        }

        // Mostrar info de quantidade
        totalCount.textContent = allInscriptions.length;
        countInfo.style.display = 'block';

        // Criar um container customizado para o dropdown (com imagens)
        const inscriptionListContainer = document.createElement('div');
        inscriptionListContainer.id = 'inscription-list-container';
        inscriptionListContainer.style.cssText = 'max-height: 280px; overflow-y: auto; border: 1px solid #f59e0b; border-radius: 8px; background: #1a1a1a;';
        
        // Substituir o select por um container custom
        inscriptionSelect.style.display = 'none';
        inscriptionSelect.parentNode.insertBefore(inscriptionListContainer, inscriptionSelect);

        // Função para renderizar inscriptions com imagens (limitado a 12)
        const renderInscriptions = (inscriptionsToShow) => {
            inscriptionListContainer.innerHTML = '';
            
            const limited = inscriptionsToShow.slice(0, 12);
            shownCount.textContent = limited.length;
            
            if (limited.length === 0) {
                inscriptionListContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No inscriptions found</div>';
                return;
            }
            
            limited.forEach(inscription => {
                const item = document.createElement('div');
                item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px; cursor: pointer; border-bottom: 1px solid #333; transition: background 0.2s;';
                item.dataset.inscription = JSON.stringify({
                    id: inscription.id,
                    inscriptionId: inscription.inscriptionId,
                    inscriptionNumber: inscription.inscriptionNumber,
                    contentType: inscription.contentType
                });
                
                // Thumbnail da inscription
                const thumbnail = document.createElement('div');
                thumbnail.style.cssText = 'width: 40px; height: 40px; border-radius: 6px; overflow: hidden; border: 1px solid #f59e0b; background: #2a2a2a; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
                
                const inscriptionId = inscription.inscriptionId || inscription.id;
                if (inscriptionId) {
                    const contentUrl = `https://ordinals.com/content/${inscriptionId}`;
                    const contentType = inscription.contentType || '';
                    
                    // Detectar tipo de conteúdo
                    if (contentType.includes('image') || contentType.includes('png') || contentType.includes('jpeg') || contentType.includes('jpg') || contentType.includes('webp') || contentType.includes('gif')) {
                        // Imagem estática ou GIF
                        thumbnail.innerHTML = `<img src="${contentUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='🖼️'">`;
                    } else if (contentType.includes('video') || contentType.includes('mp4') || contentType.includes('webm')) {
                        // Vídeo
                        thumbnail.innerHTML = `<video src="${contentUrl}" style="width: 100%; height: 100%; object-fit: cover;" muted loop autoplay playsinline onerror="this.parentElement.innerHTML='🎥'"></video>`;
                    } else if (contentType.includes('text') || contentType.includes('html')) {
                        // Texto/HTML
                        thumbnail.innerHTML = '<div style="font-size: 20px;">📝</div>';
                    } else {
                        // Tentar carregar como imagem (fallback)
                        thumbnail.innerHTML = `<img src="${contentUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='💎'">`;
                    }
                } else {
                    thumbnail.innerHTML = '<div style="font-size: 20px;">💎</div>';
                }
                
                // Info da inscription
                const info = document.createElement('div');
                info.style.cssText = 'flex: 1; min-width: 0;';
                const number = inscription.inscriptionNumber || inscription.number || '?';
                const idShort = (inscriptionId || '').substring(0, 10);
                info.innerHTML = `
                    <div style="font-weight: 600; color: #f59e0b; font-size: 14px;">Inscription #${number}</div>
                    <div style="font-size: 11px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${idShort}...</div>
                `;
                
                item.appendChild(thumbnail);
                item.appendChild(info);
                
                // Hover effect
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'rgba(245, 158, 11, 0.1)';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = 'transparent';
                });
                
                // Click para selecionar
                item.addEventListener('click', () => {
                    // Remover seleção anterior
                    inscriptionListContainer.querySelectorAll('div[data-inscription]').forEach(el => {
                        el.style.background = 'transparent';
                        el.style.borderLeft = 'none';
                    });
                    
                    // Marcar como selecionado
                    item.style.background = 'rgba(245, 158, 11, 0.2)';
                    item.style.borderLeft = '3px solid #f59e0b';
                    
                    // Trigger change event
                    const inscriptionData = JSON.parse(item.dataset.inscription);
                    handleInscriptionSelect(inscriptionData);
                });
                
                inscriptionListContainer.appendChild(item);
            });
        };

        // Renderizar primeiras 12 inscriptions
        renderInscriptions(allInscriptions);

        // Event listener para busca
        inscriptionSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (!searchTerm) {
                // Se busca vazia, mostrar primeiras 12
                renderInscriptions(allInscriptions);
                return;
            }

            // Filtrar inscriptions
            const filtered = allInscriptions.filter(inscription => {
                const number = String(inscription.inscriptionNumber || inscription.number || '');
                const id = (inscription.inscriptionId || inscription.id || '').toLowerCase();
                
                return number.includes(searchTerm) || id.includes(searchTerm);
            });

            console.log(`🔍 Search "${searchTerm}": ${filtered.length} results`);
            renderInscriptions(filtered);
        });

        // Função para lidar com seleção de inscription
        const handleInscriptionSelect = async (inscriptionData) => {
            const previewDiv = screen.querySelector('#inscription-preview');
            
            console.log('🖼️ Inscription selected:', inscriptionData);
            
            // Preencher hidden inputs
            screen.querySelector('#pool-inscription-id').value = inscriptionData.inscriptionId || inscriptionData.id;
            screen.querySelector('#pool-inscription-number').value = inscriptionData.inscriptionNumber || '';
            
            // Mostrar preview
            previewDiv.style.display = 'block';
            screen.querySelector('#inscription-preview-number').textContent = `Inscription #${inscriptionData.inscriptionNumber || '?'}`;
            screen.querySelector('#inscription-preview-id').textContent = `ID: ${(inscriptionData.inscriptionId || inscriptionData.id).substring(0, 20)}...`;
            
            // Carregar imagem/content da inscription com tamanho maior
            const imageContainer = screen.querySelector('#inscription-preview-image');
            imageContainer.innerHTML = '<div class="spinner" style="width: 20px; height: 20px;"></div>';
            
            try {
                const inscriptionId = inscriptionData.inscriptionId || inscriptionData.id;
                const contentUrl = `https://ordinals.com/content/${inscriptionId}`;
                const contentType = inscriptionData.contentType || '';
                
                console.log('🖼️ Loading content:', { inscriptionId, contentType, contentUrl });
                
                // Limpar container
                imageContainer.innerHTML = '';
                
                // Detectar tipo de conteúdo e renderizar apropriadamente
                if (contentType.includes('image') || contentType.includes('png') || contentType.includes('jpeg') || contentType.includes('jpg') || contentType.includes('webp') || contentType.includes('gif')) {
                    // Imagem estática ou GIF
                    const img = document.createElement('img');
                    img.src = contentUrl;
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
                    img.onerror = () => {
                        console.error('❌ Failed to load image:', contentUrl);
                        imageContainer.innerHTML = '<div style="font-size: 32px;">🖼️</div>';
                    };
                    img.onload = () => {
                        console.log('✅ Image loaded successfully');
                    };
                    imageContainer.appendChild(img);
                } else if (contentType.includes('video') || contentType.includes('mp4') || contentType.includes('webm')) {
                    // Vídeo
                    const video = document.createElement('video');
                    video.src = contentUrl;
                    video.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
                    video.muted = true;
                    video.loop = true;
                    video.autoplay = true;
                    video.playsInline = true;
                    video.onerror = () => {
                        console.error('❌ Failed to load video:', contentUrl);
                        imageContainer.innerHTML = '<div style="font-size: 32px;">🎥</div>';
                    };
                    video.onloadeddata = () => {
                        console.log('✅ Video loaded successfully');
                    };
                    imageContainer.appendChild(video);
                } else if (contentType.includes('text') || contentType.includes('html')) {
                    // Texto/HTML
                    imageContainer.innerHTML = '<div style="font-size: 32px;">📝</div>';
                } else {
                    // Tentar carregar como imagem (fallback universal)
                    console.log('⚠️ Unknown content type, trying as image:', contentType);
                    const img = document.createElement('img');
                    img.src = contentUrl;
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
                    img.onerror = () => {
                        console.error('❌ Failed to load content:', contentUrl);
                        imageContainer.innerHTML = '<div style="font-size: 32px;">💎</div>';
                    };
                    img.onload = () => {
                        console.log('✅ Content loaded as image');
                    };
                    imageContainer.appendChild(img);
                }
            } catch (err) {
                console.error('❌ Error loading inscription preview:', err);
                imageContainer.innerHTML = '<div style="font-size: 32px;">💎</div>';
            }
        };

        console.log('✅ Inscription dropdown configured with search!');

    } catch (error) {
        console.error('❌ Error loading inscriptions:', error);
        const inscriptionSelect = screen.querySelector('#inscription-select');
        inscriptionSelect.innerHTML = '<option value="">Error loading inscriptions</option>';
    }
}

/**
 * Criar nova pool
 */
async function handleCreatePool(e) {
    e.preventDefault();
    
    const form = e.target;
    const poolName = form.querySelector('#pool-name').value;
    const poolImage = form.querySelector('#pool-image').value;
    const useInscription = form.querySelector('#use-inscription').checked;
    const poolInscriptionId = useInscription ? form.querySelector('#pool-inscription-id').value : null;
    const poolInscriptionNumber = useInscription ? form.querySelector('#pool-inscription-number').value : null;
    const runeA = form.querySelector('#rune-a').value;
    const runeAName = form.querySelector('#rune-a-name').value;
    const isBtcPair = form.querySelector('#is-btc-pair').checked;
    const runeB = isBtcPair ? null : form.querySelector('#rune-b').value;
    const runeBName = isBtcPair ? 'BTC' : form.querySelector('#rune-b-name').value;
    const initialAmountA = parseInt(form.querySelector('#initial-amount-a').value);
    const initialAmountB = parseInt(form.querySelector('#initial-amount-b').value);
    const feeRate = parseInt(form.querySelector('#fee-rate').value);

    // Validações
    if (!poolName || !runeA || !runeAName || !initialAmountA || !initialAmountB) {
        showNotification('❌ Please fill all required fields', 'error');
        return;
    }

    if (useInscription && !poolInscriptionId) {
        showNotification('❌ Please provide an Inscription ID', 'error');
        return;
    }

    try {
        showLoading('Creating pool...');

        const walletInfo = await sendMessage({ action: 'getWalletInfo' });
        if (!walletInfo.success || !walletInfo.address) {
            throw new Error('Wallet not found');
        }

        const response = await fetch('https://kraywallet-backend.onrender.com/api/dex/pools/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                poolName,
                poolImage,
                poolInscriptionId,
                poolInscriptionNumber: poolInscriptionNumber ? parseInt(poolInscriptionNumber) : null,
                useInscription,
                creatorAddress: walletInfo.address,
                runeA,
                runeAName,
                runeB,
                runeBName,
                isBtcPair,
                initialAmountA,
                initialAmountB,
                feeRate
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to create pool');
        }

        console.log('✅ Pool created:', data.poolId);
        showNotification('✅ Pool created successfully!', 'success');
        
        // Fechar tela e recarregar pools
        document.querySelector('.create-pool-screen').remove();
        loadLiquidityPools();

    } catch (error) {
        console.error('❌ Error creating pool:', error);
        showNotification('❌ ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Mostrar detalhes da pool
 */
async function showPoolDetails(poolId) {
    console.log('🔍 Loading pool details:', poolId);
    showNotification('Pool details coming soon!', 'info');
}

/**
 * Mostrar tela de swap
 */
async function showSwapScreen(poolId) {
    console.log('💱 Opening swap screen for pool:', poolId);
    showNotification('Swap feature coming soon!', 'info');
}

// ==========================================
// ⚡ NETWORK SWITCHER (Mainnet/Lightning/Testnet)
// ==========================================

/**
 * Switch between networks (mainnet, lightning, testnet)
 * @param {string} network - 'mainnet', 'lightning', or 'testnet'
 */
async function switchNetwork(network) {
    console.log(`⚡ ========== SWITCHING TO ${network.toUpperCase()} ==========`);
    
    try {
        // Update dropdown label
        const currentNetworkLabel = document.getElementById('current-network-label');
        const balanceLabel = document.getElementById('balance-label');
        const lightningInfo = document.getElementById('lightning-info');
        const lightningActions = document.getElementById('lightning-actions');
        const actionButtons = document.querySelector('.action-buttons');
        
        // Update balance icon
        const balanceNetworkIcon = document.getElementById('balance-network-icon');
        const balanceNetworkEmoji = document.getElementById('balance-network-emoji');
        
        if (network === 'mainnet') {
            // Mainnet (Bitcoin Layer 1)
            if (currentNetworkLabel) {
                currentNetworkLabel.innerHTML = '<img src="../images/bitcoin.png" alt="Bitcoin" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline\';" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px; display: inline;" /><span style="display: none;">🔗</span> Mainnet';
            }
            if (balanceLabel) {
                balanceLabel.textContent = 'Total Balance';
            }
            // Update balance icon to Bitcoin (normal size)
            if (balanceNetworkIcon) {
                balanceNetworkIcon.src = '../images/bitcoin.png';
                balanceNetworkIcon.style.display = 'inline';
                balanceNetworkIcon.style.borderRadius = '0';
                balanceNetworkIcon.style.width = '40px';
                balanceNetworkIcon.style.height = '40px';
                balanceNetworkEmoji.style.display = 'none';
            }
            
            // LIMPAR balance antes de atualizar
            const walletBalance = document.getElementById('wallet-balance');
            const walletBalanceBtc = document.getElementById('wallet-balance-btc');
            if (walletBalance) walletBalance.textContent = 'Loading...';
            if (walletBalanceBtc) walletBalanceBtc.textContent = '';
            
            // Hide Lightning and L2 specific UI
            lightningInfo?.classList.add('hidden');
            lightningActions?.classList.add('hidden');
            document.getElementById('kray-l2-content')?.classList.add('hidden');
            
            // Show normal UI
            actionButtons?.classList.remove('hidden');
            document.querySelector('.tabs-container')?.classList.remove('hidden');
            
            // Show normal tab contents
            document.getElementById('ordinals-tab')?.classList.remove('hidden');
            
            // Update Bitcoin balance
            await updateMainnetBalance();
            
            console.log('✅ Switched to Mainnet (Bitcoin Layer 1)');
            
        } else if (network === 'kray-l2') {
            // KRAY SPACE L2 (Our own Layer 2!)
            if (currentNetworkLabel) {
                currentNetworkLabel.innerHTML = '<img src="../assets/kray-space.webp" alt="KRAY L2" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'inline\';" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px; display: inline; border-radius: 3px;" /><span style="display: none;">⚡</span> KRAY L2';
            }
            if (balanceLabel) {
                balanceLabel.textContent = 'L2 Balance';
            }
            // Update balance icon to KRAY L2 (40% bigger than Bitcoin icon)
            if (balanceNetworkIcon && balanceNetworkEmoji) {
                balanceNetworkIcon.src = '../assets/kray-space.webp';
                balanceNetworkIcon.style.display = 'inline';
                balanceNetworkIcon.style.borderRadius = '8px';
                balanceNetworkIcon.style.width = '56px';
                balanceNetworkIcon.style.height = '56px';
                balanceNetworkEmoji.style.display = 'none';
            }
            
            // Hide normal action buttons and tabs
            actionButtons?.classList.add('hidden');
            document.querySelector('.tabs-container')?.classList.add('hidden');
            
            // Hide ALL tab contents (Ordinals, Runes, Swap, Activity)
            document.getElementById('ordinals-tab')?.classList.add('hidden');
            document.getElementById('runes-tab')?.classList.add('hidden');
            document.getElementById('swap-tab')?.classList.add('hidden');
            document.getElementById('activity-tab')?.classList.add('hidden');
            
            // Hide Lightning-specific UI (if any)
            lightningInfo?.classList.add('hidden');
            lightningActions?.classList.add('hidden');
            
            // Show ONLY KRAY L2 content
            const krayL2Content = document.getElementById('kray-l2-content');
            if (krayL2Content) {
                krayL2Content.classList.remove('hidden');
            }
            
            // Clear Bitcoin balance (don't show in L2 mode)
            const walletBalance = document.getElementById('wallet-balance');
            const walletBalanceBtc = document.getElementById('wallet-balance-btc');
            if (walletBalance) walletBalance.textContent = 'Loading...';
            if (walletBalanceBtc) walletBalanceBtc.textContent = '';
            
            // Load L2 balance immediately
            if (window.krayL2 && typeof window.krayL2.refreshL2Data === 'function') {
                console.log('📡 Calling refreshL2Data...');
                await window.krayL2.refreshL2Data();
            } else {
                console.warn('⚠️ krayL2.refreshL2Data not available');
            }
            
            console.log('✅ Switched to KRAY L2 (Layer 2)');
            
        } else if (network === 'lightning') {
            // Lightning Network (commented out - using KRAY L2 instead)
            // Keeping code for reference
            if (currentNetworkLabel) {
                currentNetworkLabel.textContent = '⚡ Lightning';
            }
            if (balanceLabel) {
                balanceLabel.textContent = 'Total Balance (Lightning)';
            }
            // Update balance icon to Lightning
            if (balanceNetworkIcon && balanceNetworkEmoji) {
                balanceNetworkIcon.style.display = 'none';
                balanceNetworkEmoji.textContent = '⚡';
                balanceNetworkEmoji.style.display = 'inline';
            }
            
            // LIMPAR balance antes de atualizar (evita mostrar balance do Mainnet)
            const walletBalance = document.getElementById('wallet-balance');
            const walletBalanceBtc = document.getElementById('wallet-balance-btc');
            if (walletBalance) walletBalance.textContent = 'Loading...';
            if (walletBalanceBtc) walletBalanceBtc.textContent = '';
            
            // Show Lightning-specific UI
            lightningInfo?.classList.remove('hidden');
            lightningActions?.classList.remove('hidden');
            actionButtons?.classList.add('hidden');
            
            // Update Lightning balance
            await updateLightningBalance();
            
            console.log('✅ Switched to Lightning Network (Layer 2)');
            
        } else if (network === 'testnet') {
            // Testnet
            if (currentNetworkLabel) {
                currentNetworkLabel.textContent = '🧪 Testnet';
            }
            if (balanceLabel) {
                balanceLabel.textContent = 'Total Balance (Testnet)';
            }
            // Update balance icon to Testnet
            if (balanceNetworkIcon && balanceNetworkEmoji) {
                balanceNetworkIcon.style.display = 'none';
                balanceNetworkEmoji.textContent = '🧪';
                balanceNetworkEmoji.style.display = 'inline';
            }
            
            // Hide Lightning and L2 specific UI
            lightningInfo?.classList.add('hidden');
            lightningActions?.classList.add('hidden');
            document.getElementById('kray-l2-content')?.classList.add('hidden');
            
            // Show normal UI
            actionButtons?.classList.remove('hidden');
            document.querySelector('.tabs-container')?.classList.remove('hidden');
            
            // Show normal tab contents
            document.getElementById('ordinals-tab')?.classList.remove('hidden');
            
            // Update testnet balance (mock for now)
            const walletBalance = document.getElementById('wallet-balance');
            const walletBalanceBtc = document.getElementById('wallet-balance-btc');
            if (walletBalance) walletBalance.textContent = '0 sats';
            if (walletBalanceBtc) walletBalanceBtc.textContent = '0.00000000 BTC';
            
            showNotification('🧪 Testnet mode (not implemented yet)', 'info');
            
            console.log('✅ Switched to Testnet');
        }
        
        // Mark active option
        document.querySelectorAll('.network-option').forEach(opt => {
            if (opt.dataset.network === network) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
        
        // Save preference
        chrome.storage.local.set({ activeNetwork: network }, () => {
            console.log(`💾 Network preference saved: ${network}`);
        });
        
    } catch (error) {
        console.error('❌ Error switching network:', error);
        showNotification('❌ Failed to switch network', 'error');
    }
}

/**
 * Update Mainnet (Bitcoin) balance
 */
async function updateMainnetBalance() {
    try {
        console.log('💰 Updating Mainnet balance...');
        
        const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        
        console.log('📊 Wallet info received:', walletInfo);
        
        if (walletInfo.success && walletInfo.data) {
            // Balance vem como { total, confirmed, unconfirmed }
            const balanceData = walletInfo.data.balance;
            
            // ✅ FIX: Usar typeof para verificar se é objeto, então pegar .total
            let balance;
            if (typeof balanceData === 'object' && balanceData !== null) {
                // Balance é um objeto { total, confirmed, unconfirmed }
                balance = balanceData.total ?? 0;
            } else {
                // Balance já é um número
                balance = balanceData || 0;
            }
            
            const balanceBtc = (balance / 100000000).toFixed(8);
            
            console.log('💰 Balance data:', balanceData);
            console.log('💰 Balance total:', balance);
            
            const walletBalance = document.getElementById('wallet-balance');
            const walletBalanceBtc = document.getElementById('wallet-balance-btc');
            
            if (walletBalance) {
                walletBalance.textContent = `${balance.toLocaleString()} sats`;
            }
            if (walletBalanceBtc) {
                walletBalanceBtc.textContent = `${balanceBtc} BTC`;
            }
            
            console.log(`✅ Mainnet balance updated: ${balance} sats`);
        }
    } catch (error) {
        console.error('❌ Error updating Mainnet balance:', error);
    }
}

/**
 * Update Lightning Network balance and channels
 */
async function updateLightningBalance() {
    const walletBalance = document.getElementById('wallet-balance');
    const walletBalanceBtc = document.getElementById('wallet-balance-btc');
    const channelsText = document.getElementById('lightning-channels-text');
    
    try {
        console.log('⚡ Updating Lightning balance...');
        
        // Get wallet address
        const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        
        if (!walletInfo.success || !walletInfo.data?.address) {
            throw new Error('Wallet not found');
        }
        
        const address = walletInfo.data.address;
        
        console.log(`⚡ Fetching Lightning balance for: ${address.slice(0, 20)}...`);
        
        // Fetch Lightning balance from backend com TIMEOUT
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos timeout
        
        const response = await fetch(`https://kraywallet-backend.onrender.com/api/lightning/balance/${address}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('⚡ Lightning API response:', data);
        
        const balance = data.balance || 0;
        const balanceBtc = (balance / 100000000).toFixed(8);
        const channelsActive = data.channels?.active || 0;
        const channelsTotal = data.channels?.total || 0;
        const lndStatus = data.lndStatus || 'unknown';
        const walletStatus = data.walletStatus || '';
        
        console.log(`💰 Balance: ${balance} sats`);
        console.log(`📡 Channels: ${channelsActive} active / ${channelsTotal} total`);
        console.log(`🔌 LND Status: ${lndStatus}`);
        console.log(`🔐 Wallet Status: ${walletStatus}`);
        
        // Se wallet está inicializando, mostrar mensagem específica
        if (walletStatus === 'locked_or_initializing') {
            if (walletBalance) {
                walletBalance.innerHTML = `<span style="color: #ff9500;">Initializing...</span>`;
            }
            if (walletBalanceBtc) {
                walletBalanceBtc.textContent = '';
            }
            if (channelsText) {
                channelsText.innerHTML = `<div style="color: #888; font-size: 12px; margin-top: 8px;">⏳ Setting up Lightning Network...<br>This may take 1-2 minutes</div>`;
            }
            return;
        }
        
        // Update UI normal
        if (walletBalance) {
            walletBalance.textContent = `${balance.toLocaleString()} sats`;
        }
        if (walletBalanceBtc) {
            walletBalanceBtc.textContent = `${balanceBtc} BTC`;
        }
        if (channelsText) {
            channelsText.textContent = `${channelsActive} ${channelsActive === 1 ? 'channel' : 'channels'} active`;
        }
        
        console.log(`✅ Lightning balance updated: ${balance} sats, ${channelsActive} channels`);
        
        // Mensagem informativa baseada no status
        if (lndStatus === 'disconnected') {
            console.log('ℹ️  LND not running. Start with: ./start-lnd.sh');
        } else if (lndStatus === 'connected' && channelsActive === 0) {
            console.log('ℹ️  LND connected! No channels yet. Use "Open Channel" to get started!');
        }
        
    } catch (error) {
        console.error('❌ Error updating Lightning balance:', error);
        console.error('   Error type:', error.name);
        console.error('   Error message:', error.message);
        
        // Mensagem específica baseada no erro
        let errorMessage = '0 sats';
        if (error.name === 'AbortError') {
            console.log('⏱️  Request timeout - backend may be slow or LND not running');
            errorMessage = '0 sats';
        } else if (error.message.includes('Failed to fetch')) {
            console.log('🔌 Backend not responding - is it running?');
            errorMessage = '0 sats';
        }
        
        // Show 0 on error
        if (walletBalance) walletBalance.textContent = errorMessage;
        if (walletBalanceBtc) walletBalanceBtc.textContent = '0.00000000 BTC';
        if (channelsText) channelsText.textContent = '0 channels active';
        
        console.log('ℹ️  Lightning showing 0 sats (LND not connected or backend issue)');
    }
}

// ==========================================
// 💰 PURE BITCOIN BALANCE
// ==========================================

/**
 * Calculate pure Bitcoin balance (UTXOs without inscriptions or runes)
 */
async function getPureBitcoinBalance(address, userRunes) {
    try {
        console.log('💰 Calculating pure Bitcoin balance...');
        console.log(`   Address: ${address}`);
        console.log(`   User has ${userRunes.length} runes`);
        
        // 1. Buscar balance total
        const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        if (!walletInfo.success) {
            throw new Error('Failed to get wallet info');
        }
        
        const totalBalance = walletInfo.data.balance.total || 0;
        console.log(`   Total balance: ${totalBalance} sats`);
        
        // 2. Buscar inscriptions
        const inscriptionsResponse = await chrome.runtime.sendMessage({
            action: 'getInscriptions',
            data: { address }
        });
        
        const inscriptions = inscriptionsResponse.inscriptions || [];
        console.log(`   Inscriptions: ${inscriptions.length}`);
        
        // 3. Calcular sats em inscriptions (geralmente 546 sats cada)
        const inscriptionsSats = inscriptions.reduce((sum, ins) => sum + (ins.outputValue || ins.value || 600), 0);
        console.log(`   Sats in inscriptions: ${inscriptionsSats} sats`);
        
        // 4. Calcular sats em runes
        // Cada UTXO de rune tem pelo menos 546 sats (dust limit)
        let runesSats = 0;
        for (const rune of userRunes) {
            // Cada rune pode ter múltiplos UTXOs
            const utxoCount = rune.utxos ? rune.utxos.length : 1;
            runesSats += utxoCount * 546; // Estimativa conservadora
        }
        console.log(`   Estimated sats in runes: ${runesSats} sats`);
        
        // 5. Calcular pure balance
        const pureBalance = Math.max(0, totalBalance - inscriptionsSats - runesSats);
        console.log(`   Pure Bitcoin balance: ${pureBalance} sats`);
        
        return pureBalance;
        
    } catch (error) {
        console.error('❌ Error calculating pure Bitcoin balance:', error);
        return 0;
    }
}

// ==========================================
// ⚡ LIGHTNING ACTIONS (Open Channel, Deposit, Withdraw)
// ==========================================

/**
 * Open Lightning Channel
 */
async function handleOpenChannel() {
    console.log('📡 ========== OPEN LIGHTNING CHANNEL ==========');
    
    try {
        // TODO: Implementar UI para abrir channel
        showNotification('🚧 Open Channel coming soon!', 'info');
        
        console.log('📡 Open Channel feature will allow:');
        console.log('   1. Select remote peer');
        console.log('   2. Choose amount to lock');
        console.log('   3. Create funding transaction');
        console.log('   4. Wait for confirmations');
        console.log('   5. Channel active!');
        
    } catch (error) {
        console.error('❌ Error opening channel:', error);
        showNotification('❌ Failed to open channel', 'error');
    }
}

/**
 * Deposit to Lightning (Mainnet → Lightning)
 */
async function handleDepositToLightning() {
    console.log('💰 ========== DEPOSIT TO LIGHTNING ==========');
    
    try {
        // Buscar wallet info
        const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        
        if (!walletInfo.success || !walletInfo.data?.address) {
            throw new Error('Wallet not found');
        }
        
        const address = walletInfo.data.address;
        
        // Buscar Runes do usuário
        console.log('📊 Fetching user Runes for deposit...');
        console.log(`   Address: ${address}`);
        
        const runesResponse = await chrome.runtime.sendMessage({
            action: 'getRunes',
            data: { address }
        });
        
        console.log('📦 Runes response:', runesResponse);
        
        if (!runesResponse.success) {
            console.error('❌ Failed to fetch runes:', runesResponse.error);
            throw new Error('Failed to fetch Runes');
        }
        
        // ✅ CORRIGIR: O backend retorna `runes` não `data`
        const userRunes = runesResponse.runes || [];
        console.log(`✅ Found ${userRunes.length} Runes`);
        
        // Mostrar tela de seleção
        showDepositToLightningScreen(address, userRunes);
        
    } catch (error) {
        console.error('❌ Error opening deposit screen:', error);
        showNotification('❌ Failed to open deposit screen', 'error');
    }
}

/**
 * Mostrar tela de Deposit para Lightning
 */
async function showDepositToLightningScreen(address, userRunes) {
    console.log('💰 Showing Deposit to Lightning screen...');
    console.log(`   Address: ${address}`);
    console.log(`   Runes available: ${userRunes.length}`);
    
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        padding: 20px;
        overflow-y: auto;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    `;
    header.innerHTML = `
        <h2 style="color: #fff; font-size: 20px; font-weight: 700; margin: 0;">
            💰 Deposit to Lightning
        </h2>
        <button id="close-deposit-modal" style="
            background: transparent;
            border: none;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
        ">×</button>
    `;
    
    // Info
    const info = document.createElement('div');
    info.style.cssText = `
        background: rgba(255, 159, 0, 0.1);
        border: 1px solid rgba(255, 159, 0, 0.3);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
        color: #ff9500;
        font-size: 13px;
        line-height: 1.6;
    `;
    info.innerHTML = `
        <strong>⚡ How it works:</strong><br>
        1. Select which Runes you want to send to Lightning<br>
        2. Or send pure Bitcoin (minimum 1 sat)<br>
        3. Creates a Lightning channel with your assets<br>
        4. Assets locked in channel for instant swaps!
    `;
    
    // Lista de Runes
    const runesList = document.createElement('div');
    runesList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
    `;
    
    // Opção: Pure Bitcoin
    const bitcoinOption = document.createElement('div');
    bitcoinOption.className = 'deposit-option';
    bitcoinOption.style.cssText = `
        background: #1a1a1a;
        border: 2px solid #333;
        border-radius: 12px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
    `;
    
    // Buscar sats puros (sem inscriptions e sem runes)
    console.log('💰 Fetching pure Bitcoin balance...');
    const pureBitcoinBalance = await getPureBitcoinBalance(address, userRunes);
    console.log(`   Pure sats: ${pureBitcoinBalance} sats`);
    
    // Inscription ID do símbolo Bitcoin na blockchain
    const bitcoinInscriptionId = 'cfab194b924f7785c6e453728e1c264b89b74843633278cda3ad3f57576c1e93i0';
    const bitcoinContentUrl = `https://ordinals.com/content/${bitcoinInscriptionId}`;
    
    bitcoinOption.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
                width: 48px;
                height: 48px;
                border-radius: 8px;
                overflow: hidden;
                background: #000;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <img src="${bitcoinContentUrl}" 
                     style="width: 100%; height: 100%; object-fit: cover;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                />
                <div style="
                    display: none;
                    font-size: 28px;
                    color: #f7931a;
                ">₿</div>
            </div>
            <div style="flex: 1;">
                <div style="color: #fff; font-weight: 600; font-size: 15px;">Pure Bitcoin</div>
                <div style="color: #888; font-size: 13px;">${pureBitcoinBalance.toLocaleString()} sats available</div>
            </div>
            <div style="color: #fff; font-weight: 600;">›</div>
        </div>
    `;
    bitcoinOption.addEventListener('click', () => {
        showDepositAmountScreen(null, address, overlay, pureBitcoinBalance);
    });
    bitcoinOption.addEventListener('mouseenter', () => {
        bitcoinOption.style.borderColor = '#ff9500';
        bitcoinOption.style.background = '#222';
    });
    bitcoinOption.addEventListener('mouseleave', () => {
        bitcoinOption.style.borderColor = '#333';
        bitcoinOption.style.background = '#1a1a1a';
    });
    
    runesList.appendChild(bitcoinOption);
    
    // Opções de Runes
    if (userRunes.length > 0) {
        userRunes.forEach(rune => {
            const runeOption = document.createElement('div');
            runeOption.className = 'deposit-option';
            runeOption.style.cssText = `
                background: #1a1a1a;
                border: 2px solid #333;
                border-radius: 12px;
                padding: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            // Determinar display (thumbnail ou símbolo)
            const runeName = rune.displayName || rune.name || 'Unknown Rune';
            const runeSymbol = rune.symbol || 'ᚱ';
            const hasParent = rune.parent && rune.parentPreview;
            
            // HTML com thumbnail se tiver parent
            runeOption.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${hasParent ? `
                        <div style="
                            width: 48px;
                            height: 48px;
                            border-radius: 8px;
                            overflow: hidden;
                            background: #000;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <img src="${rune.parentPreview}" 
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            />
                            <div style="display: none; font-size: 24px;">${runeSymbol}</div>
                        </div>
                    ` : `
                        <div style="font-size: 32px;">${runeSymbol}</div>
                    `}
                    <div style="flex: 1;">
                        <div style="color: #fff; font-weight: 600; font-size: 15px;">${runeName}</div>
                        <div style="color: #888; font-size: 13px;">${parseInt(rune.amount).toLocaleString()} available</div>
                    </div>
                    <div style="color: #fff; font-weight: 600;">›</div>
                </div>
            `;
            runeOption.addEventListener('click', () => {
                showDepositAmountScreen(rune, address, overlay);
            });
            runeOption.addEventListener('mouseenter', () => {
                runeOption.style.borderColor = '#ff9500';
                runeOption.style.background = '#222';
            });
            runeOption.addEventListener('mouseleave', () => {
                runeOption.style.borderColor = '#333';
                runeOption.style.background = '#1a1a1a';
            });
            
            runesList.appendChild(runeOption);
        });
    } else {
        const noRunes = document.createElement('div');
        noRunes.style.cssText = `
            text-align: center;
            padding: 32px;
            color: #666;
            font-size: 14px;
        `;
        noRunes.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">ᚱ</div>
            <div>No Runes detected</div>
            <div style="font-size: 12px; margin-top: 8px; color: #888;">
                Loading from blockchain...<br>
                Or deposit pure Bitcoin below
            </div>
        `;
        runesList.appendChild(noRunes);
    }
    
    // Montar
    overlay.appendChild(header);
    overlay.appendChild(info);
    overlay.appendChild(runesList);
    document.body.appendChild(overlay);
    
    // Close button
    document.getElementById('close-deposit-modal').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
}

/**
 * Mostrar tela de quantidade para deposit
 */
function showDepositAmountScreen(rune, address, previousOverlay, pureBitcoinBalance = 0) {
    console.log('💰 Showing amount screen...');
    
    // Preparar dados da Rune ou Bitcoin
    let assetName = 'Pure Bitcoin';
    let assetSymbol = '₿';
    let hasParent = false;
    let parentPreview = '';
    let availableAmount = pureBitcoinBalance;
    let minAmount = 10000; // 10k sats minimum for Lightning channel
    
    if (rune) {
        // É uma Rune
        assetName = rune.displayName || rune.name || 'Unknown Rune';
        assetSymbol = rune.symbol || 'ᚱ';
        hasParent = rune.parent && rune.parentPreview;
        parentPreview = rune.parentPreview || '';
        availableAmount = parseInt(rune.amount);
        minAmount = 1; // Runes podem enviar qualquer quantidade
        
        console.log(`   Rune: ${assetName}`);
        console.log(`   Available: ${availableAmount}`);
        console.log(`   Has parent: ${hasParent}`);
    } else {
        // É Pure Bitcoin
        // Buscar inscription do Bitcoin
        const bitcoinInscriptionId = 'cfab194b924f7785c6e453728e1c264b89b74843633278cda3ad3f57576c1e93i0';
        hasParent = true;
        parentPreview = `https://ordinals.com/content/${bitcoinInscriptionId}`;
        
        console.log('   Type: Pure Bitcoin');
        console.log(`   Available: ${availableAmount} sats`);
        console.log(`   Min amount: ${minAmount} sats`);
    }
    
    // Remover overlay anterior
    if (previousOverlay) {
        document.body.removeChild(previousOverlay);
    }
    
    // Criar novo overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
            <button id="back-deposit-btn" style="
                background: transparent;
                border: none;
                color: #fff;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
            ">←</button>
            ${hasParent ? `
                <div style="
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <img src="${parentPreview}" 
                         style="width: 100%; height: 100%; object-fit: cover;"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                    />
                    <div style="display: none; font-size: 20px;">${assetSymbol}</div>
                </div>
            ` : ''}
            <h2 style="color: #fff; font-size: 20px; font-weight: 700; margin: 0; flex: 1;">
                ${assetName}
            </h2>
        </div>
        
        <div style="background: #1a1a1a; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
            <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Available</div>
            <div style="color: #fff; font-size: 24px; font-weight: 700; margin-bottom: 24px;">
                ${availableAmount.toLocaleString()} ${rune ? assetSymbol : 'sats'}
            </div>
            
            <div style="color: #888; font-size: 13px; margin-bottom: 8px;">
                ${rune ? 'Amount to deposit' : 'Bitcoin amount (sats)'}
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
                <input type="number" id="deposit-amount" placeholder="${rune ? 'Enter amount' : `Min ${minAmount.toLocaleString()} sats`}" 
                    style="
                        flex: 1;
                        background: #000;
                        border: 2px solid #333;
                        border-radius: 12px;
                        padding: 16px;
                        color: #fff;
                        font-size: 18px;
                        font-weight: 600;
                    "
                    max="${availableAmount}"
                    min="${minAmount}"
                />
                <button id="max-deposit-btn" style="
                    background: #ff9500;
                    border: none;
                    border-radius: 8px;
                    padding: 16px 24px;
                    color: #000;
                    font-weight: 700;
                    cursor: pointer;
                ">MAX</button>
            </div>
        </div>
        
        <div style="background: rgba(255, 159, 0, 0.1); border: 1px solid rgba(255, 159, 0, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <div style="color: #ff9500; font-size: 13px; line-height: 1.6;">
                <strong>⚡ What happens:</strong><br>
                1. Creates Lightning channel<br>
                2. ${rune ? 'Runes + BTC' : 'BTC'} locked in channel<br>
                3. Can do instant swaps (<1 second)<br>
                4. Fee: 1 sat per swap!
            </div>
        </div>
        
        <button id="confirm-deposit-btn" style="
            background: linear-gradient(135deg, #ff9500 0%, #ff6b00 100%);
            border: none;
            border-radius: 12px;
            padding: 18px;
            color: #fff;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            width: 100%;
        ">
            💰 Deposit to Lightning
        </button>
    `;
    
    document.body.appendChild(overlay);
    
    // Event listeners
    document.getElementById('back-deposit-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        handleDepositToLightning(); // Voltar para lista
    });
    
    // Botão MAX (agora para Runes e Bitcoin)
    document.getElementById('max-deposit-btn').addEventListener('click', () => {
        document.getElementById('deposit-amount').value = availableAmount;
    });
    
    document.getElementById('confirm-deposit-btn').addEventListener('click', async () => {
        const amount = document.getElementById('deposit-amount').value;
        
        if (!amount || parseFloat(amount) <= 0) {
            showNotification('❌ Enter valid amount', 'error');
            return;
        }
        
        if (parseFloat(amount) > availableAmount) {
            showNotification('❌ Insufficient balance', 'error');
            return;
        }
        
        if (parseFloat(amount) < minAmount) {
            showNotification(`❌ Minimum ${minAmount.toLocaleString()} ${rune ? assetSymbol : 'sats'}`, 'error');
            return;
        }
        
        // Processar deposit
        document.body.removeChild(overlay);
        await processDepositToLightning(rune, amount, address);
    });
}

/**
 * Processar deposit para Lightning
 */
async function processDepositToLightning(rune, amount, address) {
    console.log('💰 ========== PROCESSING DEPOSIT ==========');
    console.log(`   Asset: ${rune ? (rune.displayName || rune.name) : 'Pure Bitcoin'}`);
    console.log(`   Amount: ${amount} sats`);
    console.log(`   Address: ${address}`);
    
    try {
        // 1. Verificar se LND está sincronizado
        console.log('🔍 Checking LND status...');
        showNotification('⚡ Checking Lightning Network status...', 'info');
        
        const statusResponse = await fetch('https://kraywallet-backend.onrender.com/api/lightning/status');
        const statusData = await statusResponse.json();
        
        console.log('📊 LND Status:', statusData);
        
        if (!statusData.connected) {
            throw new Error('Lightning Network not connected. LND may be syncing or not running.');
        }
        
        if (!statusData.info?.synced_to_chain) {
            throw new Error(`Lightning Network is syncing. Currently at block ${statusData.info?.block_height || 0}. Please wait ~15-30 minutes.`);
        }
        
        // 2. Preparar dados do channel
        console.log('📡 Preparing channel funding transaction...');
        showNotification('⚡ Opening Lightning channel...', 'info');
        
        const channelData = {
            capacity: amount, // Amount in sats
            fromAddress: address,
            assetType: rune ? 'rune' : 'btc',
            rune: rune ? {
                id: rune.id,
                name: rune.name || rune.displayName,
                amount: rune.amount
            } : null
        };
        
        console.log('📦 Channel data:', channelData);
        
        // 3. Chamar backend para criar o channel
        const response = await fetch('https://kraywallet-backend.onrender.com/api/lightning/open-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(channelData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to open channel');
        }
        
        const result = await response.json();
        console.log('✅ Channel opening result:', result);
        
        // 4. Mostrar sucesso
        showNotification(`✅ Channel opening! TXID: ${result.txid?.slice(0, 10)}...`, 'success');
        
        // 5. Fechar overlay
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) overlay.remove();
        
        // 6. Atualizar balances
        setTimeout(() => {
            updateLightningBalance();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error processing deposit:', error);
        showNotification(`❌ ${error.message}`, 'error');
    }
}

/**
 * Withdraw from Lightning (Lightning → Mainnet)
 */
async function handleWithdrawFromLightning() {
    console.log('📤 ========== WITHDRAW FROM LIGHTNING ==========');
    
    try {
        // Verificar se tem balance Lightning
        const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        
        if (!walletInfo.success || !walletInfo.data?.address) {
            throw new Error('Wallet not found');
        }
        
        const address = walletInfo.data.address;
        
        // Buscar balance Lightning
        const response = await fetch(`https://kraywallet-backend.onrender.com/api/lightning/balance/${address}`);
        const data = await response.json();
        
        const balance = data.balance || 0;
        const channelsActive = data.channels?.active || 0;
        
        console.log(`💰 Lightning balance: ${balance} sats`);
        console.log(`📡 Active channels: ${channelsActive}`);
        
        if (balance === 0 || channelsActive === 0) {
            showNotification('⚠️ No balance or channels to withdraw', 'warning');
            return;
        }
        
        // TODO: Implementar UI de withdraw
        showNotification('🚧 Withdraw feature coming soon!', 'info');
        
        console.log('📤 Withdraw will allow:');
        console.log('   1. Choose amount to withdraw');
        console.log('   2. Close Lightning channel (cooperative)');
        console.log('   3. Create closing transaction');
        console.log('   4. Runes + BTC return to Mainnet');
        console.log('   5. Everything documented on-chain!');
        
        // Preview do que vai fazer:
        console.log('\n📋 Withdraw Preview:');
        console.log(`   From: Lightning Channel`);
        console.log(`   To: ${address}`);
        console.log(`   Amount: ${balance} sats`);
        console.log(`   + Runes locked in channel (if any)`);
        console.log(`   Fee: ~200-500 sats (on-chain closing)`);
        console.log(`   Time: ~10 minutes (on-chain confirmation)`);
        
    } catch (error) {
        console.error('❌ Error withdrawing:', error);
        showNotification('❌ Failed to withdraw', 'error');
    }
}

/**
 * Initialize network selector with saved preference
 */
async function initializeNetworkSelector() {
    try {
        console.log('⚡ Initializing Network Selector...');
        
        // Get saved preference
        const result = await chrome.storage.local.get(['activeNetwork']);
        const savedNetwork = result.activeNetwork || 'mainnet'; // Default to Mainnet
        
        console.log(`📊 Saved network preference: ${savedNetwork}`);
        
        // Apply saved network
        await switchNetwork(savedNetwork);
        
        console.log('✅ Network Selector initialized');
        
    } catch (error) {
        console.error('❌ Error initializing Network Selector:', error);
        // Default to Mainnet on error
        await switchNetwork('mainnet');
    }
}

// ==========================================
// 🔒 LOCK/UNLOCK FUNCTIONS
// ==========================================

/**
 * Handle unlock wallet button click
 */
async function handleUnlockWallet() {
    try {
        console.log('🔓 ========== UNLOCKING WALLET ==========');
        
        const passwordInput = document.getElementById('unlock-password');
        const password = passwordInput.value.trim();
        
        if (!password) {
            showNotification('❌ Please enter your password', 'error');
            return;
        }
        
        if (password.length < 6) {
            showNotification('❌ Password must be at least 6 characters', 'error');
            return;
        }
        
        // Show loading
        showLoading('Unlocking wallet...');
        
        // Call background to unlock
        const response = await sendMessage({
            action: 'unlockWallet',
            data: { password }
        });
        
        hideLoading();
        
        if (response.success) {
            console.log('✅ Wallet unlocked successfully');
            showNotification('✅ Welcome back!', 'success');
            
            // 🔒 SEGURANÇA: Limpar password imediatamente após uso
            passwordInput.value = '';
            console.log('✅ Password cleared from input field');
            
            // 💾 LIMPAR CACHE AO UNLOCK (dados podem ter mudado)
            clearAllCache();
            
            // 🔔 NOTIFICAR TODAS AS PÁGINAS QUE A WALLET FOI DESBLOQUEADA
            try {
                // Buscar todas as tabs
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    try {
                        // Enviar mensagem para content script de cada tab
                        await chrome.tabs.sendMessage(tab.id, {
                            type: 'MYWALLET_UNLOCKED',
                            address: response.address
                        });
                        console.log(`📡 Notified tab ${tab.id} about unlock`);
                    } catch (e) {
                        // Tab pode não ter content script, ignorar
                    }
                }
            } catch (error) {
                console.error('⚠️ Error notifying tabs:', error);
            }
            
            // Show wallet screen and load data
            showScreen('wallet');
            await loadWalletData();
            
            // ⚡ Initialize KRAY L2 after unlock
            if (window.krayL2) {
                if (typeof window.krayL2.setShowScreen === 'function') {
                    window.krayL2.setShowScreen(showScreen);
                }
                if (typeof window.krayL2.initL2 === 'function') {
                    console.log('⚡ Initializing L2 after unlock...');
                    setTimeout(() => window.krayL2.initL2(), 500);
                }
            }
        } else {
            console.error('❌ Failed to unlock:', response.error);
            showNotification('❌ ' + response.error, 'error');
            
            // Clear password input
            passwordInput.value = '';
            passwordInput.focus();
        }
        
    } catch (error) {
        hideLoading();
        console.error('❌ Error unlocking wallet:', error);
        showNotification('❌ Failed to unlock wallet', 'error');
    }
}

/**
 * Handle lock wallet button click (from Settings)
 */
async function handleLockWallet() {
    try {
        console.log('🔒 Locking wallet...');
        
        // Call background to lock
        const response = await sendMessage({ action: 'lockWallet' });
        
        if (response.success) {
            console.log('✅ Wallet locked successfully');
            showNotification('🔒 Wallet locked', 'success');
            
            // 🔒 SEGURANÇA: Limpar campo de password completamente
            const unlockPasswordInput = document.getElementById('unlock-password');
            if (unlockPasswordInput) {
                unlockPasswordInput.value = '';
                console.log('✅ Password field cleared for security');
            }
            
            // Show unlock screen
            showScreen('unlock');
        } else {
            showNotification('❌ Failed to lock wallet', 'error');
        }
        
    } catch (error) {
        console.error('❌ Error locking wallet:', error);
        showNotification('❌ Failed to lock wallet', 'error');
    }
}

/**
 * Handle auto-lock timeout change (from Settings)
 */
async function handleAutolockTimeoutChange(event) {
    try {
        const timeout = parseInt(event.target.value, 10);
        console.log(`🔒 Setting auto-lock timeout to: ${timeout} minutes`);
        
        // Call background to set timeout
        const response = await sendMessage({
            action: 'setAutolockTimeout',
            data: { timeout }
        });
        
        if (response.success) {
            console.log('✅ Auto-lock timeout set successfully');
            
            let message = '';
            if (timeout === 0) {
                message = '⏰ Auto-lock disabled';
            } else {
                message = `⏰ Auto-lock set to ${timeout} minutes`;
            }
            
            showNotification(message, 'success');
        } else {
            showNotification('❌ Failed to set auto-lock timeout', 'error');
        }
        
    } catch (error) {
        console.error('❌ Error setting auto-lock timeout:', error);
        showNotification('❌ Failed to set auto-lock timeout', 'error');
    }
}

/**
 * Load auto-lock setting on Settings screen
 */
async function loadAutolockSetting() {
    try {
        const result = await chrome.storage.local.get(['autolockTimeout']);
        const timeout = result.autolockTimeout !== undefined ? result.autolockTimeout : 15; // Default 15 minutes
        
        const select = document.getElementById('autolock-timeout');
        if (select) {
            select.value = timeout.toString();
        }
    } catch (error) {
        console.error('❌ Error loading autolock setting:', error);
    }
}

// Setup event listeners para DEX
document.addEventListener('DOMContentLoaded', () => {
    const createPoolBtn = document.getElementById('create-pool-btn');
    if (createPoolBtn) {
        createPoolBtn.addEventListener('click', showCreatePoolScreen);
        console.log('✅ Create Pool button listener added');
    }

    // Quando a tab Swap for clicada, carregar pools
    const swapTab = document.querySelector('[data-tab="swap"]');
    if (swapTab) {
        swapTab.addEventListener('click', () => {
            loadLiquidityPools();
        });
        console.log('✅ Swap tab listener added');
    }
    
    // Load autolock setting when settings screen is shown
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        const originalHandler = settingsBtn.onclick;
        settingsBtn.onclick = function(e) {
            if (originalHandler) originalHandler.call(this, e);
            loadAutolockSetting();
        };
    }
});

// ========================================
// SPLIT UTXOs FUNCTIONALITY
// ========================================

let splitState = {
    selectedUTXOs: [],
    outputs: [],
    utxosList: []
};

// Navegar para tela Split
async function showSplitUTXOsScreen() {
    console.log('✂️ ========== Opening Split UTXOs screen ==========');
    console.log('   Function called successfully!');
    
    try {
        // ✅ PRIMEIRO: Mostrar loading IMEDIATAMENTE
        console.log('   Creating loading overlay...');
        
        // Criar overlay de loading
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'split-loading-overlay';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #0a0a0a;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        loadingOverlay.innerHTML = `
            <div class="loading-container">
                <img src="../assets/logo.png" alt="MyWallet" class="logo-medium" />
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading UTXOs...</p>
                <p class="loading-subtext" style="font-size: 12px; color: #888; margin-top: 8px;">This may take a few seconds</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
        console.log('   ✅ Loading overlay displayed!');
        
        // ⏱️ Pequeno delay para garantir que o loading seja renderizado
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // ✅ Carregar UTXOs ANTES de mostrar a tela
        await loadSplitUTXOs();
        
        // ✅ Adicionar 2 outputs padrão
        splitState.outputs = [];
        addSplitOutput(546); // Output 1: 546 sats (padrão para Inscription/Runes)
        addSplitOutput(546); // Output 2: 546 sats (padrão para Inscription/Runes)
        
        // ✅ Remover loading overlay
        if (loadingOverlay) {
            loadingOverlay.remove();
            console.log('   ✅ Loading overlay removed');
        }
        
        // ✅ AGORA SIM: Mostrar a tela Split (com dados já carregados)
        showScreen('split-utxos');
        console.log('   ✅ Split screen displayed');
        
    } catch (error) {
        console.error('❌ Error loading Split screen:', error);
        
        // Remover loading em caso de erro
        const overlay = document.getElementById('split-loading-overlay');
        if (overlay) {
            overlay.remove();
            console.log('   ✅ Loading overlay removed (error case)');
        }
        
        showNotification('Failed to load Split screen: ' + error.message, 'error');
    }
}

// Carregar UTXOs disponíveis
async function loadSplitUTXOs() {
    console.log('📦 Loading UTXOs for split...');
    
    const listContainer = document.getElementById('split-utxo-list');
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="loading-container">
                <img src="../assets/logo.png" alt="MyWallet" class="logo-medium" />
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading UTXOs...</p>
            </div>
        `;
    }
    
    try {
        // Obter endereço da carteira (do DOM)
        const addressElement = document.getElementById('wallet-address');
        let address = addressElement ? addressElement.getAttribute('data-full-address') : null;
        
        // Se não encontrou no DOM, tentar via message
        if (!address) {
            console.log('   Trying to get address via chrome.runtime...');
            const response = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
            if (response && response.success && response.address) {
                address = response.address;
            }
        }
        
        if (!address) {
            throw new Error('Could not get wallet address. Is wallet unlocked?');
        }
        
        console.log('   Address:', address);
        console.log('   Address length:', address.length);
        
        // Buscar UTXOs enriquecidos do backend
        const url = `https://kraywallet-backend.onrender.com/api/wallet/utxos/${address}`;
        console.log('   Fetching enriched UTXOs from backend...');
        console.log('   URL:', url);
        
        const response = await fetch(url);
        console.log('   Response status:', response.status);
        console.log('   Response ok:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('   Error response body:', errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('   Response data:', data);
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch UTXOs');
        }
        
        console.log(`   ✅ Found ${data.utxos.length} UTXOs`);
        console.log(`   - ${data.inscriptions.length} inscriptions`);
        console.log(`   - ${data.runes.length} runes`);
        
        if (data.utxos.length === 0) {
            if (listContainer) {
                listContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No UTXOs available</div>';
            }
            return;
        }
        
        // UTXOs já vêm enriquecidos do backend
        splitState.utxosList = data.utxos.map(utxo => ({
            ...utxo,
            selected: false
        }));
        
        console.log('   ✅ UTXOs loaded, rendering...');
        renderSplitUTXOs();
        
    } catch (error) {
        console.error('❌ Error loading UTXOs:', error);
        if (listContainer) {
            listContainer.innerHTML = `
                <div style="color: #ef4444; text-align: center; padding: 20px;">
                    <div style="margin-bottom: 8px;">❌ Failed to load UTXOs</div>
                    <div style="font-size: 12px; color: #888;">${error.message}</div>
                </div>
            `;
        }
    }
}

// Renderizar lista de UTXOs
function renderSplitUTXOs() {
    const listContainer = document.getElementById('split-utxo-list');
    if (!listContainer) return;
    
    if (splitState.utxosList.length === 0) {
        listContainer.innerHTML = `<div style="color: #888; text-align: center; padding: 20px;">No UTXOs available</div>`;
        return;
    }
    
    listContainer.innerHTML = '';
    
    splitState.utxosList.forEach((utxo, index) => {
        const utxoItem = document.createElement('div');
        utxoItem.style.cssText = 'display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #2a2a2a; cursor: pointer; transition: background 0.2s;';
        utxoItem.onmouseover = () => { utxoItem.style.background = '#1a1a1a'; };
        utxoItem.onmouseout = () => { utxoItem.style.background = 'transparent'; };
        utxoItem.onclick = () => toggleUTXOSelection(index);
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = utxo.selected;
        checkbox.style.cssText = 'margin-right: 12px; cursor: pointer; flex-shrink: 0;';
        checkbox.onclick = (e) => {
            e.stopPropagation();
            toggleUTXOSelection(index);
        };
        
        // Thumbnail (se tiver inscrição)
        if (utxo.hasInscription && utxo.inscription) {
            const thumbnail = document.createElement('img');
            thumbnail.src = utxo.inscription.preview;
            thumbnail.style.cssText = 'width: 48px; height: 48px; border-radius: 6px; margin-right: 12px; object-fit: cover; flex-shrink: 0; border: 1px solid #333;';
            thumbnail.onerror = () => {
                thumbnail.style.display = 'none';
            };
            utxoItem.appendChild(checkbox);
            utxoItem.appendChild(thumbnail);
        } else {
            utxoItem.appendChild(checkbox);
        }
        
        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';
        
        const badges = [];
        if (utxo.hasInscription) badges.push('<span style="background: #8b5cf6; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">📜 Inscription</span>');
        if (utxo.hasRunes) badges.push('<span style="background: #f59e0b; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">🪙 Runes</span>');
        if (!utxo.hasInscription && !utxo.hasRunes) badges.push('<span style="background: #10b981; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">💰 Pure BTC</span>');
        
        let detailsHtml = '';
        
        // Detalhes das Runes
        if (utxo.hasRunes && utxo.runes && utxo.runes.length > 0) {
            const runesInfo = utxo.runes.map(r => {
                const amount = parseInt(r.amount) || 0;
                return `<div style="color: #f59e0b; font-size: 11px; margin-top: 2px;">
                    🪙 ${r.name || 'Unknown Rune'}: ${amount.toLocaleString()} ${r.symbol || ''}
                </div>`;
            }).join('');
            detailsHtml += runesInfo;
        }
        
        // Detalhes da Inscrição
        if (utxo.hasInscription && utxo.inscription) {
            detailsHtml += `<div style="color: #8b5cf6; font-size: 11px; margin-top: 2px;">
                📜 #${utxo.inscription.number || 'Unknown'}
            </div>`;
        }
        
        info.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
                ${badges.join('')}
            </div>
            ${detailsHtml}
            <div style="color: #888; font-size: 11px; font-family: monospace; margin-top: 4px; overflow: hidden; text-overflow: ellipsis;">
                ${utxo.txid.substring(0, 16)}...${utxo.txid.substring(utxo.txid.length - 4)}:${utxo.vout}
            </div>
            <div style="color: #fff; font-weight: 600; margin-top: 4px;">
                ${utxo.value.toLocaleString()} sats
            </div>
        `;
        
        utxoItem.appendChild(info);
        listContainer.appendChild(utxoItem);
    });
}

// Toggle seleção de UTXO
function toggleUTXOSelection(index) {
    splitState.utxosList[index].selected = !splitState.utxosList[index].selected;
    
    if (splitState.utxosList[index].selected) {
        splitState.selectedUTXOs.push(splitState.utxosList[index]);
    } else {
        splitState.selectedUTXOs = splitState.selectedUTXOs.filter(u => u.id !== splitState.utxosList[index].id);
    }
    
    renderSplitUTXOs();
    updateSplitSummary();
}

// Adicionar output
function addSplitOutput(value = 546) {
    const output = { value };
    splitState.outputs.push(output);
    renderSplitOutputs();
    updateSplitSummary();
}

// Remover output
function removeSplitOutput(index) {
    splitState.outputs.splice(index, 1);
    renderSplitOutputs();
    updateSplitSummary();
}

// Atualizar valor de output
function updateSplitOutputValue(index, value) {
    splitState.outputs[index].value = parseInt(value) || 0;
    updateSplitSummary();
}

// Renderizar outputs
function renderSplitOutputs() {
    const outputsContainer = document.getElementById('split-outputs-list');
    if (!outputsContainer) return;
    
    if (splitState.outputs.length === 0) {
        outputsContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 12px;">No outputs configured. Click "+" to add.</div>';
        return;
    }
    
    outputsContainer.innerHTML = '';
    
    splitState.outputs.forEach((output, index) => {
        const outputItem = document.createElement('div');
        outputItem.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; background: #0a0a0a; border-radius: 6px; flex-wrap: nowrap;';
        
        const label = document.createElement('span');
        label.style.cssText = 'color: #888; min-width: 70px; flex-shrink: 0;';
        label.textContent = `Output ${index + 1}:`;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.value = output.value;
        input.min = '546';
        input.step = '1';
        input.style.cssText = 'flex: 1; min-width: 80px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 8px; color: #fff; font-size: 14px;';
        input.addEventListener('change', (e) => {
            updateSplitOutputValue(index, e.target.value);
        });
        
        const satsLabel = document.createElement('span');
        satsLabel.style.cssText = 'color: #888; min-width: 35px; flex-shrink: 0;';
        satsLabel.textContent = 'sats';
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.cssText = 'background: #ef4444; color: #fff; border: none; border-radius: 4px; padding: 8px 10px; cursor: pointer; font-size: 14px; font-weight: bold; flex-shrink: 0; min-width: 32px; transition: background 0.2s;';
        removeBtn.addEventListener('click', () => {
            removeSplitOutput(index);
        });
        removeBtn.addEventListener('mouseover', () => {
            removeBtn.style.background = '#dc2626';
        });
        removeBtn.addEventListener('mouseout', () => {
            removeBtn.style.background = '#ef4444';
        });
        
        outputItem.appendChild(label);
        outputItem.appendChild(input);
        outputItem.appendChild(satsLabel);
        outputItem.appendChild(removeBtn);
        
        outputsContainer.appendChild(outputItem);
    });
}

// Atualizar sumário
function updateSplitSummary() {
    const totalInput = splitState.selectedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
    const totalOutput = splitState.outputs.reduce((sum, out) => sum + out.value, 0);
    
    // Estimar fee (aproximado)
    const numInputs = splitState.selectedUTXOs.length;
    const numOutputs = splitState.outputs.length;
    const estimatedSize = Math.ceil(10.5 + (numInputs * 57.5) + (numOutputs * 43));
    const estimatedFee = estimatedSize * 1; // 1 sat/vB
    
    const canExecute = totalInput > 0 && totalOutput > 0 && (totalInput >= totalOutput + estimatedFee);
    
    // Atualizar UI
    const summaryDiv = document.getElementById('split-summary');
    const executeBtn = document.getElementById('execute-split-btn');
    
    if (summaryDiv && totalInput > 0) {
        summaryDiv.style.display = 'block';
        document.getElementById('split-total-input').textContent = `${totalInput.toLocaleString()} sats`;
        document.getElementById('split-total-output').textContent = `${totalOutput.toLocaleString()} sats`;
        document.getElementById('split-est-fee').textContent = `${estimatedFee} sats`;
    } else if (summaryDiv) {
        summaryDiv.style.display = 'none';
    }
    
    if (executeBtn) {
        executeBtn.disabled = !canExecute;
        if (!canExecute && totalInput > 0) {
            executeBtn.textContent = `⚠️ Insufficient Balance (need ${(totalOutput + estimatedFee - totalInput)} more sats)`;
        } else {
            executeBtn.textContent = '✂️ Execute Split';
        }
    }
}

// Executar split
async function executeSplit() {
    console.log('✂️ Executing split...');
    
    try {
        if (splitState.selectedUTXOs.length === 0) {
            alert('⚠️ Please select at least one UTXO');
            return;
        }
        
        if (splitState.outputs.length === 0) {
            alert('⚠️ Please add at least one output');
            return;
        }
        
        const executeBtn = document.getElementById('execute-split-btn');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.textContent = '⏳ Building PSBT...';
        }
        
        // Obter endereço da carteira (do DOM)
        const addressElement = document.getElementById('wallet-address');
        let address = addressElement ? addressElement.getAttribute('data-full-address') : null;
        
        // Se não encontrou no DOM, tentar via message
        if (!address) {
            const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
            if (walletInfo && walletInfo.success) {
                address = walletInfo.address;
            }
        }
        
        if (!address) {
            throw new Error('Could not get wallet address');
        }
        
        // Construir PSBT
        const buildResponse = await fetch('https://kraywallet-backend.onrender.com/api/psbt/split', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address,
                inputs: splitState.selectedUTXOs.map(u => ({
                    txid: u.txid,
                    vout: u.vout,
                    value: u.value
                })),
                outputs: splitState.outputs,
                feeRate: 1
            })
        });
        
        const buildResult = await buildResponse.json();
        
        if (!buildResult.success) {
            throw new Error(buildResult.error || 'Failed to build PSBT');
        }
        
        console.log('✅ PSBT built successfully');
        
        if (executeBtn) {
            executeBtn.textContent = '🔐 Signing...';
        }
        
        // Assinar PSBT
        const signResponse = await chrome.runtime.sendMessage({
            action: 'signPSBT',
            psbt: buildResult.psbt
        });
        
        if (!signResponse.success) {
            throw new Error(signResponse.error || 'Failed to sign PSBT');
        }
        
        console.log('✅ PSBT signed successfully');
        
        if (executeBtn) {
            executeBtn.textContent = '📡 Broadcasting...';
        }
        
        // Finalizar e extrair hex
        const finalizeResponse = await chrome.runtime.sendMessage({
            action: 'finalizePSBT',
            psbt: signResponse.signedPsbt
        });
        
        if (!finalizeResponse.success) {
            throw new Error(finalizeResponse.error || 'Failed to finalize PSBT');
        }
        
        // Broadcast
        const broadcastResponse = await chrome.runtime.sendMessage({
            action: 'broadcastTransaction',
            hex: finalizeResponse.hex
        });
        
        if (!broadcastResponse.success) {
            throw new Error(broadcastResponse.error || 'Failed to broadcast transaction');
        }
        
        console.log('✅ Transaction broadcast successfully!');
        console.log('   TXID:', broadcastResponse.txid);
        
        alert(`✅ Split successful! TXID: ${broadcastResponse.txid.substring(0, 16)}...`);
        
        // Voltar para settings após 2 segundos
        setTimeout(() => {
            showScreen('settings');
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error executing split:', error);
        alert(`❌ Split failed: ${error.message}`);
        
        const executeBtn = document.getElementById('execute-split-btn');
        if (executeBtn) {
            executeBtn.disabled = false;
            executeBtn.textContent = '✂️ Execute Split';
        }
    }
}

// Event listeners para Split
document.addEventListener('DOMContentLoaded', () => {
    // Botão para abrir Split UTXOs
    const splitUtxosBtn = document.getElementById('split-utxos-btn');
    console.log('🔍 Looking for split-utxos-btn:', splitUtxosBtn);
    if (splitUtxosBtn) {
        splitUtxosBtn.addEventListener('click', () => {
            console.log('🔥 Split button clicked!');
            showSplitUTXOsScreen();
        });
        console.log('✅ Split UTXOs button listener added');
    } else {
        console.error('❌ split-utxos-btn not found in DOM!');
    }
    
    // Botão voltar da tela Split
    const backFromSplitBtn = document.getElementById('back-from-split-btn');
    if (backFromSplitBtn) {
        backFromSplitBtn.addEventListener('click', () => {
            showScreen('settings');
        });
    }
    
    // Botão adicionar output
    const addOutputBtn = document.getElementById('add-split-output-btn');
    if (addOutputBtn) {
        addOutputBtn.addEventListener('click', () => addSplitOutput(546));
    }
    
    // Botão executar split
    const executeSplitBtn = document.getElementById('execute-split-btn');
    if (executeSplitBtn) {
        executeSplitBtn.addEventListener('click', executeSplit);
    }
});

// Expor funções globalmente para uso inline no HTML
window.updateSplitOutputValue = updateSplitOutputValue;
window.removeSplitOutput = removeSplitOutput;


// ========================================
// MARKETPLACE - LIST ON MARKET
// ========================================

// Global variable to store current inscription being listed
let currentInscriptionToList = null;

/**
 * Show List on Market Screen (Full Screen como inscription details)
 */
function showListMarketModal(inscription) {
    console.log('📋 Opening List on Market screen...', inscription);
    
    // Store current inscription
    currentInscriptionToList = inscription;
    
    // Update screen content
    const contentUrl = inscription.preview || `https://ordinals.com/content/${inscription.id}`;
    document.getElementById('list-inscription-preview-large').src = contentUrl;
    
    document.getElementById('list-inscription-number-large').textContent = 
        `Inscription #${inscription.number || '?'}`;
    
    document.getElementById('list-inscription-id-large').textContent = 
        `ID: ${inscription.id}`;
    
    // Reset form
    document.getElementById('list-price-screen').value = '';
    document.getElementById('list-description-screen').value = '';
    
    // Reset character counter
    const counter = document.getElementById('char-count');
    if (counter) {
        counter.textContent = '0 / 500 characters';
        counter.style.color = '#888';
    }
    
    // Update summary
    updateListingSummary();
    
    // Show screen
    showScreen('list-market');
}

/**
 * Hide List on Market Screen (volta para wallet)
 */
function hideListMarketModal() {
    showScreen('wallet');
    currentInscriptionToList = null;
}

/**
 * Update Listing Summary
 */
function updateListingSummary() {
    const price = parseInt(document.getElementById('list-price-screen')?.value) || 0;
    
    // You receive = price (buyer pays ALL fees!)
    const youReceive = price;
    
    // Update UI - só mostrar o total
    const totalEl = document.getElementById('summary-total-screen');
    if (totalEl) totalEl.textContent = youReceive.toLocaleString() + ' sats';
}

/**
 * Create Market Listing (MAIN LOGIC)
 */
// Flag para evitar cliques duplos
let isCreatingListing = false;

async function createMarketListing() {
    console.log('🚀 Creating market listing...');
    
    // Evitar cliques duplos
    if (isCreatingListing) {
        console.log('⚠️ Already creating listing, ignoring duplicate click');
        return;
    }
    
    isCreatingListing = true;
    
    if (!currentInscriptionToList) {
        showNotification('❌ No inscription selected', 'error');
        isCreatingListing = false;
        return;
    }
    
    const price = parseInt(document.getElementById('list-price-screen').value);
    const description = document.getElementById('list-description-screen').value;
    const feeRate = 1; // Dummy value - buyer pays fee anyway!
    
    // Validation
    if (!price || price < 1000) {
        showNotification('❌ Price must be at least 1,000 sats', 'error');
        return;
    }
    
    try {
        // Show loading
        showLoading('Creating listing...');
        
        // 🛒 STEP 1: Usar novo fluxo BUY NOW (SEM assinatura prévia!)
        console.log('🛒 Creating BUY NOW listing via background...');
        
        const createListingResponse = await chrome.runtime.sendMessage({
            action: 'createBuyNowListing',
            data: {
                inscriptionId: currentInscriptionToList.id,
                priceSats: price,
                description: description
            }
        });
        
        if (!createListingResponse.success) {
            throw new Error(createListingResponse.error || 'Failed to create listing');
        }
        
        console.log('✅ BUY NOW listing created!');
        console.log('   Order ID:', createListingResponse.order_id);
        hideLoading();
        
        // 🎉 STEP 2: Mostrar tela de SUCESSO (não precisa assinar!)
        // O modelo BUY NOW não requer assinatura prévia do seller
        document.getElementById('list-market-screen')?.classList.add('hidden');
        
        // Mostrar sucesso
        showListingSuccessScreen(
            currentInscriptionToList.id, 
            price, 
            createListingResponse.order_id
        );
        
        console.log('✅ Listing is LIVE! No signature needed upfront.');
        console.log('   Seller will sign when buyer purchases.')
        
    } catch (error) {
        console.error('❌ Error creating listing:', error);
        hideLoading();
        showNotification('❌ Failed to create listing: ' + error.message, 'error');
    } finally {
        // ✅ SEMPRE resetar flag no final
        isCreatingListing = false;
        console.log('🔓 isCreatingListing reset to false');
    }
}

// ========================================
// EVENT LISTENERS - MARKETPLACE
// ========================================

// Setup listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 Setting up marketplace listeners...');
    
    // Back button (volta para wallet)
    document.getElementById('back-from-list-market-btn')?.addEventListener('click', hideListMarketModal);
    
    // Create listing button
    document.getElementById('list-create-btn-screen')?.addEventListener('click', createMarketListing);
    
    // Update summary on input change
    document.getElementById('list-price-screen')?.addEventListener('input', updateListingSummary);
    
    // Character counter for description (like Twitter!)
    document.getElementById('list-description-screen')?.addEventListener('input', (e) => {
        const charCount = e.target.value.length;
        const counter = document.getElementById('char-count');
        if (counter) {
            counter.textContent = `${charCount} / 500 characters`;
            
            // Change color based on length (like Twitter)
            if (charCount > 450) {
                counter.style.color = '#ef4444'; // Red
            } else if (charCount > 400) {
                counter.style.color = '#f59e0b'; // Orange
            } else {
                counter.style.color = '#888'; // Gray
            }
        }
    });
    
    console.log('✅ Marketplace listeners set up');
});

// Expose functions globally
window.showListMarketModal = showListMarketModal;
window.hideListMarketModal = hideListMarketModal;
window.updateListingSummary = updateListingSummary;
window.createMarketListing = createMarketListing;

// ========================================
// BUY MARKET LISTING - UNIFIED FUNCTION
// ========================================

/**
 * 🛒 Buy a market listing (unified function for all buy buttons)
 * Can be called from: extension popup, KrayScan, inscription profile, etc.
 * 
 * @param {string} orderId - The order ID of the listing
 * @param {number} priceSats - Price in satoshis (optional, will fetch if not provided)
 */
async function buyMarketListing(orderId, priceSats = null) {
    try {
        console.log('\n🛒 ===== BUY MARKET LISTING (UNIFIED) =====');
        console.log('   Order ID:', orderId);
        console.log('   Price:', priceSats, 'sats');
        
        showLoading('Preparing purchase...');
        
        // Get wallet info
        const walletInfo = await sendMessage({ action: 'getWalletInfo' });
        
        if (!walletInfo.unlocked) {
            hideLoading();
            showNotification('🔒 Please unlock your wallet first', 'error');
            showScreen('unlock');
            return;
        }
        
        const buyerAddress = walletInfo.address;
        console.log('   Buyer address:', buyerAddress);
        
        // If price not provided, fetch from API
        if (!priceSats) {
            const listingResponse = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/${orderId}`);
            const listingData = await listingResponse.json();
            if (!listingData.success) {
                throw new Error('Listing not found');
            }
            priceSats = listingData.listing.price_sats;
            console.log('   Fetched price:', priceSats, 'sats');
        }
        
        // Call background to prepare buy PSBT
        const result = await sendMessage({
            action: 'buyAtomicSwap',
            data: {
                orderId,
                priceSats,
                buyerAddress,
                buyerChangeAddress: buyerAddress // Same address for change
            }
        });
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to prepare purchase');
        }
        
        console.log('✅ Buy PSBT prepared, waiting for signature...');
        hideLoading();
        
        // The background will save pendingPsbtRequest
        // Show the PSBT signing screen
        showScreen('confirm-psbt');
        await loadPsbtConfirmation();
        
    } catch (error) {
        console.error('❌ Error buying listing:', error);
        hideLoading();
        showNotification('❌ ' + error.message, 'error');
    }
}

// Expose buy function globally
window.buyMarketListing = buyMarketListing;

// ========================================
// MY OFFERS - MARKETPLACE LISTINGS
// ========================================

/**
 * Show My Offers Screen
 */
async function showMyOffersScreen() {
    console.log('📋 Opening My Offers screen...');
    showScreen('my-offers');
    await loadMyOffers();
}

/**
 * Load My Offers from Backend
 */
async function loadMyOffers() {
    console.log('📋 Loading my atomic swap listings...');
    
    try {
        // Get address from background script
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        const address = result?.data?.address || walletState.address;
        
        console.log('📍 User address:', address);
        
        if (!address) {
            showNotification('❌ Wallet not initialized', 'error');
            return;
        }
        
        // Show loading
        document.getElementById('my-offers-loading').classList.remove('hidden');
        document.getElementById('my-offers-empty').classList.add('hidden');
        document.getElementById('my-offers-list').classList.add('hidden');
        
        // Fetch atomic swap listings from backend
        const url = `https://kraywallet-backend.onrender.com/api/atomic-swap/?seller_address=${address}`;
        console.log('📡 Fetching atomic listings from:', url);
        
        const response = await fetch(url);
        
        const data = await response.json();
        
        console.log('📦 Atomic listings response:', data);
        console.log('   Total listings:', data.listings?.length || 0);
        
        // 🔥 FILTRAR: Mostrar APENAS listings ATIVAS (OPEN ou PENDING_SIGNATURES)
        // NÃO mostrar CANCELLED, FILLED, ou EXPIRED
        const activeListings = (data.listings || []).filter(l => 
            l.status === 'OPEN' || l.status === 'PENDING_SIGNATURES'
        );
        
        console.log(`   Active listings: ${activeListings.length}`);
        
        // Hide loading
        document.getElementById('my-offers-loading').classList.add('hidden');
        
        if (activeListings.length === 0) {
            // Show empty state
            document.getElementById('my-offers-empty').classList.remove('hidden');
            return;
        }
        
        // Render listings
        const container = document.getElementById('my-offers-list');
        container.innerHTML = '';
        container.classList.remove('hidden');
        
        for (const listing of activeListings) {
            const listingCard = createAtomicListingCard(listing);
            container.appendChild(listingCard);
        }
        
        console.log(`✅ Loaded ${activeListings.length} active atomic listings (${data.listings?.length || 0} total)`);
        
    } catch (error) {
        console.error('❌ Error loading atomic listings:', error);
        document.getElementById('my-offers-loading').classList.add('hidden');
        showNotification('Failed to load listings', 'error');
    }
}

/**
 * Create Offer Card Element
 */
function createOfferCard(offer) {
    const card = document.createElement('div');
    card.className = 'offer-card';
    card.style.cssText = 'display: flex; gap: 12px; padding: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); margin-bottom: 12px; align-items: center;';
    
    // Preview image
    const preview = document.createElement('img');
    preview.className = 'offer-preview';
    preview.src = `https://ordinals.com/content/${offer.inscription_id}`;
    preview.alt = 'Inscription';
    preview.style.cssText = 'width: 80px; height: 80px; border-radius: 8px; object-fit: cover; flex-shrink: 0;';
    preview.onerror = () => {
        preview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23333" width="80" height="80"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="24"%3E📜%3C/text%3E%3C/svg%3E';
    };
    
    // Details
    const details = document.createElement('div');
    details.className = 'offer-details';
    details.style.cssText = 'flex: 1; min-width: 0;';
    
    const title = document.createElement('p');
    title.className = 'offer-title';
    title.style.cssText = 'font-weight: 600; font-size: 14px; margin: 0 0 4px 0; color: var(--color-text);';
    title.textContent = offer.inscription_number 
        ? `Inscription #${offer.inscription_number}`
        : `Inscription ${offer.inscription_id.substring(0, 10)}...`;
    
    const contentType = document.createElement('p');
    contentType.className = 'offer-content-type';
    contentType.style.cssText = 'font-size: 11px; color: var(--color-text-secondary); margin: 0 0 8px 0;';
    contentType.textContent = offer.content_type || 'unknown';
    
    const price = document.createElement('p');
    price.className = 'offer-price';
    price.style.cssText = 'font-weight: 600; font-size: 14px; color: var(--color-primary); margin: 0 0 4px 0;';
    price.textContent = `💰 ${offer.offer_amount.toLocaleString()} sats`;
    
    const date = document.createElement('p');
    date.className = 'offer-date';
    date.style.cssText = 'font-size: 11px; color: var(--color-text-secondary); margin: 0;';
    const createdDate = new Date(offer.created_at);
    date.textContent = `Listed: ${createdDate.toLocaleDateString()}`;
    
    details.appendChild(title);
    details.appendChild(contentType);
    details.appendChild(price);
    details.appendChild(date);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'offer-actions';
    actions.style.cssText = 'display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;';
    
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-share-offer';
    shareBtn.style.cssText = 'padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; white-space: nowrap;';
    shareBtn.textContent = '📱 Share';
    shareBtn.onclick = () => showShareModal(offer);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel-offer';
    cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--color-error); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; white-space: nowrap;';
    cancelBtn.textContent = '❌ Cancel';
    cancelBtn.onclick = () => cancelOffer(offer.id);
    
    actions.appendChild(shareBtn);
    actions.appendChild(cancelBtn);
    
    // Assemble card
    card.appendChild(preview);
    card.appendChild(details);
    card.appendChild(actions);
    
    return card;
}

/**
 * Create Atomic Listing Card Element
 */
function createAtomicListingCard(listing) {
    const card = document.createElement('div');
    card.className = 'atomic-listing-card';
    card.style.cssText = 'display: flex; gap: 12px; padding: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); margin-bottom: 12px; align-items: center;';
    
    // Preview image
    const preview = document.createElement('img');
    preview.className = 'listing-preview';
    preview.src = `https://kraywallet-backend.onrender.com/api/ordinals/${listing.inscription_id}/content`;
    preview.alt = 'Inscription';
    preview.style.cssText = 'width: 80px; height: 80px; border-radius: 8px; object-fit: cover; flex-shrink: 0;';
    preview.onerror = () => {
        preview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23333" width="80" height="80"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="24"%3E📜%3C/text%3E%3C/svg%3E';
    };
    
    // Details
    const details = document.createElement('div');
    details.className = 'listing-details';
    details.style.cssText = 'flex: 1; min-width: 0;';
    
    const title = document.createElement('p');
    title.className = 'listing-title';
    title.style.cssText = 'font-weight: 600; font-size: 14px; margin: 0 0 4px 0; color: var(--color-text);';
    title.textContent = listing.inscription_number 
        ? `Inscription #${listing.inscription_number}`
        : `Inscription ${listing.inscription_id.substring(0, 10)}...`;
    
    // Status badge
    const statusColors = {
        'PENDING_SIGNATURES': '#FFA500',
        'OPEN': '#4CAF50',
        'FILLED': '#666',
        'CANCELLED': '#999',
        'EXPIRED': '#999'
    };
    
    const statusBadge = document.createElement('span');
    statusBadge.style.cssText = `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: ${statusColors[listing.status] || '#666'}; color: white; margin: 0 0 8px 0;`;
    statusBadge.textContent = listing.status;
    
    const price = document.createElement('p');
    price.className = 'listing-price';
    price.style.cssText = 'font-weight: 600; font-size: 14px; color: var(--color-primary); margin: 8px 0 4px 0;';
    price.textContent = `💰 ${listing.price_sats.toLocaleString()} sats`;
    
    const date = document.createElement('p');
    date.className = 'listing-date';
    date.style.cssText = 'font-size: 11px; color: var(--color-text-secondary); margin: 0;';
    const createdDate = new Date(listing.created_at * 1000);
    date.textContent = `Listed: ${createdDate.toLocaleDateString()}`;
    
    details.appendChild(title);
    details.appendChild(statusBadge);
    details.appendChild(price);
    details.appendChild(date);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'listing-actions';
    actions.style.cssText = 'display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;';
    
    // Botões dinâmicos baseados no status
    if (listing.status === 'PENDING_SIGNATURES') {
        const updateBtn = document.createElement('button');
        updateBtn.className = 'btn-update-price';
        updateBtn.style.cssText = 'padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; white-space: nowrap;';
        updateBtn.textContent = '💰 Update Price';
        updateBtn.onclick = () => showUpdatePriceModal(listing);
        actions.appendChild(updateBtn);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel-listing';
        cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--color-error); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; white-space: nowrap;';
        cancelBtn.textContent = '❌ Cancel';
        cancelBtn.onclick = () => cancelAtomicListing(listing.order_id);
        actions.appendChild(cancelBtn);
    } else if (listing.status === 'OPEN') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel-listing';
        cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--color-error); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; white-space: nowrap;';
        cancelBtn.textContent = '❌ Cancel';
        cancelBtn.onclick = () => cancelAtomicListing(listing.order_id);
        actions.appendChild(cancelBtn);
    }
    
    // Assemble card
    card.appendChild(preview);
    card.appendChild(details);
    card.appendChild(actions);
    
    return card;
}

/**
 * Cancel Atomic Listing (COM ASSINATURA - SEM CONFIRM)
 */
async function cancelAtomicListing(orderId) {
    try {
        showNotification('🔐 Sign message to cancel listing...', 'info');
        
        const result = await chrome.runtime.sendMessage({
            action: 'cancelListing',
            data: { orderId }
        });
        
        if (result.success) {
            showNotification('✅ Listing cancelled successfully!', 'success');
            
            // 🔄 Recarregar TUDO para atualizar UI
            await loadMyOffers(); // Reload "My Market Listings" tab
            await loadOrdinals(); // Reload "Ordinals" tab (para atualizar botões List/Send)
        } else {
            throw new Error(result.error || 'Failed to cancel listing');
        }
    } catch (error) {
        console.error('❌ Error cancelling listing:', error);
        showNotification(`❌ ${error.message}`, 'error');
    }
}

/**
 * Show Update Price Modal
 */
function showUpdatePriceModal(listing) {
    const newPrice = prompt(`Update price for Inscription #${listing.inscription_number || '...'}?\n\nCurrent price: ${listing.price_sats} sats\nEnter new price in sats:`, listing.price_sats);
    
    if (!newPrice || isNaN(newPrice) || parseInt(newPrice) < 546) {
        if (newPrice !== null) {
            showNotification('❌ Invalid price (minimum 546 sats)', 'error');
        }
        return;
    }
    
    updateListingPrice(listing.order_id, parseInt(newPrice));
}

/**
 * Update Listing Price
 */
async function updateListingPrice(orderId, newPrice) {
    try {
        showNotification('⏳ Updating price...', 'info');
        
        const result = await chrome.runtime.sendMessage({
            action: 'updateListingPrice',
            data: { orderId, newPrice }
        });
        
        if (result.success) {
            if (result.requiresSignature) {
                showNotification('✅ Price updated! Please sign the new PSBT.', 'success');
            } else {
                showNotification('✅ Price updated successfully!', 'success');
            }
            await loadMyOffers(); // Reload listings
        } else {
            throw new Error(result.error || 'Failed to update price');
        }
    } catch (error) {
        console.error('❌ Error updating price:', error);
        showNotification(`❌ ${error.message}`, 'error');
    }
}

/**
 * Cancel Offer (OLD SYSTEM - MANTIDO PARA COMPATIBILIDADE)
 */
async function cancelOffer(offerId) {
    try {
        showLoadingOverlay('Cancelling listing...');
        
        const response = await fetch(
            `https://kraywallet-backend.onrender.com/api/offers/${offerId}/cancel`,
            { method: 'PUT' }
        );
        
        const data = await response.json();
        
        hideLoadingOverlay();
        
        if (data.success) {
            showNotification('✅ Listing cancelled', 'success');
            loadMyOffers(); // Reload
        } else {
            throw new Error(data.error || 'Failed to cancel');
        }
        
    } catch (error) {
        console.error('❌ Error cancelling offer:', error);
        hideLoadingOverlay();
        showNotification('Failed to cancel listing', 'error');
    }
}

/**
 * Show Share Modal (Placeholder for Fase 6)
 */
function showShareModal(offer) {
    console.log('📱 Sharing offer:', offer);
    
    // Open offer page in new tab
    const offerUrl = `https://kraywallet-backend.onrender.com/offer.html?id=${offer.id}`;
    chrome.tabs.create({ url: offerUrl });
    
    showNotification('📱 Opening offer page...', 'info');
}

// ========================================
// MY PUBLIC PROFILE
// ========================================

/**
 * Show My Profile Screen
 */
async function showMyProfileScreen() {
    console.log('🎭 Opening My Profile screen...');
    showScreen('my-profile');
    await loadMyProfile();
}

/**
 * Fetch BTC Price and Update USD Values
 */
async function updateUSDPrices() {
    try {
        // Fetch BTC price from Mempool.space API
        const response = await fetch('https://mempool.space/api/v1/prices');
        const prices = await response.json();
        const btcPriceUSD = prices.USD;
        
        console.log('💵 BTC Price:', btcPriceUSD, 'USD');
        
        // Update all USD price elements
        document.querySelectorAll('.usd-price-target').forEach(element => {
            const sats = parseInt(element.dataset.sats);
            const btc = sats / 100000000;
            const usd = btc * btcPriceUSD;
            element.textContent = `≈ $${usd.toFixed(2)} USD`;
        });
        
    } catch (error) {
        console.error('❌ Error fetching BTC price:', error);
        // Keep default "≈ $0.00 USD" if fetch fails
    }
}

/**
 * Load My Profile Data
 */
async function loadMyProfile() {
    console.log('🎭 Loading my profile...');
    
    try {
        // Get address from background script
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        const address = result?.data?.address || walletState.address;
        
        console.log('📍 User address:', address);
        
        if (!address) {
            showNotification('❌ Wallet not initialized', 'error');
            return;
        }
        
        // Update profile header
        document.getElementById('profile-address').textContent = address;
        
        // Show loading
        document.getElementById('profile-loading').classList.remove('hidden');
        
        // Fetch profile data
        const [offersRes, inscriptionsRes, runesRes] = await Promise.all([
            fetch(`https://kraywallet-backend.onrender.com/api/offers?address=${address}&status=active`),
            chrome.runtime.sendMessage({ action: 'getInscriptions' }),
            chrome.runtime.sendMessage({ action: 'getRunes' })
        ]);
        
        const offersData = await offersRes.json();
        
        console.log('📦 Profile data loaded:', {
            offers: offersData.offers?.length || 0,
            inscriptions: inscriptionsRes?.inscriptions?.length || 0,
            runes: runesRes?.runes?.length || 0
        });
        
        // Update stats
        document.getElementById('profile-listings-count').textContent = offersData.offers?.length || 0;
        document.getElementById('profile-inscriptions-count').textContent = inscriptionsRes?.inscriptions?.length || 0;
        document.getElementById('profile-runes-count').textContent = runesRes?.runes?.length || 0;
        
        // Hide loading and show tabs
        document.getElementById('profile-loading').classList.add('hidden');
        document.getElementById('profile-tabs').classList.remove('hidden');
        
        // Separate offers by type
        const ordinalOffers = offersData.offers?.filter(o => o.type === 'inscription') || [];
        const runeOffers = offersData.offers?.filter(o => o.type === 'rune_swap') || [];
        const poolOffers = offersData.offers?.filter(o => o.type === 'liquidity_pool') || [];
        
        console.log('📊 Offers by type:', {
            ordinals: ordinalOffers.length,
            runes: runeOffers.length,
            pools: poolOffers.length
        });
        
        // Render Ordinals tab
        renderProfileTab('ordinals', ordinalOffers);
        
        // Render Runes tab
        renderProfileTab('runes', runeOffers);
        
        // Render Pools tab
        renderProfileTab('pools', poolOffers);
        
        // Update USD prices after rendering cards
        await updateUSDPrices();
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        document.getElementById('profile-loading').classList.add('hidden');
        showNotification('Failed to load profile', 'error');
    }
}

/**
 * Render Profile Tab Content
 */
function renderProfileTab(tabName, offers) {
    const listContainer = document.getElementById(`profile-${tabName}-list`);
    const emptyState = document.getElementById(`profile-${tabName}-empty`);
    
    if (!offers || offers.length === 0) {
        // Show empty state
        emptyState.classList.remove('hidden');
        listContainer.classList.add('hidden');
        listContainer.innerHTML = '';
        return;
    }
    
    // Hide empty state and show list
    emptyState.classList.add('hidden');
    listContainer.classList.remove('hidden');
    listContainer.innerHTML = '';
    
    // Render up to 3 offers
    const displayOffers = offers.slice(0, 3);
    for (const offer of displayOffers) {
        const card = createMiniOfferCard(offer);
        listContainer.appendChild(card);
    }
}

/**
 * Create Mini Offer Card for Profile Preview
 */
function createMiniOfferCard(offer) {
    const card = document.createElement('div');
    card.style.cssText = 'display: flex; gap: 12px; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); margin-bottom: 8px; transition: all 0.2s; position: relative;';
    
    card.onmouseenter = () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    };
    card.onmouseleave = () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
    };
    
    // Preview image
    const preview = document.createElement('img');
    preview.src = `https://ordinals.com/content/${offer.inscription_id}`;
    preview.alt = 'Inscription';
    preview.style.cssText = 'width: 60px; height: 60px; border-radius: 6px; object-fit: cover; flex-shrink: 0; cursor: pointer;';
    preview.onerror = () => {
        preview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23333" width="60" height="60"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="20"%3E📜%3C/text%3E%3C/svg%3E';
    };
    preview.onclick = () => {
        // Open offer page
        const offerUrl = `https://kraywallet-backend.onrender.com/offer.html?id=${offer.id}`;
        chrome.tabs.create({ url: offerUrl });
    };
    
    // Details
    const details = document.createElement('div');
    details.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;';
    
    // Top part (title)
    const topPart = document.createElement('div');
    
    const title = document.createElement('p');
    title.style.cssText = 'font-weight: 600; font-size: 13px; margin: 0 0 4px 0; color: var(--color-text); cursor: pointer;';
    title.textContent = offer.inscription_number 
        ? `Inscription #${offer.inscription_number}`
        : `Inscription ${offer.inscription_id.substring(0, 10)}...`;
    title.onclick = () => {
        const offerUrl = `https://kraywallet-backend.onrender.com/offer.html?id=${offer.id}`;
        chrome.tabs.create({ url: offerUrl });
    };
    
    topPart.appendChild(title);
    
    // Bottom part (price + buy button)
    const bottomPart = document.createElement('div');
    bottomPart.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';
    
    // Price container
    const priceContainer = document.createElement('div');
    
    const price = document.createElement('p');
    price.style.cssText = 'font-weight: 600; font-size: 13px; color: var(--color-primary); margin: 0;';
    price.textContent = `💰 ${offer.offer_amount.toLocaleString()} sats`;
    
    // USD price (will be calculated)
    const usdPrice = document.createElement('p');
    usdPrice.style.cssText = 'font-size: 11px; color: var(--color-text-secondary); margin: 2px 0 0 0;';
    usdPrice.textContent = '≈ $0.00 USD';
    usdPrice.className = 'usd-price-target';
    usdPrice.dataset.sats = offer.offer_amount;
    
    priceContainer.appendChild(price);
    priceContainer.appendChild(usdPrice);
    
    // Buy button
    const buyBtn = document.createElement('button');
    buyBtn.style.cssText = 'padding: 6px 12px; background: var(--color-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap; transition: all 0.2s;';
    buyBtn.textContent = '🛒 Buy';
    buyBtn.onmouseenter = () => {
        buyBtn.style.opacity = '0.8';
    };
    buyBtn.onmouseleave = () => {
        buyBtn.style.opacity = '1';
    };
    buyBtn.onclick = (e) => {
        e.stopPropagation();
        // Redirect to ordinals.html with buy parameter
        const buyUrl = `https://kraywallet-backend.onrender.com/ordinals.html?buy=${offer.id}`;
        chrome.tabs.create({ url: buyUrl });
    };
    
    bottomPart.appendChild(priceContainer);
    bottomPart.appendChild(buyBtn);
    
    details.appendChild(topPart);
    details.appendChild(bottomPart);
    
    card.appendChild(preview);
    card.appendChild(details);
    
    return card;
}

// Event Listeners for My Profile
document.addEventListener('DOMContentLoaded', () => {
    // My Profile button in settings
    document.getElementById('my-profile-btn')?.addEventListener('click', showMyProfileScreen);
    
    // Back button
    document.getElementById('back-from-profile-btn')?.addEventListener('click', () => {
        showScreen('settings');
    });
    
    // Open External Profile button
    document.getElementById('open-external-profile-btn')?.addEventListener('click', async () => {
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        if (result && result.data && result.data.address) {
            const profileUrl = `https://kraywallet-backend.onrender.com/profile.html?address=${result.data.address}`;
            chrome.tabs.create({ url: profileUrl });
        } else {
            alert('❌ Please unlock your wallet first');
        }
    });
    
    // Share Profile button
    document.getElementById('share-profile-btn')?.addEventListener('click', async () => {
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        if (result && result.data && result.data.address) {
            const profileUrl = `https://kraywallet-backend.onrender.com/profile.html?address=${result.data.address}`;
            
            try {
                await navigator.clipboard.writeText(profileUrl);
                showNotification('📋 Profile link copied!', 'success');
            } catch (err) {
                console.error('Failed to copy:', err);
                // Fallback: show in alert
                alert(`Your profile URL:\n\n${profileUrl}`);
            }
        } else {
            alert('❌ Please unlock your wallet first');
        }
    });
    
    // View All Listings button
    document.getElementById('view-all-ordinals-btn')?.addEventListener('click', () => {
        showMyOffersScreen();
    });
    
    // Profile tabs switching
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchProfileTab(tabName);
        });
    });
});

/**
 * Switch Profile Tab
 */
function switchProfileTab(tabName) {
    console.log('🔄 Switching to tab:', tabName);
    
    // Update tab buttons
    document.querySelectorAll('.profile-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--color-primary)';
            tab.style.color = 'var(--color-primary)';
        } else {
            tab.classList.remove('active');
            tab.style.borderBottomColor = 'transparent';
            tab.style.color = 'var(--color-text-secondary)';
        }
    });
    
    // Update tab content
    document.querySelectorAll('.profile-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    document.getElementById(`profile-tab-${tabName}`)?.classList.remove('hidden');
}

// Event Listeners for My Offers
document.addEventListener('DOMContentLoaded', () => {
    // My Offers button in settings
    document.getElementById('my-offers-btn')?.addEventListener('click', showMyOffersScreen);
    
    // Back button
    document.getElementById('back-from-my-offers-btn')?.addEventListener('click', () => {
        showScreen('settings');
    });
});

// ========================================
// PSBT SIGNING SCREEN EVENT LISTENERS
// ========================================
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
    } else {
        console.warn('   ⚠️  psbt-sign-btn not found');
    }
    
    // Cancel button
    const psbtCancelBtn = document.getElementById('psbt-cancel-btn');
    if (psbtCancelBtn) {
        psbtCancelBtn.addEventListener('click', () => {
            console.log('❌ Cancel button clicked');
            handlePsbtCancel();
        });
        console.log('   ✅ psbt-cancel-btn listener added');
    } else {
        console.warn('   ⚠️  psbt-cancel-btn not found');
    }
    
    // ⚡ Lightning Payment listeners
    console.log('⚡ Setting up Lightning payment listeners...');
    
    const lightningConfirmBtn = document.getElementById('lightning-payment-confirm-btn');
    if (lightningConfirmBtn) {
        lightningConfirmBtn.addEventListener('click', async () => {
            console.log('✅ Lightning payment confirm button clicked');
            await handleLightningPaymentConfirm();
        });
        console.log('   ✅ lightning-payment-confirm-btn listener added');
    } else {
        console.warn('   ⚠️  lightning-payment-confirm-btn not found');
    }
    
    const lightningCancelBtn = document.getElementById('lightning-payment-cancel-btn');
    if (lightningCancelBtn) {
        lightningCancelBtn.addEventListener('click', () => {
            console.log('❌ Lightning payment cancel button clicked');
            handleLightningPaymentCancel();
        });
        console.log('   ✅ lightning-payment-cancel-btn listener added');
    } else {
        console.warn('   ⚠️  lightning-payment-cancel-btn not found');
    }
    
    // Enter key para confirmar Lightning payment
    const lightningPasswordInput = document.getElementById('lightning-payment-password');
    if (lightningPasswordInput) {
        lightningPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('⚡ Enter pressed on Lightning payment password');
                handleLightningPaymentConfirm();
            }
        });
        console.log('   ✅ lightning-payment-password Enter listener added');
    }
});

// ==========================================
// 💝 SIGN MESSAGE (Para Likes)
// ==========================================

// Mostrar tela de sign message
function showSignMessageScreen(message) {
    console.log('✍️  Showing sign message screen for:', message);
    
    // Mostrar a mensagem
    document.getElementById('message-to-sign').textContent = message;
    
    // Mostrar tela
    showScreen('sign-message');
    
    // Focar no campo de senha
    setTimeout(() => {
        document.getElementById('message-sign-password')?.focus();
    }, 100);
}

// Handle message sign
async function handleMessageSign() {
    const password = document.getElementById('message-sign-password').value;
    
    if (!password) {
        showNotification('Please enter your password', 'error');
        return;
    }
    
    try {
        showLoading('Signing message...');
        
        // Get pending message
        const storage = await chrome.storage.local.get(['pendingMessageRequest']);
        console.log('📦 Pending message storage:', storage);
        if (!storage.pendingMessageRequest) {
            throw new Error('No pending message found');
        }
        
        const message = storage.pendingMessageRequest.message;
        console.log('✍️  Message to sign:', message);
        
        // 🔥 NOVA ABORDAGEM: Pedir ao background para assinar (ele tem acesso à wallet)
        console.log('🔄 Requesting background to sign with password...');
        
        const result = await chrome.runtime.sendMessage({
            action: 'signMessageWithPassword',
            data: { message, password }
        });
        
        console.log('📨 Background response:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to sign message');
        }
        
        const { signature, address } = result;
        
        // Save result to storage
        await chrome.storage.local.set({
            messageSignResult: {
                success: true,
                signature: signature,
                address: address
            }
        });
        
        hideLoading();
        showNotification('✅ Message signed successfully!', 'success');
        
        // Close popup after short delay
        setTimeout(() => window.close(), 500);
        
    } catch (error) {
        hideLoading();
        console.error('Error signing message:', error);
        
        if (error.message.includes('Invalid password')) {
            showNotification('❌ Invalid password', 'error');
        } else {
            showNotification('❌ Error signing message: ' + error.message, 'error');
        }
    }
}

// Handle message cancel
async function handleMessageCancel() {
    // Save cancelled result
    await chrome.storage.local.set({
        messageSignResult: {
            success: false,
            error: 'User cancelled'
        }
    });
    
    // Clear pending request
    await chrome.storage.local.remove('pendingMessageRequest');
    
    // Close popup
    window.close();
}

// Sign message locally (same logic as background)
async function signMessageLocal(message, mnemonic) {
    const network = bitcoin.networks.bitcoin;
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
    
    const child = root.derivePath("m/86'/0'/0'/0/0");
    const address = bitcoin.payments.p2tr({
        internalPubkey: child.publicKey.slice(1, 33),
        network
    }).address;
    
    const privateKey = child.privateKey;
    if (!privateKey) {
        throw new Error('Failed to derive private key');
    }
    
    const messageBuffer = new TextEncoder().encode(message);
    const messageHash = bitcoin.crypto.sha256(messageBuffer);
    const signatureBytes = ecc.sign(messageHash, privateKey);
    const signatureBase64 = btoa(String.fromCharCode.apply(null, signatureBytes));
    
    return {
        signature: signatureBase64,
        address: address
    };
}

// Event listeners for sign message
document.getElementById('message-sign-btn')?.addEventListener('click', handleMessageSign);
document.getElementById('message-cancel-btn')?.addEventListener('click', handleMessageCancel);

// ==========================================
// ⚡ LIGHTNING NETWORK UI (SEND/RECEIVE/OPEN CHANNEL)
// ==========================================

// Send Lightning - Mostrar tela
function showSendLightningScreen() {
    console.log('⚡ Opening Send Lightning screen...');
    showScreen('send-lightning');
    
    // Limpar campos
    document.getElementById('send-lightning-invoice').value = '';
    document.getElementById('send-lightning-decoded-info').classList.add('hidden');
    document.getElementById('send-lightning-pay-btn').disabled = true;
}

// Send Lightning - Decode invoice
async function handleDecodeLightningInvoice() {
    const invoice = document.getElementById('send-lightning-invoice').value.trim();
    
    if (!invoice) {
        showNotification('❌ Please enter a Lightning invoice', 'error');
        return;
    }
    
    try {
        console.log('🔍 Decoding invoice...');
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/lightning/decode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice })
        });
        
        const decoded = await response.json();
        
        if (!decoded.success) {
            throw new Error(decoded.error || 'Failed to decode invoice');
        }
        
        console.log('✅ Invoice decoded:', decoded);
        
        // Mostrar informações
        document.getElementById('send-lightning-amount').textContent = 
            `${decoded.amount?.toLocaleString() || '?'} sats`;
        document.getElementById('send-lightning-description').textContent = 
            decoded.description || 'No description';
        
        document.getElementById('send-lightning-decoded-info').classList.remove('hidden');
        document.getElementById('send-lightning-pay-btn').disabled = false;
        
        showNotification('✅ Invoice decoded successfully', 'success');
        
    } catch (error) {
        console.error('❌ Error decoding invoice:', error);
        showNotification('❌ Failed to decode invoice: ' + error.message, 'error');
    }
}

// Send Lightning - Pay invoice
async function handlePayLightningInvoice() {
    const invoice = document.getElementById('send-lightning-invoice').value.trim();
    
    if (!invoice) {
        showNotification('❌ Please enter a Lightning invoice', 'error');
        return;
    }
    
    try {
        console.log('⚡ Paying Lightning invoice...');
        
        // Usar window.krayWallet.sendPayment() que já implementamos!
        const result = await sendMessage({ 
            action: 'sendPayment', 
            invoice 
        });
        
        if (result.success) {
            console.log('✅ Payment successful!');
            console.log('   Preimage:', result.preimage);
            
            showNotification('✅ Lightning payment sent successfully!', 'success');
            
            // Voltar para wallet após 1 segundo
            setTimeout(() => {
                showScreen('wallet');
                loadWalletData();
            }, 1000);
        } else {
            throw new Error(result.error || 'Payment failed');
        }
        
    } catch (error) {
        console.error('❌ Error paying invoice:', error);
        showNotification('❌ Payment failed: ' + error.message, 'error');
    }
}

// Receive Lightning - Mostrar tela
function showReceiveLightningScreen() {
    console.log('⚡ Opening Receive Lightning screen...');
    showScreen('receive-lightning');
    
    // Limpar campos
    document.getElementById('receive-lightning-amount').value = '';
    document.getElementById('receive-lightning-description').value = '';
    document.getElementById('receive-lightning-invoice-display').classList.add('hidden');
    document.getElementById('receive-lightning-copy-btn').classList.add('hidden');
}

// Receive Lightning - Create invoice
async function handleCreateLightningInvoice() {
    const amount = parseInt(document.getElementById('receive-lightning-amount').value);
    const description = document.getElementById('receive-lightning-description').value.trim();
    
    if (!amount || amount <= 0) {
        showNotification('❌ Please enter a valid amount', 'error');
        return;
    }
    
    try {
        console.log('⚡ Creating Lightning invoice...');
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/lightning/invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                description: description || 'KrayWallet payment'
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to create invoice');
        }
        
        console.log('✅ Invoice created:', result.invoice.substring(0, 50) + '...');
        
        // Mostrar invoice
        document.getElementById('receive-lightning-invoice-text').value = result.invoice;
        document.getElementById('receive-lightning-invoice-display').classList.remove('hidden');
        document.getElementById('receive-lightning-copy-btn').classList.remove('hidden');
        
        // TODO: Gerar QR Code
        // document.getElementById('receive-lightning-qr').innerHTML = `<img src="..." />`;
        
        showNotification('✅ Invoice created successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Error creating invoice:', error);
        showNotification('❌ Failed to create invoice: ' + error.message, 'error');
    }
}

// Receive Lightning - Copy invoice
function handleCopyLightningInvoice() {
    const invoice = document.getElementById('receive-lightning-invoice-text').value;
    
    navigator.clipboard.writeText(invoice).then(() => {
        showNotification('✅ Invoice copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy invoice:', err);
        showNotification('❌ Failed to copy invoice', 'error');
    });
}

// Open Channel - Mostrar tela
function showOpenChannelScreen() {
    console.log('📡 Opening Open Channel screen...');
    showScreen('open-channel');
    
    // Limpar campos
    document.getElementById('open-channel-pubkey').value = '';
    document.getElementById('open-channel-amount').value = '';
    document.getElementById('open-channel-host').value = '';
}

// Open Channel - Confirm
async function handleOpenChannel() {
    const pubkey = document.getElementById('open-channel-pubkey').value.trim();
    const amount = parseInt(document.getElementById('open-channel-amount').value);
    const host = document.getElementById('open-channel-host').value.trim();
    
    if (!pubkey) {
        showNotification('❌ Please enter a node public key', 'error');
        return;
    }
    
    if (!amount || amount < 20000) {
        showNotification('❌ Minimum channel capacity is 20,000 sats', 'error');
        return;
    }
    
    try {
        console.log('📡 Opening Lightning channel...');
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/lightning/open-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nodePubkey: pubkey,
                localAmount: amount,
                host: host || undefined
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to open channel');
        }
        
        console.log('✅ Channel opened:', result);
        
        showNotification('✅ Channel opened successfully!', 'success');
        
        // Voltar para wallet após 1 segundo
        setTimeout(() => {
            showScreen('wallet');
            loadWalletData();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error opening channel:', error);
        showNotification('❌ Failed to open channel: ' + error.message, 'error');
    }
}

// Event Listeners para botões Lightning
document.getElementById('send-lightning-btn')?.addEventListener('click', showSendLightningScreen);
document.getElementById('receive-lightning-btn')?.addEventListener('click', showReceiveLightningScreen);
document.getElementById('open-channel-btn')?.addEventListener('click', showOpenChannelScreen);

// Event Listeners para ações nas telas
document.getElementById('send-lightning-decode-btn')?.addEventListener('click', handleDecodeLightningInvoice);
document.getElementById('send-lightning-pay-btn')?.addEventListener('click', handlePayLightningInvoice);

document.getElementById('receive-lightning-create-btn')?.addEventListener('click', handleCreateLightningInvoice);
document.getElementById('receive-lightning-copy-btn')?.addEventListener('click', handleCopyLightningInvoice);

document.getElementById('open-channel-confirm-btn')?.addEventListener('click', handleOpenChannel);

// Event Listeners para botões de voltar
document.getElementById('back-from-send-lightning-btn')?.addEventListener('click', () => {
    showScreen('wallet');
    loadWalletData();
});
document.getElementById('back-from-receive-lightning-btn')?.addEventListener('click', () => {
    showScreen('wallet');
    loadWalletData();
});
document.getElementById('back-from-open-channel-btn')?.addEventListener('click', () => {
    showScreen('wallet');
    loadWalletData();
});

console.log('✅ Lightning UI functions loaded!');

// Expose functions
window.showMyOffersScreen = showMyOffersScreen;
window.loadMyOffers = loadMyOffers;
window.cancelOffer = cancelOffer;
window.showShareModal = showShareModal;


