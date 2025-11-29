/**
 * ⚡ KRAY STATION - LIGHTNING DEX FRONTEND
 * 
 * Conecta com nossa implementação Lightning DeFi real!
 * Backend: /api/lightning-defi/* e /api/lightning/*
 */

const LIGHTNING_API = 'http://localhost:4000/api/lightning-defi';
const LND_API = 'http://localhost:4000/api/lightning';

// Estado global
let hubInfo = null;
let pools = [];
let lndInfo = null;
let walletConnected = false;
let userAddress = null;

/**
 * 🚀 INICIALIZAR AO CARREGAR PÁGINA
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('⚡ Lightning Hub UI initializing...');
    
    // Conectar ao LND
    await connectToLND();
    
    // Carregar pools Lightning DeFi
    await loadLightningPools();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check wallet connection
    checkWalletConnection();
    
    // Listen for wallet connection events
    window.addEventListener('walletConnected', (e) => {
        console.log('✅ Wallet connected event received:', e.detail);
        walletConnected = true;
        userAddress = e.detail.address;
        updateWalletUI();
    });
    
    // Auto-refresh stats a cada 10 segundos
    setInterval(async () => {
        await connectToLND();
        await loadLightningPools();
    }, 10000);
});

/**
 * 🔗 CONECTAR AO LND
 */
async function connectToLND() {
    console.log('🔗 Connecting to LND...');
    
    try {
        const response = await fetch(`${LND_API}/info`);
        
        if (!response.ok) {
            throw new Error(`LND not available: ${response.status}`);
        }
        
        lndInfo = await response.json();
        
        console.log('✅ LND connected:', lndInfo);
        
        // Atualizar UI
        updateHubInfo();
        
    } catch (error) {
        console.error('❌ Failed to connect to LND:', error);
        showHubError();
    }
}

/**
 * 📊 ATUALIZAR INFO DO HUB NA UI
 */
function updateHubInfo() {
    if (!lndInfo) return;
    
    // Status
    document.getElementById('hubStatus').innerHTML = 
        `✅ Connected to LND ${lndInfo.alias || 'Node'}`;
    
    // Pubkey
    if (lndInfo.identity_pubkey || lndInfo.pubkey) {
        document.getElementById('hubPubkey').style.display = 'block';
        document.getElementById('hubPubkeyValue').textContent = 
            lndInfo.identity_pubkey || lndInfo.pubkey;
    }
    
    // Stats
    const numChannels = lndInfo.num_active_channels || lndInfo.channels || 0;
    document.getElementById('hubChannels').textContent = numChannels;
    document.getElementById('hubPools').textContent = pools.length;
    
    // Calcular total fees (mock - pode ser implementado depois)
    document.getElementById('hubFees').textContent = '~0.3%';
}

/**
 * ❌ MOSTRAR ERRO DE CONEXÃO
 */
function showHubError() {
    document.getElementById('hubStatus').innerHTML = 
        `❌ LND not connected - <a href="#" onclick="location.reload()" style="color: #FFD700;">Retry</a>`;
    document.getElementById('hubChannels').textContent = '0';
    document.getElementById('hubPools').textContent = '0';
}

/**
 * 🏊 CARREGAR POOLS LIGHTNING DEFI
 */
async function loadLightningPools() {
    console.log('🏊 Loading Lightning DeFi pools...');
    
    const loadingEl = document.getElementById('poolsLoading');
    const emptyEl = document.getElementById('poolsEmpty');
    const gridEl = document.getElementById('poolsGrid');
    
    try {
        const response = await fetch(`${LIGHTNING_API}/pools`);
        
        if (!response.ok) {
            throw new Error('Failed to load pools');
        }
        
        const data = await response.json();
        pools = data.pools || [];
        
        console.log(`✅ Loaded ${pools.length} Lightning pools`);
        
        // Esconder loading
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (pools.length === 0) {
            // Mostrar empty state
            if (emptyEl) emptyEl.style.display = 'block';
            if (gridEl) gridEl.style.display = 'none';
        } else {
            // Mostrar pools
            if (emptyEl) emptyEl.style.display = 'none';
            if (gridEl) {
                gridEl.style.display = 'grid';
                renderPools();
            }
        }
        
        // Atualizar contador
        document.getElementById('hubPools').textContent = pools.length;
        
    } catch (error) {
        console.error('❌ Failed to load pools:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
    }
}

/**
 * 🎨 RENDERIZAR POOLS
 */
function renderPools() {
    const gridEl = document.getElementById('poolsGrid');
    if (!gridEl) return;
    
    gridEl.innerHTML = pools.map(pool => `
        <div class="pool-card" data-pool-id="${pool.poolId}">
            <div class="pool-header">
                <div class="pool-pair">
                    <span class="pool-token">${pool.tokenA || 'RUNE'}</span>
                    <span class="pool-separator">⚡</span>
                    <span class="pool-token">${pool.tokenB || 'BTC'}</span>
                </div>
                <span class="lightning-badge">LIGHTNING</span>
            </div>
            
            <div class="pool-stats">
                <div class="pool-stat">
                    <span class="pool-stat-label">TVL</span>
                    <span class="pool-stat-value">${formatSats(pool.reserveA || 0)}</span>
                </div>
                <div class="pool-stat">
                    <span class="pool-stat-label">BTC Reserve</span>
                    <span class="pool-stat-value">${formatBTC(pool.reserveB || 0)}</span>
                </div>
                <div class="pool-stat">
                    <span class="pool-stat-label">Fee</span>
                    <span class="pool-stat-value">0.3%</span>
                </div>
                <div class="pool-stat">
                    <span class="pool-stat-label">Speed</span>
                    <span class="pool-stat-value instant-badge">⚡ &lt;1s</span>
                </div>
            </div>
            
            <button class="pool-swap-btn" onclick="openSwapWithPool('${pool.poolId}')">
                ⚡ Swap Now
            </button>
        </div>
    `).join('');
}

/**
 * 💱 ABRIR SWAP COM POOL SELECIONADO
 */
function openSwapWithPool(poolId) {
    console.log('💱 Opening swap with pool:', poolId);
    
    // Redirecionar para runes-swap com pool pré-selecionado
    window.location.href = `/runes-swap.html?pool=${poolId}`;
}

/**
 * 🎛️ SETUP EVENT LISTENERS
 */
function setupEventListeners() {
    // Connect Wallet button
    const connectBtn = document.getElementById('connectWallet');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            if (!window.krayWallet) {
                alert('Please install KrayWallet extension first!');
                return;
            }
            
            try {
                const accounts = await window.krayWallet.connect();
                console.log('✅ Wallet connected:', accounts);
                
                walletConnected = true;
                userAddress = accounts[0];
                
                // Dispatch event
                window.dispatchEvent(new CustomEvent('walletConnected', {
                    detail: { address: userAddress }
                }));
                
                updateWalletUI();
            } catch (error) {
                console.error('❌ Failed to connect wallet:', error);
                alert('Failed to connect wallet: ' + error.message);
            }
        });
    }
    
    // Create Pool button
    const createPoolBtn = document.getElementById('createPoolBtn');
    if (createPoolBtn) {
        createPoolBtn.addEventListener('click', () => {
            window.location.href = '/runes-swap.html?tab=create-pool';
        });
    }
}

/**
 * 🔍 CHECK WALLET CONNECTION
 */
function checkWalletConnection() {
    if (window.krayWallet) {
        console.log('✅ KrayWallet detected');
        
        // Try to get accounts (if already connected)
        window.krayWallet.getAccounts().then(accounts => {
            if (accounts && accounts.length > 0) {
                walletConnected = true;
                userAddress = accounts[0];
                updateWalletUI();
                
                // Dispatch event
                window.dispatchEvent(new CustomEvent('walletConnected', {
                    detail: { address: userAddress }
                }));
            }
        }).catch(err => {
            console.log('Wallet not connected yet');
        });
    }
}

/**
 * 🎨 ATUALIZAR UI DA WALLET
 */
function updateWalletUI() {
    const connectBtn = document.getElementById('connectWallet');
    if (!connectBtn) return;
    
    if (walletConnected && userAddress) {
        connectBtn.innerHTML = `
            <span class="wallet-text">${formatAddress(userAddress)}</span>
        `;
        connectBtn.classList.add('connected');
    } else {
        connectBtn.innerHTML = `
            <span class="wallet-text">Connect Wallet</span>
        `;
        connectBtn.classList.remove('connected');
    }
}

/**
 * 🔧 HELPER: FORMAT ADDRESS
 */
function formatAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * 🔧 HELPER: FORMAT SATS
 */
function formatSats(sats) {
    if (!sats || sats === 0) return '0 sats';
    if (sats >= 100000000) {
        return (sats / 100000000).toFixed(2) + ' BTC';
    }
    return sats.toLocaleString() + ' sats';
}

/**
 * 🔧 HELPER: FORMAT BTC
 */
function formatBTC(sats) {
    if (!sats || sats === 0) return '0.00000000 BTC';
    return (sats / 100000000).toFixed(8) + ' BTC';
}

console.log('⚡ Lightning Hub JS loaded!');
