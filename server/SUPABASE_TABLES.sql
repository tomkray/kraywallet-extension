-- 🗄️ KRAY STATION - SUPABASE TABLES
-- Cole este SQL no Supabase SQL Editor

-- 1. Inscriptions (cache de inscriptions)
CREATE TABLE IF NOT EXISTS inscriptions (
    id TEXT PRIMARY KEY,
    inscription_number BIGINT,
    content_type TEXT,
    content_length BIGINT,
    address TEXT,
    output_value BIGINT,
    listed BOOLEAN DEFAULT FALSE,
    price BIGINT DEFAULT 0,
    owner TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inscriptions_address ON inscriptions(address);
CREATE INDEX idx_inscriptions_listed ON inscriptions(listed);
CREATE INDEX idx_inscriptions_owner ON inscriptions(owner);

-- 2. Offers (Atomic Swap Marketplace)
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    inscription_id TEXT NOT NULL,
    seller_address TEXT NOT NULL,
    buyer_address TEXT,
    price BIGINT NOT NULL,
    status TEXT DEFAULT 'active',
    psbt_hex TEXT,
    seller_signature TEXT,
    buyer_signature TEXT,
    seller_txid TEXT,
    seller_vout INT,
    encrypted_signature TEXT,
    signature_key TEXT,
    sighash_type INT DEFAULT 1,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_seller ON offers(seller_address);
CREATE INDEX idx_offers_inscription ON offers(inscription_id);

-- 3. Users (Analytics)
CREATE TABLE IF NOT EXISTS users (
    address TEXT PRIMARY KEY,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    total_actions INT DEFAULT 0,
    reputation_score INT DEFAULT 0,
    metadata JSONB
);

-- 4. User Actions (tracking)
CREATE TABLE IF NOT EXISTS user_actions (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    action_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_actions_address ON user_actions(address);
CREATE INDEX idx_user_actions_type ON user_actions(action_type);

-- 5. Lightning Pools (DeFi)
CREATE TABLE IF NOT EXISTS lightning_pools (
    id SERIAL PRIMARY KEY,
    rune_id TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    btc_balance BIGINT DEFAULT 0,
    rune_balance BIGINT DEFAULT 0,
    total_liquidity BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Lightning Swaps (DeFi transactions)
CREATE TABLE IF NOT EXISTS lightning_swaps (
    id SERIAL PRIMARY KEY,
    pool_id INT REFERENCES lightning_pools(id),
    user_address TEXT NOT NULL,
    swap_type TEXT NOT NULL,
    amount_in BIGINT NOT NULL,
    amount_out BIGINT NOT NULL,
    status TEXT DEFAULT 'pending',
    txid TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Comentários
COMMENT ON TABLE inscriptions IS 'Cache de inscriptions detectadas';
COMMENT ON TABLE offers IS 'Marketplace P2P de inscriptions';
COMMENT ON TABLE users IS 'Usuários da plataforma';
COMMENT ON TABLE lightning_pools IS 'Pools de liquidez Lightning DeFi';

-- ✅ TODAS AS TABELAS CRIADAS!

