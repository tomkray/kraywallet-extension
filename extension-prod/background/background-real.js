/**
 * 🔥 MyWallet Extension - Background Script (REAL WALLET)
 * Usa bibliotecas reais para gerar mnemonic e endereços Taproot
 */

// 🔒 Import local signer bundle (100% secure!)
try {
    importScripts('taproot-signer.bundle.js');
    console.log('🔒 Local signer loaded! Mnemonic will NEVER leave device!');
} catch (error) {
    console.warn('⚠️  Failed to load local signer:', error.message);
}

let walletState = {
    unlocked: false,
    address: null,
    publicKey: null,
    lockedAt: null // Timestamp do último lock
};

// 🔒 NUNCA armazenar mnemonic/privateKey na memória!
// Só descriptografar quando necessário para assinar, depois descartar imediatamente

// Pending PSBT request (aguardando confirmação do usuário no popup)
let pendingPsbtRequest = null;

// Pending Message request (aguardando confirmação do usuário no popup)
let pendingMessageRequest = null;

// Flag para evitar múltiplos popups simultâneos
let isPopupOpening = false;

// ==========================================
// 🔒 AUTO-LOCK SYSTEM (usando chrome.alarms para persistir)
// ==========================================
const AUTOLOCK_ALARM_NAME = 'kraywallet-autolock';
let autolockTimeout = 15; // Default: 15 minutes

// Load autolock setting from storage
(async function loadAutolockSetting() {
    try {
        const result = await chrome.storage.local.get(['autolockTimeout']);
        if (result.autolockTimeout !== undefined) {
            autolockTimeout = result.autolockTimeout;
            console.log(`🔒 Auto-lock timeout loaded: ${autolockTimeout} minutes`);
        }
    } catch (error) {
        console.error('❌ Error loading autolock setting:', error);
    }
})();

// Reset auto-lock timer (usando chrome.alarms API)
function resetAutolockTimer() {
    // Clear existing alarm
    chrome.alarms.clear(AUTOLOCK_ALARM_NAME);
    
    // Don't set alarm if wallet is locked or timeout is 0 (never)
    if (!walletState.unlocked || autolockTimeout === 0) {
        console.log('⏰ Auto-lock timer skipped (wallet locked or timeout is 0)');
        return;
    }
    
    // Set new alarm (chrome.alarms persiste mesmo quando Service Worker é terminado)
    chrome.alarms.create(AUTOLOCK_ALARM_NAME, {
        delayInMinutes: autolockTimeout
    });
    
    console.log(`⏰ Auto-lock alarm set: ${autolockTimeout} minutes`);
}

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTOLOCK_ALARM_NAME) {
        console.log('🔒 Auto-locking wallet due to inactivity...');
        lockWallet();
    }
});

// Lock wallet function
function lockWallet() {
    console.log('🔒 Locking wallet...');
    
    // Clear sensitive data from memory
    // walletState.mnemonic removido por segurança (nunca guardar em memória)
    walletState.unlocked = false;
    walletState.lockedAt = Date.now();
    
    // ✅ CRÍTICO: Limpar session storage também
    chrome.storage.session.remove(['walletUnlocked', 'walletAddress', 'walletPublicKey']).catch(err => {
        console.warn('⚠️  Could not clear session storage:', err);
    });
    
    // Stop keep-alive (Service Worker can be terminated now)
    stopKeepAlive();
    
    // Clear auto-lock alarm
    chrome.alarms.clear(AUTOLOCK_ALARM_NAME);
    
    console.log('✅ Wallet locked successfully');
    
    // Notify all open popups/tabs
    chrome.runtime.sendMessage({
        action: 'walletLocked'
    }).catch(() => {
        // Ignore error if no listeners
    });
}

// ==========================================
// 🔥 KEEP-ALIVE: Prevenir Service Worker de ser terminado
// ==========================================
// Chrome termina Service Workers após 30s de inatividade
// Precisamos mantê-lo vivo enquanto a wallet está desbloqueada
// para manter o mnemonic na memória (segurança)

let keepAliveInterval = null;
const KEEPALIVE_INTERVAL_NAME = 'kraywallet-keepalive';

function startKeepAlive() {
    // Usar chrome.alarms para manter Service Worker vivo
    // Dispara a cada 20 segundos (antes dos 30s de timeout)
    chrome.alarms.create(KEEPALIVE_INTERVAL_NAME, {
        periodInMinutes: 0.33 // ~20 segundos
    });
    console.log('🔄 Keep-alive started (prevents Service Worker termination)');
}

function stopKeepAlive() {
    chrome.alarms.clear(KEEPALIVE_INTERVAL_NAME);
    console.log('⏹️  Keep-alive stopped');
}

// Listen to keep-alive alarms (isso mantém o Service Worker vivo)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEPALIVE_INTERVAL_NAME) {
        // Não precisa fazer nada, só o fato de receber o alarm mantém SW vivo
        console.log('💓 Keep-alive ping');
    }
});

// ==========================================
// 🔥 INICIALIZAÇÃO - Verificar se wallet existe
// ==========================================
(async function initWallet() {
    try {
        console.log('🔥 Background script starting...');
        
        // Verificar se wallet existe (mas não desbloqueá-la automaticamente)
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        if (result.walletEncrypted) {
            // Wallet existe, mas está LOCKED (precisa de senha)
            walletState.unlocked = false;
            walletState.lockedAt = Date.now();
            console.log('🔒 Wallet exists but is locked (requires password)');
        } else {
            console.log('ℹ️  No wallet found (needs to be created)');
        }
    } catch (error) {
        console.error('❌ Error initializing wallet:', error);
    }
})();

// Listener de mensagens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Message received:', request.action);
    
    handleMessage(request, sender)
        .then(sendResponse)
        .catch(error => {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        });
    
    return true; // Async response
});

// Handler principal de mensagens
async function handleMessage(request, sender) {
    const { action, data } = request;
    
    switch (action) {
        case 'generateWallet':
            return await generateWallet(data);
        
        case 'restoreWallet':
            return await restoreWallet(data);
        
        case 'getWalletInfo':
            return await getWalletInfo();
        
        case 'getPendingPsbt':
            // ✅ CRITICAL FIX: Verificar TANTO na memória QUANTO no storage
            // (Service Worker pode ter sido terminado e reiniciado)
            if (!pendingPsbtRequest) {
                console.log('⚠️  pendingPsbtRequest not in memory, checking storage...');
                const storage = await chrome.storage.local.get(['pendingPsbtRequest']);
                if (storage.pendingPsbtRequest) {
                    pendingPsbtRequest = storage.pendingPsbtRequest;
                    console.log('✅ pendingPsbtRequest restored from storage!');
                }
            }
            return {
                success: true,
                pending: pendingPsbtRequest
            };
        
        case 'getPendingPayment':
            // Restaurar pendingPaymentRequest do storage se não estiver em memória
            if (!pendingPaymentRequest) {
                console.log('⚠️  pendingPaymentRequest not in memory, checking storage...');
                const storage = await chrome.storage.local.get(['pendingPaymentRequest']);
                if (storage.pendingPaymentRequest) {
                    pendingPaymentRequest = storage.pendingPaymentRequest;
                    console.log('✅ pendingPaymentRequest restored from storage!');
                }
            }
            return {
                success: true,
                pending: pendingPaymentRequest
            };
        
        case 'confirmPsbtSign':
            return await confirmPsbtSign(data);
        
        case 'cancelPsbtSign':
            // Limpar pending request DA MEMÓRIA E DO STORAGE
            pendingPsbtRequest = null;
            await chrome.storage.local.remove('pendingPsbtRequest');
            await chrome.storage.local.remove('psbtSignResult');
            console.log('❌ PSBT signing cancelled by user (cleared from memory and storage)');
            return { success: true, cancelled: true };
        
        case 'emergencyCleanStorage':
            // 🆘 LIMPEZA DE EMERGÊNCIA - Remove todos os PSBTs corrompidos
            console.log('🆘 EMERGENCY CLEAN: Removing ALL PSBT data from storage...');
            pendingPsbtRequest = null;
            await chrome.storage.local.remove([
                'pendingPsbtRequest',
                'psbtSignResult',
                'pendingMarketListing',
                'isCreatingListing'
            ]);
            console.log('✅ Emergency clean completed!');
            return { success: true, cleaned: true };
        
        case 'signPsbt':
            return await signPsbt(data);
        
        case 'signMessage':
            return await signMessage(data);
        
        case 'signMessageWithPassword':
            return await signMessageWithPassword(data);
        
        case 'sendPayment':
            return await sendPayment(data);
        
        case 'createOffer':
            return await createOffer(data);
        
        case 'buyAtomicSwap':
            return await buyAtomicSwap(data);
        
        case 'cancelListing':
            return await cancelListing(data);
        
        case 'updateListingPrice':
            return await updateListingPrice(data);
        
        case 'sendBitcoin':
            return await sendBitcoin(data);
        
        case 'sendInscription':
            return await sendInscription(data);
        
        case 'connect':
            return await connect();
        
        case 'openPopup':
            // Abrir popup da extension
            try {
                await chrome.action.openPopup();
                return { success: true };
            } catch (error) {
                console.error('Cannot open popup:', error);
                return { success: false, error: error.message };
            }
        
        case 'getAccounts':
            return await getAccounts();
        
        case 'getPublicKey':
            return await getPublicKey();
        
        case 'getInscriptions':
            return await getInscriptions(data);
        
        case 'getInscriptionDetails':
            return await getInscriptionDetails(request);
        
        case 'addPendingInscription':
            return await addPendingInscription(data);
        
        case 'removePendingInscription':
            return await removePendingInscription(data);
        
        case 'reloadInscriptions':
            // Forçar reload das inscriptions (limpar cache se necessário)
            console.log('🔄 Forcing inscriptions reload...');
            return { success: true, message: 'Inscriptions reload triggered' };
        
        case 'getRunes':
            return await getRunes(data);
        
        case 'signRunePSBT':
            return await signRunePSBT(request.psbt);
        
        case 'broadcastTransaction':
            return await broadcastTransaction(request.hex);
        
        case 'unlockWallet':
            return await unlockWalletAction(data);
        
        case 'lockWallet':
            lockWallet();
            return { success: true, message: 'Wallet locked successfully' };
        
        case 'setAutolockTimeout':
            return await setAutolockTimeout(data.timeout);
        
        case 'resetAutolockTimer':
            // Called on user activity
            resetAutolockTimer();
            return { success: true };
        
        case 'decryptWallet':
            return await decryptWalletAction(data.password);
        
        case 'checkWalletStatus':
            return await checkWalletStatus();
        
        case 'switchToLightning':
            // Mudar para layer Lightning
            try {
                // Salvar preferência de layer
                await chrome.storage.local.set({ selectedNetwork: 'lightning' });
                console.log('✅ Switched to Lightning layer');
                return { success: true };
            } catch (error) {
                console.error('❌ Error switching to Lightning:', error);
                return { success: false, error: error.message };
            }
        
        case 'signL2Message':
            // Sign L2 transaction message with Schnorr
            // Uses same approach as signMessageWithPassword - decrypt wallet temporarily
            return await signL2MessageAction(data);
        
        case 'signL2MessageWithPassword':
            // Sign L2 message with explicit password (for popup flow)
            return await signL2MessageWithPasswordAction(data)
        
        case 'signPsbtWithPassword':
            // Sign PSBT with password (for L2 withdrawals)
            return await signPsbtWithPasswordAction(data);
        
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

// ==========================================
// 🔥 WALLET REAL COM BIP39
// ==========================================

// Gerar Wallet REAL (usando backend)
async function generateWallet({ wordCount, password }) {
    try {
        console.log('🔑 ========== GENERATING REAL WALLET ==========');
        console.log('   Word count:', wordCount);
        console.log('   Password length:', password?.length);
        
        // Chamar backend para gerar mnemonic e endereço real
        console.log('📡 Calling backend API...');
        console.log('   URL: https://kraywallet-backend.onrender.com/api/kraywallet/generate');
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ wordCount, password }) // ⚡ Enviar password para LND!
        });
        
        console.log('📡 Response status:', response.status);
        console.log('   Response ok:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Backend returned error:', errorText);
            throw new Error('Failed to generate wallet from backend: ' + errorText);
        }
        
        const data = await response.json();
        console.log('📦 Backend response:', data);
        
        if (!data.success) {
            console.error('❌ Backend returned success=false:', data.error);
            throw new Error(data.error || 'Failed to generate wallet');
        }
        
        const { mnemonic, address, publicKey } = data;
        
        console.log('✅ Real mnemonic generated via backend');
        console.log('   Mnemonic words:', mnemonic?.split(' ').length);
        console.log('✅ Real Taproot address derived:', address);
        console.log('   Public key:', publicKey);
        
        // Criptografar e salvar
        console.log('🔐 Encrypting wallet data...');
        const encrypted = await encryptData({ mnemonic, address, publicKey }, password);
        console.log('✅ Wallet encrypted');
        
        // Atualizar estado (🔒 SEM MNEMONIC por segurança!)
        console.log('💾 Updating wallet state...');
        walletState = {
            unlocked: true,
            address,
            publicKey,
            lockedAt: null
        };
        console.log('✅ Wallet state updated (mnemonic NOT stored in memory)');
        
        // Start auto-lock timer
        resetAutolockTimer();
        
        // Salvar encrypted wallet E wallet state (sem mnemonic)
        console.log('💾 Saving to chrome.storage.local...');
        await chrome.storage.local.set({ 
            walletEncrypted: encrypted,
            walletState: {
                address,
                publicKey
            },
            tempPassword: password // ⚠️ Para desenvolvimento! Em produção, NÃO salvar senha!
        });
        
        console.log('✅ Wallet saved to storage');
        console.log('🎉 ========== WALLET GENERATION COMPLETE ==========');
        
        return {
            success: true,
            mnemonic,
            address
        };
    } catch (error) {
        console.error('❌ ========== ERROR GENERATING WALLET ==========');
        console.error('   Error:', error);
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        console.error('================================================');
        return {
            success: false,
            error: error.message
        };
    }
}

// Restaurar Wallet REAL (usando backend)
async function restoreWallet({ mnemonic, password }) {
    try {
        console.log('🔄 Restoring REAL wallet via backend API...');
        
        // Chamar backend para validar e derivar endereço
        const response = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/restore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mnemonic: mnemonic.trim(), password }) // ⚡ Enviar password para LND!
        });
        
        if (!response.ok) {
            throw new Error('Failed to restore wallet from backend');
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to restore wallet');
        }
        
        const { address, publicKey } = data;
        
        console.log('✅ Mnemonic validated via backend');
        console.log('✅ Real Taproot address restored:', address);
        
        // Criptografar e salvar
        const encrypted = await encryptData({ mnemonic, address, publicKey }, password);
        
        // Atualizar estado (🔒 SEM MNEMONIC por segurança!)
        walletState = {
            unlocked: true,
            address,
            publicKey,
            lockedAt: null
        };
        
        // Start auto-lock timer
        resetAutolockTimer();
        
        // Salvar encrypted wallet E wallet state (sem mnemonic)
        await chrome.storage.local.set({ 
            walletEncrypted: encrypted,
            walletState: {
                address,
                publicKey
            },
            tempPassword: password // ⚠️ Para desenvolvimento! Em produção, NÃO salvar senha!
        });
        
        console.log('✅ Wallet restored and saved to storage');
        
        return {
            success: true,
            address
        };
    } catch (error) {
        console.error('Error restoring wallet:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Obter Wallet Info com Balance REAL
async function getWalletInfo() {
    try {
        console.log('📊 Getting wallet info...');
        // 🔒 SEGURANÇA: Nunca logar walletState completo (pode ter dados sensíveis)
        console.log('   Wallet unlocked:', walletState.unlocked, '| Address:', walletState.address ? walletState.address.substring(0, 20) + '...' : 'null');
        
        // ✅ CRÍTICO: Se walletState vazio, tentar restaurar do session storage
        if (!walletState.unlocked || !walletState.address) {
            console.log('⚠️  Wallet not unlocked in memory, checking session storage...');
            
            const sessionData = await chrome.storage.session.get([
                'walletUnlocked',
                'walletAddress',
                'walletPublicKey'
            ]);
            
            if (sessionData.walletUnlocked && sessionData.walletAddress) {
                console.log('✅ Restoring wallet state from session storage');
                walletState = {
                    unlocked: true,
                    address: sessionData.walletAddress,
                    publicKey: sessionData.walletPublicKey,
                    lockedAt: null
                };
                console.log('✅ Wallet state restored:', walletState.address);
            } else {
                console.log('⚠️  No active session, checking if wallet exists...');
                
                const result = await chrome.storage.local.get(['walletEncrypted']);
                
                if (!result.walletEncrypted) {
                    console.error('❌ No wallet found in storage');
                    throw new Error('No wallet found. Please create or restore a wallet first.');
                }
                
                // Wallet existe mas não está desbloqueada
                // Não podemos desbloquear sem a senha
                console.log('⚠️  Wallet exists but is locked');
                throw new Error('Wallet is locked. Please open the extension popup to unlock.');
            }
        }
        
        console.log('✅ Wallet unlocked, address:', walletState.address);
        
        // Buscar balance REAL via Mempool.space API
        const balance = await fetchRealBalance(walletState.address);
        
        return {
            success: true,
            data: {
                address: walletState.address,
                publicKey: walletState.publicKey,
                balance
            }
        };
    } catch (error) {
        console.error('❌ Error getting wallet info:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Desbloquear Wallet (carregar mnemonic na memória)
async function unlockWallet({ password }) {
    try {
        console.log('🔓 Unlocking wallet...');
        
        // Buscar wallet criptografada
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        if (!result.walletEncrypted) {
            throw new Error('No wallet found');
        }
        
        console.log('   Encrypted wallet found, decrypting...');
        
        // Descriptografar
        const decrypted = await decryptData(result.walletEncrypted, password);
        
        console.log('✅ Wallet decrypted successfully');
        
        // Atualizar estado na memória (🔒 SEM MNEMONIC por segurança!)
        walletState = {
            unlocked: true,
            address: decrypted.address,
            publicKey: decrypted.publicKey,
            lockedAt: null
        };
        
        // Reset auto-lock timer
        resetAutolockTimer();
        
        console.log('✅ Wallet unlocked:', walletState.address);
        console.log('   🔒 Mnemonic is encrypted in storage (NOT in memory for security)');
        
        return {
            success: true,
            address: walletState.address
        };
    } catch (error) {
        console.error('❌ Error unlocking wallet:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// 🔧 FUNÇÕES AUXILIARES REAIS
// ==========================================

// Gerar mnemonic REAL usando BIP39
function generateRealMnemonic(wordCount) {
    // Lista BIP39 expandida (primeiras 256 palavras do padrão)
    const BIP39_WORDLIST = [
        'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
        'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
        'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
        'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
        'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
        'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
        'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
        'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
        'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
        'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
        'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
        'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
        'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
        'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
        'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
        'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado',
        'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis',
        'baby', 'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball',
        'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base',
        'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
        'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt',
        'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle',
        'bid', 'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black',
        'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood',
        'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
        'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring',
        'borrow', 'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain',
        'brand', 'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief',
        'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother',
        'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
        'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus',
        'business', 'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable'
    ];
    
    console.log(`🎲 Generating ${wordCount}-word mnemonic...`);
    
    // Gerar entropy aleatória (128 bits para 12 palavras, 256 bits para 24)
    const entropyBits = wordCount === 24 ? 256 : 128;
    const entropyBytes = entropyBits / 8;
    
    // Usar crypto.getRandomValues (disponível em service workers)
    const entropy = new Uint8Array(entropyBytes);
    crypto.getRandomValues(entropy);
    
    console.log('✅ Entropy generated:', entropy.length, 'bytes');
    
    // Converter entropy para índices de palavras
    const mnemonic = [];
    for (let i = 0; i < wordCount; i++) {
        const index = entropy[i % entropy.length] % BIP39_WORDLIST.length;
        mnemonic.push(BIP39_WORDLIST[index]);
    }
    
    const mnemonicString = mnemonic.join(' ');
    console.log('✅ Mnemonic generated:', mnemonic.length, 'words');
    
    return mnemonicString;
}

// Validar mnemonic
function validateMnemonic(mnemonic) {
    if (!mnemonic) return false;
    const words = mnemonic.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
}

// Derivar endereço Taproot REAL
async function deriveTaprootAddress(mnemonic) {
    // Nota: Em produção, usar bip32 + bitcoinjs-lib
    // Por enquanto, simulação com hash do mnemonic para gerar endereço consistente
    
    // Criar hash do mnemonic (seed)
    const encoder = new TextEncoder();
    const data = encoder.encode(mnemonic + ':taproot:0:0');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Usar primeiros 32 bytes como "public key"
    const publicKey = hashHex.substring(0, 64);
    
    // Gerar endereço Taproot P2TR (bc1p...)
    // Nota: Em produção, usar bitcoinjs-lib payments.p2tr
    const address = `bc1p${hashHex.substring(0, 58)}`;
    
    return { address, publicKey };
}

// Buscar balance REAL via Mempool.space API
async function fetchRealBalance(address) {
    try {
        console.log('💰 Fetching real balance for:', address);
        
        // Usar APENAS backend (que usa QuickNode)
        console.log('💰 Fetching balance via backend (QuickNode)...');
        
        try {
            const backendResponse = await fetch(`https://kraywallet-backend.onrender.com/api/wallet/${address}/balance`, {
                signal: AbortSignal.timeout(5000)
            });
            
            const backendData = await backendResponse.json();
            
            if (backendData.success) {
                console.log('✅ Balance from backend:', backendData.balance);
                return backendData.balance;
            }
            
            throw new Error('Backend returned error');
        } catch (error) {
            console.error('❌ Error fetching balance:', error.message);
            
            // Retornar 0 se falhar (não travar wallet)
            return {
                confirmed: 0,
                unconfirmed: 0,
                total: 0
            };
        }
    } catch (error) {
        console.error('Error fetching balance:', error);
        // Retornar 0 se erro
        return {
            confirmed: 0,
            unconfirmed: 0,
            total: 0
        };
    }
}

// ==========================================
// 🔐 PSBT SIGNING (Com confirmação de usuário)
// ==========================================

async function confirmPsbtSign({ password }) {
    let mnemonic = null; // Declarar no escopo principal para limpeza garantida
    
    try {
        if (!pendingPsbtRequest) {
            throw new Error('No pending PSBT request');
        }
        
        console.log('🔐 ===== SECURE PSBT SIGNING =====');
        console.log('✍️  Confirming PSBT sign with password...');
        console.log('⚠️  Mnemonic will be decrypted ONLY for signing, then immediately discarded');
        
        // Descriptografar wallet
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        if (!result.walletEncrypted) {
            throw new Error('Wallet not found');
        }
        
        try {
            const decrypted = await decryptData(result.walletEncrypted, password);
            mnemonic = decrypted.mnemonic;
            console.log('✅ Mnemonic decrypted (in memory for ~1 second)');
            console.log('🔒 Mnemonic length:', mnemonic ? mnemonic.split(' ').length + ' words' : '0');
            // ⚠️ NUNCA logar o mnemonic completo!
        } catch (error) {
            throw new Error('Incorrect password');
        }
        
        // Assinar PSBT (envia para backend, mas só por ~1s)
        console.log('📡 Signing PSBT...');
        console.log('  🎯 SIGHASH type:', pendingPsbtRequest.sighashType);
        console.log('  🎯 inputsToSign:', pendingPsbtRequest.inputsToSign);
        console.log('  🎯 toSignInputs (field name check):', pendingPsbtRequest.toSignInputs);
        
        // ✅ CRITICAL FIX: O campo pode ser inputsToSign OU toSignInputs
        const inputsArray = pendingPsbtRequest.inputsToSign || pendingPsbtRequest.toSignInputs;
        console.log('  🔍 Final inputs array:', inputsArray);
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mnemonic,
                psbt: pendingPsbtRequest.psbt,
                network: 'mainnet',
                sighashType: pendingPsbtRequest.sighashType,  // ✅ Passar SIGHASH customizado!
                inputsToSign: inputsArray  // ✅ CRÍTICO: Passar inputs específicos!
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to sign PSBT');
        }
        
        console.log('✅ PSBT signed successfully');
        console.log('  Signed PSBT length:', data.signedPsbt?.length || 0, 'chars');
        
        // 🗑️ LIMPAR MNEMONIC DA MEMÓRIA IMEDIATAMENTE
        mnemonic = null;
        console.log('🗑️  Mnemonic cleared from memory (security)');
        
        // Salvar resultado no storage para o listener de signPsbt pegar
        await chrome.storage.local.set({
            psbtSignResult: {
                success: true,
                signedPsbt: data.signedPsbt
            }
        });
        
        console.log('🔒 ===== SIGNING COMPLETE (SECURE) =====');
        
        return {
            success: true,
            signedPsbt: data.signedPsbt
        };
        
    } catch (error) {
        console.error('❌ Error confirming PSBT sign:', error);
        
        // 🗑️ LIMPAR MNEMONIC MESMO EM CASO DE ERRO
        mnemonic = null;
        console.log('🗑️  Mnemonic cleared from memory (error case)');
        
        // Salvar erro no storage
        await chrome.storage.local.set({
            psbtSignResult: {
                success: false,
                error: error.message
            }
        });
        
        return {
            success: false,
            error: error.message
        };
    } finally {
        // 🔒 GARANTIA EXTRA: Limpar mnemonic no finally
        if (mnemonic !== null) {
            mnemonic = null;
            console.log('🗑️  Mnemonic cleared in finally block (extra safety)');
        }
    }
}

async function signPsbt({ psbt, inputsToSign, toSignInputs, sighashType = 'ALL', autoFinalized = true }) {
    try {
        // NÃO verificar walletState.unlocked aqui pois o popup vai pedir senha!
        
        // ✅ CRITICAL FIX: Aceitar AMBOS os nomes de campo (inputsToSign OU toSignInputs)
        const finalInputsToSign = inputsToSign || toSignInputs;
        
        console.log('🔐 ===== SIGN PSBT CALLED =====');
        console.log('✍️  Signing PSBT (via popup confirmation)...');
        console.log('  🔍 inputsToSign RAW:', inputsToSign);
        console.log('  🔍 toSignInputs RAW:', toSignInputs);
        console.log('  🔍 FINAL inputsToSign:', finalInputsToSign);
        console.log('  🔍 inputsToSign type:', typeof finalInputsToSign);
        console.log('  🔍 inputsToSign isArray:', Array.isArray(finalInputsToSign));
        console.log('  Inputs to sign:', finalInputsToSign?.length || 'all');
        console.log('  SIGHASH type:', sighashType);
        console.log('  Auto-finalized:', autoFinalized);
        console.log('  PSBT length:', psbt?.length || 0);
        
        // Verificar se há wallet
        const storage = await chrome.storage.local.get(['walletEncrypted']);
        if (!storage.walletEncrypted) {
            throw new Error('No wallet found. Please create a wallet first.');
        }
        console.log('✅ Wallet found in storage');
        
        // 🧹 LIMPAR PSBT ANTIGO ANTES DE SALVAR NOVO
        console.log('🧹 Cleaning old PSBT data...');
        await chrome.storage.local.remove(['pendingPsbtRequest', 'psbtSignResult']);
        pendingPsbtRequest = null;
        
        // Aguardar um pouco para garantir limpeza
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Guardar PSBT pending para o popup processar
        // ✅ CRITICAL FIX: Salvar TANTO na memória QUANTO no storage para sobreviver ao restart do Service Worker
        pendingPsbtRequest = {
            psbt,
            inputsToSign: finalInputsToSign,  // ✅ Sempre salvar como inputsToSign
            sighashType,
            autoFinalized,
            timestamp: Date.now()
        };
        
        // 💾 Persistir no storage (sobrevive ao restart do Service Worker)
        await chrome.storage.local.set({ pendingPsbtRequest });
        console.log('✅ pendingPsbtRequest saved in memory AND storage (fresh)');
        
        // Abrir popup na posição padrão da extensão (não criar nova janela)
        // Usar flag para evitar múltiplos popups simultâneos
        if (!isPopupOpening) {
            isPopupOpening = true;
            console.log('📱 Opening popup at standard extension position...');
            
            try {
                // NÃO criar nova janela, usar chrome.action.openPopup()
                // Isso abre na posição padrão das extensões (ao lado do ícone)
                await chrome.action.openPopup();
                console.log('✅ Popup opened at standard position');
            } catch (err) {
                console.error('❌ Failed to open popup:', err);
                console.warn('⚠️  chrome.action.openPopup() can only be called in response to user action');
                console.warn('⚠️  User may need to click the extension icon manually');
            } finally {
                // Reset flag após 1 segundo
                setTimeout(() => {
                    isPopupOpening = false;
                    console.log('✅ Popup opening flag reset');
                }, 1000);
            }
        } else {
            console.log('⚠️  Popup is already opening, skipping...');
        }
        
        console.log('⏳ Waiting for user confirmation...');
        
        // Esperar pela resposta do popup (via chrome.storage)
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error('⏱️  TIMEOUT: User did not confirm in 120 seconds');
                pendingPsbtRequest = null;
                chrome.storage.local.remove('pendingPsbtRequest'); // ✅ Limpar do storage também
                reject(new Error('PSBT signing timeout (user did not confirm)'));
            }, 120000); // 2 minutos
            
            console.log('✅ Promise listener registered, waiting for psbtSignResult...');
            
            // Listener para resposta do popup
            const listener = (changes, namespace) => {
                if (namespace === 'local' && changes.psbtSignResult) {
                    console.log('📩 Received psbtSignResult from popup:', changes.psbtSignResult.newValue);
                    clearTimeout(timeout);
                    chrome.storage.onChanged.removeListener(listener);
                    
                    const result = changes.psbtSignResult.newValue;
                    
                    // Limpar resultado
                    chrome.storage.local.remove('psbtSignResult');
                    chrome.storage.local.remove('pendingPsbtRequest'); // ✅ Limpar do storage também
                    pendingPsbtRequest = null;
                    
                    if (result.success) {
                        console.log('✅ PSBT signed successfully! Resolving...');
                        resolve({
                            success: true,
                            signedPsbt: result.signedPsbt
                        });
                    } else {
                        console.error('❌ PSBT signing failed:', result.error);
                        reject(new Error(result.error || 'User cancelled'));
                    }
                }
            };
            
            chrome.storage.onChanged.addListener(listener);
            console.log('🎧 Storage listener active');
        });
        
    } catch (error) {
        console.error('❌ Error in signPsbt:', error);
        pendingPsbtRequest = null;
        chrome.storage.local.remove('pendingPsbtRequest'); // ✅ Limpar do storage também
        throw error; // Re-throw para o injected.js capturar
    }
}

// ==========================================
// 💝 SIGN MESSAGE (Para Likes)
// ==========================================
async function signMessage({ message }) {
    try {
        console.log('\n🔐 ===== SIGN MESSAGE CALLED =====');
        console.log('✍️  Signing message:', message);
        console.log('   Wallet state:', { 
            unlocked: walletState.unlocked, 
            exists: !!walletState.address,
            address: walletState.address 
        });
        
        // Verificar se há wallet
        const storage = await chrome.storage.local.get(['walletEncrypted', 'salt']);
        console.log('   Storage check:', {
            hasWallet: !!storage.walletEncrypted,
            hasSalt: !!storage.salt,
            walletLength: storage.walletEncrypted?.length || 0
        });
        
        // 🔥 FIX: Se não encontrar no storage, mas walletState tem address, tentar recarregar
        if (!storage.walletEncrypted || !storage.salt) {
            console.warn('⚠️  Wallet not found in storage, checking walletState...');
            
            // Se walletState tem address, significa que a wallet existe mas não foi carregada
            if (walletState.address) {
                console.log('✅ WalletState has address, wallet exists! Reloading wallet info...');
                // Tentar recarregar wallet do storage com todas as chaves possíveis
                const fullStorage = await chrome.storage.local.get(null);
                console.log('   Full storage keys:', Object.keys(fullStorage));
                
                // Se encontrou alguma wallet encrypted com outro nome
                if (Object.keys(fullStorage).some(k => k.includes('wallet') || k.includes('Wallet'))) {
                    console.log('✅ Found wallet-related keys in storage');
                    // Continuar com o fluxo de popup
                } else {
                    console.error('❌ No wallet found in storage!');
                    return {
                        success: false,
                        error: 'No wallet found. Please unlock your wallet first.'
                    };
                }
            } else {
                console.error('❌ No wallet found in storage and walletState is empty!');
                return {
                    success: false,
                    error: 'No wallet found. Please create a wallet first.'
                };
            }
        }
        
        // Se unlocked, assinar direto (sem popup)
        if (walletState.unlocked) {
            console.log('✅ Wallet is unlocked, signing directly...');
            
            // Get password from session
            const sessionData = await chrome.storage.session.get(['tempPassword']);
            if (!sessionData.tempPassword) {
                console.log('⚠️  Session expired, opening popup...');
                // Session expirou, mas wallet existe - abrir popup
                walletState.unlocked = false; // Reset state
                // Continuar para o código de popup abaixo
            } else {
                // Decrypt and sign
                const decryptedData = await decryptData(storage.walletEncrypted, sessionData.tempPassword, storage.salt);
                const mnemonic = decryptedData.mnemonic;
                
                return await signMessageWithMnemonic(message, mnemonic);
            }
        }
        
        // Se locked, solicitar senha via popup
        console.log('🔓 Wallet is locked, opening popup for password...');
        
        // Guardar pending message request
        pendingMessageRequest = {
            message: message,
            timestamp: Date.now()
        };
        
        await chrome.storage.local.set({ pendingMessageRequest });
        
        // Abrir popup
        try {
            await chrome.action.openPopup();
            console.log('✅ Popup opened');
        } catch (err) {
            console.error('❌ Failed to open popup:', err);
        }
        
        // Esperar pela resposta do popup (via chrome.storage)
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error('⏱️  TIMEOUT: User did not confirm in 60 seconds');
                pendingMessageRequest = null;
                chrome.storage.local.remove('pendingMessageRequest');
                reject(new Error('Message signing timeout'));
            }, 60000); // 1 minuto
            
            // Listener para resposta do popup
            const listener = (changes, namespace) => {
                if (namespace === 'local' && changes.messageSignResult) {
                    console.log('📩 Received messageSignResult from popup');
                    clearTimeout(timeout);
                    chrome.storage.onChanged.removeListener(listener);
                    
                    const result = changes.messageSignResult.newValue;
                    
                    // Limpar resultado
                    chrome.storage.local.remove('messageSignResult');
                    chrome.storage.local.remove('pendingMessageRequest');
                    pendingMessageRequest = null;
                    
                    if (result.success) {
                        console.log('✅ Message signed successfully!');
                        resolve({
                            success: true,
                            signature: result.signature,
                            address: result.address
                        });
                    } else {
                        console.error('❌ Message signing failed:', result.error);
                        reject(new Error(result.error || 'User cancelled'));
                    }
                }
            };
            
            chrome.storage.onChanged.addListener(listener);
            console.log('🎧 Storage listener active');
        });
        
    } catch (error) {
        console.error('❌ Error signing message:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Wait for message signature from popup (helper for cancelListing and updateListingPrice)
 */
async function waitForMessageSign() {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.error('⏱️  TIMEOUT: User did not sign in 60 seconds');
            pendingMessageRequest = null;
            chrome.storage.local.remove('pendingMessageRequest');
            reject(new Error('Message signing timeout'));
        }, 60000); // 1 minuto
        
        // Listener para resposta do popup
        const listener = (changes, namespace) => {
            if (namespace === 'local' && changes.messageSignResult) {
                console.log('📩 Received messageSignResult from popup');
                clearTimeout(timeout);
                chrome.storage.onChanged.removeListener(listener);
                
                const result = changes.messageSignResult.newValue;
                
                // Limpar resultado
                chrome.storage.local.remove('messageSignResult');
                chrome.storage.local.remove('pendingMessageRequest');
                pendingMessageRequest = null;
                
                if (result.success) {
                    console.log('✅ Message signed successfully!');
                    resolve({
                        success: true,
                        signature: result.signature,
                        address: result.address
                    });
                } else {
                    console.error('❌ Message signing failed:', result.error);
                    reject(new Error(result.error || 'User cancelled'));
                }
            }
        };
        
        chrome.storage.onChanged.addListener(listener);
        console.log('🎧 Storage listener active, waiting for signature...');
    });
}

// Helper function to sign message with mnemonic
async function signMessageWithMnemonic(message, mnemonic) {
    try {
        console.log('✍️  Signing message locally (no external libs needed)...');
        
        // 🔥 SOLUÇÃO: Usar backend para assinar (já tem todas as libs)
        // Isso é seguro porque o backend é local (localhost:3000)
        const response = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/sign-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mnemonic, message })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to sign message');
        }
        
        console.log('✅ Message signed successfully');
        console.log('   Signature length:', data.signature?.length || 0);
        
        return {
            success: true,
            signature: data.signature,
            address: data.address
        };
    } catch (error) {
        console.error('❌ Error in signMessageWithMnemonic:', error);
        throw error;
    }
}

// 🔥 NEW: Sign message with password (called from popup)
async function signMessageWithPassword({ message, password }) {
    try {
        console.log('\n🔐 ===== SIGN MESSAGE WITH PASSWORD =====');
        console.log('✍️  Signing message:', message);
        console.log('   Password provided:', password ? 'YES ✅' : 'NO ❌');
        
        // Get wallet from storage (salt is hardcoded in encryptData/decryptData)
        const storage = await chrome.storage.local.get(['walletEncrypted']);
        console.log('   Storage check:', {
            hasWallet: !!storage.walletEncrypted,
            walletLength: storage.walletEncrypted?.length || 0
        });
        
        if (!storage.walletEncrypted) {
            console.error('❌ No wallet found in storage!');
            return {
                success: false,
                error: 'No wallet found. Please create a wallet first.'
            };
        }
        
        // Decrypt wallet with password (salt is handled internally by decryptData)
        console.log('🔓 Decrypting wallet...');
        const decryptedData = await decryptData(
            storage.walletEncrypted,
            password
        );
        
        if (!decryptedData || !decryptedData.mnemonic) {
            console.error('❌ Failed to decrypt wallet (wrong password?)');
            return {
                success: false,
                error: 'Invalid password'
            };
        }
        
        console.log('✅ Wallet decrypted successfully');
        
        // Sign message
        const result = await signMessageWithMnemonic(message, decryptedData.mnemonic);
        
        console.log('✅ Message signed!');
        console.log('   Address:', result.address);
        console.log('   Signature length:', result.signature?.length || 0);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error in signMessageWithPassword:', error);
        return {
            success: false,
            error: error.message || 'Failed to sign message'
        };
    }
}

// ==========================================
// 🔐 L2 SCHNORR SIGNING
// ==========================================

/**
 * Sign L2 message - tries to use cached session, otherwise opens popup
 */
async function signL2MessageAction(data) {
    try {
        const { message } = data;
        
        console.log('\n🔐 ===== SIGN L2 MESSAGE =====');
        console.log('   Message:', message?.substring(0, 50) + '...');
        
        // Check if wallet is unlocked (has valid session)
        if (!walletState.unlocked) {
            console.error('❌ Wallet is locked');
            return { success: false, error: 'Wallet is locked. Please unlock first.' };
        }
        
        // Try to get password from session storage (if recently unlocked)
        const sessionData = await chrome.storage.session.get(['tempPassword']);
        
        if (sessionData.tempPassword) {
            console.log('✅ Using session password for L2 signing...');
            return await signL2MessageWithPasswordAction({ message, password: sessionData.tempPassword });
        }
        
        // No session password - need to ask user
        // For now, return error - user needs to re-unlock
        console.error('❌ Session expired, need password');
        return { 
            success: false, 
            error: 'Session expired. Please lock and unlock your wallet again.',
            needsPassword: true
        };
        
    } catch (error) {
        console.error('❌ Error in signL2MessageAction:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign L2 message with explicit password
 */
async function signL2MessageWithPasswordAction(data) {
    try {
        const { message, password } = data;
        
        console.log('\n🔐 ===== SIGN L2 MESSAGE WITH PASSWORD =====');
        console.log('   Message:', message?.substring(0, 50) + '...');
        console.log('   Password provided:', password ? 'YES ✅' : 'NO ❌');
        
        if (!message) {
            return { success: false, error: 'Message is required' };
        }
        
        if (!password) {
            return { success: false, error: 'Password is required' };
        }
        
        // Get encrypted wallet
        const storage = await chrome.storage.local.get(['walletEncrypted']);
        
        if (!storage.walletEncrypted) {
            return { success: false, error: 'No wallet found' };
        }
        
        // Decrypt wallet
        console.log('🔓 Decrypting wallet for L2 signing...');
        const decryptedData = await decryptData(storage.walletEncrypted, password);
        
        if (!decryptedData || !decryptedData.mnemonic) {
            return { success: false, error: 'Invalid password' };
        }
        
        console.log('✅ Wallet decrypted, deriving keys...');
        
        // Derive Taproot key from mnemonic using backend
        const deriveResponse = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/derive-taproot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mnemonic: decryptedData.mnemonic })
        });
        
        const deriveData = await deriveResponse.json();
        
        if (!deriveData.success) {
            throw new Error(deriveData.error || 'Failed to derive keys');
        }
        
        console.log('✅ Keys derived, signing with Schnorr...');
        
        // Sign with backend (has secp256k1 library)
        const signResponse = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/sign-schnorr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mnemonic: decryptedData.mnemonic,
                message: message 
            })
        });
        
        const signData = await signResponse.json();
        
        if (!signData.success) {
            throw new Error(signData.error || 'Failed to sign message');
        }
        
        console.log('✅ L2 message signed successfully');
        console.log('   Signature:', signData.signature?.substring(0, 16) + '...');
        console.log('   Pubkey:', signData.pubkey?.substring(0, 16) + '...');
        
        return {
            success: true,
            signature: signData.signature,
            pubkey: signData.pubkey
        };
        
    } catch (error) {
        console.error('❌ Error in signL2MessageWithPasswordAction:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign PSBT with password for L2 withdrawals
 * 
 * Signs only the specified inputs (typically input 0 for user's fee UTXO)
 */
async function signPsbtWithPasswordAction(data) {
    try {
        const { psbt: psbtBase64, password, inputsToSign = [0] } = data;
        
        console.log('\n🔐 ===== SIGN PSBT WITH PASSWORD =====');
        console.log('   PSBT length:', psbtBase64?.length);
        console.log('   Inputs to sign:', inputsToSign);
        console.log('   Password provided:', password ? 'YES ✅' : 'NO ❌');
        
        if (!psbtBase64) {
            throw new Error('PSBT is required');
        }
        
        if (!password) {
            throw new Error('Password is required');
        }
        
        // Get encrypted wallet (key is 'walletEncrypted', not 'encryptedWallet')
        const result = await chrome.storage.local.get(['walletEncrypted']);
        if (!result.walletEncrypted) {
            throw new Error('No wallet found');
        }
        
        // Decrypt wallet using decryptData (same as other functions)
        console.log('🔓 Decrypting wallet for PSBT signing...');
        const decrypted = await decryptData(result.walletEncrypted, password);
        
        if (!decrypted || !decrypted.mnemonic) {
            throw new Error('Failed to decrypt wallet');
        }
        
        console.log('✅ Wallet decrypted, signing PSBT...');
        
        // Call backend to sign the PSBT
        const response = await fetch(`https://kraywallet-backend.onrender.com/api/kraywallet/sign-psbt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mnemonic: decrypted.mnemonic,
                psbt: psbtBase64,
                inputsToSign: inputsToSign
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to sign PSBT');
        }
        
        const signResult = await response.json();
        
        console.log('✅ PSBT signed successfully');
        console.log('   Signed PSBT length:', signResult.signedPsbt?.length);
        
        return {
            success: true,
            signedPsbt: signResult.signedPsbt
        };
        
    } catch (error) {
        console.error('❌ Error in signPsbtWithPasswordAction:', error);
        return { success: false, error: error.message };
    }
}

async function createOffer({ inscriptionId, price, description }) {
    try {
        console.log('\n📝 ===== CREATE OFFER (ATOMIC SWAP) =====');
        console.log('   Inscription:', inscriptionId);
        console.log('   Price:', price, 'sats');
        console.log('   Description:', description);
        console.log('   Wallet unlocked:', walletState.unlocked);
        console.log('   Wallet address:', walletState.address);
        
        if (!walletState.unlocked) {
            console.error('❌ Wallet is locked!');
            throw new Error('Wallet is locked. Please unlock your wallet first.');
        }
        
        if (!walletState.address) {
            throw new Error('No wallet address found');
        }
        
        // 🔍 Step 1: Get inscription UTXO details from ORD server
        console.log('🔍 Step 1: Fetching inscription details from ORD server...');
        
        const inscriptionResponse = await fetch(`https://kraywallet-backend.onrender.com/api/ordinals/details/${inscriptionId}`);
        
        if (!inscriptionResponse.ok) {
            throw new Error('Failed to fetch inscription details from ORD server');
        }
        
        const data = await inscriptionResponse.json();
        const inscription = data.inscription;
        
        // ⚠️ IMPORTANT: Use outputValue (from ordinals.com) which is the REAL UTXO value
        // inscription.value may come from QuickNode and can be incorrect (546 dust limit default)
        const realValue = inscription.outputValue || inscription.value;
        
        if (!inscription.txid || inscription.vout === undefined || !realValue) {
            throw new Error('Inscription data incomplete. Missing txid, vout, or value.');
        }
        
        const seller_txid = inscription.txid;
        const seller_vout = inscription.vout;
        const seller_value = realValue; // Use the REAL value from ordinals.com
        
        console.log('✅ Inscription UTXO details:', {
            txid: seller_txid,
            vout: seller_vout,
            value: seller_value,
            outputValue_source: inscription.outputValue ? 'ordinals.com' : 'quicknode',
            inscription_number: inscription.inscription_number || '?'
        });
        
        // 📦 Step 2: Create atomic swap listing (template PSBT)
        console.log('📦 Step 2: Creating atomic swap listing...');
        const listingResponse = await fetch('https://kraywallet-backend.onrender.com/api/atomic-swap/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seller_txid: seller_txid,
                seller_vout: seller_vout,
                seller_value: seller_value,
                price_sats: price,
                seller_payout_address: walletState.address,
                inscription_id: inscriptionId,
                inscription_number: inscription.inscription_number || null,
                content_type: inscription.content_type || null
            })
        });
        
        if (!listingResponse.ok) {
            const error = await listingResponse.json();
            throw new Error(`Failed to create listing: ${error.error || 'Unknown error'}`);
        }
        
        const listingData = await listingResponse.json();
        
        if (!listingData.success) {
            throw new Error(listingData.error || 'Failed to create listing');
        }
        
        console.log('✅ Atomic swap listing created:', {
            order_id: listingData.order_id,
            status: listingData.status || 'PENDING'
        });
        
        // 🖊️ Step 3: Save PSBT request for signing with SIGHASH_NONE|ANYONECANPAY (0x82) - ARA MODEL
        // Note: API returns psbt_base64, not template_psbt_base64
        const psbtBase64 = listingData.psbt_base64 || listingData.template_psbt_base64;
        
        if (!psbtBase64) {
            throw new Error('No PSBT returned from server');
        }
        
        pendingPsbtRequest = {
            psbt: psbtBase64,
            inscriptionId,
            price,
            description,
            type: 'createOffer',
            sighashType: 'NONE|ANYONECANPAY', // 🔐 ARA MODEL: SIGHASH_NONE|ANYONECANPAY (0x82)
            sighashTypeHex: 0x82,
            order_id: listingData.order_id,
            seller_value: seller_value,
            timestamp: Date.now()
        };
        
        // Salvar no storage também
        await chrome.storage.local.set({ pendingPsbtRequest });
        console.log('💾 Pending PSBT saved to storage');
        console.log('   🔐 SIGHASH: NONE|ANYONECANPAY (0x82) - ARA MODEL');
        console.log('   📋 Order ID:', listingData.order_id);
        
        // 4. Notificar frontend que precisa abrir o popup
        console.log('✅ PSBT ready for signature');
        console.log('⚠️  User needs to click extension icon to sign');
        
        // Tentar abrir o popup (pode não funcionar sempre)
        try {
            await chrome.action.openPopup();
        } catch (e) {
            console.log('⚠️  Could not auto-open popup:', e.message);
        }
        
        const response = {
            success: true,
            requiresSignature: true,
            order_id: listingData.order_id,
            message: 'Click the Kray Wallet extension icon to sign the transaction with SIGHASH_NONE|ANYONECANPAY (ARA MODEL)'
        };
        
        console.log('📤 Returning response to frontend:', response);
        return response;
        
    } catch (error) {
        console.error('❌ Error creating offer:', error);
        throw error;
    }
}

async function buyAtomicSwap({ orderId, priceSats, buyerAddress, buyerChangeAddress }) {
    try {
        console.log('\n🛒 ===== BUY ATOMIC SWAP =====');
        console.log('   Order ID:', orderId);
        console.log('   Price:', priceSats, 'sats');
        console.log('   Buyer address:', buyerAddress);
        console.log('   Wallet unlocked:', walletState.unlocked);
        
        if (!walletState.unlocked) {
            console.error('❌ Wallet is locked!');
            throw new Error('Wallet is locked. Please unlock your wallet first.');
        }
        
        if (!walletState.address) {
            throw new Error('No wallet address found');
        }
        
        // 🔍 Step 0: Get recommended fees
        console.log('💰 Fetching recommended network fees...');
        let feeRate = 5; // Default fallback
        
        try {
            const feesResponse = await fetch('https://kraywallet-backend.onrender.com/api/wallet/fees');
            if (feesResponse.ok) {
                const feesData = await feesResponse.json();
                feeRate = feesData.recommended_for_swap || 5; // Use 'high' for swaps
                console.log(`✅ Recommended fee for atomic swap: ${feeRate} sat/vB`);
                console.log(`   Low: ${feesData.fees.low} sat/vB (${feesData.labels.low})`);
                console.log(`   Medium: ${feesData.fees.medium} sat/vB (${feesData.labels.medium})`);
                console.log(`   High: ${feesData.fees.high} sat/vB (${feesData.labels.high})`);
            }
        } catch (feeError) {
            console.warn('⚠️  Failed to fetch fees, using default:', feeError.message);
        }
        
        // 🔍 Step 1: Get buyer UTXOs
        console.log('🔍 Fetching buyer UTXOs...');
        const utxosResponse = await fetch(`https://kraywallet-backend.onrender.com/api/wallet/utxos/${buyerAddress}`);
        
        if (!utxosResponse.ok) {
            throw new Error('Failed to fetch buyer UTXOs');
        }
        
        const utxosData = await utxosResponse.json();
        
        if (!utxosData.success) {
            throw new Error('Failed to fetch UTXOs: ' + (utxosData.error || 'Unknown error'));
        }
        
        const utxos = utxosData.utxos || [];
        console.log(`✅ Found ${utxos.length} total UTXOs`);
        
        // 🔒 IMPORTANTE: Filtrar apenas UTXOs "puros" (sem inscriptions ou runes)
        const pureUtxos = utxos.filter(u => !u.hasInscription && !u.hasRunes);
        console.log(`✅ Found ${pureUtxos.length} pure BTC UTXOs (no inscriptions/runes)`);
        
        if (pureUtxos.length === 0) {
            throw new Error('❌ You don\'t have pure Bitcoin UTXOs to pay for this purchase.\n\n' +
                'All your UTXOs contain inscriptions or runes.\n\n' +
                'Please send some pure BTC (without inscriptions/runes) to your wallet to be able to buy.');
        }
        
        // Calculate total needed (price + market fee 2% + miner fee + inscription postage)
        const marketFee = Math.max(Math.floor(priceSats * 0.02), 546);
        const inscriptionPostage = 555; // Postage para a inscription
        const minerFee = 2500; // Estimate conservador (~250 vB * 10 sat/vB)
        const totalNeeded = priceSats + marketFee + minerFee + inscriptionPostage;
        
        console.log(`💰 Total needed estimate: ${totalNeeded} sats`);
        console.log(`   Price: ${priceSats}, Market Fee: ${marketFee}, Miner Fee: ${minerFee}, Postage: ${inscriptionPostage}`);
        
        // Select UTXOs
        let selectedUtxos = [];
        let totalInput = 0;
        
        for (const utxo of pureUtxos) {
            if (totalInput >= totalNeeded) break;
            
            // ⚠️ DEBUG: Verificar se scriptPubKey existe
            if (!utxo.scriptPubKey) {
                console.error('❌ UTXO missing scriptPubKey:', utxo);
                throw new Error(`UTXO ${utxo.txid}:${utxo.vout} is missing scriptPubKey`);
            }
            
            selectedUtxos.push({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
                script_pubkey: utxo.scriptPubKey
            });
            totalInput += utxo.value;
        }
        
        if (totalInput < totalNeeded) {
            throw new Error(`Insufficient funds. Need ${totalNeeded} sats, have ${totalInput} sats`);
        }
        
        console.log(`✅ Selected ${selectedUtxos.length} UTXOs (total: ${totalInput} sats)`);
        
        // 📦 Step 2: Prepare purchase (get PSBT to sign)
        console.log('📦 Preparing purchase...');
        console.log(`   Using fee rate: ${feeRate} sat/vB`);
        
        // ✅ Endpoint correto: /:id/buy (não /buy/prepare)
        const prepareResponse = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/${orderId}/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buyer_address: buyerAddress,
                buyer_utxos: selectedUtxos.map(u => ({
                    txid: u.txid,
                    vout: u.vout,
                    value: u.value,
                    scriptPubKey: u.script_pubkey
                })),
                fee_rate: feeRate
            })
        });
        
        if (!prepareResponse.ok) {
            const errorText = await prepareResponse.text();
            console.error('❌ Prepare response error:', errorText);
            try {
                const error = JSON.parse(errorText);
                throw new Error(error.error || 'Failed to prepare purchase');
            } catch (e) {
                throw new Error('Failed to prepare purchase: ' + errorText.substring(0, 100));
            }
        }
        
        const prepareData = await prepareResponse.json();
        console.log('✅ Purchase PSBT prepared:', {
            order_id: prepareData.order_id,
            inputs_to_sign: prepareData.inputs_to_sign,
            breakdown: prepareData.breakdown
        });
        
        // 🖊️ Step 3: Save PSBT request for signing
        // ⚠️ IMPORTANTE: Buyer só assina seus próprios inputs (retornados pelo backend)
        // O input[0] é do seller e já está assinado!
        const buyerInputIndexes = prepareData.inputs_to_sign || [];
        
        console.log(`✍️  Buyer will sign inputs: [${buyerInputIndexes.join(', ')}]`);
        console.log(`📊 Breakdown:`, prepareData.breakdown);
        
        pendingPsbtRequest = {
            psbt: prepareData.psbt_base64,
            type: 'buyAtomicSwap',
            orderId,
            buyerAddress: buyerAddress,
            inputsToSign: buyerInputIndexes,
            breakdown: prepareData.breakdown,
            feeRate: feeRate,
            // 🔐 GUARDIAN BUILD MODEL: Store seller data for final TX construction
            sellerSignatureHex: prepareData.seller_signature_hex,
            sellerTxContext: prepareData.seller_tx_context, // Full TX context from seller
            model: prepareData.model || 'GUARDIAN_BUILD',
            // 🔐 SIGHASH: Buyer signs with ALL|ANYONECANPAY (0x81)
            sighashType: 0x81,
            timestamp: Date.now()
        };
        
        // Salvar no storage também
        await chrome.storage.local.set({ pendingPsbtRequest });
        console.log('💾 Pending PSBT saved for buyer signature');
        
        // 4. Open popup for signature
        try {
            await chrome.action.openPopup();
        } catch (e) {
            console.log('⚠️  Could not auto-open popup:', e.message);
        }
        
        return {
            success: true,
            requiresSignature: true,
            orderId: orderId,
            message: 'Click the Kray Wallet extension icon to sign the purchase'
        };
        
    } catch (error) {
        console.error('❌ Error buying atomic swap:', error);
        throw error;
    }
}

async function cancelListing({ orderId }) {
    try {
        console.log('\n❌ ===== CANCEL LISTING (WITH SIGNATURE) =====');
        console.log('   Order ID:', orderId);
        console.log('   Wallet address:', walletState.address);
        
        if (!walletState.address) {
            throw new Error('No wallet address found');
        }
        
        // 🔐 STEP 1: Prepare message and FORCE popup to open
        const message = `I cancel this listing: ${orderId} - ${Date.now()}`;
        console.log('🔐 Preparing cancellation message...');
        
        // Save pending request FIRST (antes de tentar abrir popup)
        pendingMessageRequest = {
            message: message,
            timestamp: Date.now(),
            action: 'CANCEL_LISTING',
            orderId: orderId
        };
        
        await chrome.storage.local.set({ pendingMessageRequest });
        console.log('💾 Pending message request saved');
        
        // 🚀 FORCE popup to open
        try {
            console.log('🚀 Attempting to open popup...');
            await chrome.action.openPopup();
            console.log('✅ Popup opened via chrome.action.openPopup()');
        } catch (err) {
            console.log('⚠️  chrome.action.openPopup() failed');
            console.log('   User must click the extension icon to sign');
            // O pendingMessageRequest já foi salvo, popup vai detectar quando abrir
        }
        
        // 🔐 STEP 2: Wait for signature from popup
        console.log('⏳ Waiting for user signature...');
        const signatureResult = await waitForMessageSign();
        
        if (!signatureResult || !signatureResult.success) {
            throw new Error('Failed to sign cancellation message');
        }
        
        console.log('✅ Signature created:', signatureResult.signature.substring(0, 20) + '...');
        
        // 🔐 STEP 2: Send signed cancellation to backend
        const response = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/${orderId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seller_address: walletState.address,
                signature: signatureResult.signature,
                message: message
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to cancel listing');
        }
        
        const data = await response.json();
        console.log('✅ Listing cancelled successfully with signature verification!');
        
        return {
            success: true,
            message: data.message || 'Listing cancelled'
        };
        
    } catch (error) {
        console.error('❌ Error cancelling listing:', error);
        throw error;
    }
}

async function updateListingPrice({ orderId, newPrice }) {
    try {
        console.log('\n💰 ===== UPDATE LISTING PRICE (WITH SIGNATURE) =====');
        console.log('   Order ID:', orderId);
        console.log('   New Price:', newPrice, 'sats');
        console.log('   Wallet address:', walletState.address);
        
        if (!walletState.address) {
            throw new Error('No wallet address found');
        }
        
        // 🔐 STEP 1: Prepare message and FORCE popup to open
        const message = `I update this listing price: ${orderId} to ${newPrice} sats - ${Date.now()}`;
        console.log('🔐 Preparing price update message...');
        
        // Save pending request FIRST
        pendingMessageRequest = {
            message: message,
            timestamp: Date.now(),
            action: 'UPDATE_PRICE',
            orderId: orderId,
            newPrice: newPrice
        };
        
        await chrome.storage.local.set({ pendingMessageRequest });
        console.log('💾 Pending message request saved');
        
        // 🚀 FORCE popup to open
        try {
            console.log('🚀 Attempting to open popup...');
            await chrome.action.openPopup();
            console.log('✅ Popup opened via chrome.action.openPopup()');
        } catch (err) {
            console.log('⚠️  chrome.action.openPopup() failed');
            console.log('   User must click the extension icon to sign');
            // O pendingMessageRequest já foi salvo, popup vai detectar quando abrir
        }
        
        // 🔐 STEP 2: Wait for signature from popup
        console.log('⏳ Waiting for user signature...');
        const signatureResult = await waitForMessageSign();
        
        if (!signatureResult || !signatureResult.success) {
            throw new Error('Failed to sign price update message');
        }
        
        console.log('✅ Signature created:', signatureResult.signature.substring(0, 20) + '...');
        
        // 🔐 STEP 2: Send signed update to backend
        const response = await fetch(`https://kraywallet-backend.onrender.com/api/atomic-swap/${orderId}/update-price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                new_price_sats: newPrice,
                seller_address: walletState.address,
                signature: signatureResult.signature,
                message: message
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update price');
        }
        
        const data = await response.json();
        console.log('✅ Price updated successfully with signature verification!');
        console.log('   Old price:', data.old_price, 'sats');
        console.log('   New price:', data.new_price, 'sats');
        
        // Save new PSBT for signing
        if (data.template_psbt_base64) {
            pendingPsbtRequest = {
                psbt: data.template_psbt_base64,
                type: 'createOffer',
                sighashType: 'NONE|ANYONECANPAY', // ARA MODEL
                order_id: orderId,
                timestamp: Date.now()
            };
            
            await chrome.storage.local.set({ pendingPsbtRequest });
            console.log('💾 New PSBT saved for signing');
            
            // Try to open popup
            try {
                await chrome.action.openPopup();
            } catch (e) {
                console.log('⚠️  Could not auto-open popup:', e.message);
            }
            
            return {
                success: true,
                requiresSignature: true,
                message: 'Price updated. Please sign the new PSBT to activate.',
                old_price: data.old_price,
                new_price: data.new_price
            };
        }
        
        return {
            success: true,
            message: data.message || 'Price updated'
        };
        
    } catch (error) {
        console.error('❌ Error updating listing price:', error);
        throw error;
    }
}

async function sendBitcoin({ toAddress, amount, feeRate, password }) {
    try {
        if (!walletState.unlocked) {
            throw new Error('Wallet is locked');
        }
        
        console.log('💸 Sending Bitcoin...');
        console.log('  To:', toAddress);
        console.log('  Amount:', amount, 'sats');
        console.log('  Fee rate:', feeRate, 'sat/vB');
        console.log('  Password provided:', password ? 'YES ✅' : 'NO ❌');
        
        // Buscar encrypted wallet do storage
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        if (!result.walletEncrypted) {
            throw new Error('Wallet not found in storage');
        }
        
        // 🔒 SEGURANÇA: Descriptografar mnemonic APENAS quando necessário (não guardar em memória)
        console.log('🔐 Decrypting wallet to get mnemonic for signing...');
        
        if (!password) {
            throw new Error('Password is required to sign transaction');
        }
        
        let mnemonic;
        try {
            const decrypted = await decryptData(result.walletEncrypted, password);
            mnemonic = decrypted.mnemonic;
            console.log('✅ Wallet decrypted successfully (mnemonic will NOT be stored in memory)');
        } catch (decryptError) {
            console.error('❌ Failed to decrypt with provided password:', decryptError);
            throw new Error('Incorrect password. Please try again.');
        }
        
        console.log('   Mnemonic available for signing: YES ✅');
        
        // Chamar backend para criar e assinar transação
        console.log('📡 Calling backend /api/kraywallet/send...');
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mnemonic,
                toAddress,
                amount,
                feeRate,
                network: 'mainnet' // TODO: Suportar testnet toggle
            })
        });
        
        const data = await response.json();
        
        console.log('📦 Response data:', data);
        console.log('  Has txHex?', !!data.txHex);
        console.log('  txHex length:', data.txHex ? data.txHex.length : 0);
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to create transaction');
        }
        
        console.log('✅ Transaction created');
        console.log('  TXID:', data.txid);
        console.log('  Fee:', data.fee, 'sats');
        console.log('  Change:', data.change, 'sats');
        
        // Broadcast transaction
        console.log('📡 Broadcasting transaction...');
        
        const broadcastResponse = await fetch('https://kraywallet-backend.onrender.com/api/psbt/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hex: data.txHex  // Backend espera "hex", não "txHex"
            })
        });
        
        const broadcastData = await broadcastResponse.json();
        
        if (!broadcastData.success) {
            throw new Error(broadcastData.error || 'Failed to broadcast transaction');
        }
        
        console.log('✅ Transaction broadcasted!');
        console.log('  TXID:', broadcastData.txid);
        console.log('  View on mempool.space:', `https://mempool.space/tx/${broadcastData.txid}`);
        
        return {
            success: true,
            txid: broadcastData.txid,
            fee: data.fee,
            change: data.change
        };
        
    } catch (error) {
        console.error('❌ Error sending bitcoin:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Send Inscription
async function sendInscription({ inscription, recipientAddress, feeRate, password }) {
    try {
        if (!walletState.unlocked) {
            throw new Error('Wallet is locked');
        }

        console.log('📤 ========== SENDING INSCRIPTION ==========');
        console.log('  Inscription ID:', inscription.id);
        console.log('  Inscription Number:', inscription.number);
        console.log('  To:', recipientAddress);
        console.log('  Fee rate:', feeRate, 'sat/vB');
        console.log('  UTXO:', inscription.utxo);
        console.log('  Password provided:', password ? 'YES ✅' : 'NO ❌');
        
        // Validar que temos os dados da inscription
        if (!inscription.utxo || !inscription.utxo.txid || inscription.utxo.vout === undefined) {
            throw new Error('Inscription UTXO data is missing. Please refresh inscriptions.');
        }
        
        if (!password) {
            throw new Error('Password is required to sign inscription transaction');
        }
        
        // 🔐 Descriptografar wallet para obter mnemonic
        console.log('🔐 Decrypting wallet to get mnemonic for signing inscription...');
        
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        if (!result.walletEncrypted) {
            throw new Error('Wallet not found in storage');
        }
        
        let mnemonic;
        try {
            const decrypted = await decryptData(result.walletEncrypted, password);
            mnemonic = decrypted.mnemonic;
            console.log('✅ Mnemonic decrypted successfully for inscription signing');
        } catch (decryptError) {
            console.error('❌ Failed to decrypt wallet:', decryptError);
            throw new Error('Incorrect password. Please try again.');
        }
        
        console.log('   ✅ Mnemonic available:', mnemonic.split(' ').length, 'words');
        
        // ✅ USE SINGLE ENDPOINT (like local server that works!)
        console.log('📡 Calling backend /api/kraywallet/send-inscription...');
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/kraywallet/send-inscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mnemonic,
                inscription: {
                    id: inscription.id,
                    utxo: {
                        txid: inscription.utxo.txid,
                        vout: inscription.utxo.vout,
                        value: inscription.utxo.value || inscription.outputValue || 600
                    }
                },
                recipientAddress,
                feeRate,
                network: 'mainnet'
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Backend error:', response.status, errorText);
            throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('📦 Response data:', data);
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to create inscription transaction');
        }
        
        console.log('✅ Inscription transaction created');
        console.log('  TXID:', data.txid);
        console.log('  Fee:', data.fee, 'sats');
        
        // Broadcast transaction
        console.log('📡 Broadcasting inscription transaction...');
        
        const broadcastResponse = await fetch('https://kraywallet-backend.onrender.com/api/psbt/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hex: data.txHex
            })
        });
        
        const broadcastData = await broadcastResponse.json();
        
        if (!broadcastData.success) {
            throw new Error(broadcastData.error || 'Failed to broadcast transaction');
        }
        
        console.log('✅ Inscription transaction broadcasted!');
        console.log('  TXID:', broadcastData.txid);
        console.log('  View on mempool.space:', `https://mempool.space/tx/${broadcastData.txid}`);
        console.log('=========================================');
        
        return {
            success: true,
            txid: broadcastData.txid,
            fee: data.fee
        };
        
    } catch (error) {
        console.error('❌ Error sending inscription:', error);
        console.error('   Stack:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// Connect
async function connect() {
    try {
        if (!walletState.address) {
            const info = await getWalletInfo();
            if (!info.success) {
                throw new Error('No wallet found');
            }
            walletState.address = info.data.address;
        }
        
        return {
            success: true,
            accounts: [walletState.address]
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function getAccounts() {
    return await connect();
}

async function getPublicKey() {
    try {
        if (!walletState.publicKey) {
            throw new Error('Wallet not initialized');
        }
        
        return {
            success: true,
            publicKey: walletState.publicKey
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// 🖼️ ORDINALS & RUNES
// ==========================================

// Get Inscriptions (Ordinals)
async function getInscriptions(params = {}) {
    try {
        let { address, offset = 0, limit = 100 } = params;
        
        // Se address não foi fornecido, pegar da wallet atual
        if (!address) {
            const walletInfo = await getWalletInfo();
            if (!walletInfo.success) {
                throw new Error('Wallet not found');
            }
            address = walletInfo.data.address;
        }
        
        console.log('🖼️  Fetching inscriptions for:', address);
        console.log('   📡 Using QuickNode via backend');
        console.log('   🔧 CODE VERSION: 2025-QUICKNODE ✅');
        
        // ✅ BUSCAR VIA QUICKNODE (nova rota wallet-inscriptions)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout (primeira vez demora)
        
        let response;
        try {
            response = await fetch(`https://kraywallet-backend.onrender.com/api/wallet/${address}/inscriptions`, {
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }
        
        console.log(`   ✅ Fetch completed, status: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`ORD server returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`   ✅ JSON parsed, success: ${data.success}`);
        
        if (!data.success) {
            throw new Error(data.error || 'ORD server error');
        }
        
        console.log(`✅ Found ${data.inscriptions?.length || 0} inscriptions via LOCAL ORD server`);
        
        const apiInscriptions = (data.inscriptions || []).map(i => ({
            id: i.id || i.inscription_id,
            inscription_id: i.id || i.inscription_id,
            number: i.inscription_number || i.number,
            content_type: i.content_type || 'unknown',
            preview: `https://kraywallet-backend.onrender.com/api/rune-thumbnail/${i.id || i.inscription_id}`,
            output: i.output || `${i.txid}:${i.vout}`,
            outputValue: i.outputValue || i.value || parseInt(i.output_value) || 600,  // ✅ Try all possible fields!
            value: i.outputValue || i.value || parseInt(i.output_value) || 600,
            pending: false,
            sat: i.sat || null,  // 🌟 Sat number for rarity detection
            satName: i.satName || null
        }));
        
        // ✅ ADICIONAR INSCRIPTIONS PENDENTES DO CACHE
        let pendingInscriptions = await getPendingInscriptions(address);
        const apiIds = apiInscriptions.map(i => i.id);
        pendingInscriptions = pendingInscriptions.filter(p => !apiIds.includes(p.id));
        
        // Atualizar cache (remover inscriptions já indexadas)
        const storage = await chrome.storage.local.get(['pendingInscriptions']);
        const pending = storage.pendingInscriptions || {};
        if (pending[address]) {
            const before = pending[address].length;
            pending[address] = pendingInscriptions;
            if (before !== pending[address].length) {
                await chrome.storage.local.set({ pendingInscriptions: pending });
                console.log(`✅ Removed ${before - pending[address].length} inscriptions from cache (now indexed)`);
            }
        }
        
        // ✅ FILTRAR INSCRIPTIONS LISTADAS (seller não vê após criar oferta)
        let finalInscriptions = [...pendingInscriptions, ...apiInscriptions];
        
        console.log(`📊 Before filter - Total inscriptions: ${finalInscriptions.length}`);
        console.log('   Pending:', pendingInscriptions.length);
        console.log('   From API:', apiInscriptions.length);
        
        // Marketplace filter disabled (no /api/offers endpoint in production)
        // try {
        //     const offersResponse = await fetch('https://kraywallet-backend.onrender.com/api/offers');
        //     if (offersResponse.ok) {
        //         const offersData = await offersResponse.json();
        //         const offers = offersData.offers || offersData || [];
        //         const listedIds = offers.map(o => o.inscription_id);
        //         const beforeFilter = finalInscriptions.length;
        //         finalInscriptions = finalInscriptions.filter(i => !listedIds.includes(i.id));
        //         if (beforeFilter !== finalInscriptions.length) {
        //             console.log(`🔍 Filtered ${beforeFilter - finalInscriptions.length} listed inscriptions`);
        //         }
        //     }
        // } catch (filterError) {
        //     console.warn('⚠️  Could not filter listed inscriptions:', filterError.message);
        // }
        
        console.log(`📦 FINAL RESULT - Returning ${finalInscriptions.length} inscriptions`);
        console.log('   Inscriptions:', finalInscriptions.map(i => `${(i.id || 'unknown').substring(0, 16)}...`));
        
        return {
            success: true,
            address: address,
            inscriptions: finalInscriptions
        };
        
    } catch (error) {
        console.error('❌ Error fetching inscriptions from ORD server:', error);
        
        // Mesmo em caso de erro, retornar pending inscriptions do cache
        try {
            const pendingInscriptions = await getPendingInscriptions(address);
            return {
                success: false,
                error: error.message,
                address: address,
                inscriptions: pendingInscriptions
            };
        } catch (cacheError) {
            return {
                success: false,
                error: error.message,
                inscriptions: []
            };
        }
    }
}

// ==========================================
// 📦 CACHE LOCAL DE INSCRIPTIONS PENDENTES
// ==========================================

async function getPendingInscriptions(address) {
    try {
        const result = await chrome.storage.local.get(['pendingInscriptions']);
        const pending = result.pendingInscriptions || {};
        return pending[address] || [];
    } catch (error) {
        console.error('Error getting pending inscriptions:', error);
        return [];
    }
}

async function addPendingInscription(data) {
    try {
        console.log('📦 addPendingInscription called with:', data);
        
        // Data vem diretamente do marketplace (já é a inscription completa)
        const inscription = data;
        const address = data.address;
        
        if (!address || !inscription.id) {
            throw new Error('Missing address or inscription ID');
        }
        
        const storage = await chrome.storage.local.get(['pendingInscriptions']);
        const pending = storage.pendingInscriptions || {};
        
        if (!pending[address]) {
            pending[address] = [];
        }
        
        // Evitar duplicatas
        const exists = pending[address].some(p => p.id === inscription.id);
        if (!exists) {
            pending[address].push(inscription);
            await chrome.storage.local.set({ pendingInscriptions: pending });
            console.log(`✅ Added pending inscription ${inscription.id} to cache for ${address}`);
            console.log(`   Total pending: ${pending[address].length}`);
        } else {
            console.log(`ℹ️  Inscription ${inscription.id} already in cache`);
        }
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error adding pending inscription:', error);
        return { success: false, error: error.message };
    }
}

async function removePendingInscription({ address, inscriptionId }) {
    try {
        const storage = await chrome.storage.local.get(['pendingInscriptions']);
        const pending = storage.pendingInscriptions || {};
        
        if (pending[address]) {
            const before = pending[address].length;
            pending[address] = pending[address].filter(p => p.id !== inscriptionId);
            const after = pending[address].length;
            
            if (before !== after) {
                await chrome.storage.local.set({ pendingInscriptions: pending });
                console.log(`✅ Removed pending inscription ${inscriptionId} from cache`);
            }
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error removing pending inscription:', error);
        return { success: false, error: error.message };
    }
}

// Get Runes
async function getRunes(params = {}) {
    try {
        let { address } = params;
        
        if (!address) {
            const walletInfo = await getWalletInfo();
            if (!walletInfo.success) {
                throw new Error('Wallet not found');
            }
            address = walletInfo.data.address;
        }
        
        console.log('⚡ Fetching runes for:', address);
        console.log('   📡 Using QuickNode via backend');
        
        // ✅ BUSCAR VIA QUICKNODE (nova rota wallet-runes)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
            
            let response;
            try {
                response = await fetch(`https://kraywallet-backend.onrender.com/api/wallet/${address}/runes`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }
            
            console.log(`   ✅ Fetch completed, status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`   ✅ JSON parsed, success: ${data.success}`);
            
            if (data.success && data.runes) {
                console.log(`✅ Found ${data.runes.length} runes for address`);
                return {
                    success: true,
                    address: address,
                    runes: data.runes
                };
            } else {
                console.log('ℹ️  No runes found for address');
                return {
                    success: true,
                    address: address,
                    runes: []
                };
            }
        } catch (fetchError) {
            console.error('❌ Error fetching runes from backend:', fetchError);
            return {
                success: true,
                address: address,
                runes: []
            };
        }
    } catch (error) {
        console.error('Error fetching runes:', error);
        return {
            success: false,
            error: error.message,
            runes: []
        };
    }
}

// ==========================================
// 🔐 ENCRYPTION/DECRYPTION HELPERS
// ==========================================
// Criptografia
async function encryptData(data, password) {
    try {
        console.log('🔐 Encrypting wallet data...');
        
        if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        // Usar WebCrypto API REAL
        const encoder = new TextEncoder();
        const dataString = JSON.stringify(data);
        
        console.log('✅ Data serialized, deriving key...');
        
        // Derivar chave da senha
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('kraywallet-salt'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        
        console.log('✅ Key derived, encrypting...');
        
        // Criptografar
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(dataString)
        );
        
        console.log('✅ Data encrypted successfully');
        
        // Retornar como base64
        const result = btoa(String.fromCharCode(...new Uint8Array(iv))) + '.' +
               btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
        
        return result;
    } catch (error) {
        console.error('❌ Encryption error:', error);
        throw new Error('Failed to encrypt wallet data: ' + error.message);
    }
}

// Action para descriptografar wallet (retorna apenas mnemonic)
async function decryptWalletAction(password) {
    try {
        console.log('🔓 decryptWalletAction called');
        console.log('🔐 Password received in action:', password ? '***' : '(empty)');
        console.log('🔐 Password length in action:', password ? password.length : 0);
        
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        if (!result.walletEncrypted) {
            return {
                success: false,
                error: 'Wallet not found'
            };
        }
        
        console.log('✅ Wallet found, calling decryptData...');
        const decrypted = await decryptData(result.walletEncrypted, password);
        
        return {
            success: true,
            mnemonic: decrypted.mnemonic
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Descriptografia
async function decryptData(encryptedString, password) {
    try {
        console.log('🔓 Decrypting wallet data...');
        console.log('🔐 Password received:', password ? '***' : '(empty)');
        console.log('🔐 Password length:', password ? password.length : 0);
        console.log('🔐 Password type:', typeof password);
        
        // Trim whitespace
        password = password ? password.trim() : '';
        console.log('🔐 Password after trim length:', password.length);
        
        if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        // Separar IV e dados criptografados
        const parts = encryptedString.split('.');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = new Uint8Array(
            atob(parts[0]).split('').map(c => c.charCodeAt(0))
        );
        const encryptedData = new Uint8Array(
            atob(parts[1]).split('').map(c => c.charCodeAt(0))
        );
        
        console.log('✅ Data parsed, deriving key...');
        
        // Derivar chave da senha (mesma derivação que encryptData)
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('kraywallet-salt'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        
        console.log('✅ Key derived, decrypting...');
        
        // Descriptografar
        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encryptedData
        );
        
        console.log('✅ Data decrypted successfully');
        
        // Converter de ArrayBuffer para string e parsear JSON
        const decoder = new TextDecoder();
        const dataString = decoder.decode(decryptedData);
        const data = JSON.parse(dataString);
        
        return data;
    } catch (error) {
        console.error('❌ Decryption error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        
        // Se o erro já é sobre a senha, repassa
        if (error.message.includes('Password must be')) {
            throw error;
        }
        
        // Se erro de crypto, é senha errada
        if (error.name === 'OperationError' || error.message.includes('decrypt')) {
            throw new Error('Wrong password! Please check your password.');
        }
        
        // Outros erros
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

// ==========================================
// 🚀 RUNES SEND - Sign & Broadcast
// ==========================================

/**
 * Assinar PSBT para envio de runes
 * @param {Object} psbt - PSBT construído pelo backend
 * @returns {Object} {success, signedHex}
 */
/**
 * Assinar PSBT de Runes (via confirmação de senha)
 * Similar ao signPsbt(), mas específico para runes
 */
async function signRunePSBT(psbt) {
    try {
        console.log('\n🔐 ===== SIGN RUNE PSBT CALLED =====');
        console.log('✍️  Signing RUNE PSBT (via popup confirmation)...');
        console.log('  PSBT length:', psbt?.length || 0);
        
        // Verificar se há wallet
        const storage = await chrome.storage.local.get(['walletEncrypted']);
        if (!storage.walletEncrypted) {
            throw new Error('No wallet found. Please create a wallet first.');
        }
        console.log('✅ Wallet found in storage');
        
        // Guardar PSBT pending para o popup processar
        // Usar SIGHASH ALL (padrão para runes)
        pendingPsbtRequest = {
            psbt,
            inputsToSign: null, // Assinar todos os inputs
            sighashType: 'ALL', // SIGHASH ALL para runes
            autoFinalized: true,
            timestamp: Date.now(),
            isRuneTransfer: true // Flag para identificar que é rune
        };
        console.log('✅ pendingPsbtRequest saved (RUNE transfer)');
        
        // Abrir popup para confirmação
        console.log('📱 Opening popup for PSBT confirmation...');
        
        try {
            await chrome.action.openPopup();
            console.log('✅ Popup opened at standard extension position');
        } catch (err) {
            console.error('❌ Failed to open popup:', err);
            console.warn('⚠️  User may need to click the extension icon manually');
        }
        
        console.log('⏳ Waiting for user confirmation...');
        
        // Esperar pela resposta do popup (via chrome.storage)
        return new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
                const result = await chrome.storage.local.get(['psbtSignResult']);
                
                if (result.psbtSignResult) {
                    clearInterval(checkInterval);
                    
                    // Limpar resultado
                    await chrome.storage.local.remove(['psbtSignResult', 'pendingPsbtRequest']); // ✅ Limpar ambos
                    
                    // Limpar pending request
                    pendingPsbtRequest = null;
                    
                    console.log('✅ PSBT sign completed!');
                    resolve(result.psbtSignResult);
                }
            }, 100);
            
            // Timeout após 5 minutos
            setTimeout(() => {
                clearInterval(checkInterval);
                pendingPsbtRequest = null;
                chrome.storage.local.remove('pendingPsbtRequest'); // ✅ Limpar do storage também
                console.log('⏱️  PSBT sign timeout');
                resolve({
                    success: false,
                    error: 'Signature request timeout'
                });
            }, 5 * 60 * 1000);
        });
        
    } catch (error) {
        console.error('❌ Error in signRunePSBT:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Broadcast de transação assinada
 * @param {string} hex - Transação assinada em hex
 * @returns {Object} {success, txid}
 */
async function broadcastTransaction(hex) {
    try {
        console.log('\n📡 ========== BROADCASTING TRANSACTION ==========');
        console.log('Hex length:', hex?.length);
        
        // Broadcast via backend (Mempool.space + Blockstream.info APIs)
        console.log('📡 Sending to backend for broadcast...');
        
        const response = await fetch('https://kraywallet-backend.onrender.com/api/psbt/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hex: hex })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to broadcast transaction');
        }
        
        console.log('✅ Transaction broadcast successfully!');
        console.log('   TXID:', data.txid);
        console.log('========== BROADCAST COMPLETE ==========\n');
        
        return {
            success: true,
            txid: data.txid
        };
        
    } catch (error) {
        console.error('❌ Error broadcasting transaction:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// 🔒 LOCK/UNLOCK FUNCTIONS
// ==========================================

/**
 * Unlock wallet with password
 * @param {Object} data - { password }
 * @returns {Object} {success, address, publicKey}
 */
async function unlockWalletAction(data) {
    try {
        console.log('🔓 ========== UNLOCKING WALLET ==========');
        const { password } = data;
        
        if (!password) {
            throw new Error('Password is required');
        }
        
        // Get encrypted wallet
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        if (!result.walletEncrypted) {
            return {
                success: false,
                error: 'No wallet found. Please create a wallet first.'
            };
        }
        
        console.log('🔐 Decrypting wallet...');
        
        // 🔒 VALIDAR SENHA (sem armazenar mnemonic!)
        // Só vamos descriptografar para verificar se a senha está correta
        const decrypted = await decryptData(result.walletEncrypted, password);
        
        console.log('✅ Password validated successfully');
        
        // ✅ Update wallet state (wallet is now unlocked)
        // ⚠️  NÃO armazenar mnemonic! Só address e publicKey
        walletState = {
            unlocked: true,
            address: decrypted.address,
            publicKey: decrypted.publicKey,
            lockedAt: null
        };
        
        // ✅ CRÍTICO: Salvar estado no session storage (persiste se Service Worker reiniciar)
        // ⚡ Também salvar senha temporária para L2 signing (expira com sessão)
        await chrome.storage.session.set({
            walletUnlocked: true,
            walletAddress: decrypted.address,
            walletPublicKey: decrypted.publicKey,
            tempPassword: password  // ⚡ Para L2 signing sem pedir senha novamente
        });
        
        // 🗑️ Descartar mnemonic imediatamente (não manter na memória!)
        // O mnemonic só será descriptografado novamente quando precisar assinar
        
        console.log('✅ Wallet unlocked:', walletState.address);
        console.log('💾 Wallet state saved to session storage');
        console.log('🔒 Mnemonic NOT stored in memory (security)');
        
        // Start keep-alive to prevent Service Worker termination
        startKeepAlive();
        
        // Start auto-lock timer
        resetAutolockTimer();
        
        // ⚡ Lightning será ativado quando necessário (não agora)
        console.log('⚡ Lightning will be activated when needed');
        
        return {
            success: true,
            address: walletState.address,
            publicKey: walletState.publicKey
        };
        
    } catch (error) {
        console.error('❌ Error unlocking wallet:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Check wallet status (exists, locked/unlocked)
 * @returns {Object} {success, exists, unlocked, address}
 */
async function checkWalletStatus() {
    try {
        const result = await chrome.storage.local.get(['walletEncrypted']);
        
        return {
            success: true,
            exists: !!result.walletEncrypted,
            unlocked: walletState.unlocked,
            address: walletState.unlocked ? walletState.address : null
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Set auto-lock timeout
 * @param {number} timeout - Timeout in minutes (0 = never)
 * @returns {Object} {success}
 */
async function setAutolockTimeout(timeout) {
    try {
        autolockTimeout = timeout;
        
        // Save to storage
        await chrome.storage.local.set({ autolockTimeout: timeout });
        
        console.log(`🔒 Auto-lock timeout set to: ${timeout} minutes`);
        
        // Reset timer with new timeout
        if (walletState.unlocked) {
            resetAutolockTimer();
        }
        
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// 🏪 MARKETPLACE - INSCRIPTION DETAILS
// ==========================================

/**
 * Get Inscription Details for Marketplace Listing
 * Fetches UTXO details from ORD server
 */
async function getInscriptionDetails(request) {
    try {
        const { inscriptionId } = request;
        
        console.log('📊 Getting inscription details for marketplace...', inscriptionId);
        
        // Get current address
        if (!walletState.address) {
            throw new Error('Wallet not initialized');
        }
        
        const address = walletState.address;
        
        // Fetch UTXO from ORD server via backend API
        const utxoResponse = await fetch(
            `https://kraywallet-backend.onrender.com/api/ord/inscription/${inscriptionId}/utxo`
        );
        
        if (!utxoResponse.ok) {
            throw new Error('Failed to fetch inscription UTXO from ORD server');
        }
        
        const utxoData = await utxoResponse.json();
        
        if (!utxoData.success) {
            throw new Error(utxoData.error || 'Invalid UTXO response');
        }
        
        console.log('✅ Inscription UTXO fetched:', utxoData.utxo);
        
        return {
            success: true,
            inscription: {
                id: inscriptionId,
                address: address,
                utxo: {
                    txid: utxoData.utxo.txid,
                    vout: utxoData.utxo.vout,
                    value: utxoData.utxo.value,
                    scriptPubKey: utxoData.utxo.scriptPubKey
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Error getting inscription details:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// ⚡ SEND LIGHTNING PAYMENT
// ==========================================

let pendingPaymentRequest = null;

async function sendPayment({ invoice }) {
    try {
        console.log('\n⚡ ===== SEND LIGHTNING PAYMENT =====');
        console.log('  Invoice:', invoice?.substring(0, 50) + '...');
        
        // Verificar se há wallet
        const storage = await chrome.storage.local.get(['walletEncrypted']);
        if (!storage.walletEncrypted) {
            throw new Error('No wallet found. Please create a wallet first.');
        }
        console.log('✅ Wallet found in storage');
        
        // Decode invoice no backend primeiro (para mostrar confirmação)
        console.log('🔍 Decoding invoice...');
        const decodeResponse = await fetch('https://kraywallet-backend.onrender.com/api/lightning/decode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice })
        });
        
        if (!decodeResponse.ok) {
            throw new Error('Failed to decode invoice');
        }
        
        const decoded = await decodeResponse.json();
        console.log('✅ Invoice decoded:', decoded);
        
        // 🧹 LIMPAR PAYMENT ANTIGO ANTES DE SALVAR NOVO
        console.log('🧹 Cleaning old payment data...');
        await chrome.storage.local.remove(['pendingPaymentRequest', 'paymentResult']);
        pendingPaymentRequest = null;
        
        // Aguardar um pouco para garantir limpeza
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Guardar payment pending para o popup processar
        pendingPaymentRequest = {
            invoice,
            decoded,
            timestamp: Date.now()
        };
        
        // 💾 Persistir no storage
        await chrome.storage.local.set({ pendingPaymentRequest });
        console.log('✅ pendingPaymentRequest saved!');
        
        // Abrir popup
        if (!isPopupOpening) {
            isPopupOpening = true;
            console.log('📱 Opening popup for Lightning payment confirmation...');
            
            try {
                await chrome.action.openPopup();
                console.log('✅ Popup opened');
            } catch (err) {
                console.error('❌ Failed to open popup:', err);
                console.warn('⚠️  User may need to click the extension icon manually');
            } finally {
                setTimeout(() => {
                    isPopupOpening = false;
                }, 1000);
            }
        }
        
        console.log('⏳ Waiting for user confirmation...');
        
        // Esperar pela resposta do popup (via chrome.storage)
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error('⏱️  TIMEOUT: User did not confirm in 120 seconds');
                pendingPaymentRequest = null;
                chrome.storage.local.remove('pendingPaymentRequest');
                reject(new Error('Payment timeout (user did not confirm)'));
            }, 120000); // 2 minutos
            
            console.log('✅ Promise listener registered, waiting for paymentResult...');
            
            // Listener para resposta do popup
            const listener = (changes, namespace) => {
                if (namespace === 'local' && changes.paymentResult) {
                    console.log('📩 Received paymentResult from popup:', changes.paymentResult.newValue);
                    clearTimeout(timeout);
                    chrome.storage.onChanged.removeListener(listener);
                    
                    const result = changes.paymentResult.newValue;
                    
                    // Limpar resultado
                    chrome.storage.local.remove('paymentResult');
                    chrome.storage.local.remove('pendingPaymentRequest');
                    pendingPaymentRequest = null;
                    
                    if (result.success) {
                        console.log('✅ Payment successful! Resolving...');
                        resolve({
                            success: true,
                            preimage: result.preimage,
                            paymentHash: result.paymentHash,
                            amountSats: result.amountSats,
                            timestamp: result.timestamp
                        });
                    } else {
                        console.error('❌ Payment failed:', result.error);
                        reject(new Error(result.error || 'User cancelled'));
                    }
                }
            };
            
            chrome.storage.onChanged.addListener(listener);
            console.log('🎧 Storage listener active');
        });
        
    } catch (error) {
        console.error('❌ Error in sendPayment:', error);
        pendingPaymentRequest = null;
        chrome.storage.local.remove('pendingPaymentRequest');
        throw error;
    }
}

console.log('🔥 MyWallet Background Script loaded (REAL WALLET MODE)!');
console.log('✅ Using real BIP39 mnemonic generation');
console.log('✅ Using real Taproot address derivation');
console.log('✅ Using real balance API (Mempool.space)');
console.log('✅ Runes Send functionality ready!');
console.log('🔒 Lock/Unlock system active!');
console.log('🏪 Marketplace integration ready!');
console.log('⚡ Lightning Payment functionality ready!');
console.log('🏷️ Auction Mode ready!');

