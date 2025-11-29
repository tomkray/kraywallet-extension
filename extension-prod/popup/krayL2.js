/**
 * KRAY SPACE L2 - Extension Integration
 * 
 * Handles all L2 functionality in the extension
 * Completely separate from existing Bitcoin/Runes/Ordinals code
 */

// L2 API Configuration
// Try production first, fallback to localhost for development
const L2_API_URLS = [
    'https://kraywallet-backend.onrender.com/l2',  // Production (Render - integrated)
    'http://localhost:5002'                         // Development (local standalone)
];

let L2_API_URL = L2_API_URLS[0]; // Default to production

// Function to find working L2 API
async function findWorkingL2API() {
    for (const url of L2_API_URLS) {
        try {
            const response = await fetch(`${url}/health`, { 
                method: 'GET',
                signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            if (response.ok) {
                console.log(`✅ L2 API found at: ${url}`);
                L2_API_URL = url;
                return url;
            }
        } catch (e) {
            console.log(`⏭️ L2 API not available at: ${url}`);
        }
    }
    console.warn('⚠️ No L2 API available');
    return null;
}

// L2 State
let l2Account = null;
let l2Balance = null;
let l2Transactions = [];

/**
 * Initialize L2
 */
async function initL2() {
    console.log('\n⚡ Initializing KRAY L2...');

    try {
        // Find working L2 API (production or local)
        await findWorkingL2API();
        
        // Check L2 API connection
        const health = await checkL2Health();

        const statusDot = document.getElementById('l2-status-dot');
        const statusText = document.getElementById('l2-status-text');
        
        if (health) {
            console.log('✅ L2 API connected');
            if (statusDot) statusDot.style.background = '#10b981';
            if (statusText) statusText.textContent = 'Connected';
        } else {
            console.warn('⚠️  L2 API not available');
            if (statusDot) statusDot.style.background = '#f59e0b';
            if (statusText) statusText.textContent = 'Offline';
        }

        // 🔥 Check if we're in L2 mode before loading data with UI update
        const activeNetworkResult = await chrome.storage.local.get(['activeNetwork']);
        const isKrayL2 = activeNetworkResult.activeNetwork === 'kray-l2';
        
        // Load L2 data (only update UI if in L2 mode!)
        await loadL2Data(isKrayL2);

        // Setup L2 listeners
        setupL2Listeners();

    } catch (error) {
        console.error('❌ L2 initialization failed:', error);
        const statusDot = document.getElementById('l2-status-dot');
        const statusText = document.getElementById('l2-status-text');
        if (statusDot) statusDot.style.background = '#ef4444';
        if (statusText) statusText.textContent = 'Error';
    }
}

/**
 * Check L2 API health
 */
async function checkL2Health() {
    try {
        const response = await fetch(`${L2_API_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.status === 'healthy';
    } catch (error) {
        console.error('L2 health check failed:', error);
        return false;
    }
}

/**
 * Load L2 data for current wallet
 * @param {boolean} updateUI - Whether to update the UI (default true)
 */
async function loadL2Data(updateUI = true) {
    try {
        // Get current wallet address
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });

        if (!result || !result.success) {
            console.log('⏭️  No wallet available');
            return;
        }

        const l1Address = result.data.address;
        console.log(`📊 Loading L2 data for ${l1Address}...`);

        // Store address as account identifier
        l2Account = l1Address;

        // Get L2 balance from API
        await updateL2Balance();

        // Get recent transactions
        await updateL2Transactions();

        // Get membership status
        await updateMembershipStatus();

        // Update UI only if requested
        if (updateUI) {
            displayL2Balance();
            displayL2Transactions();
        }

        console.log('✅ L2 data loaded');

    } catch (error) {
        console.error('❌ Error loading L2 data:', error);
    }
}

/**
 * Get or create L2 account
 */
async function getOrCreateL2Account(l1Address) {
    try {
        // Try to get existing account balance
        const response = await fetch(`${L2_API_URL}/account/${l1Address}/balance`);

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ L2 account found with balance: ${data.balance_kray} KRAY`);
            // Store the balance for later use
            l2Balance = data;
            return l1Address; // Use L1 address as account identifier
        }

        // Account doesn't exist or no balance, try to create it
        console.log('📝 Creating L2 account...');
        
        // Get pubkey from wallet for signature verification
        let pubkey = null;
        try {
            const walletInfo = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
            if (walletInfo.success && walletInfo.data.publicKey) {
                pubkey = walletInfo.data.publicKey;
            }
        } catch (e) {
            console.warn('Could not get pubkey, will set on first transaction');
        }

        const createResponse = await fetch(`${L2_API_URL}/account/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                l1_address: l1Address,
                pubkey: pubkey
            })
        });

        if (createResponse.ok) {
            const createData = await createResponse.json();
            console.log(`✅ L2 account created: ${createData.account_id}`);
            return l1Address;
        }
        
        // Even if create fails, return the address (account may exist from deposit)
        console.log('ℹ️ Using L1 address as L2 account identifier');
        return l1Address;

    } catch (error) {
        console.error('❌ Error with L2 account:', error);
        return l1Address; // Return address anyway for balance lookup
    }
}

/**
 * Update L2 balance from API
 */
async function updateL2Balance() {
    console.log(`📡 updateL2Balance called, l2Account: ${l2Account}`);
    
    if (!l2Account) {
        console.warn('⚠️ No l2Account, cannot fetch balance');
        return;
    }

    try {
        const url = `${L2_API_URL}/account/${l2Account}/balance`;
        console.log(`📡 Fetching balance from: ${url}`);
        
        const response = await fetch(url);
        console.log(`📡 Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ Balance fetch failed: ${response.status} - ${errorText}`);
            if (!l2Balance) {
                l2Balance = {
                    balance_credits: '0',
                    balance_kray: '0.000',
                    available_credits: '0'
                };
            }
            return;
        }

        l2Balance = await response.json();
        console.log(`💰 L2 Balance received:`, l2Balance);
        console.log(`💰 L2 Balance: ${l2Balance.balance_kray} KRAY (${l2Balance.balance_credits} credits)`);

    } catch (error) {
        console.error('❌ Error fetching L2 balance:', error);
        if (!l2Balance) {
            l2Balance = {
                balance_credits: '0',
                balance_kray: '0.000',
                available_credits: '0'
            };
        }
    }
}

/**
 * Update L2 transactions
 */
async function updateL2Transactions() {
    if (!l2Account) return;

    try {
        const response = await fetch(`${L2_API_URL}/account/${l2Account}/transactions?limit=10`);

        if (!response.ok) {
            console.warn('⚠️ Transactions fetch failed');
            l2Transactions = [];
            return;
        }

        const data = await response.json();
        l2Transactions = data.transactions || [];

        console.log(`📜 Found ${l2Transactions.length} L2 transactions`);

    } catch (error) {
        console.error('❌ Error fetching L2 transactions:', error);
        l2Transactions = [];
    }
}

/**
 * Update and display membership status
 */
async function updateMembershipStatus() {
    if (!l2Account) return;

    try {
        console.log('🎴 Fetching membership status...');
        const response = await fetch(`${L2_API_URL}/account/${l2Account}/membership`);

        if (!response.ok) {
            console.warn('⚠️ Membership fetch failed, using defaults');
            displayMembershipStatus({ tier: 'none', limits: { freeTxPerDay: 0 }, usage: { dailyUsed: 0 } });
            return;
        }

        const data = await response.json();
        console.log('🎴 Membership data:', data);
        displayMembershipStatus(data);

    } catch (error) {
        console.error('❌ Error fetching membership:', error);
        displayMembershipStatus({ tier: 'none', limits: { freeTxPerDay: 0 }, usage: { dailyUsed: 0 } });
    }
}

/**
 * Display membership status in UI
 */
function displayMembershipStatus(data) {
    const tier = data.membership?.tier || data.tier || 'none';
    const limits = data.limits || { freeTxPerDay: 0, maxTxPerHour: 10, minBalanceToSend: 10 };
    const usage = data.usage || { dailyUsed: 0, dailyRemaining: 0 };

    console.log(`🎴 Displaying membership: ${tier}`);

    // Update badge
    const badge = document.getElementById('l2-membership-badge');
    if (badge) {
        const tierInfo = {
            'black':    { emoji: '🖤', name: 'Black Card', color: '#ffffff', bg: '#1a1a1a' },
            'diamond':  { emoji: '💎', name: 'Diamond', color: '#b9f2ff', bg: '#1a3a4a' },
            'gold':     { emoji: '🥇', name: 'Gold', color: '#ffd700', bg: '#3a3010' },
            'amethyst': { emoji: '💜', name: 'Amethyst', color: '#9966cc', bg: '#2a1a3c' },
            'common':   { emoji: '🪨', name: 'Common', color: '#808080', bg: '#2a2a2a' },
            'none':     { emoji: '👤', name: 'No Card', color: '#888888', bg: '#333333' }
        };
        
        const info = tierInfo[tier] || tierInfo.none;
        badge.textContent = `${info.emoji} ${info.name}`;
        badge.style.background = info.bg;
        badge.style.color = info.color;
        badge.style.border = `1px solid ${info.color}40`;
    }

    // Highlight active card
    const tiers = ['common', 'amethyst', 'gold', 'diamond', 'black'];
    tiers.forEach(t => {
        const card = document.getElementById(`membership-${t}`);
        if (card) {
            if (t === tier) {
                card.style.opacity = '1';
                card.style.transform = 'scale(1.05)';
                card.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.5)';
            } else {
                card.style.opacity = '0.4';
                card.style.transform = 'scale(1)';
                card.style.boxShadow = 'none';
            }
        }
    });

    // Update free TX counter
    const usedEl = document.getElementById('l2-free-tx-used');
    const limitEl = document.getElementById('l2-free-tx-limit');
    const statusEl = document.getElementById('l2-free-tx-status');

    if (usedEl) usedEl.textContent = usage.dailyUsed || 0;
    if (limitEl) limitEl.textContent = limits.freeTxPerDay || 0;
    
    if (statusEl) {
        const remaining = (limits.freeTxPerDay || 0) - (usage.dailyUsed || 0);
        if (tier === 'none') {
            statusEl.textContent = 'Get a membership card!';
            statusEl.style.color = '#888';
        } else if (remaining > 0) {
            statusEl.textContent = `${remaining} free TX remaining`;
            statusEl.style.color = '#10b981';
        } else {
            statusEl.textContent = 'Limit reached - paying 1 KRAY/tx';
            statusEl.style.color = '#f59e0b';
        }
    }
}

/**
 * Display L2 balance in UI
 * 
 * 🔥 SIMPLIFIED: 1:1 mapping with L1 (no credits conversion)
 * Balance = actual KRAY amount (integer, divisibility: 0)
 */
function displayL2Balance() {
    console.log('🎨 Displaying L2 balance...', l2Balance);
    
    // Get KRAY balance (1:1 with L1 - integer, no decimals)
    const krayBalance = l2Balance?.balance_kray || l2Balance?.balance || '0';
    const availableBalance = l2Balance?.available_kray || l2Balance?.available || krayBalance;
    
    // Update L2 balance element if exists
    const l2BalanceKray = document.getElementById('l2-balance-kray');
    if (l2BalanceKray) {
        l2BalanceKray.textContent = krayBalance;
    }
    
    // Update main header balance
    const walletBalance = document.getElementById('wallet-balance');
    const walletBalanceBtc = document.getElementById('wallet-balance-btc');
    
    if (walletBalance) {
        // Show integer KRAY (no decimals - respecting divisibility: 0)
        walletBalance.textContent = `${krayBalance} KRAY`;
        console.log(`✅ Updated wallet-balance: ${krayBalance} KRAY`);
    }
    
    if (walletBalanceBtc) {
        // Show available balance (for spending)
        walletBalanceBtc.textContent = `${availableBalance} available`;
        console.log(`✅ Updated wallet-balance-btc: ${availableBalance} available`);
    }
    
    // Multi-token balances (show if balance > 0, including decimals!)
    const dogBalance = l2Balance?.balance_dog || '0';
    const dogsocialBalance = l2Balance?.balance_dogsocial || '0';
    const radiolaBalance = l2Balance?.balance_radiola || '0';
    
    // Convert to number for comparison (handles decimals correctly)
    const hasDog = parseFloat(dogBalance) > 0 || parseInt(dogBalance) > 0;
    const hasDogsocial = parseFloat(dogsocialBalance) > 0 || parseInt(dogsocialBalance) > 0;
    const hasRadiola = parseFloat(radiolaBalance) > 0 || parseInt(radiolaBalance) > 0;
    
    // Show/hide DOG row
    const dogRow = document.getElementById('l2-dog-row');
    if (dogRow) {
        if (hasDog) {
            dogRow.style.display = 'flex';
            document.getElementById('l2-balance-dog').textContent = parseFloat(dogBalance).toFixed(5);
        } else {
            dogRow.style.display = 'none';
        }
    }
    
    // Show/hide DOGSOCIAL row
    const dogsocialRow = document.getElementById('l2-dogsocial-row');
    if (dogsocialRow) {
        if (hasDogsocial) {
            dogsocialRow.style.display = 'flex';
            document.getElementById('l2-balance-dogsocial').textContent = parseFloat(dogsocialBalance).toFixed(5);
        } else {
            dogsocialRow.style.display = 'none';
        }
    }
    
    // Show/hide RADIOLA row
    const radiolaRow = document.getElementById('l2-radiola-row');
    if (radiolaRow) {
        if (hasRadiola) {
            radiolaRow.style.display = 'flex';
            document.getElementById('l2-balance-radiola').textContent = parseFloat(radiolaBalance).toFixed(5);
        } else {
            radiolaRow.style.display = 'none';
        }
    }
}

/**
 * Display L2 transactions
 */
function displayL2Transactions() {
    const container = document.getElementById('l2-transactions-list');

    if (!container) return;

    if (l2Transactions.length === 0) {
        container.innerHTML = `
            <div class="l2-empty-state" style="padding: 32px 16px; text-align: center; background: var(--color-bg-secondary); border-radius: 10px; border: 1px solid var(--color-border);">
                <span class="l2-empty-icon">⚡</span>
                <p class="l2-empty-text">No L2 transactions yet</p>
                <p class="l2-empty-subtext">Start using Layer 2 for instant transfers</p>
            </div>
        `;
        return;
    }

    container.innerHTML = l2Transactions.map(tx => `
        <div class="l2-transaction-item">
            <div class="l2-transaction-icon">${getTransactionIcon(tx.type)}</div>
            <div class="l2-transaction-info">
                <div class="l2-transaction-label">${getTransactionLabel(tx.type)}</div>
                <div class="l2-transaction-time">${new Date(tx.created_at).toLocaleString()}</div>
            </div>
            <div class="l2-transaction-amount">
                <div class="l2-transaction-amount-value ${tx.from === l2Account ? 'negative' : 'positive'}">
                    ${tx.from === l2Account ? '-' : '+'}${(parseInt(tx.amount) / 1000).toFixed(3)} KRAY
                </div>
                <div class="l2-transaction-gas">Gas: ${(parseInt(tx.gas_fee) / 1000).toFixed(3)}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Get transaction icon based on type
 */
function getTransactionIcon(type) {
    const icons = {
        'transfer': '💸',
        'swap': '🔄',
        'stake': '🔒',
        'unstake': '🔓',
        'list': '🏷️',
        'buy': '🛒'
    };
    return icons[type] || '⚡';
}

/**
 * Get transaction label
 */
function getTransactionLabel(type) {
    const labels = {
        'transfer': 'Transfer',
        'swap': 'Swap',
        'stake': 'Stake',
        'unstake': 'Unstake',
        'list': 'List Item',
        'buy': 'Purchase'
    };
    return labels[type] || type;
}

/**
 * Setup L2 event listeners
 */
function setupL2Listeners() {
    console.log('🎧 Setting up L2 listeners...');

    // Main feature buttons
    document.getElementById('l2-deposit-btn')?.addEventListener('click', showL2DepositScreen);
    document.getElementById('l2-withdraw-btn')?.addEventListener('click', showL2WithdrawScreen);
    document.getElementById('l2-transfer-btn')?.addEventListener('click', showL2TransferScreen);
    document.getElementById('l2-swap-btn')?.addEventListener('click', showL2SwapScreen);
    document.getElementById('l2-marketplace-btn')?.addEventListener('click', showL2MarketplaceScreen);
    document.getElementById('l2-rewards-btn')?.addEventListener('click', showL2RewardsScreen);

    // Back buttons (return to kray-l2 network view)
    document.getElementById('back-from-l2-deposit-btn')?.addEventListener('click', () => {
        if (typeof switchNetwork !== 'undefined') {
            switchNetwork('kray-l2');
        } else {
            console.error('switchNetwork not available');
        }
    });
    
    document.getElementById('back-from-l2-transfer-btn')?.addEventListener('click', () => {
        if (typeof switchNetwork !== 'undefined') {
            switchNetwork('kray-l2');
        }
    });
    
    document.getElementById('back-from-l2-swap-btn')?.addEventListener('click', () => {
        if (typeof switchNetwork !== 'undefined') {
            switchNetwork('kray-l2');
        }
    });
    
    document.getElementById('back-from-l2-withdraw-btn')?.addEventListener('click', () => {
        if (typeof switchNetwork !== 'undefined') {
            switchNetwork('kray-l2');
        }
    });

    console.log('✅ L2 listeners configured');
}

/**
 * Show L2 Deposit Screen
 */
async function showL2DepositScreen() {
    console.log('📥 Opening L2 deposit screen...');
    
    // Call showScreen function
    if (showScreenFn) {
        showScreenFn('l2-deposit');
    } else if (typeof showScreen !== 'undefined') {
        showScreen('l2-deposit');
    } else {
        console.error('showScreen function not available!');
        return;
    }
    
    try {
        // Fetch bridge info from API
        const response = await fetch(`${L2_API_URL}/bridge/info`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch bridge info');
        }
        
        const bridgeInfo = await response.json();
        const bridgeAddress = bridgeInfo.multisig_address || 'bc1p...';
        
        // Display bridge address
        document.getElementById('l2-bridge-address').textContent = bridgeAddress;
        
        // Generate QR code (just address, no bitcoin: prefix to avoid opening wallets)
        const qrContainer = document.getElementById('l2-bridge-qr');
        qrContainer.innerHTML = `
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${bridgeAddress}" 
                 alt="QR Code" 
                 style="width: 180px; height: 180px; border-radius: 8px;" />
        `;
        
        // Copy button functionality
        document.getElementById('copy-bridge-address-btn').onclick = () => {
            navigator.clipboard.writeText(bridgeAddress);
            window.showNotification('✅ Bridge address copied!', 'success');
        };
        
    } catch (error) {
        console.error('❌ Error loading deposit screen:', error);
        window.showNotification('Error loading deposit info', 'error');
    }
}

/**
 * Show L2 Withdraw Screen
 */
async function showL2WithdrawScreen() {
    console.log('📤 Opening L2 withdraw screen...');
    
    // Switch to withdraw screen
    if (showScreenFn) {
        showScreenFn('l2-withdraw');
    } else if (typeof showScreen !== 'undefined') {
        showScreen('l2-withdraw');
    } else {
        console.error('showScreen function not available!');
        return;
    }
    
    // Update balance display
    if (l2Balance) {
        document.getElementById('l2-withdraw-balance').textContent = l2Balance.balance_kray;
    }
    
    // Pre-fill L1 address from wallet
    try {
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        if (result.success) {
            document.getElementById('l2-withdraw-address').value = result.data.address;
        }
    } catch (error) {
        console.error('Error getting wallet address:', error);
    }
    
    // Setup withdraw button
    const amountInput = document.getElementById('l2-withdraw-amount');
    const executeBtn = document.getElementById('l2-withdraw-execute-btn');
    
    amountInput.oninput = () => {
        const amount = parseFloat(amountInput.value);
        executeBtn.disabled = !amount || amount < 1;
    };
    
    executeBtn.onclick = async () => {
        await executeWithdrawal();
    };
}

/**
 * Show L2 Transfer Screen
 */
async function showL2TransferScreen() {
    console.log('⚡ Opening L2 transfer screen...');
    
    // Switch to transfer screen
    if (showScreenFn) {
        showScreenFn('l2-transfer');
    } else if (typeof showScreen !== 'undefined') {
        showScreen('l2-transfer');
    } else {
        console.error('showScreen function not available!');
        return;
    }
    
    // Update balance display
    if (l2Balance) {
        document.getElementById('l2-transfer-balance').textContent = l2Balance.balance_kray;
    }
    
    // Setup transfer button
    const amountInput = document.getElementById('l2-transfer-amount');
    const recipientInput = document.getElementById('l2-transfer-recipient');
    const sendBtn = document.getElementById('l2-transfer-send-btn');
    
    const validateInputs = () => {
        const amount = parseInt(amountInput.value);
        const recipient = recipientInput.value.trim();
        // Accept bc1p (Taproot) addresses for L2 accounts
        const isValidRecipient = recipient.startsWith('bc1p') && recipient.length === 62;
        sendBtn.disabled = !amount || amount < 1 || !isValidRecipient;
    };
    
    amountInput.oninput = validateInputs;
    recipientInput.oninput = validateInputs;
    
    sendBtn.onclick = async () => {
        await executeTransfer();
    };
}

/**
 * Show L2 Swap Screen
 */
async function showL2SwapScreen() {
    console.log('🔄 Opening L2 swap screen...');
    
    // Switch to swap screen
    if (showScreenFn) {
        showScreenFn('l2-swap');
    } else if (typeof showScreen !== 'undefined') {
        showScreen('l2-swap');
    } else {
        console.error('showScreen function not available!');
        return;
    }
    
    // Update balance display
    if (l2Balance) {
        document.getElementById('l2-swap-balance').textContent = l2Balance.balance_kray;
    }
    
    // Setup swap amount input (auto-calculate output)
    const amountInInput = document.getElementById('l2-swap-amount-in');
    const amountOutInput = document.getElementById('l2-swap-amount-out');
    const executeBtn = document.getElementById('l2-swap-execute-btn');
    
    amountInInput.oninput = async () => {
        const amount = parseFloat(amountInInput.value);
        
        if (amount && amount > 0) {
            // Get quote from API
            await getSwapQuote(amount);
            executeBtn.disabled = false;
        } else {
            amountOutInput.value = '';
            executeBtn.disabled = true;
        }
    };
    
    executeBtn.onclick = async () => {
        await executeSwap();
    };
}

/**
 * Sign L2 transaction with user's wallet
 */
async function signL2Transaction(messageData) {
    try {
        console.log('🔐 Signing L2 transaction...');
        
        // Create deterministic message
        const message = [
            messageData.from,
            messageData.to || '',
            messageData.amount.toString(),
            messageData.nonce.toString(),
            messageData.type
        ].join(':');
        
        console.log('   Message:', message.substring(0, 50) + '...');
        
        // Request signature from background script
        const result = await chrome.runtime.sendMessage({
            action: 'signL2Message',
            message: message
        });
        
        if (!result || !result.success) {
            throw new Error(result?.error || 'Failed to sign transaction');
        }
        
        console.log('✅ Transaction signed successfully');
        
        return {
            signature: result.signature,
            pubkey: result.pubkey
        };
        
    } catch (error) {
        console.error('❌ Signing error:', error);
        throw error;
    }
}

/**
 * Execute L2 Transfer (1:1 mapping, integer amounts)
 */
async function executeTransfer() {
    console.log('⚡ Executing L2 transfer...');
    
    const recipient = document.getElementById('l2-transfer-recipient').value.trim();
    const amount = parseInt(document.getElementById('l2-transfer-amount').value);
    
    if (!recipient || !amount) {
        window.showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (amount < 1) {
        window.showNotification('Minimum transfer: 1 KRAY', 'error');
        return;
    }
    
    try {
        // 1:1 mapping - amount in KRAY = amount in credits
        const credits = amount;
        
        // Get current nonce
        const balanceResponse = await fetch(`${L2_API_URL}/account/${l2Account}/balance`);
        const accountData = await balanceResponse.json();
        const nonce = accountData.nonce || 0;
        
        console.log(`   From: ${l2Account}`);
        console.log(`   To: ${recipient}`);
        console.log(`   Amount: ${amount} KRAY`);
        console.log(`   Nonce: ${nonce}`);
        
        // Sign transaction with REAL signature
        const { signature, pubkey } = await signL2Transaction({
            from: l2Account,
            to: recipient,
            amount: credits,
            nonce: nonce,
            type: 'transfer'
        });
        
        console.log(`   Signature: ${signature?.substring(0, 20)}...`);
        console.log(`   Pubkey: ${pubkey?.substring(0, 20)}...`);
        
        const response = await fetch(`${L2_API_URL}/transaction/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from_account: l2Account,
                to_account: recipient,
                amount: credits.toString(),
                signature,
                pubkey,  // Include pubkey for signature verification
                nonce,
                tx_type: 'transfer'
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Transfer failed');
        }
        
        console.log('✅ Transfer successful!', result);
        window.showNotification(`✅ Sent ${amount} KRAY instantly!`, 'success');
        
        // Refresh balance
        await refreshL2Data();
        
        // Go back to L2 content
        window.switchNetwork('kray-l2');
        
    } catch (error) {
        console.error('❌ Transfer error:', error);
        window.showNotification('Transfer failed: ' + error.message, 'error');
    }
}

/**
 * Execute L2 Withdrawal
 */
async function executeWithdrawal() {
    console.log('📤 Executing withdrawal...');
    
    const amount = parseFloat(document.getElementById('l2-withdraw-amount').value);
    const l1Address = document.getElementById('l2-withdraw-address').value.trim();
    
    if (!amount || !l1Address) {
        window.showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (amount < 1) {
        window.showNotification('Minimum withdrawal: 1 KRAY', 'error');
        return;
    }
    
    try {
        // 1:1 mapping - amount in KRAY = amount in credits
        const credits = Math.floor(amount);
        
        // TODO: Sign withdrawal request
        const signature = '0'.repeat(128);
        
        const response = await fetch(`${L2_API_URL}/bridge/withdrawal/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_id: l2Account,
                credits_amount: credits.toString(),
                l1_address: l1Address,
                signature
            })
        });
        
        if (!response.ok) {
            throw new Error('Withdrawal request failed');
        }
        
        const result = await response.json();
        
        console.log('✅ Withdrawal requested!', result);
        window.showNotification(`✅ Withdrawal requested! Wait 24h challenge period.`, 'success');
        
        // Refresh balance
        await refreshL2Data();
        
        // Go back
        window.switchNetwork('kray-l2');
        
    } catch (error) {
        console.error('❌ Withdrawal error:', error);
        window.showNotification('Withdrawal failed: ' + error.message, 'error');
    }
}

/**
 * Get swap quote
 */
async function getSwapQuote(amountIn) {
    try {
        // TODO: Get real pool ID
        const poolId = 'pool_kray_btc';
        const credits = Math.floor(amountIn * 1000);
        
        const response = await fetch(`${L2_API_URL}/defi/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pool_id: poolId,
                token_in: 'KRAY',
                amount_in: credits.toString()
            })
        });
        
        if (response.ok) {
            const quote = await response.json();
            
            // Display quote
            document.getElementById('l2-swap-amount-out').value = (parseInt(quote.amount_out) / 100000000).toFixed(8);
            document.getElementById('l2-swap-price').textContent = `1 KRAY = ${quote.effective_price.toFixed(8)} BTC`;
            document.getElementById('l2-swap-impact').textContent = `${quote.price_impact.toFixed(2)}%`;
        }
    } catch (error) {
        console.error('Error getting quote:', error);
    }
}

/**
 * Execute swap
 */
async function executeSwap() {
    console.log('🔄 Executing swap...');
    
    const amountIn = parseFloat(document.getElementById('l2-swap-amount-in').value);
    const tokenOut = document.getElementById('l2-swap-token-out').value;
    
    if (!amountIn) {
        window.showNotification('Enter amount to swap', 'error');
        return;
    }
    
    try {
        const credits = Math.floor(amountIn * 1000);
        const poolId = `pool_kray_${tokenOut.toLowerCase()}`;
        
        const response = await fetch(`${L2_API_URL}/defi/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pool_id: poolId,
                account_id: l2Account,
                token_in: 'KRAY',
                amount_in: credits.toString(),
                min_amount_out: '0'
            })
        });
        
        if (!response.ok) {
            throw new Error('Swap failed');
        }
        
        const result = await response.json();
        
        console.log('✅ Swap successful!', result);
        window.showNotification(`✅ Swapped ${amountIn} KRAY instantly!`, 'success');
        
        // Refresh
        await refreshL2Data();
        window.switchNetwork('kray-l2');
        
    } catch (error) {
        console.error('❌ Swap error:', error);
        window.showNotification('Swap failed: ' + error.message, 'error');
    }
}

/**
 * Show L2 Marketplace Screen
 */
function showL2MarketplaceScreen() {
    console.log('🏪 Opening L2 marketplace screen...');
    
    showNotification('🏪 L2 Marketplace feature coming soon!', 'info');
    
    // TODO: Implement marketplace screen
}

/**
 * Show L2 Rewards Screen
 */
function showL2RewardsScreen() {
    console.log('🎁 Opening L2 rewards screen...');
    
    showNotification('🎁 L2 Rewards feature coming soon!', 'info');
    
    // TODO: Implement rewards screen
}

/**
 * Refresh L2 data
 */
async function refreshL2Data() {
    console.log('🔄 Refreshing L2 data...');
    
    // Ensure we have the account address
    if (!l2Account) {
        try {
            const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
            if (result && result.success && result.data.address) {
                l2Account = result.data.address;
                console.log(`📍 L2 account set to: ${l2Account}`);
            }
        } catch (e) {
            console.error('❌ Failed to get wallet address:', e);
        }
    }
    
    if (!l2Account) {
        console.warn('⚠️ No L2 account available');
        return;
    }
    
    await updateL2Balance();
    await updateL2Transactions();
    displayL2Balance();
    displayL2Transactions();
    
    console.log('✅ L2 data refreshed');
}

// Make showScreen available in module scope
let showScreenFn = null;

// Function to set showScreen reference
function setShowScreen(fn) {
    showScreenFn = fn;
    console.log('✅ showScreen function registered');
}

// Export functions for use in popup.js
window.krayL2 = {
    initL2,
    refreshL2Data,
    loadL2Data,
    setShowScreen,
    showL2DepositScreen,
    showL2TransferScreen,
    showL2SwapScreen,
    showL2WithdrawScreen
};

console.log('✅ KRAY L2 module loaded');

