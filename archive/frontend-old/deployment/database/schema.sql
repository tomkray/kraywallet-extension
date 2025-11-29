-- ====================================
-- KRAY WALLET - Supabase Schema
-- ====================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================
-- INSCRIPTIONS
-- ====================================
CREATE TABLE IF NOT EXISTS inscriptions (
  id TEXT PRIMARY KEY,
  inscription_number BIGINT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  content_type TEXT,
  content_length INTEGER,
  output TEXT,
  genesis_height INTEGER,
  genesis_fee INTEGER,
  output_value INTEGER,
  sat BIGINT,
  timestamp BIGINT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inscriptions_address ON inscriptions(address);
CREATE INDEX IF NOT EXISTS idx_inscriptions_number ON inscriptions(inscription_number);
CREATE INDEX IF NOT EXISTS idx_inscriptions_created ON inscriptions(created_at DESC);

-- ====================================
-- RUNES
-- ====================================
CREATE TABLE IF NOT EXISTS runes (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  spaced_name TEXT,
  symbol TEXT,
  divisibility INTEGER DEFAULT 0,
  total_supply BIGINT,
  minted BIGINT DEFAULT 0,
  burned BIGINT DEFAULT 0,
  spacers INTEGER,
  turbo BOOLEAN DEFAULT FALSE,
  etching_height INTEGER,
  etching_txid TEXT,
  parent_inscription TEXT,
  thumbnail_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runes_name ON runes(name);
CREATE INDEX IF NOT EXISTS idx_runes_spaced_name ON runes(spaced_name);
CREATE INDEX IF NOT EXISTS idx_runes_etching_height ON runes(etching_height);

-- ====================================
-- RUNE BALANCES
-- ====================================
CREATE TABLE IF NOT EXISTS rune_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT NOT NULL,
  rune_id TEXT NOT NULL REFERENCES runes(id) ON DELETE CASCADE,
  balance BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(address, rune_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_balances_address ON rune_balances(address);
CREATE INDEX IF NOT EXISTS idx_balances_rune ON rune_balances(rune_id);
CREATE INDEX IF NOT EXISTS idx_balances_updated ON rune_balances(updated_at DESC);

-- ====================================
-- ACTIVITY CACHE
-- ====================================
CREATE TABLE IF NOT EXISTS activity_cache (
  address TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  tx_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_activity_updated ON activity_cache(updated_at DESC);

-- ====================================
-- ANALYTICS (Optional)
-- ====================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  address TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- ====================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================

-- Enable RLS
ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rune_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policies (Read-only público)
CREATE POLICY "Inscriptions são públicas" 
  ON inscriptions FOR SELECT 
  USING (true);

CREATE POLICY "Runes são públicas" 
  ON runes FOR SELECT 
  USING (true);

CREATE POLICY "Balances são públicos" 
  ON rune_balances FOR SELECT 
  USING (true);

CREATE POLICY "Activity cache é público" 
  ON activity_cache FOR SELECT 
  USING (true);

-- Analytics: apenas INSERT permitido
CREATE POLICY "Analytics apenas insert" 
  ON analytics_events FOR INSERT 
  WITH CHECK (true);

-- ====================================
-- FUNCTIONS
-- ====================================

-- Update timestamp automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_inscriptions_updated_at BEFORE UPDATE ON inscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_runes_updated_at BEFORE UPDATE ON runes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON rune_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- VIEWS
-- ====================================

-- View: Runes com balances agregados
CREATE OR REPLACE VIEW runes_summary AS
SELECT 
  r.*,
  COUNT(DISTINCT rb.address) as holder_count,
  SUM(rb.balance) as total_balance
FROM runes r
LEFT JOIN rune_balances rb ON r.id = rb.rune_id
GROUP BY r.id;

-- ====================================
-- INDEXES ADICIONAIS (Performance)
-- ====================================

-- GIN index para JSONB
CREATE INDEX IF NOT EXISTS idx_inscriptions_metadata_gin ON inscriptions USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_runes_metadata_gin ON runes USING GIN (metadata);

-- ====================================
-- CONCLUÍDO
-- ====================================

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Comentários
COMMENT ON TABLE inscriptions IS 'Bitcoin Ordinals Inscriptions';
COMMENT ON TABLE runes IS 'Bitcoin Runes (fungible tokens)';
COMMENT ON TABLE rune_balances IS 'Rune balances por endereço';
COMMENT ON TABLE activity_cache IS 'Cache de transações por endereço';






