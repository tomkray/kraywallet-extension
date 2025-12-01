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
let l2Membership = null;  // Current membership status
let l2CurrentFee = 1;     // Default fee (no membership)
let currentL2Balance = 0; // Current balance as integer (for withdrawal/transfer)

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
        
        // Start auto-refresh for pending withdrawals
        startPendingWithdrawalsRefresh();

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

        // Get pending withdrawals
        await updatePendingWithdrawals();

        // Get membership status
        await updateMembershipStatus();

        // Update UI only if requested
        if (updateUI) {
            displayL2Balance();
            displayL2Transactions();
            displayPendingWithdrawals();
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
        
        // Update currentL2Balance (integer for withdrawal/transfer)
        currentL2Balance = parseInt(l2Balance.balance_credits || l2Balance.balance_kray || '0');

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
 * Update L2 transactions (including bridge deposits and withdrawals)
 */
async function updateL2Transactions() {
    if (!l2Account) return;

    try {
        // Fetch regular L2 transactions
        const txResponse = await fetch(`${L2_API_URL}/account/${l2Account}/transactions?limit=10`);
        let regularTxs = [];
        
        if (txResponse.ok) {
            const txData = await txResponse.json();
            const myAccountId = txData.account_id; // Internal account ID (acc_...)
            regularTxs = (txData.transactions || []).map(tx => ({
                ...tx,
                type: tx.type || 'transfer',
                _isSender: tx.from === myAccountId // Compare with internal ID
            }));
        }

        // Fetch bridge deposits
        let deposits = [];
        try {
            const depResponse = await fetch(`${L2_API_URL}/bridge/deposits/${l2Account}`);
            if (depResponse.ok) {
                const depData = await depResponse.json();
                deposits = (depData.deposits || []).map(d => ({
                    id: d.id,
                    type: 'deposit',
                    amount: d.credits_minted || d.amount_l1,
                    gas_fee: 0,
                    from: 'L1 Bitcoin',
                    to: l2Account,
                    status: d.status,
                    l1_txid: d.l1_txid,
                    created_at: d.created_at
                }));
            }
        } catch (e) {
            console.warn('Could not fetch deposits:', e);
        }

        // Fetch bridge withdrawals (ALL statuses)
        let withdrawals = [];
        try {
            const wdResponse = await fetch(`${L2_API_URL}/bridge/withdrawals/${l2Account}`);
            if (wdResponse.ok) {
                const wdData = await wdResponse.json();
                withdrawals = (wdData.withdrawals || []).map(w => ({
                    id: w.id,
                    type: 'withdrawal',
                    amount: w.credits_burned || w.amount_l1,
                    gas_fee: w.l2_fee || 0,
                    from: l2Account,
                    to: w.l1_address,
                    status: w.status,
                    display_status: w.display_status,
                    l1_txid: w.l1_txid,
                    challenge_deadline: w.challenge_deadline,
                    created_at: w.created_at,
                    completed_at: w.completed_at
                }));
            }
        } catch (e) {
            console.warn('Could not fetch withdrawals:', e);
        }

        // Combine all transactions
        const allTxs = [...regularTxs, ...deposits, ...withdrawals];
        
        // Sort by created_at (newest first)
        allTxs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Take top 15
        l2Transactions = allTxs.slice(0, 15);

        console.log(`📜 Found ${l2Transactions.length} L2 txs (${regularTxs.length} regular, ${deposits.length} deposits, ${withdrawals.length} withdrawals)`);

    } catch (error) {
        console.error('❌ Error fetching L2 transactions:', error);
        l2Transactions = [];
    }
}

// Pending withdrawals cache
let pendingWithdrawals = [];

/**
 * Fetch and display pending withdrawals
 */
async function updatePendingWithdrawals() {
    if (!l2Account) return;
    
    try {
        const response = await fetch(`${L2_API_URL}/bridge/withdrawals/${l2Account}`);
        
        if (!response.ok) {
            pendingWithdrawals = [];
            return;
        }
        
        const data = await response.json();
        pendingWithdrawals = (data.withdrawals || []).filter(w => 
            w.status === 'pending' || 
            w.status === 'pending_user_signature' || 
            w.status === 'challenge_period'
        );
        
        console.log(`⏳ Found ${pendingWithdrawals.length} pending withdrawals`);
        
        displayPendingWithdrawals();
        
    } catch (error) {
        console.warn('Could not fetch pending withdrawals:', error);
        pendingWithdrawals = [];
    }
}

/**
 * Display pending withdrawals in UI
 */
function displayPendingWithdrawals() {
    const section = document.getElementById('l2-pending-section');
    const list = document.getElementById('l2-pending-list');
    
    if (!section || !list) return;
    
    if (pendingWithdrawals.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    list.innerHTML = pendingWithdrawals.map(w => {
        const challengeEnd = new Date(w.challenge_deadline);
        const now = new Date();
        const timeRemaining = challengeEnd - now;
        const hoursRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));
        const minutesRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60)));
        
        let timeText, statusColor, statusIcon, statusText;
        
        if (w.status === 'pending_user_signature') {
            statusIcon = '✍️';
            statusText = 'Awaiting Signature';
            statusColor = '#f59e0b';
            timeText = 'Sign to continue';
        } else if (w.status === 'completed' && w.l1_txid) {
            statusIcon = '📡';
            statusText = 'Broadcast';
            statusColor = '#10b981';
            timeText = 'Awaiting confirmation';
        } else if (timeRemaining > 0) {
            statusIcon = '⏳';
            statusText = 'Challenge Period';
            statusColor = '#f59e0b';
            if (hoursRemaining > 1) {
                timeText = `${hoursRemaining}h remaining`;
            } else {
                timeText = `${minutesRemaining}m remaining`;
            }
        } else {
            statusIcon = '🚀';
            statusText = 'Processing';
            statusColor = '#10b981';
            timeText = 'Broadcasting soon...';
        }
        
        // Calculate progress (0-100%)
        const totalChallenge = 24 * 60 * 60 * 1000; // 24h in ms
        const elapsed = totalChallenge - timeRemaining;
        const progress = Math.min(100, Math.max(0, (elapsed / totalChallenge) * 100));
        
        // Links section
        const krayScanL2Link = `https://kraywallet-backend.onrender.com/krayscan.html?l2tx=${w.id}`;
        const mempoolLink = w.l1_txid ? `https://mempool.space/tx/${w.l1_txid}` : null;
        
        return `
            <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(139, 92, 246, 0.05)); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 14px; cursor: pointer;" onclick="window.open('${krayScanL2Link}', '_blank')">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">${statusIcon}</span>
                        <span style="font-size: 12px; color: ${statusColor}; font-weight: 600;">${statusText}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-tertiary);">${timeText}</div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${parseInt(w.amount_l1 || w.credits_burned).toLocaleString()} ▽</div>
                        <div style="font-size: 10px; color: var(--color-text-tertiary);">→ ${w.l1_address?.substring(0, 12)}...${w.l1_address?.substring(54)}</div>
                    </div>
                    <img src="../images/bitcoin.png" style="width: 28px; height: 28px; opacity: 0.7;" alt="L1">
                </div>
                
                <!-- Progress Bar -->
                <div style="background: rgba(0,0,0,0.3); border-radius: 4px; height: 6px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #f59e0b, #10b981); height: 100%; width: ${progress}%; transition: width 1s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 9px; color: var(--color-text-tertiary);">
                    <span>Requested</span>
                    <span>Challenge</span>
                    <span>Complete</span>
                </div>
                
                <!-- Links -->
                <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: center;" onclick="event.stopPropagation()">
                    <a href="${krayScanL2Link}" target="_blank" style="display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); border-radius: 6px; font-size: 10px; color: #a78bfa; text-decoration: none;">
                        <img src="../images/mobile-app-icon.png" style="width: 12px; height: 12px; border-radius: 2px;">
                        KrayScan L2 ↗
                    </a>
                    ${mempoolLink ? `
                    <a href="${mempoolLink}" target="_blank" style="display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: rgba(255,107,53,0.15); border: 1px solid rgba(255,107,53,0.3); border-radius: 6px; font-size: 10px; color: #ff6b35; text-decoration: none;">
                        <img src="../images/bitcoin.png" style="width: 12px; height: 12px;">
                        Mempool ↗
                    </a>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Calculate time remaining for withdrawal
 */
function getWithdrawalTimeRemaining(challengeDeadline) {
    const end = new Date(challengeDeadline);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return { text: 'Ready!', progress: 100 };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    const totalMs = 24 * 60 * 60 * 1000;
    const progress = ((totalMs - diff) / totalMs) * 100;
    
    if (hours > 0) {
        return { text: `${hours}h ${minutes}m`, progress };
    }
    return { text: `${minutes}m`, progress };
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
    
    // Store membership and calculate current fee
    l2Membership = { tier, limits, usage };
    const remaining = (limits.freeTxPerDay || 0) - (usage.dailyUsed || 0);
    
    // Fee is FREE if has remaining free TX, otherwise 1 KRAY
    if (tier !== 'none' && remaining > 0) {
        l2CurrentFee = 0;  // FREE!
    } else {
        l2CurrentFee = 1;  // Pay 1 KRAY
    }
    
    console.log(`💰 Current transfer fee: ${l2CurrentFee} KRAY (tier: ${tier}, remaining: ${remaining})`);
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

    container.innerHTML = l2Transactions.map(tx => {
        // 1:1 mapping - no division, KRAY is integer (divisibility: 0)
        const amount = parseInt(tx.amount) || 0;
        const gasFee = parseInt(tx.gas_fee) || 0;
        // Determine if sent or received based on tx type
        let isSent = false;
        if (tx.type === 'deposit') {
            isSent = false;  // Deposits are always received
        } else if (tx.type === 'withdrawal') {
            isSent = true;   // Withdrawals are always sent
        } else {
            // Use _isSender flag set during fetch (compares with internal account ID)
            isSent = tx._isSender === true;
        }
        const txId = tx.id || tx.tx_hash;
        
        // Determine links
        const krayScanL2Link = `https://kraywallet-backend.onrender.com/krayscan.html?l2tx=${txId}`;
        const mempoolLink = tx.l1_txid ? `https://mempool.space/tx/${tx.l1_txid}` : null;
        
        // Layer badge
        let layerBadge = '';
        if (tx.type === 'deposit') {
            layerBadge = '<span style="font-size:8px;padding:2px 6px;background:rgba(255,107,53,0.15);border:1px solid rgba(255,107,53,0.3);border-radius:4px;color:#ff6b35;">L1→L2</span>';
        } else if (tx.type === 'withdrawal') {
            layerBadge = '<span style="font-size:8px;padding:2px 6px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:4px;color:#10b981;">L2→L1</span>';
        } else if (tx.type === 'refund') {
            layerBadge = '<span style="font-size:8px;padding:2px 6px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:4px;color:#a78bfa;">REFUND</span>';
        } else {
            layerBadge = '<span style="font-size:8px;padding:2px 6px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:4px;color:#a78bfa;">L2 ⚡</span>';
        }
        
        // Status badge for withdrawals
        let statusBadge = '';
        if (tx.type === 'withdrawal' && tx.status) {
            if (tx.status === 'completed' && tx.l1_txid) {
                statusBadge = '<span style="font-size:8px;padding:2px 6px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:4px;color:#10b981;">📡 Broadcast</span>';
            } else if (tx.status === 'failed') {
                statusBadge = '<span style="font-size:8px;padding:2px 6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:4px;color:#ef4444;">❌ Failed</span>';
            } else if (tx.status === 'challenge_period') {
                statusBadge = '<span style="font-size:8px;padding:2px 6px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);border-radius:4px;color:#fbbf24;">⏳ Pending</span>';
            }
        }
        
        return `
        <div class="l2-transaction-item" style="cursor:pointer;" onclick="window.open('${krayScanL2Link}', '_blank')">
            <div class="l2-transaction-icon">${getTransactionIcon(tx.type)}</div>
            <div class="l2-transaction-info">
                <div class="l2-transaction-label" style="display:flex;align-items:center;gap:6px;">
                    ${getTransactionLabel(tx.type)}
                    ${layerBadge}
                    ${statusBadge}
                </div>
                <div class="l2-transaction-time">${new Date(tx.created_at).toLocaleString()}</div>
                ${mempoolLink ? `
                <div style="margin-top:4px;" onclick="event.stopPropagation()">
                    <a href="${mempoolLink}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(255,107,53,0.15);border:1px solid rgba(255,107,53,0.3);border-radius:4px;font-size:9px;color:#ff6b35;text-decoration:none;">
                        <img src="../images/bitcoin.png" style="width:10px;height:10px;">
                        Mempool ↗
                    </a>
                </div>` : ''}
            </div>
            <div class="l2-transaction-amount">
                <div class="l2-transaction-amount-value ${isSent ? 'negative' : 'positive'}">
                    ${isSent ? '-' : '+'}${amount} ▽
                </div>
                <div class="l2-transaction-gas">${gasFee === 0 ? 'FREE ⚡' : `Gas: ${gasFee} KRAY`}</div>
            </div>
        </div>
    `}).join('');
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

    // Setup L2 transfer confirmation listeners
    setupL2ConfirmListeners();
    
    // Setup L2 withdrawal confirmation listeners
    setupL2WithdrawConfirmListeners();

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
 * 
 * 🔒 SECURITY: Withdrawal ALWAYS goes to user's own address
 *    This prevents phishing, hacking, and user errors
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
    updateWithdrawBalance();
    
    // 🔒 SECURITY: Always use user's own address (cannot be changed)
    try {
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        if (result.success) {
            const addressDisplay = document.getElementById('l2-withdraw-address');
            if (addressDisplay) {
                addressDisplay.textContent = result.data.address;
            }
            
            // Also update BTC balance
            userBtcBalance = result.data.balance?.total || 0;
            const btcBalanceEl = document.getElementById('l2-withdraw-btc-balance');
            if (btcBalanceEl) {
                btcBalanceEl.textContent = userBtcBalance.toLocaleString();
            }
        }
    } catch (error) {
        console.error('Error getting wallet address:', error);
    }
    
    // Fetch current mempool fees
    await fetchMempoolFees();
    updateFeeDisplay();
    
    // Setup fee rate buttons (using event listeners instead of inline onclick)
    ['low', 'medium', 'high'].forEach(rate => {
        const btn = document.getElementById(`fee-btn-${rate}`);
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🔘 Fee button clicked: ${rate}`);
                window.selectFeeRate(rate);
            };
        }
    });
    
    // Select medium fee by default
    selectedFeeRate = 'medium';
    window.selectFeeRate('medium');
    
    // Setup MAX button
    const maxBtn = document.getElementById('l2-withdraw-max-btn');
    if (maxBtn) {
        maxBtn.onclick = () => {
            const amountInput = document.getElementById('l2-withdraw-amount');
            if (amountInput && currentL2Balance > 0) {
                // Account for L2 fee when using MAX
                const l2FeeInfo = getWithdrawalL2Fee();
                const maxAmount = Math.max(1, currentL2Balance);
                amountInput.value = maxAmount;
                updateWithdrawPreview();
            }
        };
    }
    
    // Setup amount input
    const amountInput = document.getElementById('l2-withdraw-amount');
    if (amountInput) {
        amountInput.value = '';
        amountInput.oninput = updateWithdrawPreview;
    }
    
    // Setup execute button
    const executeBtn = document.getElementById('l2-withdraw-execute-btn');
    if (executeBtn) {
        executeBtn.onclick = showL2WithdrawConfirm;
    }
    
    // Initial preview update
    updateWithdrawPreview();
}

/**
 * Current selected token for transfer
 */
let selectedTransferToken = 'KRAY';
let currentTokenBalance = 0;

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
    
    // Update KRAY balance dynamically
    await updateTransferTokenBalances();
    
    // Setup token selection
    setupTokenSelection();
    
    // Update fee display based on membership
    updateTransferFeeDisplay();
    
    // Setup membership link to go back to home
    const membershipLink = document.getElementById('l2-membership-link');
    if (membershipLink) {
        membershipLink.onclick = (e) => {
            e.preventDefault();
            // Go back to wallet home screen
            if (showScreenFn) {
                showScreenFn('wallet');
            } else if (typeof showScreen !== 'undefined') {
                showScreen('wallet');
            }
            // Scroll to membership section (if visible)
            setTimeout(() => {
                const membershipSection = document.getElementById('l2-membership-section');
                if (membershipSection) {
                    membershipSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        };
    }
    
    // Setup MAX button
    const maxBtn = document.getElementById('l2-transfer-max-btn');
    if (maxBtn) {
        maxBtn.onclick = () => {
            const amountInput = document.getElementById('l2-transfer-amount');
            amountInput.value = currentTokenBalance;
            amountInput.dispatchEvent(new Event('input'));
        };
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
        const hasBalance = amount <= currentTokenBalance;
        sendBtn.disabled = !amount || amount < 1 || !isValidRecipient || !hasBalance;
        
        // Show warning if exceeds balance
        if (amount > currentTokenBalance && currentTokenBalance > 0) {
            sendBtn.textContent = '⚠️ Insufficient Balance';
        } else {
            sendBtn.textContent = '⚡ Send Instantly';
        }
    };
    
    amountInput.oninput = validateInputs;
    recipientInput.oninput = validateInputs;
    
    // Send button shows confirmation screen
    sendBtn.onclick = () => {
        showL2TransferConfirm();
    };
}

/**
 * Setup L2 Transfer Confirmation listeners
 */
function setupL2ConfirmListeners() {
    // Back button
    document.getElementById('back-from-l2-confirm-btn')?.addEventListener('click', () => {
        if (showScreenFn) {
            showScreenFn('l2-transfer');
        }
    });
    
    // Cancel button
    document.getElementById('l2-confirm-cancel-btn')?.addEventListener('click', () => {
        pendingL2Transfer = null;
        if (showScreenFn) {
            showScreenFn('l2-transfer');
        }
    });
    
    // Sign & Send button
    document.getElementById('l2-confirm-sign-btn')?.addEventListener('click', async () => {
        await executeTransferWithPassword();
    });
    
    // Enter key on password field
    document.getElementById('l2-confirm-password')?.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await executeTransferWithPassword();
        }
    });
    
    console.log('✅ L2 confirmation listeners configured');
}

/**
 * Update token balances in transfer screen
 */
async function updateTransferTokenBalances() {
    console.log('💰 Updating transfer token balances...');
    
    // Update KRAY balance
    const krayBalanceEl = document.getElementById('l2-token-balance-KRAY');
    if (krayBalanceEl) {
        if (l2Balance && l2Balance.balance) {
            const balance = parseInt(l2Balance.balance) || 0;
            krayBalanceEl.textContent = balance.toLocaleString();
            currentTokenBalance = balance;
        } else if (l2Balance && l2Balance.balance_credits) {
            const balance = parseInt(l2Balance.balance_credits) || 0;
            krayBalanceEl.textContent = balance.toLocaleString();
            currentTokenBalance = balance;
        } else {
            krayBalanceEl.textContent = '0';
            currentTokenBalance = 0;
        }
    }
    
    // TODO: In the future, fetch other L2 token balances from API
    // For now, only KRAY is supported on L2
}

/**
 * Setup token selection in transfer screen
 */
function setupTokenSelection() {
    const tokenItems = document.querySelectorAll('.l2-token-item');
    
    tokenItems.forEach(item => {
        item.onclick = () => {
            // Remove selected from all
            tokenItems.forEach(t => {
                t.classList.remove('selected');
                t.style.borderColor = 'var(--color-border)';
            });
            
            // Select this one
            item.classList.add('selected');
            item.style.borderColor = '#10b981';
            
            // Update hidden input
            const token = item.dataset.token;
            selectedTransferToken = token;
            document.getElementById('l2-transfer-token').value = token;
            document.getElementById('l2-transfer-token-symbol').textContent = token;
            
            // Update current balance
            const balanceEl = document.getElementById(`l2-token-balance-${token}`);
            if (balanceEl) {
                currentTokenBalance = parseInt(balanceEl.textContent.replace(/,/g, '')) || 0;
            }
            
            // Re-validate
            const amountInput = document.getElementById('l2-transfer-amount');
            amountInput.dispatchEvent(new Event('input'));
            
            console.log(`🎯 Selected token: ${token}, Balance: ${currentTokenBalance}`);
        };
    });
}

/**
 * Update transfer fee display based on membership status
 */
function updateTransferFeeDisplay() {
    const feeDisplay = document.getElementById('l2-transfer-fee-display');
    const feeHint = document.getElementById('l2-transfer-fee-hint');
    
    if (!feeDisplay) return;
    
    if (l2CurrentFee === 0) {
        // FREE - has membership with remaining free TX
        feeDisplay.textContent = 'FREE ⚡';
        feeDisplay.style.color = '#10b981';
        
        const remaining = l2Membership?.usage ? 
            (l2Membership.limits.freeTxPerDay - l2Membership.usage.dailyUsed) : 0;
        
        if (feeHint) {
            feeHint.innerHTML = `<span style="color: #10b981;">✨ ${remaining} free transfers remaining today</span>`;
        }
    } else {
        // Paying 1 KRAY
        feeDisplay.textContent = '1 KRAY';
        feeDisplay.style.color = '#fbbf24';
        
        if (feeHint) {
            if (l2Membership?.tier && l2Membership.tier !== 'none') {
                feeHint.innerHTML = `<span style="color: #f59e0b;">⚠️ Daily limit reached - paying 1 KRAY</span>`;
            } else {
                feeHint.innerHTML = `Get a <a href="#" id="l2-membership-link" style="color: #10b981; cursor: pointer;">Membership Card</a> for FREE transfers!`;
                // Re-setup the link listener
                const link = document.getElementById('l2-membership-link');
                if (link) {
                    link.onclick = (e) => {
                        e.preventDefault();
                        if (showScreenFn) showScreenFn('wallet');
                        else if (typeof showScreen !== 'undefined') showScreen('wallet');
                    };
                }
            }
        }
    }
    
    console.log(`💰 Fee display updated: ${l2CurrentFee === 0 ? 'FREE' : '1 KRAY'}`);
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

// NOTE: signL2Transaction removed - use signL2TransactionWithPassword instead
// All L2 operations now require password confirmation for security

// Pending L2 transfer data
let pendingL2Transfer = null;

/**
 * Show L2 Transfer Confirmation Screen
 * Called when user clicks "Send Instantly"
 */
function showL2TransferConfirm() {
    console.log('⚡ Showing L2 transfer confirmation...');
    
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
    
    // Store pending transfer data
    pendingL2Transfer = {
        recipient,
        amount,
        token: selectedTransferToken
    };
    
    // Update confirmation screen
    document.getElementById('l2-confirm-amount').textContent = `${amount} ▽`;
    document.getElementById('l2-confirm-recipient').textContent = 
        recipient.substring(0, 12) + '...' + recipient.substring(recipient.length - 8);
    
    // Update fee display
    const confirmFee = document.getElementById('l2-confirm-fee');
    if (confirmFee) {
        if (l2CurrentFee === 0) {
            confirmFee.textContent = 'FREE ⚡';
            confirmFee.style.color = '#10b981';
        } else {
            confirmFee.textContent = `${l2CurrentFee} KRAY`;
            confirmFee.style.color = '#fbbf24';
        }
    }
    
    // Clear password field
    const passwordInput = document.getElementById('l2-confirm-password');
    if (passwordInput) passwordInput.value = '';
    
    // Show confirmation screen
    if (showScreenFn) {
        showScreenFn('l2-transfer-confirm');
    } else if (typeof showScreen !== 'undefined') {
        showScreen('l2-transfer-confirm');
    }
    
    // Focus password input
    setTimeout(() => {
        document.getElementById('l2-confirm-password')?.focus();
    }, 100);
}

/**
 * Execute L2 Transfer with password (called from confirmation screen)
 */
async function executeTransferWithPassword() {
    console.log('⚡ Executing L2 transfer with password...');
    
    const password = document.getElementById('l2-confirm-password').value;
    
    if (!password) {
        window.showNotification('Please enter your password', 'error');
        return;
    }
    
    if (!pendingL2Transfer) {
        window.showNotification('No pending transfer', 'error');
        return;
    }
    
    const { recipient, amount } = pendingL2Transfer;
    
    try {
        // Show loading
        const signBtn = document.getElementById('l2-confirm-sign-btn');
        if (signBtn) {
            signBtn.disabled = true;
            signBtn.textContent = '⏳ Signing...';
        }
        
        // 1:1 mapping - amount in KRAY = amount in credits
        const credits = amount;
        
        // Get current nonce
        const balanceResponse = await fetch(`${L2_API_URL}/account/${l2Account}/balance`);
        const accountData = await balanceResponse.json();
        const nonce = accountData.nonce || 0;
        
        console.log(`   From: ${l2Account}`);
        console.log(`   To: ${recipient}`);
        console.log(`   Amount: ${amount} ▽`);
        console.log(`   Nonce: ${nonce}`);
        
        // Sign transaction with password
        const { signature, pubkey } = await signL2TransactionWithPassword({
            from: l2Account,
            to: recipient,
            amount: credits,
            nonce: nonce,
            type: 'transfer'
        }, password);
        
        console.log(`   Signature: ${signature?.substring(0, 20)}...`);
        console.log(`   Pubkey: ${pubkey?.substring(0, 20)}...`);
        
        // Update button
        if (signBtn) signBtn.textContent = '⏳ Sending...';
        
        const response = await fetch(`${L2_API_URL}/transaction/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from_account: l2Account,
                to_account: recipient,
                amount: credits.toString(),
                signature,
                pubkey,
                nonce,
                tx_type: 'transfer'
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Transfer failed');
        }
        
        console.log('✅ Transfer successful!', result);
        
        // Clear pending transfer
        pendingL2Transfer = null;
        
        // Show success immediately - go back to wallet screen
        if (showScreenFn) {
            showScreenFn('wallet');
        } else if (typeof showScreen !== 'undefined') {
            showScreen('wallet');
        }
        
        // Show success notification
        window.showNotification(`⚡ Sent ${amount} ▽ instantly!`, 'success');
        
        // Refresh balance in background (don't await)
        refreshL2Data();
        
    } catch (error) {
        console.error('❌ Transfer error:', error);
        window.showNotification('Transfer failed: ' + error.message, 'error');
        
        // Reset button
        const signBtn = document.getElementById('l2-confirm-sign-btn');
        if (signBtn) {
            signBtn.disabled = false;
            signBtn.textContent = '⚡ Sign & Send';
        }
    }
}

/**
 * Sign L2 transaction with password (uses backend Schnorr signing)
 */
async function signL2TransactionWithPassword(messageData, password) {
    try {
        console.log('🔐 Signing L2 transaction with password...');
        
        // Create deterministic message
        const message = [
            messageData.from,
            messageData.to || '',
            messageData.amount.toString(),
            messageData.nonce.toString(),
            messageData.type
        ].join(':');
        
        console.log('   Message:', message.substring(0, 50) + '...');
        
        // Request signature from background script with password
        const result = await chrome.runtime.sendMessage({
            action: 'signL2MessageWithPassword',
            data: { message, password }
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

// ═══════════════════════════════════════════════════════════════════════════════
// L2 WITHDRAWAL (L2 → L1)
// ═══════════════════════════════════════════════════════════════════════════════

// Pending withdrawal data
let pendingL2Withdrawal = null;

// Fee rates from mempool
let withdrawalFeeRates = { low: 10, medium: 20, high: 30 };
let selectedFeeRate = 'medium';
let userBtcBalance = 0;

// Estimated tx size for withdrawal (PSBT with Runestone)
const WITHDRAWAL_TX_VBYTES = 280;

// Minimum sats needed for withdrawal (fee + dust outputs)
// Must match backend MIN_FEE_SATS in userFundedWithdrawal.js
const MIN_WITHDRAWAL_SATS = 3000;

/**
 * Fetch current fee rates (via backend API - uses QuickNode first!)
 */
async function fetchMempoolFees() {
    try {
        // Use backend API which uses QuickNode first, then Mempool.space as fallback
        const backendResponse = await fetch('https://kraywallet-backend.onrender.com/api/wallet/fees');
        if (backendResponse.ok) {
            const data = await backendResponse.json();
            if (data.success) {
                withdrawalFeeRates = {
                    low: data.fees.low || 10,
                    medium: data.fees.medium || 20,
                    high: data.fees.high || 30
                };
                console.log(`⛽ Fees from backend (${data.source}):`, withdrawalFeeRates);
                return withdrawalFeeRates;
            }
        }
    } catch (backendError) {
        console.warn('⚠️ Backend API failed, trying mempool.space directly...');
    }
    
    // Fallback to mempool.space directly
    try {
        const response = await fetch('https://mempool.space/api/v1/fees/recommended');
        if (response.ok) {
            const fees = await response.json();
            withdrawalFeeRates = {
                low: fees.hourFee || 10,
                medium: fees.halfHourFee || 20,
                high: fees.fastestFee || 30
            };
            console.log('⛽ Mempool fees (fallback):', withdrawalFeeRates);
        }
    } catch (error) {
        console.warn('⚠️ Could not fetch fees, using defaults');
    }
    return withdrawalFeeRates;
}

/**
 * Calculate fee in sats for given rate
 * IMPORTANT: Must be at least MIN_WITHDRAWAL_SATS to cover:
 * - Network fee
 * - Dust output for user KRAY (546 sats)
 * - Dust output for bridge change (546 sats)
 */
function calculateFeeSats(feeRate) {
    const networkFee = Math.ceil(WITHDRAWAL_TX_VBYTES * feeRate);
    // Add buffer for dust outputs: 546 (user) + 546 (bridge) = 1092
    const totalNeeded = networkFee + 1092;
    // Always return at least MIN_WITHDRAWAL_SATS
    return Math.max(totalNeeded, MIN_WITHDRAWAL_SATS);
}

/**
 * Update fee display in UI
 */
function updateFeeDisplay() {
    console.log('🔄 Updating fee display with rates:', withdrawalFeeRates);
    
    // Update fee rate buttons (with null checks)
    const lowRate = document.getElementById('fee-low-rate');
    const medRate = document.getElementById('fee-medium-rate');
    const highRate = document.getElementById('fee-high-rate');
    
    if (lowRate) lowRate.textContent = `${withdrawalFeeRates.low} s/vB`;
    if (medRate) medRate.textContent = `${withdrawalFeeRates.medium} s/vB`;
    if (highRate) highRate.textContent = `${withdrawalFeeRates.high} s/vB`;
    
    // Update fee amounts (with null checks)
    const lowSats = document.getElementById('fee-low-sats');
    const medSats = document.getElementById('fee-medium-sats');
    const highSats = document.getElementById('fee-high-sats');
    
    if (lowSats) lowSats.textContent = `~${calculateFeeSats(withdrawalFeeRates.low).toLocaleString()} sats`;
    if (medSats) medSats.textContent = `~${calculateFeeSats(withdrawalFeeRates.medium).toLocaleString()} sats`;
    if (highSats) highSats.textContent = `~${calculateFeeSats(withdrawalFeeRates.high).toLocaleString()} sats`;
    
    // Update mempool status
    const statusEl = document.getElementById('l2-withdraw-mempool-status');
    if (statusEl) {
        statusEl.textContent = `mempool.space ✓`;
        statusEl.style.color = '#10b981';
    }
    
    // Update selected fee in summary
    const selectedRate = withdrawalFeeRates[selectedFeeRate];
    const selectedSats = calculateFeeSats(selectedRate);
    
    console.log(`   Selected: ${selectedFeeRate} = ${selectedRate} s/vB = ${selectedSats} sats`);
    
    const l1FeeEl = document.getElementById('l2-withdraw-l1-fee');
    if (l1FeeEl) {
        l1FeeEl.textContent = `~${selectedSats.toLocaleString()} sats`;
    }
}

/**
 * Select fee rate (called from UI buttons)
 */
window.selectFeeRate = function(rate) {
    console.log(`⛽ Selecting fee rate: ${rate}`);
    selectedFeeRate = rate;
    
    // Update button styles
    ['low', 'medium', 'high'].forEach(r => {
        const btn = document.getElementById(`fee-btn-${r}`);
        if (btn) {
            if (r === rate) {
                btn.style.background = 'rgba(139, 92, 246, 0.15)';
                btn.style.borderColor = '#8b5cf6';
                btn.classList.add('selected');
                console.log(`   ✅ ${r} button selected`);
            } else {
                btn.style.background = 'var(--color-bg-tertiary)';
                btn.style.borderColor = 'var(--color-border)';
                btn.classList.remove('selected');
            }
        }
    });
    
    // Update fee display
    const selectedRate = withdrawalFeeRates[rate];
    const selectedSats = calculateFeeSats(selectedRate);
    
    const l1FeeEl = document.getElementById('l2-withdraw-l1-fee');
    if (l1FeeEl) {
        l1FeeEl.textContent = `~${selectedSats.toLocaleString()} sats`;
    }
    
    // Check if user has enough BTC
    checkBtcBalance(selectedSats);
    
    // Update preview
    updateWithdrawPreview();
};

// User's UTXOs for fee selection
let userUtxos = [];
let selectedFeeUtxo = null;

/**
 * Check if user has enough BTC for fee and load UTXOs
 */
async function checkBtcBalance(neededSats) {
    try {
        const result = await chrome.runtime.sendMessage({ action: 'getWalletInfo' });
        if (result.success && result.data.balance) {
            userBtcBalance = result.data.balance.total || 0;
            
            const btcBalanceEl = document.getElementById('l2-withdraw-btc-balance');
            const btcCheckEl = document.getElementById('l2-withdraw-btc-check');
            
            if (btcBalanceEl) {
                btcBalanceEl.textContent = userBtcBalance.toLocaleString();
            }
            
            if (btcCheckEl) {
                if (userBtcBalance >= neededSats) {
                    btcCheckEl.style.color = '#10b981';
                    btcCheckEl.innerHTML = `Your BTC balance: <span style="color:#10b981;font-weight:600;">${userBtcBalance.toLocaleString()} sats ✓</span>`;
                } else {
                    btcCheckEl.style.color = '#ef4444';
                    btcCheckEl.innerHTML = `⚠️ Need ${neededSats.toLocaleString()} sats, you have <span style="color:#ef4444;font-weight:600;">${userBtcBalance.toLocaleString()} sats</span>`;
                }
            }
            
            // Load UTXOs for selection
            await loadUserUtxos(result.data.address, neededSats);
        }
    } catch (error) {
        console.warn('Could not check BTC balance:', error);
    }
}

/**
 * Load user's UTXOs and find clean ones for fee
 */
async function loadUserUtxos(address, neededSats) {
    try {
        // Fetch UTXOs from our explorer API
        const response = await fetch(`${L2_API_URL.replace('/l2', '')}/api/explorer/address/${address}`);
        if (!response.ok) return;
        
        const data = await response.json();
        userUtxos = data.utxos || [];
        
        // Filter clean UTXOs (no inscriptions/runes) that have enough sats
        const cleanUtxos = userUtxos.filter(utxo => {
            // Check if UTXO has inscriptions or runes
            const hasInscriptions = utxo.inscriptions && utxo.inscriptions.length > 0;
            const hasRunes = utxo.runes && Object.keys(utxo.runes).length > 0;
            const hasEnough = utxo.value >= neededSats;
            return !hasInscriptions && !hasRunes && hasEnough;
        });
        
        // Sort by value (smallest first that's still enough)
        cleanUtxos.sort((a, b) => a.value - b.value);
        
        // Auto-select the best UTXO (smallest that covers fee)
        if (cleanUtxos.length > 0) {
            selectedFeeUtxo = cleanUtxos[0];
            console.log(`✅ Auto-selected UTXO for fee: ${selectedFeeUtxo.txid}:${selectedFeeUtxo.vout} (${selectedFeeUtxo.value} sats)`);
        }
        
        // Store clean UTXOs globally for selection
        window.cleanUtxosForFee = cleanUtxos;
        
        // Update UTXO list in UI
        const utxoListEl = document.getElementById('l2-withdraw-utxo-list');
        if (utxoListEl) {
            if (cleanUtxos.length === 0) {
                utxoListEl.innerHTML = `
                    <div style="color:#ef4444;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;text-align:center;">
                        <div style="font-size:20px;margin-bottom:8px;">⚠️</div>
                        <div style="font-weight:600;">No clean UTXOs available</div>
                        <div style="font-size:11px;color:#888;margin-top:4px;">You need a UTXO with ${neededSats.toLocaleString()}+ sats without inscriptions/runes</div>
                    </div>`;
            } else {
                utxoListEl.innerHTML = `
                    <div style="font-size:11px;color:#888;margin-bottom:8px;">
                        🔒 Only showing clean UTXOs (no inscriptions/runes) • Click to select
                    </div>
                    ${cleanUtxos.map((utxo, i) => {
                        const isSelected = selectedFeeUtxo && selectedFeeUtxo.txid === utxo.txid && selectedFeeUtxo.vout === utxo.vout;
                        const bgColor = isSelected ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)';
                        const borderColor = isSelected ? '#10b981' : 'rgba(255,255,255,0.1)';
                        return '<div onclick="selectUtxoForFee(' + i + ')" class="utxo-item' + (isSelected ? ' selected' : '') + '" style="padding:10px;margin:6px 0;background:' + bgColor + ';border:2px solid ' + borderColor + ';border-radius:8px;cursor:pointer;">' +
                            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                                '<div style="font-family:monospace;font-size:11px;color:#888;">' + utxo.txid.substring(0,8) + '...' + utxo.txid.substring(56) + ':' + utxo.vout + '</div>' +
                                (isSelected ? '<span style="color:#10b981;font-size:16px;">✓</span>' : '') +
                            '</div>' +
                            '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">' +
                                '<div style="color:#10b981;font-weight:700;font-size:14px;">' + utxo.value.toLocaleString() + ' sats</div>' +
                                (isSelected ? '<span style="font-size:10px;color:#10b981;background:rgba(16,185,129,0.2);padding:2px 6px;border-radius:4px;">SELECTED</span>' : '<span style="font-size:10px;color:#666;">click to select</span>') +
                            '</div>' +
                        '</div>';
                    }).join('')}
                `;
            }
        }
        
    } catch (error) {
        console.warn('Could not load UTXOs:', error);
    }
}

/**
 * Select specific UTXO for fee (called from UI)
 */
window.selectUtxoForFee = function(index) {
    const cleanUtxos = window.cleanUtxosForFee || [];
    
    if (cleanUtxos[index]) {
        selectedFeeUtxo = cleanUtxos[index];
        console.log(`✅ Selected UTXO: ${selectedFeeUtxo.txid}:${selectedFeeUtxo.vout} (${selectedFeeUtxo.value} sats)`);
        
        // Show notification
        if (window.showNotification) {
            window.showNotification(`Selected UTXO: ${selectedFeeUtxo.value.toLocaleString()} sats`, 'success');
        }
        
        // Refresh the list to show selection (use stored address)
        const neededSats = calculateFeeSats(withdrawalFeeRates[selectedFeeRate]);
        
        // Re-render the UTXO list without fetching again
        const utxoListEl = document.getElementById('l2-withdraw-utxo-list');
        if (utxoListEl && cleanUtxos.length > 0) {
            utxoListEl.innerHTML = `
                <div style="font-size:11px;color:#888;margin-bottom:8px;">
                    🔒 Only showing clean UTXOs (no inscriptions/runes) • Click to select
                </div>
                ${cleanUtxos.map((utxo, i) => {
                    const isSelected = selectedFeeUtxo && selectedFeeUtxo.txid === utxo.txid && selectedFeeUtxo.vout === utxo.vout;
                    const bgColor = isSelected ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)';
                    const borderColor = isSelected ? '#10b981' : 'rgba(255,255,255,0.1)';
                    return '<div onclick="selectUtxoForFee(' + i + ')" class="utxo-item' + (isSelected ? ' selected' : '') + '" style="padding:10px;margin:6px 0;background:' + bgColor + ';border:2px solid ' + borderColor + ';border-radius:8px;cursor:pointer;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                            '<div style="font-family:monospace;font-size:11px;color:#888;">' + utxo.txid.substring(0,8) + '...' + utxo.txid.substring(56) + ':' + utxo.vout + '</div>' +
                            (isSelected ? '<span style="color:#10b981;font-size:16px;">✓</span>' : '') +
                        '</div>' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">' +
                            '<div style="color:#10b981;font-weight:700;font-size:14px;">' + utxo.value.toLocaleString() + ' sats</div>' +
                            (isSelected ? '<span style="font-size:10px;color:#10b981;background:rgba(16,185,129,0.2);padding:2px 6px;border-radius:4px;">SELECTED</span>' : '<span style="font-size:10px;color:#666;">click to select</span>') +
                        '</div>' +
                    '</div>';
                }).join('')}
            `;
        }
    }
};

/**
 * Get L2 withdrawal fee based on membership
 */
function getWithdrawalL2Fee() {
    // Check if user has membership with remaining free tx
    if (l2Membership && l2Membership.usage) {
        const remaining = (l2Membership.limits?.freeTxPerDay || 0) - (l2Membership.usage?.dailyUsed || 0);
        if (remaining > 0) {
            return { fee: 0, isFree: true, remaining };
        }
    }
    return { fee: 1, isFree: false, remaining: 0 };
}

/**
 * Update withdrawal preview (fee, receive amount)
 */
function updateWithdrawPreview() {
    const amount = parseInt(document.getElementById('l2-withdraw-amount')?.value) || 0;
    const l2FeeInfo = getWithdrawalL2Fee();
    const l2Fee = l2FeeInfo.fee;
    const receiveAmount = Math.max(0, amount - l2Fee);
    
    // Update amount display
    const amountDisplayEl = document.getElementById('l2-withdraw-amount-display');
    if (amountDisplayEl) {
        amountDisplayEl.textContent = `${amount.toLocaleString()} KRAY`;
    }
    
    // Update L2 fee display
    const l2FeeEl = document.getElementById('l2-withdraw-l2-fee');
    if (l2FeeEl) {
        if (l2FeeInfo.isFree) {
            l2FeeEl.textContent = 'FREE ✓';
            l2FeeEl.style.color = '#10b981';
        } else {
            l2FeeEl.textContent = '1 KRAY';
            l2FeeEl.style.color = '#fbbf24';
        }
    }
    
    // Update receive amount
    const receiveEl = document.getElementById('l2-withdraw-receive');
    if (receiveEl) {
        receiveEl.textContent = `${receiveAmount.toLocaleString()} KRAY`;
    }
    
    // Show/hide membership hint
    const hintEl = document.getElementById('l2-withdraw-membership-hint');
    if (hintEl) {
        hintEl.style.display = l2FeeInfo.isFree ? 'none' : 'block';
    }
}

/**
 * Update withdrawal balance display
 */
function updateWithdrawBalance() {
    const balanceEl = document.getElementById('l2-withdraw-balance');
    if (balanceEl) {
        balanceEl.textContent = currentL2Balance.toLocaleString();
    }
}

/**
 * Show withdrawal confirmation screen
 * 
 * 🔒 SECURITY: Address is ALWAYS user's own address (from display, not input)
 */
function showL2WithdrawConfirm() {
    console.log('📤 Showing withdrawal confirmation...');
    
    const amount = parseInt(document.getElementById('l2-withdraw-amount')?.value);
    
    // 🔒 Get address from display (not editable input)
    const l1Address = document.getElementById('l2-withdraw-address')?.textContent?.trim();
    
    // Validate amount
    if (!amount || amount < 1) {
        window.showNotification('Minimum withdrawal: 1 KRAY', 'error');
        return;
    }
    
    if (amount > currentL2Balance) {
        window.showNotification('Insufficient balance', 'error');
        return;
    }
    
    // Validate address exists (should always be there)
    if (!l1Address || l1Address === 'Loading...') {
        window.showNotification('Error loading your address. Please try again.', 'error');
        return;
    }
    
    // Calculate fees
    const l2FeeInfo = getWithdrawalL2Fee();
    const l2Fee = l2FeeInfo.fee;
    const feeRate = withdrawalFeeRates[selectedFeeRate];
    const l1FeeSats = calculateFeeSats(feeRate);
    const receiveAmount = Math.max(0, amount - l2Fee);
    
    // Check BTC balance
    if (userBtcBalance < l1FeeSats) {
        window.showNotification(`Insufficient BTC! Need ~${l1FeeSats.toLocaleString()} sats for network fee`, 'error');
        return;
    }
    
    // Store pending withdrawal with all fee data
    pendingL2Withdrawal = { 
        amount, 
        l1Address,
        l2Fee,
        l1FeeSats,
        feeRate,
        receiveAmount
    };
    
    // Update confirmation screen
    document.getElementById('l2-withdraw-confirm-amount').textContent = amount.toLocaleString();
    document.getElementById('l2-withdraw-confirm-address').textContent = l1Address;
    
    // Update fee details
    const l2FeeEl = document.getElementById('l2-withdraw-confirm-l2fee');
    if (l2FeeEl) {
        if (l2FeeInfo.isFree) {
            l2FeeEl.textContent = 'FREE ✓';
            l2FeeEl.style.color = '#10b981';
        } else {
            l2FeeEl.textContent = `${l2Fee} KRAY`;
            l2FeeEl.style.color = '#fbbf24';
        }
    }
    
    const l1FeeEl = document.getElementById('l2-withdraw-confirm-l1fee');
    if (l1FeeEl) {
        l1FeeEl.textContent = `~${l1FeeSats.toLocaleString()} sats`;
    }
    
    const feeRateEl = document.getElementById('l2-withdraw-confirm-feerate');
    if (feeRateEl) {
        feeRateEl.textContent = `${feeRate} sat/vB (${selectedFeeRate})`;
    }
    
    const receiveEl = document.getElementById('l2-withdraw-confirm-receive');
    if (receiveEl) {
        receiveEl.textContent = `${receiveAmount.toLocaleString()} KRAY`;
    }
    
    // Reset password and checkbox
    const passwordInput = document.getElementById('l2-withdraw-confirm-password');
    const checkbox = document.getElementById('l2-withdraw-confirm-checkbox');
    const signBtn = document.getElementById('l2-withdraw-confirm-sign-btn');
    
    if (passwordInput) passwordInput.value = '';
    if (checkbox) checkbox.checked = false;
    if (signBtn) signBtn.disabled = true;
    
    // Show confirmation screen
    if (showScreenFn) {
        showScreenFn('l2-withdraw-confirm');
    }
}

/**
 * Setup withdrawal confirmation listeners
 */
function setupL2WithdrawConfirmListeners() {
    // Back button
    const backBtn = document.getElementById('back-from-l2-withdraw-confirm-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            pendingL2Withdrawal = null;
            if (showScreenFn) showScreenFn('l2-withdraw');
        };
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('l2-withdraw-confirm-cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            pendingL2Withdrawal = null;
            if (showScreenFn) showScreenFn('l2-withdraw');
        };
    }
    
    // Checkbox enables sign button
    const checkbox = document.getElementById('l2-withdraw-confirm-checkbox');
    const signBtn = document.getElementById('l2-withdraw-confirm-sign-btn');
    
    if (checkbox && signBtn) {
        checkbox.onchange = () => {
            const password = document.getElementById('l2-withdraw-confirm-password')?.value;
            signBtn.disabled = !checkbox.checked || !password;
        };
    }
    
    // Password input enables sign button
    const passwordInput = document.getElementById('l2-withdraw-confirm-password');
    if (passwordInput && signBtn && checkbox) {
        passwordInput.oninput = () => {
            signBtn.disabled = !checkbox.checked || !passwordInput.value;
        };
        
        // Enter key submits
        passwordInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !signBtn.disabled) {
                executeWithdrawalWithPassword();
            }
        };
    }
    
    // Sign button
    if (signBtn) {
        signBtn.onclick = executeWithdrawalWithPassword;
    }
}

/**
 * Execute withdrawal with password (main function)
 * 
 * Uses PSBT Colaborativo:
 * 1. User provides UTXO for fee
 * 2. Backend creates PSBT with user input + bridge input
 * 3. User signs their input
 * 4. After 24h, validators sign bridge input and broadcast
 */
async function executeWithdrawalWithPassword() {
    console.log('📤 Executing withdrawal with password...');
    
    if (!pendingL2Withdrawal) {
        window.showNotification('No pending withdrawal', 'error');
        return;
    }
    
    const { amount, l1Address, l2Fee, l1FeeSats, feeRate, receiveAmount } = pendingL2Withdrawal;
    const password = document.getElementById('l2-withdraw-confirm-password')?.value;
    
    if (!password) {
        window.showNotification('Please enter your password', 'error');
        return;
    }
    
    // Check if we have a UTXO selected for fee
    if (!selectedFeeUtxo) {
        window.showNotification('No UTXO selected for fee. Please select a clean UTXO.', 'error');
        return;
    }
    
    // Update button state
    const signBtn = document.getElementById('l2-withdraw-confirm-sign-btn');
    if (signBtn) {
        signBtn.disabled = true;
        signBtn.textContent = '⏳ Creating PSBT...';
    }
    
    try {
        console.log(`   Amount: ${amount} ▽`);
        console.log(`   L2 Fee: ${l2Fee} KRAY`);
        console.log(`   L1 Fee: ${l1FeeSats} sats (${feeRate} sat/vB)`);
        console.log(`   Receive: ${receiveAmount} KRAY`);
        console.log(`   L1 Address: ${l1Address}`);
        console.log(`   L2 Account: ${l2Account}`);
        console.log(`   Fee UTXO: ${selectedFeeUtxo.txid}:${selectedFeeUtxo.vout} (${selectedFeeUtxo.value} sats)`);
        
        // Get current nonce from account
        const accountResponse = await fetch(`${L2_API_URL}/account/${l2Account}/balance`);
        let nonce = 0;
        
        if (accountResponse.ok) {
            const accountData = await accountResponse.json();
            nonce = accountData.nonce || 0;
        }
        
        console.log(`   Nonce: ${nonce}`);
        
        // Sign L2 authorization (proves user owns the L2 account)
        const { signature, pubkey } = await signL2TransactionWithPassword({
            from: l2Account,
            to: '',  // Withdrawal has no L2 recipient
            amount: amount,
            nonce: nonce,
            type: 'withdrawal'
        }, password);
        
        console.log(`   L2 Signature: ${signature?.substring(0, 20)}...`);
        console.log(`   Pubkey: ${pubkey?.substring(0, 20)}...`);
        
        if (signBtn) signBtn.textContent = '⏳ Requesting PSBT...';
        
        // Step 1: Request withdrawal with UTXO - backend creates PSBT
        const response = await fetch(`${L2_API_URL}/bridge/withdrawal/user-funded`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_id: l2Account,
                amount: amount,
                l1_address: l1Address,
                signature,
                pubkey,
                nonce,
                fee_rate: withdrawalFeeRates[selectedFeeRate],
                fee_utxo: {
                    txid: selectedFeeUtxo.txid,
                    vout: selectedFeeUtxo.vout,
                    value: selectedFeeUtxo.value,
                    scriptPubKey: selectedFeeUtxo.scriptPubKey || ''
                },
                l2_fee: l2Fee
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to create withdrawal PSBT');
        }
        
        console.log('✅ PSBT created:', result.withdrawal_id);
        
        if (signBtn) signBtn.textContent = '⏳ Signing PSBT...';
        
        // Step 2: Sign the PSBT (user's input only)
        const signedPsbt = await signWithdrawalPsbt(result.partial_psbt, password);
        
        console.log('✅ PSBT signed by user');
        
        if (signBtn) signBtn.textContent = '⏳ Submitting...';
        
        // Step 3: Submit signed PSBT back to backend
        const submitResponse = await fetch(`${L2_API_URL}/bridge/withdrawal/${result.withdrawal_id}/submit-signed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signed_psbt: signedPsbt
            })
        });
        
        const submitResult = await submitResponse.json();
        
        if (!submitResponse.ok) {
            throw new Error(submitResult.error || 'Failed to submit signed PSBT');
        }
        
        console.log('✅ Withdrawal submitted!', submitResult);
        
        // Clear pending withdrawal
        pendingL2Withdrawal = null;
        selectedFeeUtxo = null;
        
        // Calculate time remaining
        const challengeEnd = new Date(submitResult.challenge_deadline || result.challenge_deadline);
        const hoursRemaining = Math.ceil((challengeEnd - Date.now()) / (1000 * 60 * 60));
        
        // Show success
        window.showNotification(
            `✅ Withdrawal signed! ${receiveAmount} KRAY will arrive at your L1 address after ~${hoursRemaining}h challenge period.`, 
            'success'
        );
        
        // Go back to wallet screen
        if (showScreenFn) {
            showScreenFn('wallet');
        }
        
        // Refresh data in background
        refreshL2Data();
        
    } catch (error) {
        console.error('❌ Withdrawal error:', error);
        window.showNotification('Withdrawal failed: ' + error.message, 'error');
        
        // Reset button
        if (signBtn) {
            signBtn.disabled = false;
            signBtn.textContent = '🔐 Sign & Request';
        }
    }
}

/**
 * Sign withdrawal PSBT (user's input only)
 */
async function signWithdrawalPsbt(psbtBase64, password) {
    console.log('✍️ Signing withdrawal PSBT...');
    
    // Send to background script to sign
    const result = await chrome.runtime.sendMessage({
        action: 'signPsbtWithPassword',
        data: { 
            psbt: psbtBase64, 
            password,
            inputsToSign: [0]  // Only sign input 0 (user's fee UTXO)
        }
    });
    
    if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to sign PSBT');
    }
    
    return result.signedPsbt;
}

/**
 * Get swap quote
 * 🔥 1:1 mapping - KRAY is integer (divisibility: 0)
 */
async function getSwapQuote(amountIn) {
    try {
        const poolId = 'pool_kray_btc';
        const amount = parseInt(amountIn); // 1:1, no conversion
        
        const response = await fetch(`${L2_API_URL}/defi/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pool_id: poolId,
                token_in: 'KRAY',
                amount_in: amount.toString()
            })
        });
        
        if (response.ok) {
            const quote = await response.json();
            
            // Display quote (BTC has 8 decimals)
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
        const amount = parseInt(amountIn); // 1:1, no conversion
        const poolId = `pool_kray_${tokenOut.toLowerCase()}`;
        
        const response = await fetch(`${L2_API_URL}/defi/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pool_id: poolId,
                account_id: l2Account,
                token_in: 'KRAY',
                amount_in: amount.toString(),
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
    await updatePendingWithdrawals();
    displayL2Balance();
    displayL2Transactions();
    displayPendingWithdrawals();
    
    console.log('✅ L2 data refreshed');
}

// Auto-refresh interval for pending withdrawals (every 30 seconds)
let pendingRefreshInterval = null;

/**
 * Start auto-refresh for pending withdrawals
 */
function startPendingWithdrawalsRefresh() {
    // Clear existing interval
    if (pendingRefreshInterval) {
        clearInterval(pendingRefreshInterval);
    }
    
    // Refresh every 30 seconds
    pendingRefreshInterval = setInterval(async () => {
        if (pendingWithdrawals.length > 0) {
            console.log('🔄 Auto-refreshing pending withdrawals...');
            await updatePendingWithdrawals();
            displayPendingWithdrawals();
            
            // Check for status changes and notify user
            checkWithdrawalStatusChanges();
        }
    }, 30000);
    
    console.log('⏰ Pending withdrawals auto-refresh started (30s interval)');
}

/**
 * Check for withdrawal status changes and notify user
 */
let lastWithdrawalStatuses = {};

function checkWithdrawalStatusChanges() {
    for (const w of pendingWithdrawals) {
        const lastStatus = lastWithdrawalStatuses[w.id];
        
        if (lastStatus && lastStatus !== w.display_status) {
            // Status changed!
            if (w.display_status === 'processing') {
                window.showNotification?.('🚀 Withdrawal is now processing! Broadcasting soon...', 'success');
            } else if (w.status === 'completed') {
                window.showNotification?.(`✅ Withdrawal of ${parseInt(w.amount_l1).toLocaleString()} KRAY completed!`, 'success');
            } else if (w.status === 'failed') {
                window.showNotification?.(`❌ Withdrawal failed: ${w.error_message || 'Unknown error'}`, 'error');
            }
        }
        
        lastWithdrawalStatuses[w.id] = w.display_status;
    }
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

