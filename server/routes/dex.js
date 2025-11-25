/**
 * 🌊 DEX Routes - Decentralized Exchange
 * 
 * Rotas para:
 * - Criar liquidity pools
 * - Fazer swaps
 * - Adicionar/remover liquidez
 * - Listar pools
 */

import express from 'express';
import { getDatabase } from '../db/init-supabase.js';
import AMMCalculator from '../utils/ammCalculator.js';
import PSBTBuilderDEX from '../utils/psbtBuilderDEX.js';
import axios from 'axios';
import crypto from 'crypto';

const router = express.Router();

/**
 * 🏊 GET /api/dex/pools
 * Listar todas as pools
 */
router.get('/pools', async (req, res) => {
    try {
        const db = getDatabase();
        const { sortBy = 'tvl', status = 'active', search } = req.query;
        
        let query = `
            SELECT * FROM liquidity_pools 
            WHERE status = ?
        `;
        const params = [status];
        
        // Search by name
        if (search) {
            query += ` AND (pool_name LIKE ? OR rune_a_name LIKE ? OR rune_b_name LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        // Sorting
        switch (sortBy) {
            case 'volume':
                query += ` ORDER BY volume_24h DESC`;
                break;
            case 'tvl':
            default:
                query += ` ORDER BY total_liquidity DESC`;
                break;
            case 'newest':
                query += ` ORDER BY created_at DESC`;
                break;
            case 'apr':
                // Calcular APR on-the-fly
                query += ` ORDER BY (volume_24h * fee_rate / total_liquidity) DESC`;
                break;
        }
        
        const pools = db.prepare(query).all(...params);
        
        // Enriquecer com cálculos
        const enrichedPools = pools.map(pool => {
            const prices = AMMCalculator.calculatePrice(pool.reserve_a, pool.reserve_b);
            const apr = AMMCalculator.calculateAPR(pool.volume_24h, pool.total_liquidity, pool.fee_rate);
            
            return {
                ...pool,
                price_a_in_b: prices.priceAinB,
                price_b_in_a: prices.priceBinA,
                apr,
                tvl: pool.total_liquidity,
                fee_percentage: (pool.fee_rate / 100).toFixed(2) + '%'
            };
        });
        
        res.json({
            success: true,
            pools: enrichedPools,
            count: enrichedPools.length
        });
        
    } catch (error) {
        console.error('Error listing pools:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🔍 GET /api/dex/pools/:poolId
 * Detalhes de uma pool específica
 */
router.get('/pools/:poolId', async (req, res) => {
    try {
        const db = getDatabase();
        const { poolId } = req.params;
        
        const pool = db.prepare('SELECT * FROM liquidity_pools WHERE id = ?').get(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Buscar trades recentes
        const recentTrades = db.prepare(`
            SELECT * FROM trades 
            WHERE pool_id = ? 
            ORDER BY created_at DESC 
            LIMIT 20
        `).all(poolId);
        
        // Buscar LP holders
        const lpHolders = db.prepare(`
            SELECT * FROM lp_holdings 
            WHERE pool_id = ? AND lp_tokens > 0
            ORDER BY lp_tokens DESC
        `).all(poolId);
        
        // Cálculos
        const prices = AMMCalculator.calculatePrice(pool.reserve_a, pool.reserve_b);
        const apr = AMMCalculator.calculateAPR(pool.volume_24h, pool.total_liquidity, pool.fee_rate);
        
        res.json({
            success: true,
            pool: {
                ...pool,
                price_a_in_b: prices.priceAinB,
                price_b_in_a: prices.priceBinA,
                apr,
                fee_percentage: (pool.fee_rate / 100).toFixed(2) + '%'
            },
            recentTrades,
            lpHolders: lpHolders.map(h => ({
                ...h,
                share: ((h.lp_tokens / pool.lp_token_supply) * 100).toFixed(4) + '%'
            }))
        });
        
    } catch (error) {
        console.error('Error getting pool details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ✨ POST /api/dex/pools/create
 * Criar nova liquidity pool
 */
router.post('/pools/create', async (req, res) => {
    try {
        const db = getDatabase();
        const {
            poolName,
            poolImage,
            poolInscriptionId,
            poolInscriptionNumber,
            useInscription = false,
            creatorAddress,
            runeA,
            runeAName,
            runeB,
            runeBName,
            isBtcPair,
            initialAmountA,
            initialAmountB,
            feeRate = 30  // Default 0.3%
        } = req.body;
        
        // Validações
        if (!poolName || !creatorAddress || !runeA) {
            return res.status(400).json({
                success: false,
                error: 'Pool name, creator address, and runeA are required'
            });
        }
        
        if (!isBtcPair && !runeB) {
            return res.status(400).json({
                success: false,
                error: 'runeB is required for rune/rune pairs'
            });
        }
        
        if (initialAmountA <= 0 || initialAmountB <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Initial amounts must be positive'
            });
        }
        
        // Verificar se pool já existe
        const existing = db.prepare(`
            SELECT id FROM liquidity_pools 
            WHERE rune_a = ? AND (rune_b = ? OR (rune_b IS NULL AND ? IS NULL))
        `).get(runeA, runeB, runeB);
        
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Pool already exists for this pair'
            });
        }
        
        // Gerar ID único
        const poolId = 'pool_' + crypto.randomBytes(16).toString('hex');
        
        // Calcular LP tokens iniciais
        const lpCalc = AMMCalculator.calculateLPTokens(
            initialAmountA,
            initialAmountB,
            0, 0, 0  // Pool nova
        );
        
        const now = Date.now();
        
        // Buscar conteúdo da inscription se necessário
        let inscriptionContent = null;
        if (useInscription && poolInscriptionId) {
            try {
                const inscriptionResponse = await axios.get(
                    `https://ordinals.com/content/${poolInscriptionId}`
                );
                inscriptionContent = `https://ordinals.com/content/${poolInscriptionId}`;
                console.log(`✅ Inscription loaded: ${poolInscriptionId}`);
            } catch (error) {
                console.warn('⚠️ Could not load inscription:', error.message);
            }
        }

        // Inserir pool
        db.prepare(`
            INSERT INTO liquidity_pools (
                id, pool_name, pool_image, pool_inscription_id, pool_inscription_number,
                use_inscription, creator_address,
                rune_a, rune_a_name, rune_b, rune_b_name, is_btc_pair,
                reserve_a, reserve_b, total_liquidity, lp_token_supply,
                fee_rate, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            poolId, poolName, 
            useInscription ? inscriptionContent : poolImage,
            poolInscriptionId, poolInscriptionNumber,
            useInscription ? 1 : 0,
            creatorAddress,
            runeA, runeAName, runeB, runeBName, isBtcPair ? 1 : 0,
            initialAmountA, initialAmountB,
            initialAmountA + initialAmountB,  // TVL inicial
            lpCalc.lpTokens,
            feeRate, now, now
        );
        
        // Dar LP tokens para o criador
        db.prepare(`
            INSERT INTO lp_holdings (
                id, pool_id, holder_address, lp_tokens,
                initial_a, initial_b, added_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            'lp_' + crypto.randomBytes(16).toString('hex'),
            poolId, creatorAddress, lpCalc.lpTokens,
            initialAmountA, initialAmountB, now
        );
        
        console.log(`✅ Pool created: ${poolName} (${poolId})`);
        console.log(`   Creator: ${creatorAddress}`);
        console.log(`   Pair: ${runeAName} / ${runeBName || 'BTC'}`);
        console.log(`   Initial Liquidity: ${initialAmountA} / ${initialAmountB}`);
        console.log(`   LP Tokens: ${lpCalc.lpTokens}`);
        
        res.json({
            success: true,
            poolId,
            lpTokens: lpCalc.lpTokens,
            shareOfPool: lpCalc.shareOfPool,
            message: 'Pool created successfully'
        });
        
    } catch (error) {
        console.error('Error creating pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💱 POST /api/dex/quote
 * Calcular quote para um swap (sem executar)
 */
router.post('/quote', async (req, res) => {
    try {
        const db = getDatabase();
        const {
            poolId,
            amountIn,
            tokenIn  // 'a' ou 'b'
        } = req.body;
        
        if (!poolId || !amountIn || !tokenIn) {
            return res.status(400).json({
                success: false,
                error: 'poolId, amountIn, and tokenIn are required'
            });
        }
        
        const pool = db.prepare('SELECT * FROM liquidity_pools WHERE id = ?').get(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Calcular swap
        const isSwappingA = tokenIn === 'a';
        const reserveIn = isSwappingA ? pool.reserve_a : pool.reserve_b;
        const reserveOut = isSwappingA ? pool.reserve_b : pool.reserve_a;
        
        const quote = AMMCalculator.calculateSwapOutput(
            amountIn,
            reserveIn,
            reserveOut,
            pool.fee_rate
        );
        
        // Preço antes do swap
        const currentPrice = isSwappingA 
            ? pool.reserve_b / pool.reserve_a 
            : pool.reserve_a / pool.reserve_b;
        
        res.json({
            success: true,
            quote: {
                amountIn,
                amountOut: quote.amountOut,
                priceImpact: quote.priceImpact,
                effectivePrice: quote.effectivePrice,
                feeAmount: quote.feeAmount,
                currentPrice: currentPrice.toFixed(8),
                minimumReceived: Math.floor(quote.amountOut * 0.995), // 0.5% slippage
                route: [
                    isSwappingA ? pool.rune_a_name : pool.rune_b_name,
                    isSwappingA ? pool.rune_b_name : pool.rune_a_name
                ]
            }
        });
        
    } catch (error) {
        console.error('Error calculating quote:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🔨 POST /api/dex/build-swap-psbt
 * Construir PSBT para swap (usuário assina depois)
 */
router.post('/build-swap-psbt', async (req, res) => {
    try {
        const db = getDatabase();
        const {
            poolId,
            userAddress,
            amountIn,
            tokenIn,
            feeRate = 1
        } = req.body;
        
        if (!poolId || !userAddress || !amountIn || !tokenIn) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        const pool = db.prepare('SELECT * FROM liquidity_pools WHERE id = ?').get(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Calcular swap
        const isSwappingA = tokenIn === 'a';
        const reserveIn = isSwappingA ? pool.reserve_a : pool.reserve_b;
        const reserveOut = isSwappingA ? pool.reserve_b : pool.reserve_a;
        
        const quote = AMMCalculator.calculateSwapOutput(
            amountIn,
            reserveIn,
            reserveOut,
            pool.fee_rate
        );
        
        // Buscar UTXOs do usuário
        const mempoolResponse = await axios.get(
            `https://mempool.space/api/address/${userAddress}/utxo`
        );
        const userUtxos = mempoolResponse.data;
        
        // 🛡️ PROTEÇÃO CRÍTICA: Filtrar UTXOs puros para swaps
        console.log('  🛡️  Filtering pure UTXOs for swap (protecting assets)...');
        const { default: UTXOFilter } = await import('../utils/utxoFilter.js');
        const utxoFilter = new UTXOFilter();
        const pureUserUtxos = await utxoFilter.filterPureUTXOs(userUtxos);
        console.log('  Pure user UTXOs (safe to use):', pureUserUtxos.length);
        
        if (pureUserUtxos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No pure UTXOs available for swap. All your UTXOs contain assets.'
            });
        }
        
        // Buscar UTXOs da pool (simulado - em produção virá de uma carteira real)
        const poolUtxos = []; // TODO: Implementar busca real de UTXOs da pool
        
        // Construir PSBT
        const psbtBuilder = new PSBTBuilderDEX();
        
        const psbtResult = await psbtBuilder.buildSwapPSBT({
            userAddress,
            poolAddress: pool.creator_address, // Temporário
            runeIdIn: isSwappingA ? pool.rune_a : pool.rune_b,
            runeIdOut: isSwappingA ? pool.rune_b : pool.rune_a,
            amountIn,
            amountOut: quote.amountOut,
            feeRate,
            userUtxos,
            poolUtxos
        });
        
        console.log('✅ Swap PSBT built successfully');
        
        res.json({
            success: true,
            psbt: psbtResult.psbt,
            quote: {
                amountIn,
                amountOut: quote.amountOut,
                priceImpact: quote.priceImpact,
                effectivePrice: quote.effectivePrice,
                feeAmount: quote.feeAmount
            },
            estimatedFee: psbtResult.estimatedFee,
            message: 'PSBT ready for signing'
        });
        
    } catch (error) {
        console.error('Error building swap PSBT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💱 POST /api/dex/swap
 * Executar um swap (registrar no banco, PSBT será criado depois)
 */
router.post('/swap', async (req, res) => {
    try {
        const db = getDatabase();
        const {
            poolId,
            userAddress,
            amountIn,
            tokenIn,
            minAmountOut,  // Slippage protection
            deadline
        } = req.body;
        
        // Validações
        if (!poolId || !userAddress || !amountIn || !tokenIn) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        const pool = db.prepare('SELECT * FROM liquidity_pools WHERE id = ?').get(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Calcular swap
        const isSwappingA = tokenIn === 'a';
        const reserveIn = isSwappingA ? pool.reserve_a : pool.reserve_b;
        const reserveOut = isSwappingA ? pool.reserve_b : pool.reserve_a;
        
        const result = AMMCalculator.calculateSwapOutput(
            amountIn,
            reserveIn,
            reserveOut,
            pool.fee_rate
        );
        
        // Verificar slippage
        if (minAmountOut && result.amountOut < minAmountOut) {
            return res.status(400).json({
                success: false,
                error: `Slippage too high. Expected ${minAmountOut}, would get ${result.amountOut}`
            });
        }
        
        // Verificar deadline
        if (deadline && Date.now() > deadline) {
            return res.status(400).json({
                success: false,
                error: 'Transaction deadline passed'
            });
        }
        
        // Atualizar reservas da pool
        const newReserveIn = reserveIn + amountIn;
        const newReserveOut = reserveOut - result.amountOut;
        
        const now = Date.now();
        
        db.prepare(`
            UPDATE liquidity_pools 
            SET reserve_a = ?,
                reserve_b = ?,
                volume_24h = volume_24h + ?,
                volume_all_time = volume_all_time + ?,
                swap_count = swap_count + 1,
                last_swap_at = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            isSwappingA ? newReserveIn : pool.reserve_a,
            isSwappingA ? newReserveOut : pool.reserve_b,
            amountIn,  // Volume contabilizado
            amountIn,
            now, now, poolId
        );
        
        // Registrar trade
        const tradeId = 'trade_' + crypto.randomBytes(16).toString('hex');
        
        db.prepare(`
            INSERT INTO trades (
                id, pool_id, type, from_rune, to_rune,
                from_amount, to_amount, price, fee,
                trader_address, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            tradeId, poolId, 'swap',
            isSwappingA ? pool.rune_a : pool.rune_b,
            isSwappingA ? pool.rune_b : pool.rune_a,
            amountIn, result.amountOut,
            result.effectivePrice, result.feeAmount,
            userAddress, now
        );
        
        console.log(`✅ Swap executed in pool ${poolId}`);
        console.log(`   ${amountIn} ${isSwappingA ? pool.rune_a_name : pool.rune_b_name}`);
        console.log(`   → ${result.amountOut} ${isSwappingA ? pool.rune_b_name : pool.rune_a_name}`);
        console.log(`   Price Impact: ${result.priceImpact}%`);
        
        res.json({
            success: true,
            tradeId,
            amountOut: result.amountOut,
            priceImpact: result.priceImpact,
            effectivePrice: result.effectivePrice,
            message: 'Swap executed successfully'
        });
        
    } catch (error) {
        console.error('Error executing swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💧 POST /api/dex/add-liquidity
 * Adicionar liquidez a uma pool existente
 */
router.post('/add-liquidity', async (req, res) => {
    try {
        const db = getDatabase();
        const {
            poolId,
            userAddress,
            amountA,
            amountB
        } = req.body;
        
        if (!poolId || !userAddress || !amountA || !amountB) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        const pool = db.prepare('SELECT * FROM liquidity_pools WHERE id = ?').get(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Calcular LP tokens
        const lpCalc = AMMCalculator.calculateLPTokens(
            amountA, amountB,
            pool.reserve_a, pool.reserve_b,
            pool.lp_token_supply
        );
        
        const now = Date.now();
        
        // Atualizar pool
        db.prepare(`
            UPDATE liquidity_pools 
            SET reserve_a = reserve_a + ?,
                reserve_b = reserve_b + ?,
                total_liquidity = total_liquidity + ? + ?,
                lp_token_supply = lp_token_supply + ?,
                updated_at = ?
            WHERE id = ?
        `).run(amountA, amountB, amountA, amountB, lpCalc.lpTokens, now, poolId);
        
        // Atualizar ou criar LP holding
        const existing = db.prepare(`
            SELECT * FROM lp_holdings 
            WHERE pool_id = ? AND holder_address = ?
        `).get(poolId, userAddress);
        
        if (existing) {
            // Atualizar holding existente
            db.prepare(`
                UPDATE lp_holdings 
                SET lp_tokens = lp_tokens + ?,
                    initial_a = initial_a + ?,
                    initial_b = initial_b + ?
                WHERE pool_id = ? AND holder_address = ?
            `).run(lpCalc.lpTokens, amountA, amountB, poolId, userAddress);
        } else {
            // Criar novo holding
            db.prepare(`
                INSERT INTO lp_holdings (
                    id, pool_id, holder_address, lp_tokens,
                    initial_a, initial_b, added_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                'lp_' + crypto.randomBytes(16).toString('hex'),
                poolId, userAddress, lpCalc.lpTokens,
                amountA, amountB, now
            );
        }
        
        console.log(`✅ Liquidity added to pool ${poolId}`);
        console.log(`   Amount: ${amountA} / ${amountB}`);
        console.log(`   LP Tokens: ${lpCalc.lpTokens}`);
        console.log(`   Share: ${lpCalc.shareOfPool}%`);
        
        res.json({
            success: true,
            lpTokens: lpCalc.lpTokens,
            shareOfPool: lpCalc.shareOfPool,
            newTotalSupply: lpCalc.newTotalSupply,
            message: 'Liquidity added successfully'
        });
        
    } catch (error) {
        console.error('Error adding liquidity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💧 POST /api/dex/remove-liquidity
 * Remover liquidez de uma pool
 */
router.post('/remove-liquidity', async (req, res) => {
    try {
        const db = getDatabase();
        const {
            poolId,
            userAddress,
            lpTokens
        } = req.body;
        
        if (!poolId || !userAddress || !lpTokens) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        const pool = db.prepare('SELECT * FROM liquidity_pools WHERE id = ?').get(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Verificar se usuário tem LP tokens suficientes
        const holding = db.prepare(`
            SELECT * FROM lp_holdings 
            WHERE pool_id = ? AND holder_address = ?
        `).get(poolId, userAddress);
        
        if (!holding || holding.lp_tokens < lpTokens) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient LP tokens'
            });
        }
        
        // Calcular quanto receber
        const amounts = AMMCalculator.calculateRemoveLiquidity(
            lpTokens,
            pool.lp_token_supply,
            pool.reserve_a,
            pool.reserve_b
        );
        
        const now = Date.now();
        
        // Atualizar pool
        db.prepare(`
            UPDATE liquidity_pools 
            SET reserve_a = reserve_a - ?,
                reserve_b = reserve_b - ?,
                total_liquidity = total_liquidity - ? - ?,
                lp_token_supply = lp_token_supply - ?,
                updated_at = ?
            WHERE id = ?
        `).run(amounts.amountA, amounts.amountB, amounts.amountA, amounts.amountB, lpTokens, now, poolId);
        
        // Atualizar holding
        const newLpTokens = holding.lp_tokens - lpTokens;
        
        if (newLpTokens <= 0) {
            // Remover holding completamente
            db.prepare('DELETE FROM lp_holdings WHERE id = ?').run(holding.id);
        } else {
            // Reduzir LP tokens
            db.prepare(`
                UPDATE lp_holdings 
                SET lp_tokens = ?
                WHERE id = ?
            `).run(newLpTokens, holding.id);
        }
        
        console.log(`✅ Liquidity removed from pool ${poolId}`);
        console.log(`   LP Tokens burned: ${lpTokens}`);
        console.log(`   Received: ${amounts.amountA} / ${amounts.amountB}`);
        
        res.json({
            success: true,
            amountA: amounts.amountA,
            amountB: amounts.amountB,
            lpTokensBurned: lpTokens,
            message: 'Liquidity removed successfully'
        });
        
    } catch (error) {
        console.error('Error removing liquidity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 GET /api/dex/my-pools/:address
 * Listar pools do usuário (onde ele tem liquidez)
 */
router.get('/my-pools/:address', async (req, res) => {
    try {
        const db = getDatabase();
        const { address } = req.params;
        
        const holdings = db.prepare(`
            SELECT lp.*, p.*
            FROM lp_holdings lp
            JOIN liquidity_pools p ON lp.pool_id = p.id
            WHERE lp.holder_address = ? AND lp.lp_tokens > 0
            ORDER BY lp.lp_tokens DESC
        `).all(address);
        
        const enriched = holdings.map(h => {
            const share = (h.lp_tokens / h.lp_token_supply) * 100;
            const valueA = Math.floor(h.reserve_a * share / 100);
            const valueB = Math.floor(h.reserve_b * share / 100);
            
            return {
                poolId: h.pool_id,
                poolName: h.pool_name,
                lpTokens: h.lp_tokens,
                shareOfPool: share.toFixed(4) + '%',
                currentValueA: valueA,
                currentValueB: valueB,
                initialA: h.initial_a,
                initialB: h.initial_b,
                pnl: {
                    a: valueA - h.initial_a,
                    b: valueB - h.initial_b
                },
                addedAt: h.added_at
            };
        });
        
        res.json({
            success: true,
            pools: enriched,
            count: enriched.length
        });
        
    } catch (error) {
        console.error('Error getting user pools:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

