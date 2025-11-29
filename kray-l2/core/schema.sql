-- ═══════════════════════════════════════════════════════════════════════════════
-- KRAY SPACE L2 - Database Schema
-- Complete schema for Layer 2 network
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. L2 ACCOUNTS
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_accounts (
  account_id TEXT PRIMARY KEY,              -- kray_xxxxx format
  l1_address TEXT NOT NULL UNIQUE,          -- Bitcoin Taproot address (bc1p...)
  pubkey TEXT,                              -- Public key for signature verification (33 bytes hex)
  
  -- Balances (in credits, 3 decimals)
  balance_credits TEXT NOT NULL DEFAULT '0',     -- Available balance
  staked_credits TEXT NOT NULL DEFAULT '0',      -- Staked amount
  locked_credits TEXT NOT NULL DEFAULT '0',      -- Locked in contracts
  
  -- Nonce for replay protection
  nonce INTEGER NOT NULL DEFAULT 0,
  
  -- Merkle tree position
  merkle_index INTEGER,
  
  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  
  -- Constraints
  CHECK (CAST(balance_credits AS INTEGER) >= 0),
  CHECK (CAST(staked_credits AS INTEGER) >= 0),
  CHECK (CAST(locked_credits AS INTEGER) >= 0)
);

CREATE INDEX idx_l2_accounts_l1 ON l2_accounts(l1_address);
CREATE INDEX idx_l2_accounts_balance ON l2_accounts(balance_credits);
CREATE INDEX idx_l2_accounts_activity ON l2_accounts(last_activity);

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. L2 TRANSACTIONS
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_transactions (
  tx_hash TEXT PRIMARY KEY,
  
  -- Participants
  from_account TEXT NOT NULL,
  to_account TEXT,                          -- NULL for burns/special txs
  
  -- Transaction details
  tx_type TEXT NOT NULL,                    -- transfer, swap, stake, etc
  amount_credits TEXT NOT NULL,             -- Amount transferred
  gas_fee_credits TEXT NOT NULL,            -- Gas paid
  
  -- Nonce and signature
  nonce INTEGER NOT NULL,
  signature TEXT NOT NULL,
  
  -- Extra data (JSON for complex transactions)
  data TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',   -- pending, confirmed, failed
  error_message TEXT,
  
  -- Batch information
  batch_id INTEGER,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  
  FOREIGN KEY (from_account) REFERENCES l2_accounts(account_id),
  FOREIGN KEY (to_account) REFERENCES l2_accounts(account_id),
  FOREIGN KEY (batch_id) REFERENCES l2_batches(batch_id),
  
  CHECK (tx_type IN ('transfer', 'swap', 'stake', 'unstake', 'list', 'buy', 'burn')),
  CHECK (status IN ('pending', 'confirmed', 'failed')),
  CHECK (CAST(amount_credits AS INTEGER) > 0),
  CHECK (CAST(gas_fee_credits AS INTEGER) >= 0)
);

CREATE INDEX idx_l2_tx_from ON l2_transactions(from_account, created_at DESC);
CREATE INDEX idx_l2_tx_to ON l2_transactions(to_account, created_at DESC);
CREATE INDEX idx_l2_tx_status ON l2_transactions(status, created_at DESC);
CREATE INDEX idx_l2_tx_batch ON l2_transactions(batch_id);
CREATE INDEX idx_l2_tx_type ON l2_transactions(tx_type);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. DEPOSITS (L1 → L2)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_deposits (
  deposit_id TEXT PRIMARY KEY,             -- UUID
  
  -- L1 transaction details
  l1_txid TEXT NOT NULL,
  l1_vout INTEGER NOT NULL,
  l1_address TEXT NOT NULL,                -- User's L1 address
  
  -- Amounts
  kray_amount TEXT NOT NULL,               -- KRAY locked on L1 (indivisible)
  credits_minted TEXT NOT NULL,            -- Credits minted on L2 (with decimals)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, confirming, claimed
  confirmations INTEGER NOT NULL DEFAULT 0,
  
  -- L2 account
  l2_account_id TEXT,
  
  -- Timestamps
  detected_at INTEGER NOT NULL,
  claimed_at INTEGER,
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (l2_account_id) REFERENCES l2_accounts(account_id),
  
  UNIQUE(l1_txid, l1_vout),
  CHECK (status IN ('pending', 'confirming', 'claimed')),
  CHECK (CAST(kray_amount AS INTEGER) > 0),
  CHECK (confirmations >= 0)
);

CREATE INDEX idx_deposits_l1_tx ON l2_deposits(l1_txid, l1_vout);
CREATE INDEX idx_deposits_status ON l2_deposits(status, created_at DESC);
CREATE INDEX idx_deposits_account ON l2_deposits(l2_account_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. WITHDRAWALS (L2 → L1)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_withdrawals (
  withdrawal_id TEXT PRIMARY KEY,          -- UUID
  
  -- L2 details
  l2_account_id TEXT NOT NULL,
  credits_burned TEXT NOT NULL,            -- Credits burned on L2
  
  -- L1 details
  kray_amount TEXT NOT NULL,               -- KRAY to receive on L1
  l1_address TEXT NOT NULL,                -- Destination L1 address
  
  -- Challenge period
  challenge_deadline INTEGER NOT NULL,     -- Unix timestamp (24h from request)
  challenged BOOLEAN NOT NULL DEFAULT 0,
  challenge_reason TEXT,
  
  -- L1 transaction
  l1_txid TEXT,                            -- PSBT broadcast txid
  l1_vout INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, challenged, completed, failed
  error_message TEXT,
  
  -- Timestamps
  requested_at INTEGER NOT NULL,
  completed_at INTEGER,
  
  FOREIGN KEY (l2_account_id) REFERENCES l2_accounts(account_id),
  
  CHECK (status IN ('pending', 'challenged', 'completed', 'failed')),
  CHECK (CAST(credits_burned AS INTEGER) > 0),
  CHECK (CAST(kray_amount AS INTEGER) > 0)
);

CREATE INDEX idx_withdrawals_account ON l2_withdrawals(l2_account_id, requested_at DESC);
CREATE INDEX idx_withdrawals_status ON l2_withdrawals(status);
CREATE INDEX idx_withdrawals_deadline ON l2_withdrawals(challenge_deadline);
CREATE INDEX idx_withdrawals_l1 ON l2_withdrawals(l1_txid, l1_vout);

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. BATCHES (Rollup batches)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_batches (
  batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- State roots
  prev_state_root TEXT NOT NULL,
  new_state_root TEXT NOT NULL,
  
  -- Batch contents
  tx_count INTEGER NOT NULL,
  tx_hashes TEXT NOT NULL,                 -- JSON array of tx hashes
  
  -- Gas statistics
  total_gas_collected TEXT NOT NULL,
  total_gas_burned TEXT NOT NULL,
  total_gas_distributed TEXT NOT NULL,
  
  -- L1 anchoring
  l1_anchor_txid TEXT,                     -- Bitcoin txid with OP_RETURN
  l1_block_height INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'building', -- building, published, finalized
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  finalized_at INTEGER,
  
  CHECK (status IN ('building', 'published', 'finalized')),
  CHECK (tx_count >= 0)
);

CREATE INDEX idx_batches_status ON l2_batches(status);
CREATE INDEX idx_batches_l1 ON l2_batches(l1_anchor_txid, l1_block_height);
CREATE INDEX idx_batches_created ON l2_batches(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 6. VALIDATORS
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_validators (
  validator_id TEXT PRIMARY KEY,           -- UUID
  validator_pubkey TEXT NOT NULL UNIQUE,   -- Validator's public key
  validator_address TEXT NOT NULL,         -- L1 address for rewards
  
  -- Stake
  staked_amount TEXT NOT NULL,             -- Minimum 10,000 KRAY
  
  -- Rewards
  rewards_earned TEXT NOT NULL DEFAULT '0',
  rewards_claimed TEXT NOT NULL DEFAULT '0',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',   -- active, inactive, slashed
  slash_reason TEXT,
  slash_amount TEXT,
  
  -- Performance
  blocks_validated INTEGER NOT NULL DEFAULT 0,
  last_active INTEGER NOT NULL,
  uptime_percentage REAL NOT NULL DEFAULT 100.0,
  
  -- Timestamps
  registered_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  CHECK (status IN ('active', 'inactive', 'slashed')),
  CHECK (CAST(staked_amount AS INTEGER) >= 10000000), -- 10,000 KRAY min
  CHECK (uptime_percentage >= 0 AND uptime_percentage <= 100)
);

CREATE INDEX idx_validators_status ON l2_validators(status);
CREATE INDEX idx_validators_stake ON l2_validators(staked_amount DESC);
CREATE INDEX idx_validators_active ON l2_validators(last_active DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 7. DEFI POOLS
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_defi_pools (
  pool_id TEXT PRIMARY KEY,
  
  -- Pool tokens
  token_a TEXT NOT NULL,                   -- KRAY or other
  token_b TEXT NOT NULL,                   -- BTC, USDT, etc
  
  -- Reserves (in credits for KRAY, smallest unit for others)
  reserve_a TEXT NOT NULL,
  reserve_b TEXT NOT NULL,
  
  -- LP tokens
  lp_token_supply TEXT NOT NULL,
  
  -- Fees
  fee_rate INTEGER NOT NULL DEFAULT 30,   -- 0.3% = 30 basis points
  protocol_fee_rate INTEGER NOT NULL DEFAULT 5, -- 0.05% = 5 basis points
  
  -- Statistics
  total_volume TEXT NOT NULL DEFAULT '0',
  total_fees TEXT NOT NULL DEFAULT '0',
  total_swaps INTEGER NOT NULL DEFAULT 0,
  
  -- Creator
  creator_account TEXT NOT NULL,
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (creator_account) REFERENCES l2_accounts(account_id),
  
  CHECK (CAST(reserve_a AS INTEGER) >= 0),
  CHECK (CAST(reserve_b AS INTEGER) >= 0),
  CHECK (fee_rate >= 0 AND fee_rate <= 1000)
);

CREATE INDEX idx_pools_tokens ON l2_defi_pools(token_a, token_b);
CREATE INDEX idx_pools_active ON l2_defi_pools(active);
CREATE INDEX idx_pools_volume ON l2_defi_pools(total_volume DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 8. MARKETPLACE LISTINGS
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_marketplace_listings (
  listing_id TEXT PRIMARY KEY,
  
  -- Seller
  seller_account TEXT NOT NULL,
  
  -- Asset
  asset_type TEXT NOT NULL,                -- ordinal, rune
  asset_id TEXT NOT NULL,                  -- inscription_id or rune_id
  asset_amount TEXT,                       -- NULL for ordinals, amount for runes
  
  -- Price (in KRAY Credits)
  price_credits TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',   -- active, sold, cancelled
  
  -- Buyer (when sold)
  buyer_account TEXT,
  
  -- Timestamps
  listed_at INTEGER NOT NULL,
  sold_at INTEGER,
  cancelled_at INTEGER,
  
  FOREIGN KEY (seller_account) REFERENCES l2_accounts(account_id),
  FOREIGN KEY (buyer_account) REFERENCES l2_accounts(account_id),
  
  CHECK (asset_type IN ('ordinal', 'rune')),
  CHECK (status IN ('active', 'sold', 'cancelled')),
  CHECK (CAST(price_credits AS INTEGER) > 0)
);

CREATE INDEX idx_listings_seller ON l2_marketplace_listings(seller_account);
CREATE INDEX idx_listings_status ON l2_marketplace_listings(status, listed_at DESC);
CREATE INDEX idx_listings_asset ON l2_marketplace_listings(asset_type, asset_id);
CREATE INDEX idx_listings_price ON l2_marketplace_listings(price_credits);

-- ───────────────────────────────────────────────────────────────────────────────
-- 9. GAMING REWARDS
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_gaming_rewards (
  reward_id TEXT PRIMARY KEY,
  
  -- User
  user_account TEXT NOT NULL,
  
  -- Reward details
  reward_type TEXT NOT NULL,               -- achievement, tournament, daily, etc
  reward_amount TEXT NOT NULL,             -- KRAY Credits
  
  -- Game context
  game_id TEXT,
  achievement_id TEXT,
  
  -- Status
  claimed BOOLEAN NOT NULL DEFAULT 0,
  
  -- Timestamps
  earned_at INTEGER NOT NULL,
  claimed_at INTEGER,
  expires_at INTEGER,
  
  FOREIGN KEY (user_account) REFERENCES l2_accounts(account_id),
  
  CHECK (reward_type IN ('achievement', 'tournament', 'daily', 'referral', 'loyalty')),
  CHECK (CAST(reward_amount AS INTEGER) > 0)
);

CREATE INDEX idx_rewards_user ON l2_gaming_rewards(user_account, earned_at DESC);
CREATE INDEX idx_rewards_claimed ON l2_gaming_rewards(claimed);
CREATE INDEX idx_rewards_expires ON l2_gaming_rewards(expires_at);

-- ───────────────────────────────────────────────────────────────────────────────
-- 10. AUDIT LOG
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS l2_audit_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Event details
  event_type TEXT NOT NULL,                -- deposit, withdrawal, transfer, etc
  event_data TEXT NOT NULL,                -- JSON with event details
  
  -- Related entities
  account_id TEXT,
  tx_hash TEXT,
  batch_id INTEGER,
  
  -- Timestamp
  created_at INTEGER NOT NULL,
  
  CHECK (event_type IN (
    'account_created', 'deposit', 'withdrawal', 'transfer',
    'swap', 'stake', 'unstake', 'listing', 'purchase',
    'validator_registered', 'validator_slashed', 'batch_published'
  ))
);

CREATE INDEX idx_audit_event ON l2_audit_log(event_type, created_at DESC);
CREATE INDEX idx_audit_account ON l2_audit_log(account_id, created_at DESC);
CREATE INDEX idx_audit_tx ON l2_audit_log(tx_hash);

-- ───────────────────────────────────────────────────────────────────────────────
-- VIEWS (Convenient queries)
-- ───────────────────────────────────────────────────────────────────────────────

-- View: Account summary with all balances
CREATE VIEW IF NOT EXISTS v_account_summary AS
SELECT 
  a.account_id,
  a.l1_address,
  a.balance_credits,
  a.staked_credits,
  a.locked_credits,
  (CAST(a.balance_credits AS INTEGER) + 
   CAST(a.staked_credits AS INTEGER) + 
   CAST(a.locked_credits AS INTEGER)) as total_credits,
  a.nonce,
  a.last_activity,
  COUNT(DISTINCT t.tx_hash) as total_transactions
FROM l2_accounts a
LEFT JOIN l2_transactions t ON (t.from_account = a.account_id OR t.to_account = a.account_id)
GROUP BY a.account_id;

-- View: Pending withdrawals ready to process
CREATE VIEW IF NOT EXISTS v_pending_withdrawals AS
SELECT 
  w.*,
  a.l1_address as account_l1_address,
  (w.challenge_deadline - strftime('%s', 'now')) as seconds_remaining
FROM l2_withdrawals w
JOIN l2_accounts a ON w.l2_account_id = a.account_id
WHERE w.status = 'pending'
  AND w.challenged = 0
  AND w.challenge_deadline <= strftime('%s', 'now');

-- View: Validator performance
CREATE VIEW IF NOT EXISTS v_validator_performance AS
SELECT 
  v.validator_id,
  v.validator_pubkey,
  v.staked_amount,
  v.rewards_earned,
  v.status,
  v.blocks_validated,
  v.uptime_percentage,
  (strftime('%s', 'now') - v.last_active) as seconds_since_active
FROM l2_validators v
ORDER BY v.staked_amount DESC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- INITIALIZATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════════

