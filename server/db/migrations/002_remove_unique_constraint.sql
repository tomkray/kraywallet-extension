-- Migration 002: Remove UNIQUE constraints to allow re-listing
-- Removes UNIQUE from both seller_txid/seller_vout AND psbt_hash

-- Drop old table if empty (fresh install)
DROP TABLE IF EXISTS atomic_listings;

-- Create new table without UNIQUE constraints
CREATE TABLE IF NOT EXISTS atomic_listings (
    order_id TEXT PRIMARY KEY,
    seller_txid TEXT NOT NULL,
    seller_vout INTEGER NOT NULL,
    seller_value INTEGER NOT NULL,
    seller_script_pubkey TEXT NOT NULL,
    seller_payout_address TEXT NOT NULL,
    price_sats INTEGER NOT NULL CHECK(price_sats >= 546),
    listing_psbt_base64 TEXT NOT NULL,
    psbt_hash TEXT NOT NULL,
    inscription_id TEXT,
    inscription_number INTEGER,
    content_type TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(
        status IN ('PENDING', 'OPEN', 'FILLED', 'CANCELLED', 'EXPIRED')
    ),
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    filled_at INTEGER,
    final_txid TEXT,
    final_buyer_address TEXT,
    creator_address TEXT NOT NULL,
    source TEXT DEFAULT 'kraywallet',
    likes_count INTEGER DEFAULT 0,
    updated_at INTEGER
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_atomic_listings_status ON atomic_listings(status);
CREATE INDEX IF NOT EXISTS idx_atomic_listings_inscription_id ON atomic_listings(inscription_id);
CREATE INDEX IF NOT EXISTS idx_atomic_listings_seller_address ON atomic_listings(creator_address);
CREATE INDEX IF NOT EXISTS idx_atomic_listings_created_at ON atomic_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atomic_listings_psbt_hash ON atomic_listings(psbt_hash);
CREATE INDEX IF NOT EXISTS idx_atomic_listings_active_utxo ON atomic_listings(seller_txid, seller_vout, status) WHERE status IN ('OPEN', 'PENDING_SIGNATURES');

