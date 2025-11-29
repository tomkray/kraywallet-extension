// ============================================
// KRAY•SPACE - UNIFIED HEADER COMPONENT
// Injeta o MESMO header em TODAS as páginas
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Detectar página atual
    const currentPage = window.location.pathname;
    
    // HTML do header (IDÊNTICO em todas páginas)
    const headerHTML = `
    <nav class="navbar-kray">
        <div class="container-kray">
            <div class="nav-brand-kray">
                <img src="/images/kray-station-logo.png" alt="KRAY SPACE" class="nav-logo-kray">
                <div class="nav-title-kray">
                    <h1>KRAY SPACE</h1>
                    <span>Layer 2 Bitcoin</span>
                </div>
            </div>
            
            <div class="nav-center-kray">
                <a href="/" class="nav-link-kray ${currentPage === '/' ? 'active' : ''}">Home</a>
                <a href="/ordinals.html" class="nav-link-kray ${currentPage.includes('ordinals') ? 'active' : ''}">Ordinals</a>
                <a href="/runes.html" class="nav-link-kray ${currentPage.includes('runes') ? 'active' : ''}">Runes</a>
                <a href="/krayscan.html" class="nav-link-kray ${currentPage.includes('krayscan') ? 'active' : ''}">KrayScan</a>
                <a href="/" class="nav-link-kray ${currentPage.includes('l2') || currentPage === '/' ? 'active' : ''}" style="color: #8b5cf6;">⚡ KRAY L2</a>
            </div>
            
            <div class="nav-right-kray">
                <button id="connectWalletBtn" class="wallet-btn-kray">
                    <span class="wallet-text-kray">Connect Wallet</span>
                </button>
                
                <div id="walletMenuKray" class="wallet-menu-kray" style="display: none;">
                    <div class="wallet-address-kray" id="walletAddressKray"></div>
                    <button class="wallet-disconnect-kray" onclick="disconnectWalletKray()">Disconnect</button>
                </div>
            </div>
        </div>
    </nav>
    
    <!-- Wallet Modal -->
    <div id="walletModalKray" class="modal-kray">
        <div class="modal-content-kray">
            <div class="modal-header-kray">
                <h3>Connect Wallet</h3>
                <button class="modal-close-kray" onclick="closeWalletModalKray()">&times;</button>
            </div>
            
            <div class="wallet-options-kray">
                <button class="wallet-option-kray" onclick="connectKrayWallet()">
                    <img src="/public/images/kraywallet-logo-white.png">
                    <div>
                        <div class="wallet-name-kray">KrayWallet</div>
                        <div class="wallet-desc-kray">Recommended</div>
                    </div>
                </button>
                
                <button class="wallet-option-kray" onclick="connectUnisat()">
                    <img src="/images/unisat.png">
                    <div>
                        <div class="wallet-name-kray">Unisat</div>
                        <div class="wallet-desc-kray">Popular</div>
                    </div>
                </button>
                
                <button class="wallet-option-kray" onclick="connectXverse()">
                    <img src="/images/xverse.png">
                    <div>
                        <div class="wallet-name-kray">Xverse</div>
                        <div class="wallet-desc-kray">Multi-chain</div>
                    </div>
                </button>
            </div>
        </div>
    </div>
    `;
    
    // CSS do header (inline para garantir)
    const headerCSS = `
    <style id="kray-header-styles">
    .navbar-kray {
        background: #000;
        border-bottom: 1px solid #222;
        padding: 1rem 0;
        position: sticky;
        top: 0;
        z-index: 1000;
    }

    .container-kray {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .nav-brand-kray {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .nav-logo-kray {
        width: 64px;
        height: 64px;
        border-radius: 12px;
    }

    .nav-title-kray h1 {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
        letter-spacing: 0.5px;
    }

    .nav-title-kray span {
        font-size: 12px;
        color: #666;
    }

    .nav-center-kray {
        display: flex;
        gap: 2rem;
    }

    .nav-link-kray {
        color: #999;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: color 0.2s;
    }

    .nav-link-kray:hover,
    .nav-link-kray.active {
        color: #fff;
    }

    .nav-right-kray {
        position: relative;
    }

    .wallet-btn-kray {
        background: #fff;
        color: #000;
        border: none;
        padding: 0.625rem 1.5rem;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .wallet-btn-kray:hover {
        background: #f0f0f0;
    }

    /* Wallet Menu */
    .wallet-menu-kray {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        background: #111;
        border: 1px solid #333;
        border-radius: 8px;
        min-width: 280px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        z-index: 10001;
    }

    .wallet-address-kray {
        padding: 1rem;
        font-size: 12px;
        color: #999;
        font-family: monospace;
        word-break: break-all;
        border-bottom: 1px solid #222;
    }

    .wallet-disconnect-kray {
        width: 100%;
        background: none;
        border: none;
        color: #f00;
        text-align: left;
        cursor: pointer;
        font-weight: 500;
        padding: 0.875rem 1rem;
        font-size: 14px;
    }

    .wallet-disconnect-kray:hover {
        background: #1a1a1a;
    }

    /* Wallet Modal */
    .modal-kray {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 10000;
        align-items: center;
        justify-content: center;
    }

    .modal-kray.active {
        display: flex !important;
    }

    .modal-content-kray {
        background: #111;
        border: 1px solid #333;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
    }

    .modal-header-kray {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid #222;
    }

    .modal-header-kray h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
    }

    .modal-close-kray {
        background: none;
        border: none;
        color: #999;
        font-size: 32px;
        cursor: pointer;
        line-height: 1;
        padding: 0;
    }

    .modal-close-kray:hover {
        color: #fff;
    }

    .wallet-options-kray {
        padding: 1rem;
    }

    .wallet-option-kray {
        display: flex;
        align-items: center;
        gap: 1rem;
        width: 100%;
        background: #1a1a1a;
        border: 1px solid #222;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .wallet-option-kray:last-child {
        margin-bottom: 0;
    }

    .wallet-option-kray:hover {
        border-color: #fff;
        background: #222;
    }

    .wallet-option-kray img {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        flex-shrink: 0;
    }

    .wallet-name-kray {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
    }

    .wallet-desc-kray {
        font-size: 13px;
        color: #666;
    }

    @media (max-width: 768px) {
        .nav-center-kray {
            display: none;
        }
    }
    </style>
    `;
    
    // Injetar CSS primeiro
    document.head.insertAdjacentHTML('beforeend', headerCSS);
    
    // Injetar header no início do body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    
    // Setup wallet connection
    setupWalletConnection();
});

// ============================================
// WALLET CONNECTION (PADRÃO)
// ============================================
function setupWalletConnection() {
    const btn = document.getElementById('connectWalletBtn');
    
    if (!btn) return;
    
    btn.addEventListener('click', function() {
        const savedAddress = localStorage.getItem('walletAddress');
        
        if (savedAddress) {
            // Já conectado - toggle menu
            const menu = document.getElementById('walletMenuKray');
            if (menu) {
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            }
        } else {
            // Não conectado - abrir modal
            const modal = document.getElementById('walletModalKray');
            if (modal) {
                modal.classList.add('active');
            } else {
                console.error('Modal not found!');
                alert('Error: Wallet modal not loaded. Please refresh the page.');
            }
        }
    });
    
    // Restaurar conexão
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
        document.querySelector('.wallet-text-kray').textContent = savedAddress.substring(0, 8) + '...';
        document.getElementById('walletAddressKray').textContent = savedAddress;
    }
    
    // Close menu on outside click
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('walletMenuKray');
        const btn = document.getElementById('connectWalletBtn');
        
        if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
}

function closeWalletModalKray() {
    const modal = document.getElementById('walletModalKray');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close on outside click (com delay para garantir que modal existe)
setTimeout(function() {
    const modal = document.getElementById('walletModalKray');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeWalletModalKray();
            }
        });
    }
}, 100);

// ============================================
// CONNECT KRAYWALLET (padrão da extension)
// ============================================
async function connectKrayWallet() {
    try {
        if (typeof window.krayWallet === 'undefined') {
            alert('KrayWallet extension not installed!\n\nPlease install from Chrome Web Store');
            window.open('https://chrome.google.com/webstore', '_blank');
            return;
        }

        console.log('🔗 Connecting KrayWallet...');
        
        // Request connection (isso abre popup se não estiver unlocked)
        const accounts = await window.krayWallet.requestAccounts();
        
        console.log('📦 Accounts received:', accounts);
        
        // Validar resposta
        if (!accounts) {
            throw new Error('No response from wallet');
        }
        
        if (Array.isArray(accounts) && accounts.length === 0) {
            throw new Error('Wallet is locked. Please unlock your KrayWallet extension first!');
        }
        
        if (!accounts[0]) {
            throw new Error('No account available');
        }
        
        const address = accounts[0];
        console.log('✅ Connected to address:', address);
        
        // Validar que é um endereço Bitcoin válido
        if (!address || !address.startsWith('bc1')) {
            throw new Error('Invalid Bitcoin address received');
        }
        
        // Save to localStorage
        localStorage.setItem('connectedWallet', 'kraywallet');
        localStorage.setItem('walletAddress', address);
        
        // Update UI (com validação)
        const textEl = document.querySelector('.wallet-text-kray');
        const addressEl = document.getElementById('walletAddressKray');
        
        if (textEl) {
            textEl.textContent = address.substring(0, 8) + '...';
        }
        
        if (addressEl) {
            addressEl.textContent = address;
        }
        
        // Close modal
        closeWalletModalKray();
        
        // Save to backend dashboard
        await saveToBackend(address, 'kraywallet');
        
        // Mostrar confirmação
        console.log('✅ Connection complete!');
        console.log('   Address saved:', address);
        
    } catch (error) {
        console.error('❌ Error connecting KrayWallet:', error);
        
        // Mensagem mais clara para o usuário
        if (error.message.includes('locked')) {
            alert('⚠️  Your KrayWallet is locked!\n\nPlease unlock your wallet extension and try again.');
        } else if (error.message.includes('rejected')) {
            alert('❌ Connection rejected by wallet');
        } else {
            alert('❌ Failed to connect: ' + error.message);
        }
    }
}

async function connectUnisat() {
    try {
        if (typeof window.unisat === 'undefined') {
            alert('Unisat wallet not installed!');
            return;
        }

        console.log('🔗 Connecting Unisat...');
        
        const accounts = await window.unisat.requestAccounts();
        
        if (!accounts || !accounts[0]) {
            throw new Error('No accounts returned');
        }
        
        const address = accounts[0];
        console.log('✅ Connected:', address);
        
        localStorage.setItem('connectedWallet', 'unisat');
        localStorage.setItem('walletAddress', address);
        
        const textEl = document.querySelector('.wallet-text-kray');
        const addressEl = document.getElementById('walletAddressKray');
        
        if (textEl) textEl.textContent = address.substring(0, 8) + '...';
        if (addressEl) addressEl.textContent = address;
        
        closeWalletModalKray();
        await saveToBackend(address, 'unisat');
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Failed to connect: ' + error.message);
    }
}

async function connectXverse() {
    try {
        if (typeof window.BitcoinProvider === 'undefined') {
            alert('Xverse wallet not installed!');
            return;
        }

        console.log('🔗 Connecting Xverse...');
        
        const response = await window.BitcoinProvider.connect();
        
        if (!response || !response.addresses || !response.addresses[0]) {
            throw new Error('No address returned');
        }
        
        const address = response.addresses[0].address;
        console.log('✅ Connected:', address);
        
        localStorage.setItem('connectedWallet', 'xverse');
        localStorage.setItem('walletAddress', address);
        
        const textEl = document.querySelector('.wallet-text-kray');
        const addressEl = document.getElementById('walletAddressKray');
        
        if (textEl) textEl.textContent = address.substring(0, 8) + '...';
        if (addressEl) addressEl.textContent = address;
        
        closeWalletModalKray();
        await saveToBackend(address, 'xverse');
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Failed to connect: ' + error.message);
    }
}

function disconnectWalletKray() {
    localStorage.removeItem('connectedWallet');
    localStorage.removeItem('walletAddress');
    
    const menu = document.getElementById('walletMenuKray');
    const textEl = document.querySelector('.wallet-text-kray');
    const addressEl = document.getElementById('walletAddressKray');
    
    if (menu) menu.style.display = 'none';
    if (textEl) textEl.textContent = 'Connect Wallet';
    if (addressEl) addressEl.textContent = '';
    
    console.log('✅ Wallet disconnected');
}

async function saveToBackend(address, walletType) {
    try {
        await fetch('/api/dashboard/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, walletType, timestamp: Date.now() })
        });
    } catch (e) {
        console.warn('Backend save failed:', e);
    }
}

