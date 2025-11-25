-- Migration 003: Remove UNIQUE constraint from purchase_attempts.psbt_hash
-- Permite que o buyer tente comprar várias vezes (se cancelar e tentar de novo)

-- Drop old table
DROP TABLE IF EXISTS purchase_attempts;

-- Recriar sem UNIQUE no psbt_hash
CREATE TABLE purchase_attempts (
    attempt_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    psbt_to_sign_base64 TEXT NOT NULL,
    psbt_hash TEXT NOT NULL, -- Removido UNIQUE daqui!
    buyer_address TEXT NOT NULL,
    buyer_change_address TEXT,
    buyer_inputs_json TEXT NOT NULL,
    total_buyer_input INTEGER NOT NULL,
    inscription_output_value INTEGER NOT NULL,
    market_fee_output_value INTEGER NOT NULL,
    change_output_value INTEGER NOT NULL,
    miner_fee INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'PENDING_SIGNATURES',
    final_txid TEXT UNIQUE, -- UNIQUE apenas no txid final
    final_psbt_base64 TEXT,
    broadcast_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES atomic_listings(order_id)
);

-- Índices para performance
CREATE INDEX idx_purchase_attempts_order ON purchase_attempts(order_id);
CREATE INDEX idx_purchase_attempts_state ON purchase_attempts(state);
CREATE INDEX idx_purchase_attempts_buyer ON purchase_attempts(buyer_address);
CREATE INDEX idx_purchase_attempts_created ON purchase_attempts(created_at);

