-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔐 ATOMIC SWAP SCHEMA - SIGHASH_SINGLE|ANYONECANPAY (0x83)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Este schema implementa um marketplace não-custodial de 2 passos:
-- 1. Seller lista e assina (SIGHASH_SINGLE|ANYONECANPAY no input[0])
-- 2. Buyer compra (backend completa outputs + inputs, buyer assina, backend broadcast)
--
-- CONSENSO GARANTIDO:
-- - Seller payout (output[0]) é IMUTÁVEL (valor + endereço + índice)
-- - Qualquer alteração no output[0] invalida a assinatura do seller
-- - Taxa de 2% é adicionada como output separado (pago pelo buyer)
-- - Roteamento ordinal-aware (inscriptions vão para o buyer correto)
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tabela: atomic_listings
-- Representa ofertas de venda (seller assinou, aguardando buyer)
CREATE TABLE IF NOT EXISTS atomic_listings (
    -- Identificação
    order_id TEXT PRIMARY KEY,
    
    -- UTXO do Seller (inscrição ou ativo)
    seller_txid TEXT NOT NULL,
    seller_vout INTEGER NOT NULL,
    seller_value INTEGER NOT NULL,  -- valor do UTXO em sats
    seller_script_pubkey TEXT NOT NULL,  -- hex do scriptPubKey
    
    -- Payout do Seller (fixado no output[0])
    seller_payout_address TEXT NOT NULL,
    price_sats INTEGER NOT NULL CHECK(price_sats >= 546),  -- dust limit
    
    -- PSBT Assinado pelo Seller
    listing_psbt_base64 TEXT NOT NULL,
    psbt_hash TEXT NOT NULL UNIQUE,  -- hash SHA256 do PSBT (anti-replay)
    
    -- Metadados da Inscrição (se aplicável)
    inscription_id TEXT,
    inscription_number INTEGER,
    content_type TEXT,
    
    -- Status e Timestamps
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(
        status IN ('PENDING', 'OPEN', 'FILLED', 'CANCELLED', 'EXPIRED')
    ),
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    filled_at INTEGER,
    
    -- Auditoria
    creator_address TEXT NOT NULL,  -- endereço que criou (pode diferir de payout)
    source TEXT DEFAULT 'kraywallet',  -- origem: 'kraywallet', 'api', etc
    
    -- Índice único para prevenir double-spend
    UNIQUE(seller_txid, seller_vout)
);

-- Tabela: purchase_attempts
-- Registra tentativas de compra (buyer side)
CREATE TABLE IF NOT EXISTS purchase_attempts (
    -- Identificação
    attempt_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    
    -- PSBT em Construção (antes da assinatura do buyer)
    psbt_to_sign_base64 TEXT NOT NULL,
    psbt_hash TEXT NOT NULL UNIQUE,
    
    -- Buyer Info
    buyer_address TEXT NOT NULL,
    buyer_change_address TEXT,
    buyer_inputs_json TEXT NOT NULL,  -- JSON array dos UTXOs do buyer
    
    -- Estrutura da TX Final
    total_buyer_input INTEGER NOT NULL,
    inscription_output_value INTEGER,  -- output para inscription (→ buyer)
    market_fee_output_value INTEGER NOT NULL,  -- 2% fee (→ marketplace)
    change_output_value INTEGER,  -- troco (→ buyer)
    miner_fee INTEGER NOT NULL,
    
    -- TX Final (após broadcast)
    final_txid TEXT UNIQUE,
    
    -- Status
    state TEXT NOT NULL DEFAULT 'PENDING_SIGNATURES' CHECK(
        state IN ('PENDING_SIGNATURES', 'SIGNED', 'BROADCASTED', 'CONFIRMED', 'FAILED')
    ),
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    signed_at INTEGER,
    broadcasted_at INTEGER,
    confirmed_at INTEGER,
    
    -- Auditoria
    error_message TEXT,
    
    FOREIGN KEY (order_id) REFERENCES atomic_listings(order_id)
);

-- Tabela: marketplace_config
-- Configurações globais do marketplace
CREATE TABLE IF NOT EXISTS marketplace_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Inserir configurações padrão
INSERT OR IGNORE INTO marketplace_config (key, value, updated_at) VALUES
('market_fee_percentage', '2.0', strftime('%s', 'now')),
('market_fee_address', 'bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2', strftime('%s', 'now')),
('min_listing_price', '546', strftime('%s', 'now')),
('max_listing_duration_hours', '720', strftime('%s', 'now')),  -- 30 dias
('dust_limit', '546', strftime('%s', 'now')),
('min_fee_rate', '1', strftime('%s', 'now'));  -- sat/vB

-- ═══════════════════════════════════════════════════════════════════════════════
-- ÍNDICES (Performance)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Listagens
CREATE INDEX IF NOT EXISTS idx_listings_status ON atomic_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_seller_address ON atomic_listings(creator_address);
CREATE INDEX IF NOT EXISTS idx_listings_created ON atomic_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_expires ON atomic_listings(expires_at);
CREATE INDEX IF NOT EXISTS idx_listings_inscription ON atomic_listings(inscription_id);
CREATE INDEX IF NOT EXISTS idx_listings_utxo ON atomic_listings(seller_txid, seller_vout);

-- Compras
CREATE INDEX IF NOT EXISTS idx_purchases_order ON purchase_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchase_attempts(buyer_address);
CREATE INDEX IF NOT EXISTS idx_purchases_state ON purchase_attempts(state);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchase_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_txid ON purchase_attempts(final_txid);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS (Integridade e Auditoria)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger: Validar price_sats >= dust limit
CREATE TRIGGER IF NOT EXISTS validate_listing_price
BEFORE INSERT ON atomic_listings
BEGIN
    SELECT CASE
        WHEN NEW.price_sats < 546 THEN
            RAISE(ABORT, 'Price must be at least 546 sats (dust limit)')
    END;
END;

-- Trigger: Auto-expirar listagens antigas
-- (será executado via cron job ou ao buscar listagens)
-- CREATE TRIGGER IF NOT EXISTS auto_expire_listings
-- AFTER UPDATE ON atomic_listings
-- FOR EACH ROW
-- WHEN NEW.status = 'OPEN' AND NEW.expires_at < strftime('%s', 'now')
-- BEGIN
--     UPDATE atomic_listings SET status = 'EXPIRED' WHERE order_id = NEW.order_id;
-- END;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS (Consultas Otimizadas)
-- ═══════════════════════════════════════════════════════════════════════════════

-- View: Listagens ativas com metadados
CREATE VIEW IF NOT EXISTS active_listings AS
SELECT 
    l.order_id,
    l.seller_payout_address,
    l.price_sats,
    l.inscription_id,
    l.inscription_number,
    l.content_type,
    l.created_at,
    l.expires_at,
    l.creator_address,
    l.source,
    -- Calcular taxa do marketplace (2%)
    CAST(l.price_sats * 0.02 AS INTEGER) as market_fee_sats,
    -- Total que buyer precisa pagar (preço + taxa)
    l.price_sats + CAST(l.price_sats * 0.02 AS INTEGER) as total_buyer_cost
FROM atomic_listings l
WHERE l.status = 'OPEN' 
  AND (l.expires_at IS NULL OR l.expires_at > strftime('%s', 'now'));

-- View: Estatísticas do marketplace
CREATE VIEW IF NOT EXISTS marketplace_stats AS
SELECT
    -- Listagens
    (SELECT COUNT(*) FROM atomic_listings WHERE status = 'OPEN') as open_listings,
    (SELECT COUNT(*) FROM atomic_listings WHERE status = 'FILLED') as filled_listings,
    (SELECT COUNT(*) FROM atomic_listings WHERE status = 'CANCELLED') as cancelled_listings,
    -- Volume
    (SELECT SUM(price_sats) FROM atomic_listings WHERE status = 'FILLED') as total_volume_sats,
    (SELECT SUM(market_fee_output_value) FROM purchase_attempts WHERE state = 'CONFIRMED') as total_fees_collected,
    -- Compras
    (SELECT COUNT(*) FROM purchase_attempts WHERE state = 'CONFIRMED') as successful_purchases,
    (SELECT COUNT(*) FROM purchase_attempts WHERE state = 'FAILED') as failed_purchases;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMENTÁRIOS (Documentação)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Use: sqlite3 ordinals.db ".schema atomic_listings" para ver estrutura
-- Use: sqlite3 ordinals.db ".schema purchase_attempts" para ver estrutura

