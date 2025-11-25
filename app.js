// State management
let ordinals = [];
let userOffers = [];
let isWalletConnected = false;
let connectedAddress = null;
let currentWallet = null; // ✅ 'myWallet', 'unisat', 'xverse', ou null
let autoRefreshInterval = null; // ✅ Interval ID para auto-refresh

// 🌐 Expor variáveis globalmente para iframes
window.isWalletConnected = isWalletConnected;
window.connectedAddress = connectedAddress;
window.currentWallet = currentWallet;

// 🔄 Helper para atualizar variáveis globais
function updateGlobalWalletState() {
    window.isWalletConnected = isWalletConnected;
    window.connectedAddress = connectedAddress;
    window.currentWallet = currentWallet;
    console.log('🌐 Global wallet state updated:', { isWalletConnected, connectedAddress, currentWallet });
}
let lastOffersHash = ''; // ✅ Hash das ofertas para detectar mudanças
let btcPriceUSD = 0; // 💰 Preço do Bitcoin em USD

// ==========================================
// 💰 BTC PRICE FETCHER - CoinGecko API
// ==========================================

async function fetchBTCPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await response.json();
        btcPriceUSD = data.bitcoin.usd;
        console.log(`💰 BTC Price: $${btcPriceUSD.toLocaleString()}`);
        return btcPriceUSD;
    } catch (error) {
        console.error('Error fetching BTC price:', error);
        return btcPriceUSD; // Retorna o último valor conhecido
    }
}

// Atualizar preço a cada 60 segundos
setInterval(fetchBTCPrice, 60000);

// ==========================================
// 🔗 WALLET HELPER - Suporta MyWallet, Unisat, Xverse
// ==========================================

function getConnectedWallet() {
    const walletType = localStorage.getItem('walletType') || 'unisat';
    
    if (walletType === 'kraywallet') {
        return {
            type: 'kraywallet',
            api: window.krayWallet,
            name: 'KrayWallet'
        };
    } else if (walletType === 'xverse') {
        return {
            type: 'xverse',
            api: window.XverseProviders?.BitcoinProvider,
            name: 'Xverse'
        };
    } else {
        return {
            type: 'unisat',
            api: window.unisat,
            name: 'Unisat'
        };
    }
}

async function getWalletAccounts() {
    const wallet = getConnectedWallet();
    
    if (!wallet.api) {
        throw new Error(`${wallet.name} not detected`);
    }
    
    if (wallet.type === 'kraywallet') {
        const info = await wallet.api.connect();
        return [info.address];
    } else if (wallet.type === 'xverse') {
        const response = await wallet.api.request('getAddresses');
        return [response.addresses[0].address];
    } else {
        return await wallet.api.getAccounts();
    }
}

async function getWalletPublicKey() {
    const wallet = getConnectedWallet();
    
    if (!wallet.api) {
        throw new Error(`${wallet.name} not detected`);
    }
    
    if (wallet.type === 'kraywallet') {
        const info = await wallet.api.connect();
        return info.publicKey;
    } else if (wallet.type === 'xverse') {
        const response = await wallet.api.request('getAddresses');
        return response.addresses[0].publicKey;
    } else {
        return await wallet.api.getPublicKey();
    }
}

async function getWalletBalance() {
    const wallet = getConnectedWallet();
    
    if (!wallet.api) {
        throw new Error(`${wallet.name} not detected`);
    }
    
    if (wallet.type === 'kraywallet') {
        const info = await wallet.api.connect();
        return {
            confirmed: info.balance.total,
            unconfirmed: 0,
            total: info.balance.total
        };
    } else if (wallet.type === 'xverse') {
        // Xverse não tem getBalance direto, vamos retornar estimado
        return { confirmed: 0, unconfirmed: 0, total: 0 };
    } else {
        return await wallet.api.getBalance();
    }
}

async function getWalletUtxos() {
    const wallet = getConnectedWallet();
    
    if (!wallet.api) {
        throw new Error(`${wallet.name} not detected`);
    }
    
    if (wallet.type === 'kraywallet') {
        // MyWallet não expõe UTXOs diretamente
        // Backend vai buscar UTXOs pelo endereço
        const accounts = await getWalletAccounts();
        const address = accounts[0];
        
        // Buscar UTXOs via Mempool.space
        const response = await fetch(`https://mempool.space/api/address/${address}/utxo`);
        return await response.json();
    } else if (wallet.type === 'xverse') {
        // Xverse também não expõe UTXOs facilmente
        return [];
    } else {
        return await wallet.api.getBitcoinUtxos();
    }
}

async function signWalletPsbt(psbt, options = {}) {
    const wallet = getConnectedWallet();
    
    if (!wallet.api) {
        throw new Error(`${wallet.name} not detected`);
    }
    
    if (wallet.type === 'kraywallet') {
        const result = await wallet.api.signPsbt(psbt, {
            autoFinalized: options.autoFinalized !== undefined ? options.autoFinalized : false,
            toSignInputs: options.toSignInputs || []
        });
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to sign PSBT');
        }
        
        return result.signedPsbt;
    } else if (wallet.type === 'xverse') {
        // Xverse API para signing
        const response = await wallet.api.request('signPsbt', {
            psbt,
            inputsToSign: options.toSignInputs || []
        });
        return response.psbt;
    } else {
        return await wallet.api.signPsbt(psbt, options);
    }
}

// 💾 RESTAURAR CONEXÃO DO LOCALSTORAGE
function restoreWalletConnection() {
    try {
        const saved = localStorage.getItem('ordinals_wallet_state');
        if (saved) {
            const state = JSON.parse(saved);
            if (state.connected && state.address) {
                isWalletConnected = true;
                connectedAddress = state.address;
                updateGlobalWalletState(); // 🌐 Atualizar window.*
                
                // 🔧 MIGRAÇÃO AUTOMÁTICA: myWallet → kraywallet
                let walletType = state.walletType || 'unknown';
                if (walletType === 'myWallet') {
                    console.log('🔧 Auto-migrating: myWallet → kraywallet');
                    walletType = 'kraywallet';
                    
                    // Atualizar no localStorage
                    localStorage.setItem('ordinals_wallet_state', JSON.stringify({
                        connected: true,
                        address: connectedAddress,
                        walletType: 'kraywallet'
                    }));
                }
                
                currentWallet = walletType;
                
                console.log('💾 Restored wallet connection:', connectedAddress);
                console.log('💾 Wallet type:', currentWallet);
                
                // Atualizar UI
                setTimeout(() => {
                    updateWalletUI();
                    
                    // 🔄 Notify iframes about restored connection
                    console.log('📡 Notifying iframes about restored connection...');
                    const iframes = document.querySelectorAll('iframe');
                    iframes.forEach(iframe => {
                        try {
                            iframe.contentWindow.postMessage({
                                type: 'CONNECT_WALLET',
                                wallet: currentWallet,
                                address: connectedAddress
                            }, '*');
                            console.log('   ✅ Notified iframe');
                        } catch (e) {
                            console.warn('   ⚠️ Could not notify iframe:', e);
                        }
                    });
                }, 100);
            }
        }
    } catch (e) {
        console.error('❌ Error restoring wallet connection:', e);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // 💰 BUSCAR PREÇO DO BITCOIN
    await fetchBTCPrice();
    
    // 💾 RESTAURAR CONEXÃO DO LOCALSTORAGE
    restoreWalletConnection();
    
    initializeTabs();
    loadOrdinals();
    setupEventListeners();
    loadUserOffers();
    
    // Check wallet connection status
    checkWalletConnection();
});

// Tab functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            const tabContent = document.getElementById(tabName);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // 📋 Load My Listings quando clicar na aba My Offers
            if (tabName === 'my-offers') {
                if (typeof loadMyListings === 'function') {
                    loadMyListings();
                }
            }
            
            // 🔥 Load Marketplace quando clicar na aba browse
            if (tabName === 'browse') {
                if (typeof loadAtomicSwapListings === 'function') {
                    loadAtomicSwapListings();
                }
            }
        });
    });
}

// 📄 Variáveis de Paginação (Browse Ordinals)
let currentBrowsePage = 1;
const browseItemsPerPage = 40;
let allOrdinals = []; // Todos os ordinals carregados
let filteredOrdinals = []; // Ordinals após filtros/busca

// Load ordinals grid from API - AGORA USA ATOMIC SWAP
async function loadOrdinals() {
    console.log('📋 loadOrdinals() called - redirecting to loadAtomicSwapListings()');
    
    // Usar a nova função de atomic swap listings
    if (typeof loadAtomicSwapListings === 'function') {
        await loadAtomicSwapListings();
    } else {
        console.warn('⚠️ loadAtomicSwapListings() not found! Make sure ordinals.html script is loaded.');
    }
}

// 📄 Renderizar Browse Ordinals com Paginação - AGORA USA marketplaceGrid
function renderBrowseOrdinals(ordinalsToRender) {
    const grid = document.getElementById('marketplaceGrid') || document.getElementById('ordinalsGrid');
    if (!grid) {
        console.error('❌ Grid element not found (tried marketplaceGrid and ordinalsGrid)');
        return;
    }
    const paginationDiv = document.getElementById('browseOrdinalsPagination');
    const pageInfo = document.getElementById('browsePageInfo');
    const prevBtn = document.getElementById('browsePrevBtn');
    const nextBtn = document.getElementById('browseNextBtn');
    
    grid.innerHTML = '';
    
    if (!ordinalsToRender || ordinalsToRender.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>No inscriptions available</p>
            </div>
        `;
        paginationDiv.style.display = 'none';
        return;
    }
    
    // Calcular paginação
    const totalPages = Math.ceil(ordinalsToRender.length / browseItemsPerPage);
    const startIndex = (currentBrowsePage - 1) * browseItemsPerPage;
    const endIndex = startIndex + browseItemsPerPage;
    const paginatedOrdinals = ordinalsToRender.slice(startIndex, endIndex);
    
    // Renderizar apenas a página atual
    paginatedOrdinals.forEach(ordinal => {
        const card = createOrdinalCard(ordinal);
        grid.appendChild(card);
    });
    
    // Atualizar paginação
    pageInfo.textContent = `Page ${currentBrowsePage} of ${totalPages} (${ordinalsToRender.length} total)`;
    prevBtn.disabled = currentBrowsePage === 1;
    nextBtn.disabled = currentBrowsePage === totalPages;
    paginationDiv.style.display = totalPages > 1 ? 'flex' : 'none';
    
    console.log(`✅ Showing ${paginatedOrdinals.length} ordinals (page ${currentBrowsePage}/${totalPages})`);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function createOrdinalCard(ordinal) {
    const card = document.createElement('div');
    card.className = 'ordinal-card';
    
    // ✅ Adicionar data attributes para auto-refresh
    card.setAttribute('data-inscription-id', ordinal.id);
    if (ordinal.offer_id) {
        card.setAttribute('data-offer-id', ordinal.offer_id);
    }
    
    // Buscar conteúdo do Ord Server via nosso endpoint
    const contentUrl = `${CONFIG.API_URL}/ordinals/${ordinal.id}/content`;
    
    // Determinar como exibir baseado no content_type
    let contentHtml = '';
    const contentType = (ordinal.content_type || 'unknown').toLowerCase();
    
    // Suporte COMPLETO para TODAS as extensões de imagem
    const imageExtensions = [
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 
        'ico', 'tiff', 'tif', 'heic', 'heif', 'jfif', 'pjpeg', 'pjp'
    ];
    
    // Verificar se é imagem por tipo OU extensão
    const isImage = contentType.includes('image/') || 
                    imageExtensions.some(ext => ordinal.id.toLowerCase().includes(ext)) ||
                    contentType === 'unknown'; // Se unknown, tentar como imagem
    
    // Suporte para vídeos
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', '3gp'];
    const isVideo = contentType.includes('video/') || 
                    videoExtensions.some(ext => ordinal.id.toLowerCase().includes(ext));
    
    if (isImage && !isVideo) {
        // IMAGEM - sempre tentar renderizar como imagem primeiro
        contentHtml = `<img src="${contentUrl}" alt="Inscription #${ordinal.inscription_number}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%23333%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23666%22 font-size=%2260%22>📄</text></svg>'">`;
    } else if (isVideo) {
        // VÍDEO - com autoplay mudo
        contentHtml = `<video src="${contentUrl}" controls muted loop autoplay playsinline></video>`;
    } else if (contentType.includes('text/') || contentType.includes('application/json')) {
        // Texto/JSON - exibir em iframe
        contentHtml = `<iframe src="${contentUrl}" sandbox="allow-same-origin allow-scripts" loading="lazy"></iframe>`;
    } else if (contentType.includes('audio/')) {
        // Áudio
        contentHtml = `<div class="content-placeholder">🎵<br>Audio<br><audio src="${contentUrl}" controls></audio></div>`;
    } else {
        // Se não identificou, tentar como imagem por padrão
        contentHtml = `<img src="${contentUrl}" alt="Inscription #${ordinal.inscription_number}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%23333%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23666%22 font-size=%2260%22>📄</text></svg>'">`;
    }
    
    // Formatar preço em sats (não BTC)
    const priceSats = ordinal.price || 0;
    const priceBtc = (priceSats / 100000000).toFixed(8);
    
    // Calcular valor em USD
    const priceUSD = btcPriceUSD > 0 ? (priceBtc * btcPriceUSD).toFixed(2) : '0.00';
    
    // Likes data
    const likesCount = ordinal.likes_count || 0;
    const offerId = ordinal.offer_id || '';
    
    // 💰 Badge ORD (se for oferta externa)
    const isOrdExternal = ordinal.source === 'ord-cli';
    const ordBadge = isOrdExternal ? `
        <div style="position: absolute; top: 10px; left: 10px; z-index: 10; background: linear-gradient(135deg, #FF6B00 0%, #FF8C00 100%); padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(255, 107, 0, 0.4);">
            <span style="color: white; font-size: 12px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">⚡ ORD CLI • 1% Fee</span>
        </div>
    ` : '';
    
    card.innerHTML = `
        <div class="ordinal-image">
            ${ordBadge}
            <div class="ordinal-like-section" style="position: absolute; top: 10px; right: 10px; z-index: 10; background: rgba(0,0,0,0.7); padding: 6px 10px; border-radius: 20px; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(10px);">
                <span class="like-count" style="color: white; font-size: 13px; font-weight: 600;">${likesCount > 0 ? likesCount : ''}</span>
                <button class="like-btn" data-offer-id="${offerId}" style="background: none; border: none; cursor: pointer; font-size: 18px; padding: 0; transition: transform 0.2s;" title="Like this inscription">
                    🤍
                </button>
            </div>
            ${contentHtml}
        </div>
        <div class="ordinal-info">
            <div class="ordinal-number">Inscription #${ordinal.inscription_number || 'N/A'}</div>
            <div class="ordinal-id" title="${ordinal.id}">${ordinal.id.slice(0, 12)}...${ordinal.id.slice(-4)}</div>
            <div class="ordinal-price">
                <div class="price-row">
                    <span class="price-sats">${priceSats.toLocaleString()} sats</span>
                    <span class="price-usd">$${parseFloat(priceUSD).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <span class="price-btc">${priceBtc} BTC</span>
                <button class="btn btn-small btn-primary" onclick="buyNow('${ordinal.id}', ${priceSats}, '${ordinal.owner || ''}')">
                    🛒 Buy Now
                </button>
            </div>
        </div>
    `;
    
    // Adicionar event listener para o botão de like
    const likeBtn = card.querySelector('.like-btn');
    if (likeBtn && offerId) {
        likeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLikeClick(offerId, likeBtn);
        });
        
        // Carregar estado do like (se o usuário já curtiu)
        loadLikeState(offerId, likeBtn);
    }
    
    return card;
}

// Setup event listeners
function setupEventListeners() {
    // Connect wallet (only if element exists - for ordinals.html)
    const connectWalletBtn = document.getElementById('connectWallet');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', connectWallet);
    }

    // Search (only if element exists - for ordinals.html)
    const searchOrdinals = document.getElementById('searchOrdinals');
    if (searchOrdinals) {
        searchOrdinals.addEventListener('input', handleSearch);
    }

    // Sort (only if element exists - for ordinals.html)
    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
        sortBy.addEventListener('change', handleSort);
    }
    
    // 📄 Paginação Browse Ordinals
    document.getElementById('browsePrevBtn')?.addEventListener('click', () => {
        if (currentBrowsePage > 1) {
            currentBrowsePage--;
            renderBrowseOrdinals(filteredOrdinals);
        }
    });
    
    document.getElementById('browseNextBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrdinals.length / browseItemsPerPage);
        if (currentBrowsePage < totalPages) {
            currentBrowsePage++;
            renderBrowseOrdinals(filteredOrdinals);
        }
    });

    // Create offer (only if element exists - for ordinals.html)
    const createOfferBtn = document.getElementById('createOfferBtn');
    if (createOfferBtn) {
        createOfferBtn.addEventListener('click', createOffer);
    }

    // Export PSBT (only if element exists - for ordinals.html)
    const exportPSBTBtn = document.getElementById('exportPSBTBtn');
    if (exportPSBTBtn) {
        exportPSBTBtn.addEventListener('click', exportPSBT);
    }

    // Copy PSBT (only if element exists - for ordinals.html)
    const copyPSBTBtn = document.getElementById('copyPSBTBtn');
    if (copyPSBTBtn) {
        copyPSBTBtn.addEventListener('click', () => {
            const psbtText = document.getElementById('psbtText');
            if (psbtText) {
                navigator.clipboard.writeText(psbtText.value);
                showNotification('PSBT copied to clipboard!');
            }
        });
    }

    // Wallet sweep (only if element exists - for ordinals.html)
    const sweepWalletBtn = document.getElementById('sweepWalletBtn');
    if (sweepWalletBtn) {
        sweepWalletBtn.addEventListener('click', sweepWallet);
    }
}

// ==========================================
// WALLET CONNECTION - Modal System
// ==========================================

// Open wallet selection modal
function connectWallet() {
    const modal = document.getElementById('walletModal');
    modal.classList.remove('hidden');
}

// Close wallet modal
function closeWalletModal() {
    const modal = document.getElementById('walletModal');
    modal.classList.add('hidden');
}

// Connect MyWallet
async function connectMyWallet() {
    console.log('🔺 Connecting KrayWallet...');
    
    try {
        // Check if KrayWallet extension is installed
        if (typeof window.krayWallet === 'undefined') {
            showNotification('❌ KrayWallet not detected. Please install the extension!', 'error');
            // Don't try to open chrome:// URLs from web pages (security restriction)
            alert('Please go to Chrome Extensions and load KrayWallet extension manually.');
            return;
        }

        // Request connection from KrayWallet
        const response = await window.krayWallet.connect();
        
        // ✅ Verificar se conectou com sucesso
        if (response && response.success && response.address) {
            isWalletConnected = true;
            connectedAddress = response.address;
            currentWallet = 'kraywallet'; // ✅ Definir wallet atual
            updateGlobalWalletState(); // 🌐 Atualizar window.*
            
            // Save wallet type
            localStorage.setItem('walletType', 'kraywallet');
            
            updateWalletUI();
            closeWalletModal();
            showNotification('✅ MyWallet connected successfully!', 'success');
            loadUserOffers();
            
            // 🔄 Notify iframes about wallet connection
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                try {
                    iframe.contentWindow.postMessage({
                        type: 'CONNECT_WALLET',
                        wallet: 'kraywallet',
                        address: connectedAddress
                    }, '*');
                    console.log('📡 Notified iframe about wallet connection');
                } catch (e) {
                    console.warn('⚠️ Could not notify iframe:', e);
                }
            });
            
            return;
        }
        
        // 🔒 Se falhou, verificar se é porque está locked
        if (response && !response.success && response.needsUnlock) {
            console.log('🔒 Wallet is locked, popup should open automatically');
            showNotification('🔓 Please unlock your MyWallet', 'info');
            closeWalletModal();
            
            // ⚡ AGUARDAR UNLOCK (evento será disparado quando desbloquear)
            const handleUnlock = () => {
                console.log('✅ Wallet unlocked, reconnecting...');
                
                // Reconectar automaticamente
                window.krayWallet.connect().then(result => {
                    if (result && result.success && result.address) {
                        isWalletConnected = true;
                        connectedAddress = result.address;
                        currentWallet = 'kraywallet';
                        updateGlobalWalletState(); // 🌐 Atualizar window.*
                        
                        localStorage.setItem('walletType', 'kraywallet');
                        
                        updateWalletUI();
                        showNotification('✅ MyWallet connected successfully!', 'success');
                        loadUserOffers();
                        
                        // Remover listener
                        window.removeEventListener('walletConnected', handleUnlock);
                    }
                });
            };
            
            // Adicionar listener para quando desbloquear
            window.addEventListener('walletConnected', handleUnlock);
            
            // Timeout de 60 segundos
            setTimeout(() => {
                window.removeEventListener('walletConnected', handleUnlock);
            }, 60000);
            
            return;
        }
        
        // Outros erros
        throw new Error(response?.error || 'Failed to connect wallet');
        
    } catch (error) {
        console.error('❌ MyWallet connection error:', error);
        
        // Mensagens de erro mais claras
        let errorMsg = error.message;
        
        if (errorMsg.includes('No wallet found')) {
            errorMsg = '⚠️ Please create or restore a wallet in MyWallet extension first!';
            setTimeout(() => {
                showNotification('💡 Click on the MyWallet extension icon to create/restore your wallet', 'info');
            }, 2000);
        } else if (errorMsg.includes('locked')) {
            errorMsg = '🔒 MyWallet is locked. Popup opening...';
            // O popup já deve ter sido aberto pelo injected.js
            closeWalletModal();
            
            // Mesmo listener acima
            const handleUnlock = () => {
                window.krayWallet.connect().then(result => {
                    if (result && result.success && result.address) {
                        isWalletConnected = true;
                        connectedAddress = result.address;
                        currentWallet = 'kraywallet';
                        updateGlobalWalletState(); // 🌐 Atualizar window.*
                        localStorage.setItem('walletType', 'kraywallet');
                        updateWalletUI();
                        showNotification('✅ MyWallet connected successfully!', 'success');
                        loadUserOffers();
                        window.removeEventListener('walletConnected', handleUnlock);
                    }
                });
            };
            window.addEventListener('walletConnected', handleUnlock);
            setTimeout(() => window.removeEventListener('walletConnected', handleUnlock), 60000);
        }
        
        showNotification(errorMsg, 'info');
    }
}

// Connect Unisat
async function connectUnisat() {
    console.log('🔥 Connecting Unisat...');
    
    try {
        if (typeof window.unisat === 'undefined') {
            showNotification('Unisat not detected. Please install the extension!', 'error');
            window.open('https://unisat.io/', '_blank');
            return;
        }

        const accounts = await window.unisat.requestAccounts();
        
        if (accounts && accounts.length > 0) {
            isWalletConnected = true;
            connectedAddress = accounts[0];
            currentWallet = 'unisat'; // ✅ Definir wallet atual
            updateGlobalWalletState(); // 🌐 Atualizar window.*
            
            // Save wallet type
            localStorage.setItem('walletType', 'unisat');
            
            updateWalletUI();
            closeWalletModal();
            showNotification('✅ Unisat connected successfully!', 'success');
            loadUserOffers();
        } else {
            throw new Error('No accounts found');
        }
    } catch (error) {
        console.error('❌ Unisat connection error:', error);
        showNotification('Failed to connect Unisat: ' + error.message, 'error');
    }
}

// Connect Xverse
async function connectXverse() {
    console.log('⚡ Connecting Xverse...');
    
    try {
        if (typeof window.XverseProviders === 'undefined') {
            showNotification('Xverse not detected. Please install the extension!', 'error');
            window.open('https://www.xverse.app/', '_blank');
            return;
        }

        const getAddressOptions = {
            payload: {
                purposes: ['ordinals', 'payment'],
                message: 'Connect to Ordinals Marketplace',
                network: { type: 'Mainnet' }
            },
            onFinish: (response) => {
                isWalletConnected = true;
                connectedAddress = response.addresses[0].address;
                currentWallet = 'xverse'; // ✅ Definir wallet atual
                updateGlobalWalletState(); // 🌐 Atualizar window.*
                
                // Save wallet type
                localStorage.setItem('walletType', 'xverse');
                
                updateWalletUI();
                closeWalletModal();
                showNotification('✅ Xverse connected successfully!', 'success');
                loadUserOffers();
            },
            onCancel: () => {
                showNotification('Xverse connection cancelled', 'info');
            }
        };
        
        await window.XverseProviders.BitcoinProvider.request('getAddresses', getAddressOptions);
    } catch (error) {
        console.error('❌ Xverse connection error:', error);
        showNotification('Failed to connect Xverse: ' + error.message, 'error');
    }
}

// Search ordinals
async function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    // Resetar para página 1
    currentBrowsePage = 1;
    
    // Filtrar localmente nos allOrdinals
    if (!searchTerm) {
        filteredOrdinals = allOrdinals;
    } else {
        filteredOrdinals = allOrdinals.filter(ordinal => {
            const id = (ordinal.id || '').toLowerCase();
            const number = (ordinal.inscription_number || '').toString();
            
            return id.includes(searchTerm) || number.includes(searchTerm);
        });
    }
    
    // Re-renderizar com filtro
    renderBrowseOrdinals(filteredOrdinals);
}

// Sort ordinals
async function handleSort(e) {
    const sortBy = e.target.value;
    
    // Resetar para página 1
    currentBrowsePage = 1;
    
    try {
        // Se for "popular", buscar do backend
        if (sortBy === 'popular') {
            const response = await apiRequest(`/offers?status=active&sortBy=popular`);
            // Mapear offers para o formato de inscriptions
            filteredOrdinals = response.offers.map(offer => ({
                id: offer.inscription_id,
                inscription_number: offer.inscription_number,
                content_type: offer.content_type,
                price: offer.offer_amount,
                owner: offer.creator_address,
                offer_id: offer.id,
                likes_count: offer.likes_count || 0,
                source: offer.source
            }));
        } else {
            // Ordenar localmente
            filteredOrdinals = [...allOrdinals].sort((a, b) => {
                const aNumber = a.inscription_number || 0;
                const bNumber = b.inscription_number || 0;
                const aPrice = a.price || 0;
                const bPrice = b.price || 0;
                
                switch(sortBy) {
                    case 'number':
                        return aNumber - bNumber;
                    case 'price-low':
                        return aPrice - bPrice;
                    case 'price-high':
                        return bPrice - aPrice;
                    case 'recent':
                    default:
                        return bNumber - aNumber;
                }
            });
        }
        
        // Re-renderizar com ordenação
        renderBrowseOrdinals(filteredOrdinals);
        
    } catch (error) {
        console.error('Error sorting:', error);
        showNotification('Error sorting ordinals', 'error');
    }
}

// ==========================================
// 💝 SISTEMA DE LIKES (SOCIAL MARKETPLACE)
// ==========================================

// Carregar estado do like (verificar se o usuário já curtiu)
async function loadLikeState(offerId, likeBtn) {
    if (!isWalletConnected || !connectedAddress) {
        return; // Sem wallet conectada, não carregar estado
    }
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/likes/${offerId}?address=${connectedAddress}`);
        const data = await response.json();
        
        if (data.success && data.user_liked) {
            // Usuário já curtiu, mostrar coração vermelho
            likeBtn.textContent = '❤️';
            likeBtn.setAttribute('data-liked', 'true');
        }
        
        // Atualizar contador
        const likeCount = likeBtn.parentElement.querySelector('.like-count');
        if (likeCount && data.likes_count > 0) {
            likeCount.textContent = data.likes_count;
        }
    } catch (error) {
        console.error('Error loading like state:', error);
    }
}

// Manipular click no botão de like
async function handleLikeClick(offerId, likeBtn) {
    console.log('💝 Like button clicked:', {
        offerId,
        isWalletConnected,
        currentWallet,
        connectedAddress
    });
    
    // Verificar se wallet está conectada
    if (!isWalletConnected) {
        showNotification('❌ Please connect your wallet to like', 'error');
        return;
    }
    
    // Verificar se é KrayWallet (necessário para assinatura)
    if (currentWallet !== 'kraywallet') {
        console.error('❌ Wrong wallet type:', currentWallet, '(expected: kraywallet)');
        showNotification('❌ Only KrayWallet supports likes (signature required)', 'error');
        return;
    }
    
    console.log('✅ Wallet verified, proceeding with like...');
    
    const isLiked = likeBtn.getAttribute('data-liked') === 'true';
    
    try {
        // Solicitar assinatura da wallet
        showNotification('🔏 Please sign the message in your wallet...', 'info');
        
        const message = isLiked 
            ? `I unlike this offer: ${Date.now()}`
            : `I like this offer: ${Date.now()}`;
        
        // Assinar mensagem (popup vai abrir automaticamente se locked)
        const signResult = await window.krayWallet.signMessage(message);
        
        if (!signResult || !signResult.signature) {
            throw new Error('Failed to sign message');
        }
        
        // Enviar para API
        const method = isLiked ? 'DELETE' : 'POST';
        const response = await fetch(`${CONFIG.API_URL}/likes/${offerId}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: connectedAddress,
                signature: signResult.signature,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to process like');
        }
        
        // Atualizar UI
        const likeCount = likeBtn.parentElement.querySelector('.like-count');
        
        if (isLiked) {
            // Unlike
            likeBtn.textContent = '🤍';
            likeBtn.setAttribute('data-liked', 'false');
            showNotification('💔 Unliked!', 'success');
        } else {
            // Like
            likeBtn.textContent = '❤️';
            likeBtn.setAttribute('data-liked', 'true');
            showNotification('❤️ Liked!', 'success');
        }
        
        // Atualizar contador
        if (likeCount) {
            likeCount.textContent = data.likes_count > 0 ? data.likes_count : '';
        }
        
    } catch (error) {
        console.error('❌ Error processing like:', error);
        showNotification(`❌ ${error.message}`, 'error');
    }
}

// Buy Now - Compra automática com PSBT
async function buyNow(inscriptionId, price, sellerAddress) {
    if (!isWalletConnected) {
        showNotification('Please connect your wallet first', 'error');
        return;
    }

    // ✅ NOTA: Unisat/Xverse podem COMPRAR normalmente (apenas assinam seus próprios inputs)
    if (currentWallet !== 'kraywallet') {
        console.log('✅ Non-KrayWallet detected: Can BUY (signs own inputs only)');
        console.log('   Note: Cannot SELL (requires SIGHASH_SINGLE|ANYONECANPAY)');
    }

    try {
        showNotification('🔄 Preparing purchase...', 'info');
        
        // 1. Obter endereço do comprador
        const buyerAddresses = await getWalletAccounts();
        const buyerAddress = buyerAddresses[0];
        
        // 2. Buscar oferta do vendedor
        showNotification('🔍 Finding seller offer...', 'info');
        
        const offerResponse = await apiRequest('/offers');
        const offer = offerResponse.offers.find(o => 
            o.inscription_id === inscriptionId && 
            o.status === 'active' &&
            o.offer_amount === price
        );
        
        if (!offer) {
            showNotification('❌ Offer not found. Please try again.', 'error');
            return;
        }
        
        // 3. Pegar PSBT assinado do vendedor usando endpoint protegido
        showNotification('📝 Getting seller PSBT...', 'info');
        
        // 🔒 USAR ENDPOINT PROTEGIDO para buscar PSBT
        const psbtResponse = await apiRequest(`/offers/${offer.id}/get-seller-psbt`, {
            method: 'POST',
            body: JSON.stringify({
                buyerAddress: buyerAddress
            })
        });
        
        const sellerPsbtHex = psbtResponse.psbt;
        
        // Detalhes da oferta
        const details = {
            price: offer.offer_amount,
            inscriptionId: inscriptionId,
            seller_address: offer.creator_address,  // ✅ Endereço do seller da oferta
            estimatedFee: 1000, // Estimativa inicial
            totalCost: offer.offer_amount + 1000
        };
        
        // 4. Mostrar detalhes antes de assinar
        showNotification(
            `💰 Price: ${details.price} sats + network fee`,
            'info'
        );
        
        // 5. Pedir para comprador ASSINAR o PSBT combinado
        showNotification('🔏 Please sign the atomic PSBT in Unisat...', 'info');
        showNotification('💡 You can customize fee before signing!', 'info');
        
        // SOLUÇÃO ATÔMICA: Adicionar UTXOs do comprador ao PSBT
        showNotification('🔐 Preparing atomic swap...', 'info');
        
        // Buscar fees do mempool.space
        let feeRates = { slow: 5, medium: 10, fast: 20 }; // valores padrão
        try {
            const mempoolResponse = await fetch('https://mempool.space/api/v1/fees/recommended');
            if (mempoolResponse.ok) {
                const fees = await mempoolResponse.json();
                feeRates = {
                    slow: fees.hourFee || 5,
                    medium: fees.halfHourFee || 10,
                    fast: fees.fastestFee || 20
                };
                console.log('Current mempool fees:', feeRates);
            }
        } catch (feeError) {
            console.log('Using default fee rates:', feeError);
        }
        
        // Mostrar opções de fee para o usuário
        const feeChoice = await showFeeSelector(feeRates, details.price);
        if (!feeChoice) {
            showNotification('❌ Purchase cancelled', 'error');
            return;
        }
        
        let estimatedFee = feeChoice.totalFee;
        
        // ⚠️ Bitcoin Core minimum relay fee (~255 sats for ~250 vBytes tx)
        const MIN_FEE = 350; // Segurança extra (+10% margem)
        if (estimatedFee < MIN_FEE) {
            console.log(`⚠️  Fee too low (${estimatedFee} sats), adjusting to minimum: ${MIN_FEE} sats`);
            estimatedFee = MIN_FEE;
            
            // ✅ NOTIFICAR USUÁRIO SOBRE AJUSTE DE FEE
            showNotification(`ℹ️ Fee adjusted to ${MIN_FEE} sats (network minimum)`, 'info');
        }
        
        console.log(`User selected ${feeChoice.level} fee: ${feeChoice.rate} sat/vB, final fee: ${estimatedFee} sats`);
        
        let txid;
        try {
            // ✅ FEEDBACK: Iniciando compra
            showNotification('🔄 Preparing transaction...', 'info');
            
            // 1. Verificar saldo do comprador
            const balance = await getWalletBalance();
            const totalNeeded = details.price + estimatedFee; // price + selected fee
            
            if (balance.confirmed < totalNeeded) {
                showNotification(`❌ Insufficient Balance`, 'error');
                showNotification(`💡 You need ${totalNeeded} sats (${details.price} sats + ${estimatedFee} sats fee), but only have ${balance.confirmed} sats`, 'info');
                return;
            }
            
            // 2. Buscar UTXOs e public key do comprador
            showNotification('🔍 Getting your UTXOs...', 'info');
            const utxoList = await getWalletUtxos();
            const buyerPublicKey = await getWalletPublicKey();
            console.log('Available UTXOs:', utxoList);
            console.log('Buyer public key:', buyerPublicKey);
            
            // 3. Backend recria PSBT do zero com inputs do vendedor + comprador
            showNotification('🔧 Building atomic PSBT...', 'info');
            
            const atomicPsbtResponse = await apiRequest('/purchase/build-atomic-psbt', {
                method: 'POST',
                body: JSON.stringify({
                    sellerPsbt: sellerPsbtHex,
                    sellerAddress: details.seller_address,  // ✅ Endereço do seller da oferta
                    buyerAddress: buyerAddress,
                    buyerUtxos: utxoList,
                    buyerPublicKey: buyerPublicKey,
                    paymentAmount: details.price,
                    feeRate: feeChoice.rate,
                    estimatedFee: estimatedFee
                })
            });
            
            const finalPsbt = atomicPsbtResponse.psbt;
            
            console.log('✅ Atomic PSBT created:', {
                totalInputs: atomicPsbtResponse.details.totalInputs,
                totalOutputs: atomicPsbtResponse.details.totalOutputs,
                fee: atomicPsbtResponse.details.actualFee
            });
            
            // 4. Assinar inputs do COMPRADOR apenas
            showNotification('✅ Transaction ready!', 'success');
            showNotification('🖊️ Please sign in your wallet...', 'info');
            showNotification('💰 Seller receives: ' + details.price + ' sats', 'info');
            showNotification('✅ You receive: 1 inscription', 'info');
            
            // Calcular quantos inputs do comprador existem no PSBT
            // Input 0 = vendedor (já assinado)
            // Inputs 1+ = comprador (precisa assinar)
            const totalInputs = atomicPsbtResponse.details.totalInputs;
            const buyerInputsCount = totalInputs - 1; // Total - 1 (vendedor)
            
            console.log(`PSBT has ${totalInputs} inputs total (1 seller + ${buyerInputsCount} buyer)`);
            console.log('Signing buyer inputs (indices 1+)...');
            
            // CRÍTICO: Especificar APENAS os inputs que realmente existem
            const toSignInputs = [];
            
            for (let i = 1; i < totalInputs; i++) { // De 1 até totalInputs-1
                toSignInputs.push({ 
                    index: i, 
                    publicKey: buyerPublicKey 
                });
            }
            
            console.log(`toSignInputs: ${buyerInputsCount} inputs (indices 1-${totalInputs-1})`, toSignInputs);
            
            // Mostrar notificação ANTES de abrir o popup
            showNotification('🔐 Opening KrayWallet popup...', 'info');
            showNotification('📱 Please approve the transaction', 'info');
            
            // Adicionar notificação extra para caso o popup não abra automaticamente
            setTimeout(() => {
                showNotification('💡 If popup did not open, click the extension icon 📌', 'warning');
            }, 2000);
            
            const signedPsbt = await signWalletPsbt(finalPsbt, {
                autoFinalized: false,
                toSignInputs: toSignInputs
            });
            
            if (!signedPsbt) {
                showNotification('❌ Signing cancelled', 'error');
                return;
            }
            
            showNotification('✅ Transaction signed!', 'success');
            
            console.log('✅ PSBT signed by Unisat');
            console.log('   Signed PSBT length:', signedPsbt.length, 'chars');
            console.log('   First 100 chars:', signedPsbt.substring(0, 100));
            console.log('\n📋 COMPLETE SIGNED PSBT (copy this):');
            console.log(signedPsbt);
            console.log('\n');
            
            // ✨ CONVERTER HEX → BASE64 (Unisat retorna hex!)
            let psbtToSend = signedPsbt;
            if (signedPsbt.startsWith('70736274')) {
                // É hex, converter para base64
                const hexBuffer = [];
                for (let i = 0; i < signedPsbt.length; i += 2) {
                    hexBuffer.push(parseInt(signedPsbt.substr(i, 2), 16));
                }
                const uint8Array = new Uint8Array(hexBuffer);
                psbtToSend = btoa(String.fromCharCode.apply(null, uint8Array));
                console.log('✅ Converted HEX → BASE64 for backend');
            }
            
            // 5. ⚠️ CRÍTICO: NÃO finalizar para atomic swap!
            // O backend /psbt/broadcast-atomic vai adicionar a assinatura do seller E finalizar
            console.log('⚠️ SKIPPING finalization for atomic swap (backend will finalize after adding seller signature)');
            
            let finalizedData = null;
            let txHex = null;
            
            // 6. Broadcast da transação atômica
            showNotification('📡 Broadcasting atomic swap...', 'info');
            
            try {
                if (txHex) {
                    // ✅ Usar a carteira CONECTADA para broadcast (KrayWallet ou Unisat)
                    if (currentWallet === 'kraywallet' && window.krayWallet) {
                        console.log('Broadcasting with hex via KrayWallet...');
                        // KrayWallet não tem pushTx, usar backend direto
                        throw new Error('KrayWallet: use backend for broadcast');
                    } else if (window.unisat) {
                        console.log('Broadcasting with hex via Unisat...');
                        txid = await window.unisat.pushTx(txHex);
                    } else {
                        throw new Error('No wallet available for broadcast');
                    }
                } else {
                    // Tentar com PSBT
                    if (currentWallet === 'kraywallet' && window.krayWallet) {
                        console.log('Broadcasting with PSBT via KrayWallet...');
                        throw new Error('KrayWallet: use backend for broadcast');
                    } else if (window.unisat) {
                        console.log('Broadcasting with PSBT via Unisat...');
                        txid = await window.unisat.pushPsbt(signedPsbt);
                    } else {
                        throw new Error('No wallet available for broadcast');
                    }
                }
            } catch (pushError) {
                // 🔐 ENCRYPTED SIGNATURE ATOMIC SWAP: Sempre usar backend controlado!
                console.log('🔐 Using ENCRYPTED SIGNATURE ATOMIC SWAP broadcast...', pushError.message || pushError);
                console.log('📤 Sending PSBT to secure broadcast endpoint...');
                console.log('   PSBT preview:', (finalizedData?.psbt || psbtToSend)?.substring(0, 100) + '...');
                console.log('   Offer ID:', offer.id);
                
                const broadcastResponse = await apiRequest('/psbt/broadcast-atomic', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        psbt: finalizedData?.psbt || psbtToSend,
                        offerId: offer.id
                    })
                });
                
                console.log('📥 Backend broadcast response:', broadcastResponse);
                
                if (!broadcastResponse || !broadcastResponse.txid) {
                    throw new Error('Backend broadcast failed: no txid returned');
                }
                
                console.log('✅ ENCRYPTED SIGNATURE ATOMIC SWAP: Broadcast successful!');
                console.log('   🔒 Seller signature was decrypted only on server');
                console.log('   🔒 Attacker could not broadcast outside marketplace');
                
                txid = broadcastResponse.txid;
            }
            
            if (!txid) {
                throw new Error('No txid - broadcast may have failed silently');
            }
            
            showNotification('✅ ATOMIC SWAP COMPLETE!', 'success');
            showNotification(`📜 Transaction ID: ${txid}`, 'success');
            
            // ✅ SALVAR HISTÓRICO E REMOVER OFERTA DO BANCO
            try {
                console.log('💾 Saving sale to history and removing offer...');
                await apiRequest(`/offers/${offer.id}`, {
                    method: 'DELETE',
                    body: JSON.stringify({
                        txid: txid,
                        buyer_address: connectedAddress  // Endereço do comprador
                    })
                });
                console.log('✅ Sale saved to history and offer removed');
                
                // ✅ MOSTRAR PENDING NOTIFICATION NO MARKETPLACE
                console.log('🎉 Purchase successful! Showing pending inscription...');
                
                // ✅ NOTIFICAÇÃO VISUAL: Mostrar que a inscription foi comprada
                showNotification(`⏰ Inscription purchased! Pending confirmation...`, 'success');
                showNotification(`📦 Inscription will appear in your wallet after ~15-30 minutes`, 'info');
                
                // ✅ ADICIONAR INSCRIPTION AO CACHE LOCAL DO BUYER (KrayWallet) - PENDING
                if (window.krayWallet) {
                    console.log('📦 Adding pending inscription to buyer wallet...');
                    try {
                        // ✅ CORRIGIDO: Output 0 é a inscription no atomic swap
                        const inscriptionData = {
                            id: inscriptionId,
                            number: offer.inscription_number || 0,
                            content_type: offer.content_type || 'unknown',
                            value: 600, // Valor típico de inscription UTXO
                            output: `${txid}:0`, // ✅ Output 0 é a inscription
                            address: connectedAddress,
                            pending: true, // ⏰ Marcar como pendente
                            txid: txid,
                            timestamp: Date.now(),
                            preview: `http://localhost:80/content/${inscriptionId}` // Preview local
                        };
                        
                        console.log('   📤 Pending inscription data:', inscriptionData);
                        
                        // Enviar para a extensão MyWallet via postMessage
                        window.postMessage({
                            type: 'MYWALLET_ADD_PENDING_INSCRIPTION',
                            data: inscriptionData
                        }, '*');
                        
                        console.log('✅ Pending inscription added to buyer wallet cache');
                        console.log('   ⏰ Will show with "Pending" badge until confirmed');
                        console.log('   ✅ After ~15-30 min, ORD server will index and show normally');
                        
                        // ✅ FORÇAR RELOAD DO ORDINALS TAB NA CARTEIRA
                        setTimeout(() => {
                            window.postMessage({
                                type: 'MYWALLET_RELOAD_INSCRIPTIONS'
                            }, '*');
                            console.log('🔄 MyWallet inscriptions reload requested');
                        }, 500);
                        
                    } catch (cacheError) {
                        console.warn('⚠️  Could not add to cache:', cacheError.message);
                    }
                }
                
                // ✅ REMOVER CONTAINER DO DOM IMEDIATAMENTE (Para o comprador)
                const offerCard = document.querySelector(`.inscription-card[data-inscription-id="${inscriptionId}"]`);
                if (offerCard) {
                    // Animação de fade out suave antes de remover
                    offerCard.style.opacity = '0.5';
                    offerCard.style.pointerEvents = 'none'; // Desabilitar cliques
                    setTimeout(() => {
                        offerCard.remove();
                        console.log('✅ Offer card removed from DOM');
                    }, 300); // 300ms para fade out
                }
                
                // ✅ RECARREGAR LISTA PARA GARANTIR SINCRONIZAÇÃO
                // Isso garante que outros usuários vejam a remoção quando recarregarem
                setTimeout(() => {
                    loadOrdinals();
                    console.log('🔄 Marketplace refreshed after purchase');
                }, 500);
                
            } catch (deleteError) {
                console.warn('⚠️  Could not delete offer:', deleteError.message);
                // Não impedir o sucesso, apenas avisar
            }
            
        } catch (error) {
            console.error('Atomic swap error:', error);
            
            // ✅ MENSAGENS AMIGÁVEIS E ESPECÍFICAS
            const errorMsg = error.message.toLowerCase();
            
            if (errorMsg.includes('min relay fee') || errorMsg.includes('fee too low')) {
                // Erro de taxa muito baixa
                showNotification('⚠️ Transaction Fee Too Low', 'error');
                showNotification('💡 The network requires a higher fee. Please try again with a higher fee rate (e.g., Medium or Fast)', 'info');
            } else if (errorMsg.includes('insufficient') || errorMsg.includes('not enough')) {
                // Saldo insuficiente
                showNotification('❌ Insufficient Balance', 'error');
                showNotification('💡 You don\'t have enough Bitcoin to complete this purchase. Please add funds to your wallet', 'info');
            } else if (errorMsg.includes('dust')) {
                // Output muito pequeno (dust)
                showNotification('⚠️ Amount Too Small', 'error');
                showNotification('💡 The transaction output is below the dust limit (546 sats). Please try a different amount', 'info');
            } else if (errorMsg.includes('utxo') || errorMsg.includes('spent')) {
                // UTXO já gasto
                showNotification('❌ Inscription Already Sold', 'error');
                showNotification('💡 This inscription was just purchased by someone else. Refreshing marketplace...', 'info');
                setTimeout(() => loadOrdinals(), 2000);
            } else if (errorMsg.includes('signature') || errorMsg.includes('signing')) {
                // Erro de assinatura
                showNotification('❌ Signature Error', 'error');
                showNotification('💡 Failed to sign the transaction. Please unlock your wallet and try again', 'info');
            } else if (errorMsg.includes('rejected') || errorMsg.includes('cancelled')) {
                // Usuário cancelou
                showNotification('🚫 Purchase Cancelled', 'info');
                showNotification('💡 You cancelled the transaction', 'info');
            } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
                // Erro de rede
                showNotification('🌐 Network Error', 'error');
                showNotification('💡 Connection problem. Please check your internet and try again', 'info');
            } else {
                // Erro genérico
                showNotification('❌ Purchase Failed', 'error');
                showNotification(`💡 ${error.message}`, 'info');
            }
            
            return;
        }
        
        showNotification('✅ Atomic swap complete! TXID: ' + txid.slice(0, 20) + '...', 'success');
        
        // 7. Oferta já foi deletada e salva no histórico nas linhas anteriores
        // (linhas 737-745: saveToHistory + deleteOffer)
        
        showNotification(`🎉 Purchase complete! Waiting for confirmation...`, 'success');
        
        // Mostrar link para ver transação
        setTimeout(() => {
            showNotification(`📊 View transaction: https://mempool.space/tx/${txid}`, 'success');
        }, 1000);
        
        // Recarregar marketplace
        setTimeout(() => {
            loadOrdinals();
        }, 2000);
        
    } catch (error) {
        console.error('Error buying inscription:', error);
        showNotification('Error completing purchase: ' + error.message, 'error');
    }
}

// Create offer - Using new v0.23.3 PSBT functionality
async function createOffer() {
    if (!isWalletConnected) {
        showNotification('Please connect your wallet first', 'error');
        return;
    }

    const inscriptionId = document.getElementById('inscriptionId').value;
    const offerAmount = document.getElementById('offerAmount').value;
    const feeRate = document.getElementById('feeRate').value;
    const autoSubmit = document.getElementById('autoSubmit').checked;

    if (!inscriptionId || !offerAmount) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    try {
        showNotification('📝 Creating offer with REAL inscription...', 'info');
        
        // CRIAR PSBT CUSTOMIZADO COM PAGAMENTO!
        let sellerPsbtSigned;
        
        // ✅ DETECTAR AUTOMATICAMENTE QUAL WALLET ESTÁ CONECTADA
        console.log('🔍 Detecting connected wallet:', currentWallet);
        showNotification(`📝 Getting inscription info from ${currentWallet}...`, 'info');
        
        let inscription = null;
        
        try {
            // Buscar inscription da wallet conectada
            if (currentWallet === 'kraywallet' && window.krayWallet) {
                console.log('🔍 Fetching inscriptions from KrayWallet...');
                const inscriptionsResponse = await window.krayWallet.getInscriptions();
                console.log(`📋 Total inscriptions from KrayWallet:`, inscriptionsResponse);
                
                // MyWallet retorna array direto
                const inscriptionsList = Array.isArray(inscriptionsResponse) ? inscriptionsResponse : inscriptionsResponse.list || [];
                inscription = inscriptionsList.find(i => i.inscriptionId === inscriptionId || i.id === inscriptionId);
                
            } else if (currentWallet === 'xverse' && window.XverseProviders) {
                console.log('🔍 Fetching inscriptions from Xverse...');
                // Xverse API para inscriptions
                const xverseInscriptions = await window.XverseProviders.BitcoinProvider.request('getInscriptions', {});
                inscription = xverseInscriptions.find(i => i.inscriptionId === inscriptionId);
                
            } else if (window.unisat) {
                // Fallback para Unisat
                console.log('🔍 Fetching inscriptions from Unisat...');
                const inscriptions = await window.unisat.getInscriptions(0, 100);
                console.log(`📋 Total inscriptions from Unisat: ${inscriptions.list.length}`);
                inscription = inscriptions.list.find(i => i.inscriptionId === inscriptionId);
            } else {
                throw new Error('No wallet connected');
            }
            
            console.log('🎯 Target inscription ID:', inscriptionId);
            console.log('📦 Inscription found:', inscription);
            
            if (inscription) {
                console.log('✅ Inscription UTXO details:');
                console.log('   txid:', inscription.utxo?.txid || inscription.location?.split(':')[0]);
                console.log('   vout:', inscription.utxo?.vout || inscription.location?.split(':')[1]);
                console.log('   value:', inscription.utxo?.satoshi || inscription.outputValue);
                console.log('   address:', inscription.address);
            }
            
            if (!inscription) {
                showNotification('❌ Inscription not found in wallet', 'error');
                return;
            }
            
            console.log('Inscription found:', inscription);
            console.log('🚀 DEBUG: About to fetch UTXO from ORD server...');
            
            // ✅ BUSCAR UTXO ATUAL DA INSCRIPTION VIA ORD SERVER LOCAL
            showNotification('🔍 Fetching current UTXO from ORD server...', 'info');
            console.log('🚀 DEBUG: Notification shown, calling API...');
            
            let txid, vout, value, scriptPubKey;
            
            try {
                console.log('🚀 DEBUG: Making API request to:', `/ord/inscription/${inscriptionId}/utxo`);
                const utxoResponse = await apiRequest(`/ord/inscription/${inscriptionId}/utxo`);
                console.log('🚀 DEBUG: API response received:', utxoResponse);
                
                if (utxoResponse.success && utxoResponse.utxo) {
                    txid = utxoResponse.utxo.txid;
                    vout = utxoResponse.utxo.vout;
                    value = utxoResponse.utxo.value;
                    scriptPubKey = utxoResponse.utxo.scriptPubKey;
                    
                    console.log('✅ REAL UTXO from ORD server:');
                    console.log('   txid:', txid);
                    console.log('   vout:', vout);
                    console.log('   value:', value, 'sats');
                    console.log('   satpoint:', utxoResponse.utxo.satpoint);
                    console.log('   scriptPubKey:', scriptPubKey ? scriptPubKey.substring(0, 20) + '...' : 'N/A');
                } else {
                    throw new Error('ORD server did not return UTXO');
                }
            } catch (ordError) {
                console.error('❌ Error fetching UTXO from ORD server:', ordError);
                showNotification('⚠️  Could not fetch UTXO from ORD server, using fallback', 'warning');
                
                // Fallback: usar inscription.utxo ou location
                if (inscription.utxo && inscription.utxo.txid) {
                    txid = inscription.utxo.txid;
                    vout = inscription.utxo.vout;
                    value = parseInt(inscription.utxo.satoshi) || parseInt(inscription.outputValue) || 546;
                    console.log('⚠️  Fallback: Using inscription.utxo');
                } else if (inscription.location) {
                    const parts = inscription.location.split(':');
                    txid = parts[0];
                    vout = parseInt(parts[1]);
                    value = parseInt(inscription.outputValue) || 546;
                    console.log('⚠️  Fallback: Using inscription.location');
                } else {
                    showNotification('❌ Could not determine inscription UTXO', 'error');
                    return;
                }
            }
            
            console.log('📍 FINAL UTXO to use for offer:');
            console.log('   txid:', txid);
            console.log('   vout:', vout);
            console.log('   value:', value, 'sats');
            console.log('   address:', inscription.address || connectedAddress);
            
            // Criar PSBT customizado no backend COM PAGAMENTO
            showNotification('🔨 Creating custom PSBT with payment output...', 'info');
            
            const psbtResponse = await apiRequest('/sell/create-custom-psbt', {
                method: 'POST',
                body: JSON.stringify({
                    inscriptionId,
                    inscriptionUtxo: {
                        txid: txid,  // ✅ REAL do ORD server
                        vout: vout,  // ✅ REAL do ORD server
                        value: value,  // ✅ REAL do ORD server
                        scriptPubKey: scriptPubKey,  // ✅ REAL do Bitcoin Core
                        address: inscription.address || connectedAddress
                    },
                    price: parseInt(offerAmount),
                    sellerAddress: connectedAddress,
                    feeRate: parseInt(feeRate),
                    walletType: currentWallet  // ✅ Passar tipo de wallet ao backend
                })
            });
            
            // ✨ Assinar com a wallet conectada (KrayWallet ou Unisat)
            if (currentWallet === 'kraywallet' && window.krayWallet) {
                // 🎯 USAR KRAYWALLET COM SIGHASH_NONE|ANYONECANPAY
                // NONE: Seller não se importa com outputs (buyer define tudo)
                // ANYONECANPAY: Seller não se importa com outros inputs (buyer adiciona pagamento)
                showNotification('🔏 Signing with KrayWallet (SIGHASH_NONE|ANYONECANPAY)...', 'info');
                
                try {
        const signResult = await window.krayWallet.signPsbt(psbtResponse.psbt, {
            autoFinalized: false,
            sighashType: 'NONE|ANYONECANPAY'  // ✅ CRITICAL: NONE para marketplace construir outputs!
        });
                    
                    if (!signResult.success) {
                        throw new Error(signResult.error || 'Signing failed');
                    }
                    
                    sellerPsbtSigned = signResult.signedPsbt;
                    console.log('✅ PSBT signed with KrayWallet (SIGHASH_NONE|ANYONECANPAY)');
                    
                } catch (sighashError) {
                    console.error('❌ KrayWallet signing failed:', sighashError);
                    showNotification('❌ Signing failed: ' + sighashError.message, 'error');
                    return;
                }
            } else if (window.unisat) {
                // ⚠️ UNISAT: Atualmente não suportado para criar ofertas
                // Unisat não aceita SIGHASH_NONE|ANYONECANPAY necessário para atomic swaps
                showNotification('⚠️  KrayWallet Required', 'warning');
                showNotification('Please use KrayWallet to create offers. Unisat can be used to buy.', 'info');
                console.warn('❌ Unisat does not support SIGHASH_NONE|ANYONECANPAY required for atomic swaps');
                console.warn('   Please switch to KrayWallet to create offers');
                return;
            } else {
                showNotification('❌ KrayWallet required to create offers', 'error');
                showNotification('💡 Install KrayWallet extension to sell inscriptions', 'info');
                return;
            }
            
            // VERIFICAR SE REALMENTE ASSINOU
            if (!sellerPsbtSigned) {
                showNotification('❌ Signature cancelled or failed!', 'error');
                return;
            }
            
            console.log('✅ Custom PSBT returned from Unisat:', sellerPsbtSigned);
            
            // Verificar tamanho do PSBT (assinado deve ser maior que não assinado)
            const originalLength = psbtResponse.psbt.length;
            const signedLength = sellerPsbtSigned.length;
            
            console.log('📏 PSBT size check:', {
                original: originalLength,
                signed: signedLength,
                difference: signedLength - originalLength
            });
            
            // Se PSBT assinado não é maior, provavelmente não foi assinado
            if (signedLength <= originalLength) {
                showNotification('❌ PSBT was not signed! Signature missing.', 'error');
                console.error('❌ PSBT size did not increase - likely not signed!');
                return;
            }
            
            // PSBT assinado é maior = provavelmente tem assinatura!
            console.log('✅ PSBT size increased - signature likely present!');
            showNotification('✅ PSBT signed successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating custom PSBT:', error);
            showNotification('❌ Failed: ' + error.message, 'error');
            return;
        }

        // 2. Adicionar inscription ao banco (SEMPRE - para aparecer no marketplace)
        // REMOVIDO: Este endpoint não existe mais, a oferta é criada diretamente abaixo
        // await apiRequest(`/ordinals/${inscriptionId}/list`, {
        //     method: 'POST',
        //     body: JSON.stringify({
        //         price: parseInt(offerAmount),
        //         address: connectedAddress
        //     })
        // });
        
        // 3. Salvar oferta com PSBT/assinatura + SIGHASH type
        const offerResponse = await apiRequest('/offers', {
            method: 'POST',
            body: JSON.stringify({
                type: 'inscription',
                inscriptionId,
                offerAmount: parseInt(offerAmount),
                feeRate: parseInt(feeRate),
                psbt: sellerPsbtSigned,
                creatorAddress: connectedAddress,
                expiresIn: 86400000, // 24 hours
                sighashType: "SINGLE|ANYONECANPAY" // ✨ Indicar que foi assinado com SIGHASH (como no backup!)
            })
        });

        // Display oferta criada
        document.getElementById('psbtOutput').style.display = 'block';
        document.getElementById('psbtText').value = 
            `✅ Offer Created Successfully!\n\n` +
            `Offer ID: ${offerResponse.offer.id}\n` +
            `Inscription: ${inscriptionId}\n` +
            `Number: #${inscriptionId.match(/i(\d+)$/)?.[1] || 'Unknown'}\n` +
            `Price: ${parseInt(offerAmount).toLocaleString()} sats\n` +
            `Fee Rate: ${feeRate} sat/vB\n` +
            `Seller: ${connectedAddress}\n` +
            `Status: Pending\n\n` +
            `PSBT/Signature: ${sellerPsbtSigned.slice(0, 64)}...`;

        showNotification('✅ Offer created and LIVE in marketplace!', 'success');
        
        // ✅ REMOVER INSCRIPTION DO CACHE DO SELLER (KrayWallet)
        if (window.krayWallet) {
            console.log('🗑️  Removing inscription from seller cache...');
            try {
                window.postMessage({
                    type: 'MYWALLET_REMOVE_PENDING_INSCRIPTION',
                    data: { inscriptionId: inscriptionId }
                }, '*');
                console.log('✅ Inscription removed from seller cache');
            } catch (cacheError) {
                console.warn('⚠️  Could not remove from seller cache:', cacheError.message);
            }
        }

        // Recarregar automaticamente o marketplace para mostrar a nova oferta
        setTimeout(() => {
            showNotification('🔄 Refreshing marketplace...', 'info');
            loadOrdinals();
            loadUserOffers();
            
            // Mudar para tab Browse Ordinals para usuário ver
            setTimeout(() => {
                document.querySelector('[data-tab="browse"]').click();
                showNotification('✅ Your listing is now visible!', 'success');
            }, 500);
        }, 1000);
    } catch (error) {
        console.error('Error creating offer:', error);
        showNotification('Error creating offer: ' + error.message, 'error');
    }
}

// Export PSBT
function exportPSBT() {
    const psbtText = document.getElementById('psbtText').value;
    
    if (!psbtText) {
        showNotification('Please create an offer first', 'error');
        return;
    }

    const blob = new Blob([psbtText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offer-${Date.now()}.psbt`;
    a.click();
    
    showNotification('PSBT exported successfully!');
}

// Wallet sweep - New feature in v0.23.3
async function sweepWallet() {
    if (!isWalletConnected) {
        showNotification('Please connect your wallet first', 'error');
        return;
    }

    const address = document.getElementById('sweepAddress').value;
    const feeRate = document.getElementById('sweepFeeRate').value;

    if (!address) {
        showNotification('Please enter a destination address', 'error');
        return;
    }

    if (!confirm('Are you sure you want to sweep ALL UTXOs from your wallet? This action cannot be undone.')) {
        return;
    }

    try {
        // Get wallet balance first
        const balanceResponse = await apiRequest(`/wallet/balance/${connectedAddress}`);
        
        // Create PSBT for sweep
        const psbtResponse = await apiRequest('/psbt/create', {
            method: 'POST',
            body: JSON.stringify({
                type: 'sweep',
                fromAddress: connectedAddress,
                toAddress: address,
                amount: balanceResponse.balance.total,
                feeRate
            })
        });

        // Save sweep to database
        await apiRequest('/wallet/sweep', {
            method: 'POST',
            body: JSON.stringify({
                fromAddress: connectedAddress,
                toAddress: address,
                amount: balanceResponse.balance.total,
                feeRate,
                utxoCount: balanceResponse.utxos.length,
                psbt: psbtResponse.psbt
            })
        });
        
        document.getElementById('sweepOutput').style.display = 'block';
        document.getElementById('sweepTxText').value = psbtResponse.psbt;
        
        showNotification('Sweep transaction generated! Review before broadcasting.', 'success');
    } catch (error) {
        console.error('Error creating sweep:', error);
        showNotification('Error creating sweep: ' + error.message, 'error');
    }
}

// Load user offers from API
async function loadUserOffers() {
    const offersList = document.getElementById('offersList');
    
    if (!isWalletConnected) {
        offersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔒</div>
                <p>Connect wallet to see your offers</p>
            </div>
        `;
        return;
    }

    try {
        const response = await apiRequest(`/offers?address=${connectedAddress}&type=inscription`);
        userOffers = response.offers;
        
        if (userOffers.length === 0) {
            offersList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <p>No active offers yet</p>
                    <p>Create an offer to get started!</p>
                </div>
            `;
            return;
        }

        offersList.innerHTML = '';
        userOffers.forEach(offer => {
            const offerItem = document.createElement('div');
            offerItem.className = 'offer-item';
            offerItem.innerHTML = `
                <div class="offer-info">
                    <div class="offer-id">${offer.inscription_id}</div>
                    <div class="offer-amount">${(offer.offer_amount / 100000000).toFixed(8)} BTC</div>
                    <span class="offer-status status-${offer.status}">${offer.status}</span>
                </div>
                <div class="offer-actions">
                    <button class="btn btn-small btn-secondary" onclick="viewOffer('${offer.id}')">View</button>
                    <button class="btn btn-small btn-danger" onclick="cancelOffer('${offer.id}', this)">Cancel</button>
                </div>
            `;
            offersList.appendChild(offerItem);
        });
    } catch (error) {
        console.error('Error loading offers:', error);
        offersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Error loading offers</p>
            </div>
        `;
    }
}

// Helper functions are now in config.js and handled by the API

function viewOffer(offerId) {
    const offer = userOffers.find(o => o.id === offerId);
    if (offer) {
        alert(`Offer Details:\n\nInscription: ${offer.inscriptionId}\nAmount: ${offer.amount} sats\nStatus: ${offer.status}\nPSBT: ${offer.psbt.substring(0, 50)}...`);
    }
}

async function cancelOffer(offerId, btnElement) {
    if (confirm('Are you sure you want to cancel this offer?')) {
        try {
            console.log(`🗑️ Cancelling offer ${offerId}...`);
            
            // Encontrar o botão (pode vir como parâmetro ou encontrar no DOM)
            const btn = btnElement || event?.target || document.querySelector(`button[onclick*="${offerId}"]`);
            
            if (!btn) {
                console.error('❌ Button not found!');
            }
            
            const originalText = btn?.textContent || 'Cancel';
            if (btn) {
                btn.textContent = 'Cancelling...';
                btn.disabled = true;
            }
            
            // Cancelar no backend
            const response = await apiRequest(`/offers/${offerId}/cancel`, {
                method: 'PUT',
                body: JSON.stringify({})
            });
            
            console.log('✅ Offer cancelled successfully:', response);
            
            // Remover o card imediatamente da UI
            // Tentar encontrar pelo botão ou procurar no DOM
            let offerCard = btn ? btn.closest('.offer-item') : null;
            
            // Se não encontrou pelo botão, procurar pelo ID da oferta
            if (!offerCard) {
                console.log('🔍 Searching for offer card by ID...');
                const allOfferItems = document.querySelectorAll('.offer-item');
                allOfferItems.forEach(item => {
                    if (item.textContent.includes(offerId) || item.innerHTML.includes(offerId)) {
                        offerCard = item;
                        console.log('✅ Found offer card!');
                    }
                });
            }
            
            if (offerCard) {
                console.log('🗑️ Removing offer card from UI...');
                offerCard.style.transition = 'opacity 0.3s, transform 0.3s';
                offerCard.style.opacity = '0';
                offerCard.style.transform = 'scale(0.95)';
                
                setTimeout(() => {
                    offerCard.remove();
                    
                    // Verificar se ainda tem ofertas
                    const offersList = document.getElementById('offersList');
                    if (offersList && offersList.children.length === 0) {
                        offersList.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon">📋</div>
                                <p>No active offers</p>
                            </div>
                        `;
                    }
                }, 300);
            } else {
                // Fallback: se não encontrou o card, recarrega a lista toda
                console.log('⚠️ Could not find offer card, reloading list...');
                await loadUserOffers();
            }
            
            showNotification('✅ Offer cancelled successfully', 'success');
            
            // 🔄 RECARREGAR Browse Ordinals para remover o container
            console.log('🔄 Reloading Browse Ordinals to sync...');
            if (typeof loadOrdinals === 'function') {
                // Se estamos na página ordinals.html, recarregar
                setTimeout(() => {
                    loadOrdinals();
                    console.log('✅ Browse Ordinals reloaded');
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ Error cancelling offer:', error);
            showNotification('❌ Error cancelling offer: ' + error.message, 'error');
            
            // Restaurar botão
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    }
}

// Check wallet connection status
async function checkWalletConnection() {
    // Check for Unisat wallet
    if (typeof window.unisat !== 'undefined') {
        try {
            const accounts = await window.unisat.getAccounts();
            if (accounts && accounts.length > 0) {
                isWalletConnected = true;
                connectedAddress = accounts[0];
                updateGlobalWalletState(); // 🌐 Atualizar window.*
                updateWalletUI();
            }
        } catch (error) {
            console.log('Wallet not connected');
        }
    }
}

// Update wallet UI
function updateWalletUI() {
    const btn = document.getElementById('connectWallet');
    if (isWalletConnected && connectedAddress) {
        // Show shortened address (IGUAL às outras páginas)
        const shortAddress = `${connectedAddress.substring(0, 6)}...${connectedAddress.substring(connectedAddress.length - 4)}`;
        
        btn.innerHTML = `
            <span class="wallet-text">${shortAddress}</span>
        `;
        
        // Add disconnect functionality
        btn.onclick = () => {
            if (confirm('Disconnect wallet?')) {
                isWalletConnected = false;
                connectedAddress = null;
                currentWallet = null;
                localStorage.removeItem('ordinals_wallet_state');
                updateWalletUI();
                showNotification('Wallet disconnected', 'info');
            }
        };
        
        // 🟢 VERDE gradiente (IGUAL às outras páginas)
        btn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
        
        // 💾 SALVAR NO LOCALSTORAGE
        localStorage.setItem('ordinals_wallet_state', JSON.stringify({
            connected: true,
            address: connectedAddress,
            walletType: currentWallet
        }));
        console.log('💾 Wallet state saved to localStorage');
    } else {
        // Reset to default
        btn.innerHTML = `
            <span class="wallet-text">Connect Wallet</span>
        `;
        btn.onclick = () => {
            const modal = document.getElementById('walletModal');
            modal.classList.remove('hidden');
        };
        btn.style.background = '';
        
        // 🗑️ LIMPAR LOCALSTORAGE
        localStorage.removeItem('ordinals_wallet_state');
    }
}

// Fee selector modal
async function showFeeSelector(feeRates, inscriptionPrice) {
    return new Promise((resolve) => {
        // Calcular fees estimadas (assumindo ~250 vBytes para atomic swap)
        const txSize = 250; // vBytes estimados
        
        const feeOptions = {
            slow: {
                level: 'Slow',
                rate: feeRates.slow,
                totalFee: Math.ceil(feeRates.slow * txSize),
                description: '~1 hour',
                emoji: '🐢'
            },
            medium: {
                level: 'Medium', 
                rate: feeRates.medium,
                totalFee: Math.ceil(feeRates.medium * txSize),
                description: '~30 minutes',
                emoji: '🚶'
            },
            fast: {
                level: 'Fast',
                rate: feeRates.fast,
                totalFee: Math.ceil(feeRates.fast * txSize),
                description: '~10 minutes',
                emoji: '🚀'
            }
        };
        
        // Criar modal
        const modal = document.createElement('div');
        modal.className = 'fee-modal';
        modal.innerHTML = `
            <div class="fee-modal-content">
                <h3>⛽ Select Transaction Fee</h3>
                <p class="fee-info">Current mempool conditions</p>
                
                <div class="fee-options">
                    ${Object.entries(feeOptions).map(([key, opt]) => `
                        <button class="fee-option" data-fee="${key}">
                            <span class="fee-emoji">${opt.emoji}</span>
                            <div class="fee-details">
                                <strong>${opt.level}</strong>
                                <span class="fee-rate">${opt.rate} sat/vB</span>
                                <span class="fee-time">${opt.description}</span>
                            </div>
                            <div class="fee-cost">
                                <span class="fee-amount">${opt.totalFee} sats</span>
                                <span class="fee-total">Total: ${inscriptionPrice + opt.totalFee} sats</span>
                            </div>
                        </button>
                    `).join('')}
                </div>
                
                <div class="fee-custom">
                    <label>Custom fee rate (sat/vB):</label>
                    <input type="number" id="customFeeRate" min="1" max="1000" placeholder="${feeRates.medium}">
                    <button id="useCustomFee">Use Custom</button>
                </div>
                
                <button class="fee-cancel">Cancel</button>
            </div>
        `;
        
        // Adicionar estilos se não existirem
        if (!document.querySelector('#feeModalStyles')) {
            const style = document.createElement('style');
            style.id = 'feeModalStyles';
            style.textContent = `
                .fee-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .fee-modal-content {
                    background: #1a1a1a;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    width: 90%;
                    color: white;
                }
                .fee-modal h3 {
                    margin: 0 0 8px 0;
                    font-size: 20px;
                }
                .fee-info {
                    color: #999;
                    margin: 0 0 20px 0;
                }
                .fee-options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .fee-option {
                    display: flex;
                    align-items: center;
                    background: #2a2a2a;
                    border: 2px solid #333;
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .fee-option:hover {
                    border-color: #ff6b00;
                    background: #333;
                }
                .fee-emoji {
                    font-size: 24px;
                    margin-right: 12px;
                }
                .fee-details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .fee-rate {
                    color: #ff6b00;
                    font-size: 14px;
                }
                .fee-time {
                    color: #999;
                    font-size: 12px;
                }
                .fee-cost {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                }
                .fee-amount {
                    font-weight: bold;
                    color: #ff6b00;
                }
                .fee-total {
                    font-size: 12px;
                    color: #999;
                }
                .fee-custom {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    padding: 12px;
                    background: #2a2a2a;
                    border-radius: 8px;
                    margin-bottom: 12px;
                }
                .fee-custom label {
                    flex: 1;
                }
                .fee-custom input {
                    width: 100px;
                    padding: 6px;
                    background: #1a1a1a;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: white;
                }
                #useCustomFee {
                    padding: 6px 12px;
                    background: #ff6b00;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .fee-cancel {
                    width: 100%;
                    padding: 10px;
                    background: #444;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(modal);
        
        // Event handlers
        modal.querySelectorAll('.fee-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.fee;
                document.body.removeChild(modal);
                resolve(feeOptions[key]);
            });
        });
        
        modal.querySelector('#useCustomFee').addEventListener('click', () => {
            const customRate = parseInt(document.getElementById('customFeeRate').value);
            if (customRate && customRate > 0) {
                document.body.removeChild(modal);
                resolve({
                    level: 'Custom',
                    rate: customRate,
                    totalFee: Math.ceil(customRate * txSize),
                    description: 'Custom rate'
                });
            }
        });
        
        modal.querySelector('.fee-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(null);
        });
    });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)'};
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

// ==========================================
// 🔄 AUTO-REFRESH - Atualiza marketplace em tempo real
// ==========================================

/**
 * Inicia auto-refresh do marketplace
 * Verifica se há novas ofertas ou ofertas removidas a cada X segundos
 */
function startAutoRefresh(intervalSeconds = 10) {
    console.log(`🔄 Starting auto-refresh (every ${intervalSeconds}s)...`);
    
    // Limpar interval anterior (se existir)
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Criar novo interval
    autoRefreshInterval = setInterval(async () => {
        try {
            // Apenas atualizar se estiver na tab "Browse Ordinals"
            const browseTab = document.querySelector('[data-tab="browse"]');
            const isOnBrowseTab = browseTab && browseTab.classList.contains('active');
            
            if (!isOnBrowseTab) {
                return; // Não atualizar se não estiver vendo o marketplace
            }
            
            // Buscar ofertas atuais do backend
            const response = await apiRequest('/ordinals?listed=true&limit=50');
            
            if (!response || !response.inscriptions) {
                return;
            }
            
            // Criar hash simples das inscrições listadas (IDs)
            const currentHash = response.inscriptions
                .map(i => i.id)
                .sort()
                .join('|');
            
            // Comparar com hash anterior
            if (lastOffersHash && currentHash !== lastOffersHash) {
                console.log('🔄 Marketplace changed! Reloading...');
                
                // Detectar se alguma inscription foi REMOVIDA (vendida)
                const oldInscriptionIds = lastOffersHash.split('|').filter(id => id);
                const newInscriptionIds = currentHash.split('|').filter(id => id);
                const removedInscriptions = oldInscriptionIds.filter(id => !newInscriptionIds.includes(id));
                
                if (removedInscriptions.length > 0) {
                    console.log('💰 Inscriptions sold:', removedInscriptions);
                    
                    // Remover containers das inscriptions vendidas (animação suave)
                    removedInscriptions.forEach(inscriptionId => {
                        const offerCard = document.querySelector(`.ordinal-card[data-inscription-id="${inscriptionId}"]`);
                        if (offerCard) {
                            offerCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                            offerCard.style.opacity = '0';
                            offerCard.style.transform = 'scale(0.95)';
                            setTimeout(() => offerCard.remove(), 300);
                        }
                    });
                }
                
                // Recarregar lista completa
                setTimeout(() => {
                    loadOrdinals();
                }, 400);
                
                showNotification('🔄 Marketplace updated!', 'info');
            }
            
            // Atualizar hash
            lastOffersHash = currentHash;
            
        } catch (error) {
            console.error('Auto-refresh error:', error);
            // Não mostrar notificação para não incomodar o usuário
        }
    }, intervalSeconds * 1000);
}

/**
 * Para auto-refresh
 */
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        console.log('⏹️  Stopping auto-refresh...');
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ✅ Iniciar auto-refresh quando a página carregar
window.addEventListener('load', () => {
    // Aguardar 5 segundos antes de iniciar (para não sobrecarregar ao carregar)
    setTimeout(() => {
        startAutoRefresh(10); // Atualizar a cada 10 segundos
    }, 5000);
});

// ==========================================
// 🔓 MODAL DE UNLOCK PARA LIKES
// ==========================================
function showUnlockModal() {
    return new Promise((resolve) => {
        // Criar overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        // Criar modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 32px;
            border-radius: 16px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        `;
        
        modal.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 16px;">🔓</div>
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px;">Wallet Locked</h2>
            <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Your KrayWallet is locked. Please click the extension icon 
                <strong>📌 in the browser toolbar</strong> to unlock it, then click "Try Again" below.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="unlock-modal-cancel" style="
                    padding: 12px 24px;
                    border: 2px solid #e5e7eb;
                    background: white;
                    color: #6b7280;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s;
                ">Cancel</button>
                <button id="unlock-modal-retry" style="
                    padding: 12px 24px;
                    border: none;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s;
                ">Try Again</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Hover effects
        const retryBtn = modal.querySelector('#unlock-modal-retry');
        const cancelBtn = modal.querySelector('#unlock-modal-cancel');
        
        retryBtn.onmouseenter = () => retryBtn.style.opacity = '0.9';
        retryBtn.onmouseleave = () => retryBtn.style.opacity = '1';
        
        cancelBtn.onmouseenter = () => {
            cancelBtn.style.background = '#f3f4f6';
            cancelBtn.style.borderColor = '#d1d5db';
        };
        cancelBtn.onmouseleave = () => {
            cancelBtn.style.background = 'white';
            cancelBtn.style.borderColor = '#e5e7eb';
        };
        
        // Event listeners
        retryBtn.onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
        };
        
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
            resolve(false);
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        };
    });
}

