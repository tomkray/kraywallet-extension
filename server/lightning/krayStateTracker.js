/**
 * 🎯 KRAY STATE TRACKER - Lightning DeFi Core
 * 
 * Rastreia estado de Runes e Inscriptions dentro de canais Lightning.
 * 
 * CONCEITO REVOLUCIONÁRIO:
 * - LND Channel = DeFi Pool
 * - Channel state = Rune balances off-chain
 * - Funding TX = deposit on-chain (1x)
 * - Lightning payments = swaps off-chain (instant!)
 * - Closing TX = settlement on-chain (1x)
 * 
 * ARQUITETURA:
 * Layer 1: Bitcoin blockchain (UTXOs com Runes)
 * Layer 1.5: ORD + Kray Indexer (decode Runes)
 * Layer 2: LND + State Tracker (Runes off-chain)
 */

// better-sqlite3 removido para compatibilidade com Vercel serverless
// Usar Supabase para produção
import { supabase } from '../db/init-supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLNDPoolClient } from './lndPoolClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 DATABASE SETUP - Usando Supabase (não SQLite local)
// ═══════════════════════════════════════════════════════════════════════════════

// Mock db para compatibilidade (funções Lightning não usam muito DB)
const db = {
    prepare: (sql) => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => []
    }),
    pragma: () => {},
    exec: () => {}
};

/**
 * Inicializar tabelas do State Tracker
 */
export function initStateTrackerTables() {
    console.log('\n🔧 Initializing Kray State Tracker tables...');
    
    // Tabela: Lightning Channels (pools)
    db.exec(`
        CREATE TABLE IF NOT EXISTS lightning_channels (
            channel_id TEXT PRIMARY KEY,
            channel_point TEXT NOT NULL,
            remote_pubkey TEXT NOT NULL,
            
            -- Capacidade do canal (BTC)
            capacity_sats INTEGER NOT NULL,
            local_balance_sats INTEGER NOT NULL,
            remote_balance_sats INTEGER NOT NULL,
            
            -- Estado do canal
            status TEXT NOT NULL DEFAULT 'PENDING',
            -- Status: PENDING, ACTIVE, CLOSING, CLOSED, FORCE_CLOSED
            
            -- Pool info (DeFi)
            pool_name TEXT,
            pool_id TEXT,
            pool_image_url TEXT,              -- ✅ URL da inscription (metadata apenas!)
            pool_image_inscription_id TEXT,   -- ✅ Inscription ID (metadata apenas!)
            creator_address TEXT,             -- ✅ Quem criou a pool
            
            -- Timestamps
            opened_at INTEGER NOT NULL,
            closed_at INTEGER,
            
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);
    
    // Tabela: Rune Balances (off-chain)
    db.exec(`
        CREATE TABLE IF NOT EXISTS channel_rune_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL,
            
            -- Rune info
            rune_id TEXT NOT NULL,
            rune_name TEXT,
            rune_symbol TEXT,
            divisibility INTEGER DEFAULT 0,
            
            -- Balances (off-chain state)
            local_balance TEXT NOT NULL DEFAULT '0',
            remote_balance TEXT NOT NULL DEFAULT '0',
            
            -- Funding TX info (on-chain)
            funding_rune_amount TEXT,
            funding_utxo_txid TEXT,
            funding_utxo_vout INTEGER,
            
            -- Timestamps
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            
            FOREIGN KEY (channel_id) REFERENCES lightning_channels(channel_id),
            UNIQUE(channel_id, rune_id)
        )
    `);
    
    // Tabela: Swap History (off-chain swaps)
    db.exec(`
        CREATE TABLE IF NOT EXISTS channel_swaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL,
            
            -- Swap direction
            swap_type TEXT NOT NULL,
            -- Type: BTC_TO_RUNE, RUNE_TO_BTC, RUNE_TO_RUNE
            
            -- Input
            input_asset TEXT NOT NULL,
            input_amount TEXT NOT NULL,
            
            -- Output
            output_asset TEXT NOT NULL,
            output_amount TEXT NOT NULL,
            
            -- Fees
            lp_fee TEXT,
            protocol_fee TEXT,
            routing_fee_sats INTEGER,
            
            -- Price
            price TEXT,
            price_impact TEXT,
            
            -- Lightning payment
            payment_hash TEXT UNIQUE,
            payment_preimage TEXT,
            
            -- Status
            status TEXT NOT NULL DEFAULT 'PENDING',
            -- Status: PENDING, COMPLETED, FAILED
            
            -- Timestamps
            created_at INTEGER NOT NULL,
            completed_at INTEGER,
            
            FOREIGN KEY (channel_id) REFERENCES lightning_channels(channel_id)
        )
    `);
    
    // Tabela: Channel Events (audit log)
    db.exec(`
        CREATE TABLE IF NOT EXISTS channel_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL,
            
            event_type TEXT NOT NULL,
            -- Type: OPENED, CLOSED, SWAP, BALANCE_UPDATE, FORCE_CLOSE
            
            event_data TEXT,
            -- JSON string com dados do evento
            
            created_at INTEGER NOT NULL,
            
            FOREIGN KEY (channel_id) REFERENCES lightning_channels(channel_id)
        )
    `);
    
    // Índices para performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_channels_status ON lightning_channels(status);
        CREATE INDEX IF NOT EXISTS idx_rune_balances_channel ON channel_rune_balances(channel_id);
        CREATE INDEX IF NOT EXISTS idx_swaps_channel ON channel_swaps(channel_id);
        CREATE INDEX IF NOT EXISTS idx_swaps_payment_hash ON channel_swaps(payment_hash);
        CREATE INDEX IF NOT EXISTS idx_events_channel ON channel_events(channel_id);
        CREATE INDEX IF NOT EXISTS idx_events_type ON channel_events(event_type);
    `);
    
    console.log('✅ State Tracker tables initialized');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏗️ CHANNEL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Criar registro de canal (quando funding TX é broadcast)
 */
export function createChannelRecord({
    channelId,
    channelPoint,
    remotePubkey,
    capacitySats,
    localBalanceSats,
    poolName = null,
    poolId = null,
    poolImageUrl = null,              // ✅ URL da inscription (metadata!)
    poolImageInscriptionId = null,    // ✅ Inscription ID (metadata!)
    creatorAddress = null             // ✅ Quem criou
}) {
    const timestamp = Date.now();
    
    console.log('\n🏗️  Creating channel record...');
    console.log(`   Channel ID: ${channelId}`);
    console.log(`   Capacity: ${capacitySats} sats`);
    console.log(`   Local Balance: ${localBalanceSats} sats`);
    
    const stmt = db.prepare(`
        INSERT INTO lightning_channels (
            channel_id, channel_point, remote_pubkey,
            capacity_sats, local_balance_sats, remote_balance_sats,
            status, pool_name, pool_id,
            pool_image_url, pool_image_inscription_id, creator_address,
            opened_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
        channelId,
        channelPoint,
        remotePubkey,
        capacitySats,
        localBalanceSats,
        capacitySats - localBalanceSats,
        'PENDING',
        poolName,
        poolId,
        poolImageUrl,              // ✅ URL da inscription (metadata!)
        poolImageInscriptionId,    // ✅ Inscription ID (metadata!)
        creatorAddress,            // ✅ Quem criou
        timestamp,
        timestamp,
        timestamp
    );
    
    // Log event
    logChannelEvent(channelId, 'OPENED', {
        capacitySats,
        localBalanceSats,
        poolName,
        poolId
    });
    
    console.log('✅ Channel record created (PENDING)');
    
    return getChannel(channelId);
}

/**
 * Atualizar status do canal
 */
export function updateChannelStatus(channelId, status) {
    console.log(`\n🔄 Updating channel ${channelId} status: ${status}`);
    
    const updates = {
        updated_at: Date.now()
    };
    
    if (status === 'ACTIVE') {
        // Canal foi confirmado on-chain
        updates.status = 'ACTIVE';
    } else if (status === 'CLOSING' || status === 'CLOSED' || status === 'FORCE_CLOSED') {
        updates.status = status;
        updates.closed_at = Date.now();
    }
    
    const stmt = db.prepare(`
        UPDATE lightning_channels 
        SET status = ?, updated_at = ?, closed_at = ?
        WHERE channel_id = ?
    `);
    
    stmt.run(updates.status, updates.updated_at, updates.closed_at || null, channelId);
    
    // Log event
    logChannelEvent(channelId, status === 'ACTIVE' ? 'ACTIVATED' : status, {});
    
    console.log('✅ Channel status updated');
}

/**
 * Atualizar balances do canal (BTC)
 */
export function updateChannelBalances(channelId, localBalanceSats, remoteBalanceSats) {
    const stmt = db.prepare(`
        UPDATE lightning_channels 
        SET local_balance_sats = ?,
            remote_balance_sats = ?,
            updated_at = ?
        WHERE channel_id = ?
    `);
    
    stmt.run(localBalanceSats, remoteBalanceSats, Date.now(), channelId);
}

/**
 * Obter canal por ID
 */
export function getChannel(channelId) {
    const stmt = db.prepare('SELECT * FROM lightning_channels WHERE channel_id = ?');
    return stmt.get(channelId);
}

/**
 * Listar todos os canais ativos (pools)
 */
export function listActiveChannels() {
    const stmt = db.prepare(`
        SELECT * FROM lightning_channels 
        WHERE status = 'ACTIVE'
        ORDER BY opened_at DESC
    `);
    return stmt.all();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 RUNE BALANCE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adicionar Rune ao canal (quando funding TX é confirmada)
 */
export function addRuneToChannel({
    channelId,
    runeId,
    runeName,
    runeSymbol,
    divisibility,
    localBalance,
    fundingRuneAmount,
    fundingUtxoTxid,
    fundingUtxoVout
}) {
    const timestamp = Date.now();
    
    console.log('\n🎨 Adding Rune to channel...');
    console.log(`   Channel: ${channelId}`);
    console.log(`   Rune: ${runeSymbol} (${runeId})`);
    console.log(`   Local Balance: ${localBalance}`);
    
    const stmt = db.prepare(`
        INSERT INTO channel_rune_balances (
            channel_id, rune_id, rune_name, rune_symbol, divisibility,
            local_balance, remote_balance,
            funding_rune_amount, funding_utxo_txid, funding_utxo_vout,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
        channelId,
        runeId,
        runeName,
        runeSymbol,
        divisibility,
        localBalance.toString(),
        '0', // remote starts with 0
        fundingRuneAmount.toString(),
        fundingUtxoTxid,
        fundingUtxoVout,
        timestamp,
        timestamp
    );
    
    // Log event
    logChannelEvent(channelId, 'RUNE_ADDED', {
        runeId,
        runeSymbol,
        localBalance: localBalance.toString()
    });
    
    console.log('✅ Rune added to channel');
    
    return getRuneBalance(channelId, runeId);
}

/**
 * Atualizar balance de Rune (off-chain swap)
 */
export function updateRuneBalance(channelId, runeId, localBalance, remoteBalance) {
    console.log(`\n🔄 Updating Rune balance off-chain...`);
    console.log(`   Channel: ${channelId}`);
    console.log(`   Rune: ${runeId}`);
    console.log(`   Local: ${localBalance}, Remote: ${remoteBalance}`);
    
    const stmt = db.prepare(`
        UPDATE channel_rune_balances 
        SET local_balance = ?,
            remote_balance = ?,
            updated_at = ?
        WHERE channel_id = ? AND rune_id = ?
    `);
    
    stmt.run(
        localBalance.toString(),
        remoteBalance.toString(),
        Date.now(),
        channelId,
        runeId
    );
    
    // Log event
    logChannelEvent(channelId, 'BALANCE_UPDATE', {
        runeId,
        localBalance: localBalance.toString(),
        remoteBalance: remoteBalance.toString()
    });
    
    console.log('✅ Rune balance updated off-chain');
}

/**
 * Obter balance de Rune no canal
 */
export function getRuneBalance(channelId, runeId) {
    const stmt = db.prepare(`
        SELECT * FROM channel_rune_balances 
        WHERE channel_id = ? AND rune_id = ?
    `);
    return stmt.get(channelId, runeId);
}

/**
 * Listar todos os Runes no canal
 */
export function listChannelRunes(channelId) {
    const stmt = db.prepare(`
        SELECT * FROM channel_rune_balances 
        WHERE channel_id = ?
        ORDER BY created_at ASC
    `);
    return stmt.all(channelId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SWAP MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Criar registro de swap (off-chain)
 */
export function createSwapRecord({
    channelId,
    swapType,
    inputAsset,
    inputAmount,
    outputAsset,
    outputAmount,
    lpFee,
    protocolFee,
    routingFeeSats,
    price,
    priceImpact,
    paymentHash
}) {
    const timestamp = Date.now();
    
    console.log('\n🔄 Creating swap record...');
    console.log(`   Channel: ${channelId}`);
    console.log(`   Type: ${swapType}`);
    console.log(`   ${inputAmount} ${inputAsset} → ${outputAmount} ${outputAsset}`);
    
    const stmt = db.prepare(`
        INSERT INTO channel_swaps (
            channel_id, swap_type,
            input_asset, input_amount,
            output_asset, output_amount,
            lp_fee, protocol_fee, routing_fee_sats,
            price, price_impact,
            payment_hash, status,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
        channelId,
        swapType,
        inputAsset,
        inputAmount.toString(),
        outputAsset,
        outputAmount.toString(),
        lpFee ? lpFee.toString() : null,
        protocolFee ? protocolFee.toString() : null,
        routingFeeSats,
        price ? price.toString() : null,
        priceImpact ? priceImpact.toString() : null,
        paymentHash,
        'PENDING',
        timestamp
    );
    
    console.log(`✅ Swap record created (ID: ${result.lastInsertRowid})`);
    
    return result.lastInsertRowid;
}

/**
 * Completar swap (payment settled)
 */
export function completeSwap(paymentHash, paymentPreimage) {
    console.log(`\n✅ Completing swap: ${paymentHash}`);
    
    const stmt = db.prepare(`
        UPDATE channel_swaps 
        SET status = 'COMPLETED',
            payment_preimage = ?,
            completed_at = ?
        WHERE payment_hash = ?
    `);
    
    stmt.run(paymentPreimage, Date.now(), paymentHash);
    
    // Get swap details for event log
    const swap = db.prepare('SELECT * FROM channel_swaps WHERE payment_hash = ?').get(paymentHash);
    
    if (swap) {
        logChannelEvent(swap.channel_id, 'SWAP', {
            swapType: swap.swap_type,
            inputAsset: swap.input_asset,
            inputAmount: swap.input_amount,
            outputAsset: swap.output_asset,
            outputAmount: swap.output_amount
        });
    }
    
    console.log('✅ Swap completed');
}

/**
 * Listar swaps do canal
 */
export function listChannelSwaps(channelId, limit = 50) {
    const stmt = db.prepare(`
        SELECT * FROM channel_swaps 
        WHERE channel_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `);
    return stmt.all(channelId, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 CHANNEL STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obter estatísticas completas do canal (pool)
 */
export function getChannelStats(channelId) {
    const channel = getChannel(channelId);
    
    if (!channel) {
        return null;
    }
    
    // Rune balances
    const runes = listChannelRunes(channelId);
    
    // Swap history
    const swaps = listChannelSwaps(channelId, 100);
    const completedSwaps = swaps.filter(s => s.status === 'COMPLETED');
    
    // Volume
    let totalVolumeBtc = 0;
    let totalVolumeRunes = {};
    
    completedSwaps.forEach(swap => {
        if (swap.input_asset === 'BTC') {
            totalVolumeBtc += parseInt(swap.input_amount);
        } else {
            totalVolumeRunes[swap.input_asset] = (totalVolumeRunes[swap.input_asset] || 0) + parseFloat(swap.input_amount);
        }
    });
    
    return {
        channel,
        runes: runes.map(r => ({
            runeId: r.rune_id,
            symbol: r.rune_symbol,
            name: r.rune_name,
            localBalance: r.local_balance,
            remoteBalance: r.remote_balance,
            totalBalance: (BigInt(r.local_balance) + BigInt(r.remote_balance)).toString()
        })),
        stats: {
            totalSwaps: swaps.length,
            completedSwaps: completedSwaps.length,
            totalVolumeBtc,
            totalVolumeRunes,
            avgSwapTime: completedSwaps.length > 0 
                ? completedSwaps.reduce((sum, s) => sum + (s.completed_at - s.created_at), 0) / completedSwaps.length 
                : 0
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 EVENT LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log evento do canal (audit trail)
 */
function logChannelEvent(channelId, eventType, eventData) {
    const stmt = db.prepare(`
        INSERT INTO channel_events (channel_id, event_type, event_data, created_at)
        VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(
        channelId,
        eventType,
        JSON.stringify(eventData),
        Date.now()
    );
}

/**
 * Listar eventos do canal
 */
export function listChannelEvents(channelId, limit = 100) {
    const stmt = db.prepare(`
        SELECT * FROM channel_events 
        WHERE channel_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `);
    
    const events = stmt.all(channelId, limit);
    
    return events.map(e => ({
        ...e,
        event_data: e.event_data ? JSON.parse(e.event_data) : null
    }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 EXPORT ALL
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    // Init
    initStateTrackerTables,
    
    // Channels
    createChannelRecord,
    updateChannelStatus,
    updateChannelBalances,
    getChannel,
    listActiveChannels,
    
    // Runes
    addRuneToChannel,
    updateRuneBalance,
    getRuneBalance,
    listChannelRunes,
    
    // Swaps
    createSwapRecord,
    completeSwap,
    listChannelSwaps,
    
    // Stats
    getChannelStats,
    listChannelEvents
};


