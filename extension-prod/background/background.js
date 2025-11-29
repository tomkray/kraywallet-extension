/**
 * 🔥 MyWallet Extension - Background Script
 * Gerencia a wallet e comunicação entre popup e content scripts
 */

// Importar lógica da wallet (simulado - em produção, usar bundler)
// Por enquanto, vamos usar apenas storage do Chrome

let walletState = {
    unlocked: false,
    address: null,
    mnemonic: null
};

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
        
        case 'signPsbt':
            return await signPsbt(data);
        
        case 'sendBitcoin':
            return await sendBitcoin(data);
        
        case 'connect':
            return await connect();
        
        case 'getAccounts':
            return await getAccounts();
        
        case 'getPublicKey':
            return await getPublicKey();
        
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

// Gerar Wallet
async function generateWallet({ wordCount, password }) {
    try {
        // Gerar mnemonic (simulação - em produção, usar bip39)
        const words = wordCount === 24 ? 24 : 12;
        const mnemonic = generateMnemonic(words);
        
        // Gerar address (simulação - em produção, usar bip32 + taproot)
        const address = `bc1p${randomHex(58)}`;
        
        // Criptografar e salvar
        const encrypted = await encryptData({ mnemonic, address }, password);
        await chrome.storage.local.set({ walletEncrypted: encrypted });
        
        // Atualizar estado
        walletState = {
            unlocked: true,
            address,
            mnemonic
        };
        
        return {
            success: true,
            mnemonic,
            address
        };
    } catch (error) {
        console.error('Error generating wallet:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Restaurar Wallet
async function restoreWallet({ mnemonic, password }) {
    try {
        // Validar mnemonic (simulação)
        if (!mnemonic || mnemonic.split(' ').length < 12) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        // Gerar address do mnemonic
        const address = `bc1p${randomHex(58)}`;
        
        // Criptografar e salvar
        const encrypted = await encryptData({ mnemonic, address }, password);
        await chrome.storage.local.set({ walletEncrypted: encrypted });
        
        // Atualizar estado
        walletState = {
            unlocked: true,
            address,
            mnemonic
        };
        
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

// Obter Wallet Info
async function getWalletInfo() {
    try {
        if (!walletState.unlocked || !walletState.address) {
            // Tentar desbloquear (requer senha - por enquanto, simular)
            const result = await chrome.storage.local.get(['walletEncrypted']);
            if (!result.walletEncrypted) {
                throw new Error('No wallet found');
            }
            
            // Simular desbloqueio (em produção, pedir senha)
            // Por enquanto, usar dados em memória
        }
        
        // Buscar balance (simulação - em produção, usar mempool.space API)
        const balance = {
            confirmed: 0,
            unconfirmed: 0,
            total: 0
        };
        
        return {
            success: true,
            data: {
                address: walletState.address || `bc1p${randomHex(58)}`,
                balance
            }
        };
    } catch (error) {
        console.error('Error getting wallet info:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Assinar PSBT
async function signPsbt({ psbt, sighashType = 'ALL' }) {
    try {
        if (!walletState.unlocked) {
            throw new Error('Wallet is locked');
        }
        
        // Em produção, usar a lógica da MyWallet
        // Por enquanto, retornar sucesso simulado
        
        return {
            success: true,
            signedPsbt: psbt, // Simulação
            sighashType
        };
    } catch (error) {
        console.error('Error signing PSBT:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Enviar Bitcoin
async function sendBitcoin({ toAddress, amount, feeRate }) {
    try {
        if (!walletState.unlocked) {
            throw new Error('Wallet is locked');
        }
        
        // Em produção, criar transação real
        // Por enquanto, simular
        
        const txid = randomHex(64);
        
        return {
            success: true,
            txid
        };
    } catch (error) {
        console.error('Error sending bitcoin:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Connect (para websites)
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

// Get Accounts (para websites)
async function getAccounts() {
    return await connect();
}

// Get Public Key
async function getPublicKey() {
    try {
        // Em produção, derivar do mnemonic
        const publicKey = randomHex(66);
        
        return {
            success: true,
            publicKey
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Helpers
function generateMnemonic(wordCount) {
    const words = [
        'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
        'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
        'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual'
    ];
    
    const mnemonic = [];
    for (let i = 0; i < wordCount; i++) {
        mnemonic.push(words[Math.floor(Math.random() * words.length)]);
    }
    
    return mnemonic.join(' ');
}

function randomHex(length) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

async function encryptData(data, password) {
    // Simulação - em produção, usar WebCrypto API
    return btoa(JSON.stringify({ data, password }));
}

async function decryptData(encrypted, password) {
    // Simulação - em produção, usar WebCrypto API
    const decoded = JSON.parse(atob(encrypted));
    if (decoded.password !== password) {
        throw new Error('Invalid password');
    }
    return decoded.data;
}

console.log('🔥 MyWallet Background Script loaded!');



