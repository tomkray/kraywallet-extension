-- ═══════════════════════════════════════════════════════════════════════════════
-- 🌩️ LIGHTNING DEFI - SYNTHETIC RUNES SYSTEM
-- Migration: 002_synthetic_runes_system.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. VIRTUAL POOL STATE (L2 State)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS virtual_pool_state (
    pool_id TEXT PRIMARY KEY,
    virtual_btc INTEGER NOT NULL,           -- Virtual BTC balance (sats)
    virtual_rune_amount REAL NOT NULL,      -- Virtual rune balance
    k REAL NOT NULL,                        -- AMM constant (x * y = k)
    total_swaps INTEGER DEFAULT 0,
    total_volume_btc INTEGER DEFAULT 0,
    fees_collected_btc INTEGER DEFAULT 0,
    last_update INTEGER NOT NULL,           -- Unix timestamp
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (pool_id) REFERENCES lightning_pools(pool_id)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. VIRTUAL BALANCES (Synthetic Runes per User)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS virtual_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    rune_id TEXT NOT NULL,
    virtual_amount REAL NOT NULL,          -- Synthetic runes owned
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'redeemed', 'locked'
    created_at TEXT DEFAULT (datetime('now')),
    redeemed_at TEXT,
    
    FOREIGN KEY (pool_id) REFERENCES lightning_pools(pool_id),
    
    CHECK (virtual_amount >= 0),
    CHECK (status IN ('active', 'redeemed', 'locked'))
);

CREATE INDEX IF NOT EXISTS idx_virtual_balances_user 
    ON virtual_balances(user_address, pool_id, status);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. LIGHTNING SWAPS (L2 Transactions)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lightning_swaps (
    swap_id TEXT PRIMARY KEY,
    pool_id TEXT NOT NULL,
    user_address TEXT NOT NULL,
    swap_type TEXT NOT NULL,               -- 'buy_synthetic', 'sell_synthetic'
    from_asset TEXT NOT NULL,              -- 'BTC' or rune_id
    to_asset TEXT NOT NULL,                -- 'BTC' or rune_id
    amount_in INTEGER NOT NULL,            -- Input amount (sats or rune atomic units)
    amount_out REAL NOT NULL,              -- Output amount
    fee_sats INTEGER NOT NULL,             -- Fee in sats
    price REAL NOT NULL,                   -- Execution price
    slippage REAL,                         -- Slippage %
    
    -- Lightning specific
    payment_hash TEXT,                     -- Lightning payment hash
    payment_request TEXT,                  -- Lightning invoice
    preimage TEXT,                         -- Payment preimage (proof)
    
    status TEXT NOT NULL DEFAULT 'pending',-- 'pending', 'completed', 'failed', 'expired'
    error_message TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    expires_at INTEGER,                    -- Unix timestamp
    
    FOREIGN KEY (pool_id) REFERENCES lightning_pools(pool_id),
    
    CHECK (swap_type IN ('buy_synthetic', 'sell_synthetic')),
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    CHECK (amount_in > 0),
    CHECK (amount_out > 0)
);

CREATE INDEX IF NOT EXISTS idx_lightning_swaps_user 
    ON lightning_swaps(user_address, status);
CREATE INDEX IF NOT EXISTS idx_lightning_swaps_payment 
    ON lightning_swaps(payment_hash, status);

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. REDEMPTIONS (L2 → L1 Conversions)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS redemptions (
    redemption_id TEXT PRIMARY KEY,
    user_address TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    rune_id TEXT NOT NULL,
    virtual_amount REAL NOT NULL,          -- Synthetic runes to redeem
    real_amount REAL NOT NULL,             -- Real runes sent (may differ due to fees)
    
    -- L1 Transaction details
    txid TEXT,                             -- On-chain TXID
    vout INTEGER,                          -- Output index
    fee_sats INTEGER,                      -- L1 transaction fee
    
    status TEXT NOT NULL DEFAULT 'pending',-- 'pending', 'signed', 'broadcasted', 'confirmed', 'failed'
    error_message TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    broadcasted_at TEXT,
    confirmed_at TEXT,
    confirmations INTEGER DEFAULT 0,
    
    FOREIGN KEY (pool_id) REFERENCES lightning_pools(pool_id),
    
    CHECK (status IN ('pending', 'signed', 'broadcasted', 'confirmed', 'failed')),
    CHECK (virtual_amount > 0),
    CHECK (real_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_redemptions_user 
    ON redemptions(user_address, status);
CREATE INDEX IF NOT EXISTS idx_redemptions_txid 
    ON redemptions(txid);

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. DEPOSITS (L1 → L2 Conversions)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deposits (
    deposit_id TEXT PRIMARY KEY,
    user_address TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    rune_id TEXT NOT NULL,
    real_amount REAL NOT NULL,             -- Real runes deposited
    virtual_amount REAL NOT NULL,          -- Synthetic runes issued
    
    -- L1 Transaction details
    txid TEXT NOT NULL,
    vout INTEGER NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'pending',-- 'pending', 'confirmed', 'credited'
    confirmations INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    confirmed_at TEXT,
    credited_at TEXT,
    
    FOREIGN KEY (pool_id) REFERENCES lightning_pools(pool_id),
    
    CHECK (status IN ('pending', 'confirmed', 'credited')),
    CHECK (real_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_deposits_txid 
    ON deposits(txid, vout);
CREATE INDEX IF NOT EXISTS idx_deposits_user 
    ON deposits(user_address, status);

-- ───────────────────────────────────────────────────────────────────────────────
-- 6. POOL AUDIT LOG (Security & Compliance)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pool_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_id TEXT NOT NULL,
    
    -- Balances
    l1_btc_balance INTEGER NOT NULL,       -- Real BTC in pool UTXO
    l1_rune_balance REAL NOT NULL,         -- Real runes in pool UTXO
    virtual_btc_balance INTEGER NOT NULL,  -- Virtual BTC (L2 state)
    virtual_rune_balance REAL NOT NULL,    -- Virtual runes (L2 state)
    total_synthetic_issued REAL NOT NULL,  -- Total synthetic runes issued to users
    
    -- Health metrics
    reserve_ratio REAL NOT NULL,           -- (L1 runes - synthetic issued) / L1 runes
    utilization REAL NOT NULL,             -- synthetic issued / L1 runes
    healthy BOOLEAN NOT NULL,              -- Overall health status
    
    -- Discrepancies
    btc_discrepancy INTEGER DEFAULT 0,     -- L1 vs L2 BTC difference
    rune_discrepancy REAL DEFAULT 0,       -- L1 vs L2 rune difference
    
    warning_message TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (pool_id) REFERENCES lightning_pools(pool_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_pool 
    ON pool_audit_log(pool_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 7. TRIGGERS (Automatic Invariant Checks)
-- ───────────────────────────────────────────────────────────────────────────────

-- Trigger: Update virtual pool state on swap
CREATE TRIGGER IF NOT EXISTS after_swap_update_pool
AFTER UPDATE ON lightning_swaps
WHEN NEW.status = 'completed' AND OLD.status = 'pending'
BEGIN
    UPDATE virtual_pool_state
    SET total_swaps = total_swaps + 1,
        total_volume_btc = total_volume_btc + NEW.amount_in,
        fees_collected_btc = fees_collected_btc + NEW.fee_sats,
        last_update = strftime('%s', 'now')
    WHERE pool_id = NEW.pool_id;
END;

-- Trigger: Validate redemption doesn't exceed balance
CREATE TRIGGER IF NOT EXISTS before_redemption_validate
BEFORE INSERT ON redemptions
BEGIN
    SELECT CASE
        WHEN (
            SELECT COALESCE(SUM(virtual_amount), 0)
            FROM virtual_balances
            WHERE user_address = NEW.user_address
                AND pool_id = NEW.pool_id
                AND status = 'active'
        ) < NEW.virtual_amount
        THEN RAISE(ABORT, 'Insufficient virtual balance for redemption')
    END;
END;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8. VIEWS (Convenient Queries)
-- ───────────────────────────────────────────────────────────────────────────────

-- View: User synthetic balances summary
CREATE VIEW IF NOT EXISTS v_user_balances AS
SELECT 
    user_address,
    pool_id,
    rune_id,
    SUM(CASE WHEN status = 'active' THEN virtual_amount ELSE 0 END) as active_balance,
    SUM(CASE WHEN status = 'redeemed' THEN virtual_amount ELSE 0 END) as redeemed_balance,
    COUNT(*) as transaction_count,
    MIN(created_at) as first_transaction,
    MAX(created_at) as last_transaction
FROM virtual_balances
GROUP BY user_address, pool_id, rune_id;

-- View: Pool health summary
CREATE VIEW IF NOT EXISTS v_pool_health AS
SELECT 
    p.pool_id,
    p.rune_name,
    p.btc_amount as l1_btc,
    p.rune_amount as l1_runes,
    vps.virtual_btc as l2_btc,
    vps.virtual_rune_amount as l2_runes,
    COALESCE(
        (SELECT SUM(virtual_amount) 
         FROM virtual_balances 
         WHERE pool_id = p.pool_id AND status = 'active'),
        0
    ) as total_synthetic_issued,
    (p.rune_amount - COALESCE(
        (SELECT SUM(virtual_amount) 
         FROM virtual_balances 
         WHERE pool_id = p.pool_id AND status = 'active'),
        0
    )) / p.rune_amount as reserve_ratio,
    vps.total_swaps,
    vps.total_volume_btc,
    vps.fees_collected_btc,
    p.status
FROM lightning_pools p
LEFT JOIN virtual_pool_state vps ON p.pool_id = vps.pool_id;

-- View: Recent swaps summary
CREATE VIEW IF NOT EXISTS v_recent_swaps AS
SELECT 
    swap_id,
    pool_id,
    user_address,
    swap_type,
    amount_in,
    amount_out,
    fee_sats,
    price,
    slippage,
    status,
    created_at,
    completed_at,
    (julianday(completed_at) - julianday(created_at)) * 86400 as duration_seconds
FROM lightning_swaps
ORDER BY created_at DESC
LIMIT 100;

-- ───────────────────────────────────────────────────────────────────────────────
-- 9. INITIAL DATA & CONSTRAINTS
-- ───────────────────────────────────────────────────────────────────────────────

-- Update existing lightning_pools table if needed
-- (Add columns if they don't exist)

-- Check if migration was successful
SELECT 'Migration 002 completed successfully!' as message;

