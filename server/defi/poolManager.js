/**
 * 🏊 LIQUIDITY POOL MANAGER
 * 
 * Gerencia pools de liquidez para Runes DeFi no estilo RichSwap
 * Implementa AMM (Automated Market Maker) com curva x*y=k
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { db } from '../db/init-supabase.js';

bitcoin.initEccLib(ecc);

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 POOL CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Fees alinhadas com RichSwap
export const LP_FEE_PERCENTAGE = 0.7; // 0.7% fee para LPs (7000/1000000 no RichSwap)
export const PROTOCOL_FEE_PERCENTAGE = 0.2; // 0.2% fee para protocolo (2000/1000000 no RichSwap)
export const MIN_LIQUIDITY = 1000; // Mínimo de liquidez inicial
export const SLIPPAGE_TOLERANCE = 0.05; // 5% slippage máximo padrão

// Endereço do Treasury do Kray Station (vai receber fees do protocolo)
export const TREASURE_ADDRESS = process.env.TREASURE_ADDRESS || 'bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2';

// ═══════════════════════════════════════════════════════════════════════════════
// 🗄️ DATABASE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Inicializar tabelas do banco de dados
 */
export function initPoolTables() {
    // Tabela de pools
    db.exec(`
        CREATE TABLE IF NOT EXISTS defi_pools (
            pool_id TEXT PRIMARY KEY,
            rune_id TEXT NOT NULL,
            rune_name TEXT NOT NULL,
            rune_symbol TEXT,
            
            -- UTXO do pool (onde está a liquidez)
            pool_utxo_txid TEXT NOT NULL,
            pool_utxo_vout INTEGER NOT NULL,
            pool_utxo_value INTEGER NOT NULL,
            pool_utxo_script TEXT NOT NULL,
            
            -- Reservas do pool (AMM x*y=k)
            reserve_btc INTEGER NOT NULL DEFAULT 0,
            reserve_rune INTEGER NOT NULL DEFAULT 0,
            
            -- Estatísticas
            total_liquidity_providers INTEGER NOT NULL DEFAULT 0,
            volume_24h_btc INTEGER NOT NULL DEFAULT 0,
            volume_24h_rune INTEGER NOT NULL DEFAULT 0,
            fees_collected_btc INTEGER NOT NULL DEFAULT 0,
            fees_collected_rune INTEGER NOT NULL DEFAULT 0,
            
            -- Pool address (derivado da pool key)
            pool_address TEXT NOT NULL,
            pool_pubkey TEXT NOT NULL,
            
            -- Pool Logo/Inscription (opcional)
            use_inscription INTEGER DEFAULT 0,
            pool_inscription_id TEXT,
            pool_inscription_number INTEGER,
            pool_image TEXT,
            
            -- Status
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            
            UNIQUE(pool_utxo_txid, pool_utxo_vout)
        )
    `);
    
    // Tabela de posições de liquidez
    db.exec(`
        CREATE TABLE IF NOT EXISTS defi_liquidity_positions (
            position_id TEXT PRIMARY KEY,
            pool_id TEXT NOT NULL,
            provider_address TEXT NOT NULL,
            
            -- Shares (LP tokens virtuais)
            shares INTEGER NOT NULL,
            
            -- Histórico
            btc_deposited INTEGER NOT NULL DEFAULT 0,
            rune_deposited INTEGER NOT NULL DEFAULT 0,
            fees_earned_btc INTEGER NOT NULL DEFAULT 0,
            fees_earned_rune INTEGER NOT NULL DEFAULT 0,
            
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            
            FOREIGN KEY (pool_id) REFERENCES defi_pools(pool_id)
        )
    `);
    
    // Tabela de swaps executados
    db.exec(`
        CREATE TABLE IF NOT EXISTS defi_swaps (
            swap_id TEXT PRIMARY KEY,
            pool_id TEXT NOT NULL,
            trader_address TEXT NOT NULL,
            
            -- Valores do swap
            input_coin_id TEXT NOT NULL,
            input_amount INTEGER NOT NULL,
            output_coin_id TEXT NOT NULL,
            output_amount INTEGER NOT NULL,
            
            -- Taxas e impacto
            lp_fee INTEGER NOT NULL,
            protocol_fee INTEGER NOT NULL,
            price_impact REAL NOT NULL,
            
            -- PSBT e TX
            psbt_hex TEXT,
            tx_hex TEXT,
            txid TEXT,
            
            -- Status
            status TEXT NOT NULL DEFAULT 'PENDING',
            nonce INTEGER NOT NULL,
            
            created_at INTEGER NOT NULL,
            confirmed_at INTEGER,
            
            FOREIGN KEY (pool_id) REFERENCES defi_pools(pool_id)
        )
    `);
    
    // Índices para performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pools_rune ON defi_pools(rune_id);
        CREATE INDEX IF NOT EXISTS idx_pools_status ON defi_pools(status);
        CREATE INDEX IF NOT EXISTS idx_positions_pool ON defi_liquidity_positions(pool_id);
        CREATE INDEX IF NOT EXISTS idx_positions_provider ON defi_liquidity_positions(provider_address);
        CREATE INDEX IF NOT EXISTS idx_swaps_pool ON defi_swaps(pool_id);
        CREATE INDEX IF NOT EXISTS idx_swaps_trader ON defi_swaps(trader_address);
        CREATE INDEX IF NOT EXISTS idx_swaps_status ON defi_swaps(status);
    `);
    
    console.log('✅ DeFi pool tables initialized');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 POOL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Criar um novo pool de liquidez
 */
export function createPool({
    runeId,
    runeName,
    runeSymbol,
    initialBtc,
    initialRune,
    providerAddress,
    poolUtxo,
    poolAddress,
    poolPubkey,
    useInscription,
    poolInscriptionId,
    poolInscriptionNumber,
    poolImage
}) {
    const poolId = `${runeId}:BTC`;
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Calcular shares iniciais (√(x * y))
    const initialShares = Math.floor(Math.sqrt(initialBtc * initialRune));
    
    if (initialShares < MIN_LIQUIDITY) {
        throw new Error(`Initial liquidity too low. Minimum ${MIN_LIQUIDITY} shares required.`);
    }
    
    // Inserir pool
    db.prepare(`
        INSERT INTO defi_pools (
            pool_id, rune_id, rune_name, rune_symbol,
            pool_utxo_txid, pool_utxo_vout, pool_utxo_value, pool_utxo_script,
            reserve_btc, reserve_rune,
            total_liquidity_providers,
            pool_address, pool_pubkey,
            use_inscription, pool_inscription_id, pool_inscription_number, pool_image,
            status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        poolId, runeId, runeName, runeSymbol,
        poolUtxo.txid, poolUtxo.vout, poolUtxo.value, poolUtxo.script,
        initialBtc, initialRune,
        1,
        poolAddress, poolPubkey,
        useInscription ? 1 : 0, poolInscriptionId || null, poolInscriptionNumber || null, poolImage || null,
        'ACTIVE', timestamp, timestamp
    );
    
    // Criar posição do provedor inicial
    const positionId = `${poolId}:${providerAddress}:${timestamp}`;
    
    db.prepare(`
        INSERT INTO defi_liquidity_positions (
            position_id, pool_id, provider_address,
            shares, btc_deposited, rune_deposited,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        positionId, poolId, providerAddress,
        initialShares, initialBtc, initialRune,
        timestamp, timestamp
    );
    
    console.log(`✅ Pool created: ${poolId}`);
    console.log(`   Reserve BTC: ${initialBtc} sats`);
    console.log(`   Reserve Rune: ${initialRune}`);
    console.log(`   Initial LP shares: ${initialShares}`);
    
    return {
        poolId,
        reserveBtc: initialBtc,
        reserveRune: initialRune,
        shares: initialShares,
        address: poolAddress
    };
}

/**
 * Buscar pool por rune ID
 */
export function getPool(runeId) {
    const poolId = `${runeId}:BTC`;
    
    return db.prepare(`
        SELECT * FROM defi_pools WHERE pool_id = ? AND status = 'ACTIVE'
    `).get(poolId);
}

/**
 * Listar todos os pools ativos
 */
export function listPools({ limit = 50, offset = 0 }) {
    const pools = db.prepare(`
        SELECT 
            pool_id, rune_id, rune_name, rune_symbol,
            reserve_btc, reserve_rune,
            total_liquidity_providers,
            volume_24h_btc, volume_24h_rune,
            fees_collected_btc, fees_collected_rune,
            pool_address,
            created_at, updated_at
        FROM defi_pools
        WHERE status = 'ACTIVE'
        ORDER BY reserve_btc DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    const total = db.prepare(`
        SELECT COUNT(*) as count FROM defi_pools WHERE status = 'ACTIVE'
    `).get().count;
    
    return {
        pools,
        pagination: {
            total,
            limit,
            offset,
            hasMore: offset + pools.length < total
        }
    };
}

/**
 * Calcular preço atual do pool (BTC por Rune)
 */
export function getPoolPrice(pool) {
    if (!pool.reserve_btc || !pool.reserve_rune) {
        return 0;
    }
    
    return pool.reserve_btc / pool.reserve_rune;
}

/**
 * Calcular APY estimado do pool (baseado em fees 24h)
 */
export function calculatePoolAPY(pool) {
    if (!pool.reserve_btc || !pool.fees_collected_btc) {
        return 0;
    }
    
    // APY = (fees_24h / TVL) * 365 * 100
    const dailyReturn = pool.fees_collected_btc / pool.reserve_btc;
    return dailyReturn * 365 * 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔢 AMM MATH (Constant Product x*y=k)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcular output amount para um swap (com fees)
 * 
 * Fórmula: Δy = (y * Δx * 991) / (x * 1000 + Δx * 991)
 * 991/1000 = 0.991 (0.9% fee total: 0.7% LP + 0.2% protocol)
 * 
 * Alinhado com RichSwap: 0.7% LP + 0.2% Protocol = 0.9% total
 */
export function calculateSwapOutput({
    inputAmount,
    inputReserve,
    outputReserve
}) {
    if (inputAmount <= 0) {
        throw new Error('Input amount must be positive');
    }
    
    if (inputReserve <= 0 || outputReserve <= 0) {
        throw new Error('Invalid reserves');
    }
    
    // Aplicar fee (0.7% para LP, 0.2% para protocolo = 0.9% total)
    const feeMultiplier = 1000 - (LP_FEE_PERCENTAGE * 10) - (PROTOCOL_FEE_PERCENTAGE * 10);
    const inputWithFee = inputAmount * feeMultiplier;
    
    const numerator = outputReserve * inputWithFee;
    const denominator = (inputReserve * 1000) + inputWithFee;
    
    const outputAmount = Math.floor(numerator / denominator);
    
    // Calcular taxas
    const totalFee = inputAmount - Math.floor(inputAmount * feeMultiplier / 1000);
    const lpFee = Math.floor(totalFee * (LP_FEE_PERCENTAGE / (LP_FEE_PERCENTAGE + PROTOCOL_FEE_PERCENTAGE)));
    const protocolFee = totalFee - lpFee;
    
    // Calcular price impact
    const priceImpact = ((inputAmount * outputReserve / inputReserve) - outputAmount) / outputAmount;
    
    return {
        outputAmount,
        lpFee,
        protocolFee,
        priceImpact: Math.abs(priceImpact),
        effectivePrice: inputAmount / outputAmount
    };
}

/**
 * Calcular minimum output com slippage
 */
export function calculateMinOutput(outputAmount, slippageTolerance = SLIPPAGE_TOLERANCE) {
    return Math.floor(outputAmount * (1 - slippageTolerance));
}

/**
 * Validar se price impact está dentro dos limites seguros
 * 
 * RichSwap aceita 50%-200% (0.5x-2.0x price change)
 * Mantemos 50% máximo para segurança, mas flexível para pools novos
 */
export function validatePriceImpact(priceImpact) {
    const MAX_PRICE_IMPACT = 0.50; // 50% máximo (vs 100% no RichSwap)
    const WARNING_THRESHOLD = 0.10; // 10% warning
    
    if (priceImpact > MAX_PRICE_IMPACT) {
        return {
            valid: false,
            warning: true,
            message: `Price impact too high: ${(priceImpact * 100).toFixed(2)}%`
        };
    }
    
    if (priceImpact > WARNING_THRESHOLD) {
        return {
            valid: true,
            warning: true,
            message: `High price impact: ${(priceImpact * 100).toFixed(2)}%`
        };
    }
    
    return {
        valid: true,
        warning: false,
        message: 'Price impact acceptable'
    };
}

export default {
    initPoolTables,
    createPool,
    getPool,
    listPools,
    getPoolPrice,
    calculatePoolAPY,
    calculateSwapOutput,
    calculateMinOutput,
    validatePriceImpact,
    TREASURE_ADDRESS,
    LP_FEE_PERCENTAGE,
    PROTOCOL_FEE_PERCENTAGE,
    MIN_LIQUIDITY,
    SLIPPAGE_TOLERANCE
};

