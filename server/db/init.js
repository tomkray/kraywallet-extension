// import Database from 'better-sqlite3'; // Desabilitado para Vercel
import { supabase, db } from './supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'ordinals.db');

// Criar diretório se não existir
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// export const db = new Database(DB_PATH); // SQLite local desabilitado
export { db, supabase } from './supabase.js'; // Usando Supabase

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Função para executar migrations
function runMigrations() {
    console.log('Running database migrations...');
    
    // Migration 1: Adicionar coluna sighash_type à tabela offers (se não existir)
    try {
        // Verificar se a coluna já existe
        const tableInfo = db.prepare("PRAGMA table_info(offers)").all();
        const hasSighashType = tableInfo.some(col => col.name === 'sighash_type');
        
        if (!hasSighashType) {
            db.exec(`ALTER TABLE offers ADD COLUMN sighash_type TEXT`);
            console.log('✅ Migration: Added sighash_type column to offers table');
        } else {
            console.log('ℹ️  Migration: sighash_type column already exists');
        }
    } catch (e) {
        // Tabela ainda não existe, será criada depois
        if (e.message.includes('no such table')) {
            console.log('ℹ️  Offers table does not exist yet, will be created');
        } else {
            console.error('Migration error:', e.message);
        }
    }
    
    // Migration 2: Adicionar coluna likes_count à tabela offers (se não existir)
    try {
        const tableInfo = db.prepare("PRAGMA table_info(offers)").all();
        const hasLikesCount = tableInfo.some(col => col.name === 'likes_count');
        
        if (!hasLikesCount) {
            db.exec(`ALTER TABLE offers ADD COLUMN likes_count INTEGER DEFAULT 0`);
            console.log('✅ Migration: Added likes_count column to offers table');
        } else {
            console.log('ℹ️  Migration: likes_count column already exists');
        }
    } catch (e) {
        if (e.message.includes('no such table')) {
            console.log('ℹ️  Offers table does not exist yet, will be created');
        } else {
            console.error('Migration error:', e.message);
        }
    }
    
    // Migration 3: Adicionar colunas de ORD integration (source, service_fee)
    try {
        const tableInfo = db.prepare("PRAGMA table_info(offers)").all();
        const hasSource = tableInfo.some(col => col.name === 'source');
        const hasServiceFeePercentage = tableInfo.some(col => col.name === 'service_fee_percentage');
        const hasServiceFeeAddress = tableInfo.some(col => col.name === 'service_fee_address');
        
        if (!hasSource) {
            db.exec(`ALTER TABLE offers ADD COLUMN source TEXT DEFAULT 'kraywallet'`);
            console.log('✅ Migration: Added source column to offers table');
        } else {
            console.log('ℹ️  Migration: source column already exists');
        }
        
        if (!hasServiceFeePercentage) {
            db.exec(`ALTER TABLE offers ADD COLUMN service_fee_percentage REAL DEFAULT 0.0`);
            console.log('✅ Migration: Added service_fee_percentage column to offers table');
        } else {
            console.log('ℹ️  Migration: service_fee_percentage column already exists');
        }
        
        if (!hasServiceFeeAddress) {
            db.exec(`ALTER TABLE offers ADD COLUMN service_fee_address TEXT`);
            console.log('✅ Migration: Added service_fee_address column to offers table');
        } else {
            console.log('ℹ️  Migration: service_fee_address column already exists');
        }
    } catch (e) {
        if (e.message.includes('no such table')) {
            console.log('ℹ️  Offers table does not exist yet, will be created');
        } else {
            console.error('Migration error:', e.message);
        }
    }
    
    // Migration 4: Adicionar coluna encrypted_key para criptografia de PSBTs
    try {
        const tableInfo = db.prepare("PRAGMA table_info(offers)").all();
        const hasEncryptedKey = tableInfo.some(col => col.name === 'encrypted_key');
        
        if (!hasEncryptedKey) {
            db.exec(`ALTER TABLE offers ADD COLUMN encrypted_key TEXT`);
            console.log('✅ Migration: Added encrypted_key column to offers table');
            console.log('   🔐 PSBTs will now be encrypted with AES-256-GCM + RSA-OAEP');
        } else {
            console.log('ℹ️  Migration: encrypted_key column already exists');
        }
    } catch (e) {
        if (e.message.includes('no such table')) {
            console.log('ℹ️  Offers table does not exist yet, will be created');
        } else {
            console.error('Migration error:', e.message);
        }
    }
    
    // Migration 5: Adicionar colunas para ENCRYPTED SIGNATURE ATOMIC SWAP
    try {
        const tableInfo = db.prepare("PRAGMA table_info(offers)").all();
        const hasEncryptedSignature = tableInfo.some(col => col.name === 'encrypted_signature');
        const hasSignatureKey = tableInfo.some(col => col.name === 'signature_key');
        
        if (!hasEncryptedSignature) {
            db.exec(`ALTER TABLE offers ADD COLUMN encrypted_signature TEXT`);
            console.log('✅ Migration: Added encrypted_signature column to offers table');
        } else {
            console.log('ℹ️  Migration: encrypted_signature column already exists');
        }
        
        if (!hasSignatureKey) {
            db.exec(`ALTER TABLE offers ADD COLUMN signature_key TEXT`);
            console.log('✅ Migration: Added signature_key column to offers table');
            console.log('   🔐 Seller signatures will be encrypted separately for atomic swap security');
        } else {
            console.log('ℹ️  Migration: signature_key column already exists');
        }
    } catch (e) {
        if (e.message.includes('no such table')) {
            console.log('ℹ️  Offers table does not exist yet, will be created');
        } else {
            console.error('Migration error:', e.message);
        }
    }
    
    // Migration 6: Synthetic Runes System (L2 Lightning)
    try {
        // Verificar se as tabelas já existem
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('virtual_pool_state', 'virtual_balances', 'lightning_swaps', 'redemptions', 'deposits')
        `).all();
        
        if (tables.length === 0) {
            console.log('📦 Applying Synthetic Runes migration...');
            
            // Ler e executar o SQL file
            const migrationPath = path.join(__dirname, 'migrations', '002_synthetic_runes_system.sql');
            
            if (fs.existsSync(migrationPath)) {
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                
                // Split por statements (ponto-e-vírgula)
                const statements = migrationSQL
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));
                
                for (const statement of statements) {
                    try {
                        db.exec(statement);
                    } catch (err) {
                        // Ignorar erros de "already exists"
                        if (!err.message.includes('already exists')) {
                            console.warn('Warning in synthetic runes migration:', err.message);
                        }
                    }
                }
                
                console.log('✅ Migration: Synthetic Runes System applied!');
                console.log('   🌩️  Lightning swaps enabled');
                console.log('   💎 Synthetic runes tracking ready');
            } else {
                console.log('ℹ️  Synthetic Runes migration file not found, creating tables manually...');
                
                // Criar tabelas manualmente se o arquivo não existir
                db.exec(`
                    CREATE TABLE IF NOT EXISTS virtual_pool_state (
                        pool_id TEXT PRIMARY KEY,
                        virtual_btc INTEGER NOT NULL,
                        virtual_rune_amount REAL NOT NULL,
                        k REAL NOT NULL,
                        total_swaps INTEGER DEFAULT 0,
                        total_volume_btc INTEGER DEFAULT 0,
                        fees_collected_btc INTEGER DEFAULT 0,
                        last_update INTEGER NOT NULL,
                        created_at TEXT DEFAULT (datetime('now'))
                    );
                    
                    CREATE TABLE IF NOT EXISTS virtual_balances (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_address TEXT NOT NULL,
                        pool_id TEXT NOT NULL,
                        rune_id TEXT NOT NULL,
                        virtual_amount REAL NOT NULL,
                        status TEXT NOT NULL DEFAULT 'active',
                        created_at TEXT DEFAULT (datetime('now')),
                        redeemed_at TEXT
                    );
                    
                    CREATE TABLE IF NOT EXISTS lightning_swaps (
                        swap_id TEXT PRIMARY KEY,
                        pool_id TEXT NOT NULL,
                        user_address TEXT NOT NULL,
                        swap_type TEXT NOT NULL,
                        from_asset TEXT NOT NULL,
                        to_asset TEXT NOT NULL,
                        amount_in INTEGER NOT NULL,
                        amount_out REAL NOT NULL,
                        fee_sats INTEGER NOT NULL,
                        price REAL NOT NULL,
                        slippage REAL,
                        payment_hash TEXT,
                        status TEXT NOT NULL DEFAULT 'pending',
                        created_at TEXT DEFAULT (datetime('now')),
                        completed_at TEXT
                    );
                    
                    CREATE TABLE IF NOT EXISTS redemptions (
                        redemption_id TEXT PRIMARY KEY,
                        user_address TEXT NOT NULL,
                        pool_id TEXT NOT NULL,
                        rune_id TEXT NOT NULL,
                        virtual_amount REAL NOT NULL,
                        real_amount REAL NOT NULL,
                        txid TEXT,
                        status TEXT NOT NULL DEFAULT 'pending',
                        created_at TEXT DEFAULT (datetime('now'))
                    );
                    
                    CREATE TABLE IF NOT EXISTS deposits (
                        deposit_id TEXT PRIMARY KEY,
                        user_address TEXT NOT NULL,
                        pool_id TEXT NOT NULL,
                        rune_id TEXT NOT NULL,
                        real_amount REAL NOT NULL,
                        virtual_amount REAL NOT NULL,
                        txid TEXT NOT NULL,
                        vout INTEGER NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        created_at TEXT DEFAULT (datetime('now'))
                    );
                `);
                
                console.log('✅ Synthetic Runes tables created manually');
            }
        } else {
            console.log('ℹ️  Migration: Synthetic Runes tables already exist');
        }
    } catch (e) {
        console.error('❌ Error in Synthetic Runes migration:', e.message);
    }
    
    console.log('✅ Migrations completed');
}

export async function initDatabase() {
    console.log('Initializing database...');
    
    // Executar migrations primeiro (antes de criar tabelas)
    runMigrations();

    // 🔐 Aplicar Atomic Swap Migration (SIGHASH_SINGLE|ANYONECANPAY)
    try {
        const { migrateAtomicSwap } = await import('./migrateAtomicSwap.js');
        await migrateAtomicSwap();
    } catch (error) {
        console.error('⚠️  Atomic Swap migration error:', error.message);
        // Continuar mesmo se falhar (pode já estar aplicado)
    }

    // Tabela de Inscriptions (Ordinals)
    db.exec(`
        CREATE TABLE IF NOT EXISTS inscriptions (
            id TEXT PRIMARY KEY,
            inscription_number INTEGER UNIQUE NOT NULL,
            content_type TEXT,
            content_length INTEGER,
            content TEXT,
            genesis_height INTEGER,
            genesis_fee INTEGER,
            output_value INTEGER,
            address TEXT,
            sat INTEGER,
            timestamp INTEGER,
            listed BOOLEAN DEFAULT 0,
            price INTEGER,
            owner TEXT,
            metadata TEXT
        )
    `);

    // Tabela de Runes
    db.exec(`
        CREATE TABLE IF NOT EXISTS runes (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            symbol TEXT,
            total_supply INTEGER,
            minted INTEGER,
            decimals INTEGER DEFAULT 0,
            spacers INTEGER,
            turbo BOOLEAN DEFAULT 0,
            etching_height INTEGER,
            etching_txid TEXT,
            metadata TEXT
        )
    `);

    // ⚡ LIGHTNING NETWORK TABLES
    
    // Tabela de Lightning Pools (AMM)
    db.exec(`
        CREATE TABLE IF NOT EXISTS lightning_pools (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            token_a TEXT NOT NULL,
            token_b TEXT,
            reserve_a INTEGER NOT NULL DEFAULT 0,
            reserve_b INTEGER NOT NULL DEFAULT 0,
            fee_percent REAL NOT NULL DEFAULT 0.3,
            volume_24h INTEGER DEFAULT 0,
            volume_all_time INTEGER DEFAULT 0,
            swap_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            status TEXT DEFAULT 'active'
        )
    `);

    // Tabela de Hub Channels
    db.exec(`
        CREATE TABLE IF NOT EXISTS hub_channels (
            channel_id TEXT PRIMARY KEY,
            user_pubkey TEXT NOT NULL,
            user_address TEXT,
            capacity INTEGER NOT NULL,
            asset_type TEXT NOT NULL,
            asset_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            closed_at INTEGER
        )
    `);

    // Tabela de Hub Swaps
    db.exec(`
        CREATE TABLE IF NOT EXISTS hub_swaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pool_id TEXT NOT NULL,
            user_pubkey TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            from_asset TEXT NOT NULL,
            to_asset TEXT NOT NULL,
            amount_in INTEGER NOT NULL,
            amount_out INTEGER NOT NULL,
            pool_fee INTEGER NOT NULL,
            lightning_fee INTEGER NOT NULL,
            price_impact REAL,
            payment_hash TEXT,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (pool_id) REFERENCES lightning_pools(id),
            FOREIGN KEY (channel_id) REFERENCES hub_channels(channel_id)
        )
    `);

    // Tabela de Channel Rune Metadata
    db.exec(`
        CREATE TABLE IF NOT EXISTS channel_rune_metadata (
            channel_id TEXT PRIMARY KEY,
            rune_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (channel_id) REFERENCES hub_channels(channel_id)
        )
    `);

    // Índices para Lightning tables
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lightning_pools_status ON lightning_pools(status);
        CREATE INDEX IF NOT EXISTS idx_hub_channels_user ON hub_channels(user_pubkey);
        CREATE INDEX IF NOT EXISTS idx_hub_channels_address ON hub_channels(user_address);
        CREATE INDEX IF NOT EXISTS idx_hub_channels_status ON hub_channels(status);
        CREATE INDEX IF NOT EXISTS idx_hub_swaps_pool ON hub_swaps(pool_id);
        CREATE INDEX IF NOT EXISTS idx_hub_swaps_user ON hub_swaps(user_pubkey);
        CREATE INDEX IF NOT EXISTS idx_hub_swaps_timestamp ON hub_swaps(timestamp);
    `);

    // Tabela de Balances de Runes
    db.exec(`
        CREATE TABLE IF NOT EXISTS rune_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            rune_id TEXT NOT NULL,
            balance INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (rune_id) REFERENCES runes(id),
            UNIQUE(address, rune_id)
        )
    `);

    // Tabela de Offers (PSBT)
    db.exec(`
        CREATE TABLE IF NOT EXISTS offers (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK(type IN ('inscription', 'rune_swap')),
            inscription_id TEXT,
            from_rune TEXT,
            to_rune TEXT,
            from_amount INTEGER,
            to_amount INTEGER,
            offer_amount INTEGER,
            fee_rate INTEGER,
            psbt TEXT NOT NULL,
            creator_address TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
            created_at INTEGER NOT NULL,
            expires_at INTEGER,
            filled_at INTEGER,
            txid TEXT,
            sighash_type TEXT,
            likes_count INTEGER DEFAULT 0,
            source TEXT DEFAULT 'kraywallet',
            service_fee_percentage REAL DEFAULT 0.0,
            service_fee_address TEXT,
            encrypted_key TEXT,
            encrypted_signature TEXT,
            signature_key TEXT
        )
    `);

    // Tabela de Histórico de Vendas (Sales History)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inscription_id TEXT NOT NULL,
            inscription_number INTEGER,
            seller_address TEXT NOT NULL,
            buyer_address TEXT NOT NULL,
            sale_price INTEGER NOT NULL,
            fee_rate INTEGER,
            txid TEXT NOT NULL,
            block_height INTEGER,
            confirmed_at INTEGER,
            sale_date INTEGER NOT NULL,
            sighash_type TEXT,
            offer_id TEXT,
            FOREIGN KEY (inscription_id) REFERENCES inscriptions(id)
        )
    `);
    
    // Índices para histórico de vendas
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_inscription ON sales_history(inscription_id);
        CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales_history(seller_address);
        CREATE INDEX IF NOT EXISTS idx_sales_buyer ON sales_history(buyer_address);
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_history(sale_date DESC);
    `);
    
    // 💝 Tabela de Likes (Sistema Social)
    db.exec(`
        CREATE TABLE IF NOT EXISTS offer_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            offer_id TEXT NOT NULL,
            address TEXT NOT NULL,
            signature TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
            UNIQUE(offer_id, address)
        )
    `);
    
    // Índices para likes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_likes_offer ON offer_likes(offer_id);
        CREATE INDEX IF NOT EXISTS idx_likes_address ON offer_likes(address);
        CREATE INDEX IF NOT EXISTS idx_likes_created ON offer_likes(created_at);
    `);

    // 📊 Tabela de User Analytics (Sistema de Rastreamento)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            action_type TEXT NOT NULL,
            action_data TEXT,
            offer_id TEXT,
            inscription_id TEXT,
            rune_id TEXT,
            amount INTEGER,
            created_at INTEGER NOT NULL
        )
    `);
    
    // Índices para analytics
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_analytics_address ON user_analytics(address);
        CREATE INDEX IF NOT EXISTS idx_analytics_action ON user_analytics(action_type);
        CREATE INDEX IF NOT EXISTS idx_analytics_created ON user_analytics(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_analytics_offer ON user_analytics(offer_id);
    `);

    // 🎨 Tabela de User Profiles (Avatars e Reputação)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            address TEXT PRIMARY KEY,
            avatar_seed TEXT NOT NULL,
            avatar_style TEXT DEFAULT 'identicon',
            display_name TEXT,
            bio TEXT,
            reputation_score INTEGER DEFAULT 0,
            total_sales INTEGER DEFAULT 0,
            total_purchases INTEGER DEFAULT 0,
            total_likes_given INTEGER DEFAULT 0,
            total_likes_received INTEGER DEFAULT 0,
            total_volume_sold INTEGER DEFAULT 0,
            total_volume_bought INTEGER DEFAULT 0,
            join_date INTEGER NOT NULL,
            last_activity INTEGER NOT NULL
        )
    `);
    
    // Índices para profiles
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON user_profiles(reputation_score DESC);
        CREATE INDEX IF NOT EXISTS idx_profiles_sales ON user_profiles(total_sales DESC);
        CREATE INDEX IF NOT EXISTS idx_profiles_volume ON user_profiles(total_volume_sold DESC);
    `);

    // Tabela de Liquidity Pools (DEX AMM)
    db.exec(`
        CREATE TABLE IF NOT EXISTS liquidity_pools (
            id TEXT PRIMARY KEY,
            pool_name TEXT NOT NULL,
            pool_image TEXT,
            pool_inscription_id TEXT,
            pool_inscription_number INTEGER,
            use_inscription INTEGER DEFAULT 0,
            creator_address TEXT NOT NULL,
            rune_a TEXT NOT NULL,
            rune_a_name TEXT,
            rune_b TEXT,
            rune_b_name TEXT,
            is_btc_pair INTEGER DEFAULT 0,
            reserve_a INTEGER NOT NULL DEFAULT 0,
            reserve_b INTEGER NOT NULL DEFAULT 0,
            total_liquidity INTEGER NOT NULL DEFAULT 0,
            lp_token_supply INTEGER NOT NULL DEFAULT 0,
            volume_24h INTEGER DEFAULT 0,
            volume_7d INTEGER DEFAULT 0,
            volume_all_time INTEGER DEFAULT 0,
            fee_rate INTEGER DEFAULT 30,
            swap_count INTEGER DEFAULT 0,
            last_swap_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            UNIQUE(rune_a, rune_b)
        )
    `);
    
    // Tabela de LP Token Holdings (quem tem liquidez em qual pool)
    db.exec(`
        CREATE TABLE IF NOT EXISTS lp_holdings (
            id TEXT PRIMARY KEY,
            pool_id TEXT NOT NULL,
            holder_address TEXT NOT NULL,
            lp_tokens INTEGER NOT NULL DEFAULT 0,
            initial_a INTEGER NOT NULL,
            initial_b INTEGER NOT NULL,
            added_at INTEGER NOT NULL,
            FOREIGN KEY (pool_id) REFERENCES liquidity_pools(id),
            UNIQUE(pool_id, holder_address)
        )
    `);

    // Tabela de Trades
    db.exec(`
        CREATE TABLE IF NOT EXISTS trades (
            id TEXT PRIMARY KEY,
            pool_id TEXT,
            type TEXT CHECK(type IN ('buy', 'sell', 'swap')),
            from_rune TEXT,
            to_rune TEXT,
            from_amount INTEGER,
            to_amount INTEGER,
            price REAL,
            fee INTEGER,
            trader_address TEXT,
            txid TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (pool_id) REFERENCES liquidity_pools(id)
        )
    `);

    // Tabela de Wallet Sweeps
    db.exec(`
        CREATE TABLE IF NOT EXISTS wallet_sweeps (
            id TEXT PRIMARY KEY,
            from_address TEXT NOT NULL,
            to_address TEXT NOT NULL,
            amount INTEGER NOT NULL,
            fee_rate INTEGER NOT NULL,
            utxo_count INTEGER,
            psbt TEXT NOT NULL,
            txid TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'broadcasted', 'confirmed', 'failed')),
            created_at INTEGER NOT NULL,
            confirmed_at INTEGER
        )
    `);

    // Índices para performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_inscriptions_number ON inscriptions(inscription_number);
        CREATE INDEX IF NOT EXISTS idx_inscriptions_address ON inscriptions(address);
        CREATE INDEX IF NOT EXISTS idx_inscriptions_listed ON inscriptions(listed);
        CREATE INDEX IF NOT EXISTS idx_runes_name ON runes(name);
        CREATE INDEX IF NOT EXISTS idx_rune_balances_address ON rune_balances(address);
        CREATE INDEX IF NOT EXISTS idx_offers_type ON offers(type);
        CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
        CREATE INDEX IF NOT EXISTS idx_offers_creator ON offers(creator_address);
        CREATE INDEX IF NOT EXISTS idx_trades_pool ON trades(pool_id);
        CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at);
        CREATE INDEX IF NOT EXISTS idx_pools_creator ON liquidity_pools(creator_address);
        CREATE INDEX IF NOT EXISTS idx_pools_status ON liquidity_pools(status);
        CREATE INDEX IF NOT EXISTS idx_pools_volume ON liquidity_pools(volume_24h DESC);
        CREATE INDEX IF NOT EXISTS idx_pools_tvl ON liquidity_pools(total_liquidity DESC);
        CREATE INDEX IF NOT EXISTS idx_lp_holdings_pool ON lp_holdings(pool_id);
        CREATE INDEX IF NOT EXISTS idx_lp_holdings_holder ON lp_holdings(holder_address);
    `);

    console.log('✅ Database schema created');

    // Inserir dados de exemplo
    // TODO: Fix seed data for new schema
    // await seedDatabase();

    return db;
}

async function seedDatabase() {
    // Verificar se JÁ tem runes (não inscriptions, pois não usamos mock inscriptions)
    const runesCount = db.prepare('SELECT COUNT(*) as count FROM runes').get();
    
    if (runesCount.count > 0) {
        console.log('Database already seeded, skipping...');
        return;
    }

    console.log('Seeding database with sample data...');

    // NÃO inserir inscriptions mock - apenas inscriptions reais das ofertas
    console.log('📝 Skipping mock inscriptions - only real offers will be shown');

    // Inserir runes de exemplo
    const insertRune = db.prepare(`
        INSERT INTO runes 
        (id, name, symbol, total_supply, minted, decimals, etching_height, etching_txid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleRunes = [
        ['rune_1', 'UNCOMMON•GOODS', 'UG', 21000000, 15000000, 8, 840000, 'txid1...'],
        ['rune_2', 'EPIC•SATS', 'ES', 100000000, 80000000, 8, 840100, 'txid2...'],
        ['rune_3', 'RARE•VIBES', 'RV', 50000000, 40000000, 8, 840200, 'txid3...'],
        ['rune_4', 'LEGENDARY•ONES', 'LO', 1000000, 750000, 8, 840300, 'txid4...'],
        ['rune_5', 'MYTHIC•RUNE', 'MR', 500000, 300000, 8, 840400, 'txid5...']
    ];

    for (const rune of sampleRunes) {
        insertRune.run(...rune);
    }

    // Inserir pools de liquidez
    const insertPool = db.prepare(`
        INSERT INTO liquidity_pools 
        (id, rune_a, rune_b, reserve_a, reserve_b, total_liquidity, volume_24h, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const samplePools = [
        ['pool_1', 'rune_1', 'rune_2', 1500000, 3000000, 2121320, 250000, Date.now()],
        ['pool_2', 'rune_3', 'rune_4', 850000, 170000, 380789, 180000, Date.now()],
        ['pool_3', 'rune_5', 'rune_2', 2100000, 4200000, 2969848, 420000, Date.now()]
    ];

    for (const pool of samplePools) {
        insertPool.run(...pool);
    }

    console.log('✅ Database seeded with sample data');
}

export function closeDatabase() {
    db.close();
}

export function getDatabase() {
    return db;
}


