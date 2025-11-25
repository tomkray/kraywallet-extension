/**
 * 🔄 KRAY STATION - RUNES DEFI SWAP
 * 
 * Interface frontend para o sistema DeFi baseado em pools AMM
 * Integrado com a MyWallet Extension e APIs backend
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

let userRunes = [];
let userBitcoinBalance = 0;
let connectedAddress = null;
let isWalletConnected = false;

let currentSelectingFor = null; // 'from' ou 'to'
let fromToken = null; // { id, symbol, balance, type: 'btc'|'rune' }
let toToken = null;

let currentQuote = null; // Quote atual do backend
let activePools = []; // Pools carregados do backend

const API_BASE = 'http://localhost:3000/api/defi';

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 DeFi Swap initializing...');
    
    setupEventListeners();
    loadPoolsFromBackend();
    updateSwapButton();
    
    // Listen for wallet connection
    window.addEventListener('walletConnected', async (e) => {
        console.log('✅ Wallet connected:', e.detail);
        connectedAddress = e.detail.address;
        isWalletConnected = true;
        
        await loadUserWalletData();
        updateUI();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
    console.log('🎯 Setting up event listeners...');
    
    // Token selection buttons
    const fromTokenBtn = document.getElementById('fromTokenBtn');
    const toTokenBtn = document.getElementById('toTokenBtn');
    
    console.log('📍 fromTokenBtn:', fromTokenBtn);
    console.log('📍 toTokenBtn:', toTokenBtn);
    
    if (fromTokenBtn) {
        fromTokenBtn.addEventListener('click', () => {
            console.log('🖱️ FROM token button clicked!');
            console.log('   isWalletConnected:', isWalletConnected);
            
            if (!isWalletConnected) {
                console.log('⚠️ Wallet not connected, showing notification...');
                alert('Please connect your wallet first');
                return;
            }
            console.log('✅ Opening FROM token modal...');
            openTokenModal('from');
        });
        console.log('✅ FROM button listener added');
    } else {
        console.error('❌ fromTokenBtn not found!');
    }
    
    if (toTokenBtn) {
        toTokenBtn.addEventListener('click', () => {
            console.log('🖱️ TO token button clicked!');
            console.log('   isWalletConnected:', isWalletConnected);
            
            if (!isWalletConnected) {
                console.log('⚠️ Wallet not connected, showing notification...');
                alert('Please connect your wallet first');
                return;
            }
            console.log('✅ Opening TO token modal...');
            openTokenModal('to');
        });
        console.log('✅ TO button listener added');
    } else {
        console.error('❌ toTokenBtn not found!');
    }
    
    // Amount input
    const fromAmount = document.getElementById('fromAmount');
    if (fromAmount) {
        fromAmount.addEventListener('input', async () => {
            await updateQuote();
        });
    }
    
    // Swap arrow (flip tokens)
    const swapArrowBtn = document.getElementById('swapArrowBtn');
    if (swapArrowBtn) {
        swapArrowBtn.addEventListener('click', flipTokens);
    }
    
    // Swap button
    const swapBtn = document.getElementById('swapBtn');
    if (swapBtn) {
        swapBtn.addEventListener('click', executeSwap);
    }
    
    // Create pool button
    const createPoolBtn = document.getElementById('createPoolBtn');
    if (createPoolBtn) {
        createPoolBtn.addEventListener('click', () => {
            showNotification('Create Pool feature coming soon!', 'info');
            // TODO: Implementar criar pool
        });
    }
    
    // Modal close
    const tokenModalClose = document.querySelector('#tokenModal .modal-close');
    if (tokenModalClose) {
        tokenModalClose.addEventListener('click', closeTokenModal);
    }
    
    // Click outside modal to close
    const tokenModal = document.getElementById('tokenModal');
    if (tokenModal) {
        tokenModal.addEventListener('click', (e) => {
            if (e.target === tokenModal) {
                closeTokenModal();
            }
        });
    }
    
    // Token search
    const tokenSearch = document.getElementById('tokenSearch');
    if (tokenSearch) {
        tokenSearch.addEventListener('input', filterTokens);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 WALLET DATA
// ═══════════════════════════════════════════════════════════════════════════════

async function loadUserWalletData() {
    try {
        console.log('📊 Loading wallet data...');
        
        if (!window.myWallet || !window.myWallet.getFullWalletData) {
            console.warn('⚠️  MyWallet not available');
            return;
        }
        
        const walletData = await window.myWallet.getFullWalletData();
        
        if (walletData && walletData.success) {
            userBitcoinBalance = walletData.balance?.total || 0;
            userRunes = walletData.runes || [];
            
            console.log(`✅ Loaded: ${(userBitcoinBalance / 1e8).toFixed(8)} BTC + ${userRunes.length} Runes`);
            
            showNotification(`Loaded wallet data`, 'success');
        }
        
    } catch (error) {
        console.error('❌ Error loading wallet:', error);
        showNotification('Could not load wallet data', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 POOLS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadPoolsFromBackend() {
    try {
        console.log('🏊 Loading pools...');
        
        const response = await fetch(`${API_BASE}/pools?limit=50`);
        const data = await response.json();
        
        if (data.success) {
            activePools = data.pools;
            console.log(`✅ Loaded ${activePools.length} pools`);
            updatePoolsUI();
        }
        
    } catch (error) {
        console.error('❌ Error loading pools:', error);
    }
}

function updatePoolsUI() {
    // TODO: Atualizar lista de pools na UI
    // Por enquanto, os pools mock no HTML são suficientes
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🪙 TOKEN SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

function openTokenModal(selectingFor) {
    console.log(`🔓 Opening token modal for: ${selectingFor}`);
    
    currentSelectingFor = selectingFor;
    const modal = document.getElementById('tokenModal');
    
    if (!modal) {
        console.error('❌ tokenModal not found in DOM!');
        alert('Error: Modal element not found. Please reload the page.');
        return;
    }
    
    console.log('📍 Modal element found:', modal);
    console.log('📍 Modal classes before:', modal.className);
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // Force display
    
    console.log('📍 Modal classes after:', modal.className);
    console.log('📍 Modal style.display:', modal.style.display);
    console.log('✅ Modal should be visible now!');
    
    loadTokenList();
    
    const searchInput = document.getElementById('tokenSearch');
    if (searchInput) {
        searchInput.value = '';
    }
}

function closeTokenModal() {
    const modal = document.getElementById('tokenModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentSelectingFor = null;
}

function loadTokenList() {
    console.log('📋 Loading token list...');
    const tokenList = document.getElementById('tokenList');
    
    if (!tokenList) {
        console.error('❌ tokenList element not found!');
        return;
    }
    
    if (!isWalletConnected) {
        tokenList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #888;"><p>Please connect your wallet</p></div>';
        return;
    }
    
    tokenList.innerHTML = '';
    
    // Bitcoin
    const btcItem = createTokenItem({
        id: '0:0',
        symbol: 'BTC',
        name: 'Bitcoin',
        balance: userBitcoinBalance,
        displayBalance: `${(userBitcoinBalance / 1e8).toFixed(8)} BTC`,
        icon: '₿',
        type: 'btc'
    });
    tokenList.appendChild(btcItem);
    
    // Runes
    userRunes.forEach(rune => {
        const tokenItem = createTokenItem({
            id: rune.runeId || rune.id,
            symbol: rune.symbol || rune.displayName || rune.name,
            name: rune.displayName || rune.name,
            balance: rune.amount,
            displayBalance: `${formatNumber(rune.amount)}`,
            icon: rune.symbol ? rune.symbol.charAt(0) : '🪙',
            thumbnail: rune.parentPreview,
            type: 'rune'
        });
        tokenList.appendChild(tokenItem);
    });
}

function createTokenItem(token) {
    const item = document.createElement('div');
    item.className = 'token-item';
    item.style.cssText = `
        display: flex;
        align-items: center;
        padding: 12px;
        cursor: pointer;
        border-radius: 8px;
        transition: background 0.2s;
    `;
    
    // Icon
    let iconHTML = '';
    if (token.thumbnail) {
        iconHTML = `
            <img src="${token.thumbnail}" 
                 style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" 
                 onerror="this.style.display='none';">
        `;
    } else {
        iconHTML = `
            <div style="
                width: 32px; 
                height: 32px; 
                border-radius: 50%; 
                background: linear-gradient(135deg, #FF6B35 0%, #F7931A 100%); 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-weight: bold;
            ">${token.icon}</div>
        `;
    }
    
    // Build HTML
    item.innerHTML = `
        ${iconHTML}
        <div style="flex: 1; margin-left: 12px;">
            <div style="font-weight: 600; color: white;">${token.symbol}</div>
            <div style="font-size: 12px; color: #888;">${token.name}</div>
        </div>
        ${currentSelectingFor === 'from' && token.balance > 0 ? `
            <div style="text-align: right;">
                <div style="font-weight: 600; color: white;">${token.displayBalance}</div>
            </div>
        ` : ''}
    `;
    
    // Hover effect
    item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255, 107, 53, 0.1)';
    });
    item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
    });
    
    // Click to select
    item.addEventListener('click', () => selectToken(token));
    
    // Data attributes for search
    item.dataset.symbol = token.symbol.toLowerCase();
    item.dataset.name = token.name.toLowerCase();
    
    return item;
}

function filterTokens(e) {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.token-item');
    
    items.forEach(item => {
        const symbol = item.dataset.symbol || '';
        const name = item.dataset.name || '';
        
        if (symbol.includes(query) || name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function selectToken(token) {
    if (currentSelectingFor === 'from') {
        fromToken = token;
        document.getElementById('fromTokenName').textContent = token.symbol;
        document.getElementById('fromBalance').textContent = token.displayBalance;
    } else {
        toToken = token;
        document.getElementById('toTokenName').textContent = token.symbol;
        document.getElementById('toBalance').textContent = 'Available in pools';
    }
    
    closeTokenModal();
    updateQuote();
    updateSwapButton();
    
    console.log(`✅ Selected ${token.symbol} for ${currentSelectingFor}`);
}

function flipTokens() {
    const temp = fromToken;
    fromToken = toToken;
    toToken = temp;
    
    if (fromToken) {
        document.getElementById('fromTokenName').textContent = fromToken.symbol;
        document.getElementById('fromBalance').textContent = fromToken.displayBalance;
    }
    
    if (toToken) {
        document.getElementById('toTokenName').textContent = toToken.symbol;
        document.getElementById('toBalance').textContent = 'Available in pools';
    }
    
    updateQuote();
    updateSwapButton();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💱 QUOTE & SWAP
// ═══════════════════════════════════════════════════════════════════════════════

async function updateQuote() {
    if (!fromToken || !toToken) {
        hideSwapDetails();
        return;
    }
    
    const fromAmount = document.getElementById('fromAmount').value;
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
        hideSwapDetails();
        return;
    }
    
    try {
        // Determinar pool ID
        const poolId = fromToken.type === 'btc' 
            ? `${toToken.id}:BTC`
            : `${fromToken.id}:BTC`;
        
        // Input coin ID e amount
        const inputCoinId = fromToken.type === 'btc' ? '0:0' : fromToken.id;
        const inputAmount = fromToken.type === 'btc'
            ? Math.floor(parseFloat(fromAmount) * 1e8) // BTC → sats
            : Math.floor(parseFloat(fromAmount)); // Rune amount
        
        console.log(`📊 Requesting quote: ${inputAmount} ${fromToken.symbol} → ${toToken.symbol}`);
        
        // Request quote
        const response = await fetch(`${API_BASE}/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                poolId,
                inputCoinId,
                inputAmount,
                slippageTolerance: 0.05 // 5%
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to get quote');
        }
        
        currentQuote = data.quote;
        
        // Update UI
        showSwapDetails(currentQuote);
        
    } catch (error) {
        console.error('❌ Error getting quote:', error);
        showNotification(`Error: ${error.message}`, 'error');
        hideSwapDetails();
    }
}

function showSwapDetails(quote) {
    const swapDetails = document.getElementById('swapDetails');
    if (!swapDetails) return;
    
    swapDetails.style.display = 'block';
    
    // Output amount
    const toAmount = toToken.type === 'btc'
        ? (quote.outputAmount / 1e8).toFixed(8)
        : formatNumber(quote.outputAmount);
    
    document.getElementById('toAmount').value = toAmount;
    
    // Rate
    const rate = toToken.type === 'btc'
        ? `1 ${fromToken.symbol} = ${(quote.effectivePrice / 1e8).toFixed(8)} BTC`
        : `1 ${fromToken.symbol} = ${formatNumber(quote.effectivePrice)} ${toToken.symbol}`;
    
    document.getElementById('rateValue').textContent = rate;
    
    // Price impact
    const impactPercent = (quote.priceImpact * 100).toFixed(2);
    const impactEl = document.getElementById('impactValue');
    impactEl.textContent = `${impactPercent}%`;
    
    if (quote.priceImpact < 0.01) {
        impactEl.className = 'detail-value impact-low';
    } else if (quote.priceImpact < 0.05) {
        impactEl.className = 'detail-value impact-medium';
    } else {
        impactEl.className = 'detail-value impact-high';
    }
    
    // Fees
    document.getElementById('lpFeeValue').textContent = `${((quote.lpFee / quote.inputAmount) * 100).toFixed(2)}%`;
    document.getElementById('networkFeeValue').textContent = `~350 sats`;
    
    updateSwapButton();
}

function hideSwapDetails() {
    const swapDetails = document.getElementById('swapDetails');
    if (swapDetails) {
        swapDetails.style.display = 'none';
    }
    
    document.getElementById('toAmount').value = '';
    currentQuote = null;
    updateSwapButton();
}

function updateSwapButton() {
    const swapBtn = document.getElementById('swapBtn');
    if (!swapBtn) return;
    
    if (!isWalletConnected) {
        swapBtn.disabled = true;
        swapBtn.innerHTML = '<span>Connect Wallet</span>';
    } else if (!fromToken || !toToken) {
        swapBtn.disabled = true;
        swapBtn.innerHTML = '<span>Select tokens</span>';
    } else if (!currentQuote) {
        swapBtn.disabled = true;
        swapBtn.innerHTML = '<span>Enter amount</span>';
    } else {
        swapBtn.disabled = false;
        swapBtn.innerHTML = '<span>Swap</span>';
    }
}

async function executeSwap() {
    if (!currentQuote || !fromToken || !toToken) {
        showNotification('Please get a quote first', 'error');
        return;
    }
    
    try {
        showNotification('Building swap transaction...', 'info');
        
        // TODO: Construir PSBT usando o psbtBuilder
        // TODO: Enviar para wallet assinar
        // TODO: Enviar PSBT assinada para backend /api/defi/swap
        
        showNotification('Swap feature in development!', 'info');
        
    } catch (error) {
        console.error('❌ Error executing swap:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(num) {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toLocaleString();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateUI() {
    // Update any UI elements that depend on wallet connection
    updateSwapButton();
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);
