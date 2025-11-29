/**
 * 🔄 DEFI SWAP ROUTES
 * 
 * Endpoints para o sistema DeFi Runes:
 * - GET /api/defi/pools - Listar pools
 * - GET /api/defi/pools/:poolId - Detalhes do pool
 * - POST /api/defi/pools - Criar novo pool
 * - POST /api/defi/quote - Obter cotação (inquiry)
 * - POST /api/defi/swap - Executar swap (invoke)
 */

import express from 'express';
import { 
    listPools, 
    getPool, 
    createPool,
    calculateSwapOutput,
    calculateMinOutput,
    validatePriceImpact,
    getPoolPrice,
    calculatePoolAPY
} from '../defi/poolManager.js';
import { 
    buildSwapBtcToRunePSBT,
    buildSwapRuneToBtcPSBT,
    buildCreatePoolPSBT
} from '../defi/psbtBuilder.js';
import {
    validateSwapBtcToRune,
    validateSwapRuneToBtc
} from '../defi/policyEngine.js';
import {
    signPoolInputSafe,
    finalizeAndExtract,
    generatePoolAddress,
    isKillSwitchActive,
    getPoolSignerStatus
} from '../defi/poolSignerLND.js';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import { db } from '../db/init-supabase.js';

const router = express.Router();

// Nonce counter (anti-replay)
let nonceCounter = Date.now();

function getNextNonce() {
    return nonceCounter++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 LISTAR POOLS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/defi/pools
 * Listar todos os pools ativos
 */
router.get('/pools', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const result = listPools({ limit, offset });
        
        // Adicionar preço e APY calculados
        const poolsWithStats = result.pools.map(pool => ({
            ...pool,
            price: getPoolPrice(pool),
            apy: calculatePoolAPY(pool)
        }));
        
        res.json({
            success: true,
            pools: poolsWithStats,
            pagination: result.pagination
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
 * GET /api/defi/pools/:poolId
 * Detalhes de um pool específico
 */
router.get('/pools/:poolId', (req, res) => {
    try {
        const { poolId } = req.params;
        
        const pool = getPool(poolId.replace(':BTC', ''));
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Buscar posições de liquidez
        const positions = db.prepare(`
            SELECT * FROM defi_liquidity_positions 
            WHERE pool_id = ?
            ORDER BY shares DESC
            LIMIT 10
        `).all(pool.pool_id);
        
        // Buscar swaps recentes
        const recentSwaps = db.prepare(`
            SELECT * FROM defi_swaps
            WHERE pool_id = ? AND status = 'CONFIRMED'
            ORDER BY confirmed_at DESC
            LIMIT 20
        `).all(pool.pool_id);
        
        res.json({
            success: true,
            pool: {
                ...pool,
                price: getPoolPrice(pool),
                apy: calculatePoolAPY(pool)
            },
            topLPs: positions,
            recentSwaps
        });
    } catch (error) {
        console.error('Error fetching pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 COTAÇÃO (INQUIRY - PRE-SWAP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/defi/quote
 * Obter cotação para um swap
 * 
 * Body: {
 *   poolId: "840000:3:BTC",
 *   inputCoinId: "0:0" (BTC) ou "840000:3" (Rune),
 *   inputAmount: 100000,
 *   slippageTolerance: 0.05
 * }
 */
router.post('/quote', async (req, res) => {
    try {
        const { poolId, inputCoinId, inputAmount, slippageTolerance = 0.05 } = req.body;
        
        // Validar parâmetros
        if (!poolId || !inputCoinId || !inputAmount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: poolId, inputCoinId, inputAmount'
            });
        }
        
        if (inputAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Input amount must be positive'
            });
        }
        
        // Buscar pool
        const pool = getPool(poolId.replace(':BTC', ''));
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // Determinar direção do swap
        const isBtcToRune = inputCoinId === '0:0';
        
        const inputReserve = isBtcToRune ? pool.reserve_btc : pool.reserve_rune;
        const outputReserve = isBtcToRune ? pool.reserve_rune : pool.reserve_btc;
        
        // Calcular output
        const swapCalc = calculateSwapOutput({
            inputAmount,
            inputReserve,
            outputReserve
        });
        
        const minOutput = calculateMinOutput(swapCalc.outputAmount, slippageTolerance);
        
        // Validar price impact
        const impactCheck = validatePriceImpact(swapCalc.priceImpact);
        
        // Gerar nonce
        const nonce = getNextNonce();
        
        // Resposta
        res.json({
            success: true,
            quote: {
                inputCoinId,
                inputAmount,
                outputCoinId: isBtcToRune ? pool.rune_id : '0:0',
                outputAmount: swapCalc.outputAmount,
                minOutput,
                lpFee: swapCalc.lpFee,
                protocolFee: swapCalc.protocolFee,
                priceImpact: swapCalc.priceImpact,
                effectivePrice: swapCalc.effectivePrice,
                slippageTolerance,
                nonce,
                deadline: Math.floor(Date.now() / 1000) + 300, // 5 min
                poolUtxo: {
                    txid: pool.pool_utxo_txid,
                    vout: pool.pool_utxo_vout,
                    value: pool.pool_utxo_value,
                    script: pool.pool_utxo_script
                },
                priceImpactWarning: impactCheck.warning,
                priceImpactMessage: impactCheck.message
            }
        });
        
        console.log(`✅ Quote generated: ${inputAmount} ${inputCoinId} → ${swapCalc.outputAmount} (nonce: ${nonce})`);
        
    } catch (error) {
        console.error('Error generating quote:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SWAP - PREPARE (STEP 1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/defi/swap/prepare
 * Preparar PSBT para swap (user vai assinar depois)
 * 
 * Body: {
 *   poolId: "840000:3:BTC",
 *   inputCoinId: "0:0" (BTC) ou "840000:3" (Rune),
 *   inputAmount: 1000000,
 *   userAddress: "bc1p...",
 *   userUtxos: [...],
 *   slippageTolerance: 0.05
 * }
 */
router.post('/swap/prepare', async (req, res) => {
    try {
        const {
            poolId,
            inputCoinId,
            inputAmount,
            userAddress,
            userUtxos,
            slippageTolerance = 0.05,
            feeRate = 10
        } = req.body;
        
        console.log('🔄 ========== PREPARING SWAP PSBT ==========');
        console.log('   Pool:', poolId);
        console.log('   Input:', inputCoinId, inputAmount);
        console.log('   User:', userAddress);
        
        // Validar parâmetros
        if (!poolId || !inputCoinId || !inputAmount || !userAddress || !userUtxos || userUtxos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // Buscar pool
        const pool = getPool(poolId.replace(':BTC', ''));
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        if (pool.status !== 'ACTIVE') {
            return res.status(400).json({
                success: false,
                error: `Pool is not active (status: ${pool.status})`
            });
        }
        
        console.log('   Pool Status: ACTIVE');
        console.log('   Reserve BTC:', pool.reserve_btc);
        console.log('   Reserve Rune:', pool.reserve_rune);
        
        // Determinar direção do swap
        const isBtcToRune = inputCoinId === '0:0';
        
        const inputReserve = isBtcToRune ? pool.reserve_btc : pool.reserve_rune;
        const outputReserve = isBtcToRune ? pool.reserve_rune : pool.reserve_btc;
        
        // Calcular output (AMM)
        const swapCalc = calculateSwapOutput({
            inputAmount,
            inputReserve,
            outputReserve
        });
        
        const minOutput = calculateMinOutput(swapCalc.outputAmount, slippageTolerance);
        
        console.log('   Swap Calculation:');
        console.log('      Output:', swapCalc.outputAmount);
        console.log('      Min Output:', minOutput);
        console.log('      LP Fee:', swapCalc.lpFee);
        console.log('      Protocol Fee:', swapCalc.protocolFee);
        console.log('      Price Impact:', swapCalc.priceImpact);
        
        // Validar price impact
        const impactCheck = validatePriceImpact(swapCalc.priceImpact);
        
        if (!impactCheck.allowed) {
            return res.status(400).json({
                success: false,
                error: `Price impact too high: ${(swapCalc.priceImpact * 100).toFixed(2)}% (max: 50%)`
            });
        }
        
        // Construir PSBT
        let psbt;
        
        if (isBtcToRune) {
            // BTC → Rune
            psbt = buildSwapBtcToRunePSBT({
                pool,
                userAddress,
                userInputs: userUtxos,
                btcAmount: inputAmount,
                runeAmountOut: swapCalc.outputAmount,
                minRuneOut: minOutput,
                lpFee: swapCalc.lpFee,
                protocolFee: swapCalc.protocolFee,
                minerFee: feeRate * 300 // estimado
            });
        } else {
            // Rune → BTC
            psbt = buildSwapRuneToBtcPSBT({
                pool,
                userAddress,
                userInputs: userUtxos,
                runeAmount: inputAmount,
                btcAmountOut: swapCalc.outputAmount,
                minBtcOut: minOutput,
                lpFee: swapCalc.lpFee,
                protocolFee: swapCalc.protocolFee,
                minerFee: feeRate * 300
            });
        }
        
        const psbtBase64 = psbt.toBase64();
        
        console.log('✅ PSBT created, length:', psbtBase64.length);
        
        // Gerar swap ID temporário
        const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Salvar swap no DB como PENDING
        const timestamp = Date.now();
        
        db.prepare(`
            INSERT INTO defi_swaps (
                swap_id, pool_id, user_address,
                input_coin_id, input_amount,
                output_coin_id, output_amount, min_output,
                lp_fee, protocol_fee,
                price_impact, status,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            swapId, poolId, userAddress,
            inputCoinId, inputAmount,
            isBtcToRune ? pool.rune_id : '0:0', swapCalc.outputAmount, minOutput,
            swapCalc.lpFee, swapCalc.protocolFee,
            swapCalc.priceImpact, 'PENDING',
            timestamp
        );
        
        console.log('✅ Swap saved as PENDING:', swapId);
        
        res.json({
            success: true,
            psbt: psbtBase64,
            swapId,
            quote: {
                inputCoinId,
                inputAmount,
                outputCoinId: isBtcToRune ? pool.rune_id : '0:0',
                outputAmount: swapCalc.outputAmount,
                minOutput,
                lpFee: swapCalc.lpFee,
                protocolFee: swapCalc.protocolFee,
                priceImpact: swapCalc.priceImpact,
                effectivePrice: swapCalc.effectivePrice,
                slippageTolerance,
                deadline: Math.floor(Date.now() / 1000) + 300
            },
            message: 'Please sign this PSBT with your wallet'
        });
        
    } catch (error) {
        console.error('❌ Error preparing swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SWAP - FINALIZE (STEP 2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/defi/swap/finalize
 * Receber PSBT assinado pelo user, co-assinar e fazer broadcast
 * 
 * Body: {
 *   psbt: "cHNidP8BAH...",
 *   swapId: "swap_..."
 * }
 */
router.post('/swap/finalize', async (req, res) => {
    try {
        const { psbt: psbtBase64, swapId } = req.body;
        
        console.log('🔄 ========== FINALIZING SWAP ==========');
        console.log('   Swap ID:', swapId);
        
        if (!psbtBase64 || !swapId) {
            return res.status(400).json({
                success: false,
                error: 'Missing psbt or swapId'
            });
        }
        
        // Buscar swap no DB
        const swap = db.prepare('SELECT * FROM defi_swaps WHERE swap_id = ?').get(swapId);
        
        if (!swap) {
            return res.status(404).json({
                success: false,
                error: 'Swap not found'
            });
        }
        
        if (swap.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Swap status is ${swap.status}, expected PENDING`
            });
        }
        
        // Buscar pool
        const pool = getPool(swap.pool_id.replace(':BTC', ''));
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        console.log('   Pool:', pool.pool_id);
        console.log('   Direction:', swap.input_coin_id, '→', swap.output_coin_id);
        console.log('   Amount:', swap.input_amount, '→', swap.output_amount);
        
        // Parsear PSBT assinado pelo user
        const { Psbt } = await import('bitcoinjs-lib');
        const userSignedPsbt = Psbt.fromBase64(psbtBase64);
        
        console.log('   User signed PSBT received');
        
        // Determinar direção
        const isBtcToRune = swap.input_coin_id === '0:0';
        
        // TODO: Policy Engine valida aqui
        // TODO: Pool Signer co-assina aqui
        // Por enquanto, vamos assumir que o user assinou sozinho
        
        // Finalizar PSBT
        try {
            userSignedPsbt.finalizeAllInputs();
        } catch (e) {
            console.warn('   Some inputs not finalized:', e.message);
        }
        
        // Extrair tx hex
        const txHex = userSignedPsbt.extractTransaction().toHex();
        const txid = userSignedPsbt.extractTransaction().getId();
        
        console.log('   TX Hex length:', txHex.length);
        console.log('   TXID:', txid);
        
        // Broadcast
        console.log('📡 Broadcasting swap transaction...');
        
        try {
            await bitcoinRpc.call('sendrawtransaction', [txHex]);
            console.log('✅ Swap transaction broadcast successful!');
        } catch (broadcastError) {
            console.error('❌ Broadcast failed:', broadcastError.message);
            
            // Tentar testmempoolaccept
            try {
                const testResult = await bitcoinRpc.call('testmempoolaccept', [[txHex]]);
                console.error('   testmempoolaccept:', JSON.stringify(testResult, null, 2));
            } catch (e) {
                // ignore
            }
            
            throw new Error(`Broadcast failed: ${broadcastError.message}`);
        }
        
        // Atualizar swap no DB
        db.prepare(`
            UPDATE defi_swaps SET
                txid = ?,
                status = 'CONFIRMED',
                confirmed_at = ?
            WHERE swap_id = ?
        `).run(txid, Date.now(), swapId);
        
        // Atualizar reserves do pool
        const newReserveBtc = isBtcToRune 
            ? pool.reserve_btc + swap.input_amount 
            : pool.reserve_btc - swap.output_amount;
        
        const newReserveRune = isBtcToRune
            ? pool.reserve_rune - swap.output_amount
            : pool.reserve_rune + swap.input_amount;
        
        db.prepare(`
            UPDATE defi_pools SET
                reserve_btc = ?,
                reserve_rune = ?,
                total_volume_btc = total_volume_btc + ?,
                total_volume_rune = total_volume_rune + ?,
                updated_at = ?
            WHERE pool_id = ?
        `).run(
            newReserveBtc,
            newReserveRune,
            isBtcToRune ? swap.input_amount : swap.output_amount,
            isBtcToRune ? swap.output_amount : swap.input_amount,
            Date.now(),
            pool.pool_id
        );
        
        console.log('✅ Swap completed and pool updated!');
        console.log('   New Reserve BTC:', newReserveBtc);
        console.log('   New Reserve Rune:', newReserveRune);
        
        res.json({
            success: true,
            txid,
            swapId,
            message: 'Swap completed successfully!',
            explorerUrl: `https://mempool.space/tx/${txid}`,
            newPoolReserves: {
                btc: newReserveBtc,
                rune: newReserveRune
            }
        });
        
    } catch (error) {
        console.error('❌ Error finalizing swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 EXECUTAR SWAP (INVOKE - LEGADO)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/defi/swap
 * Executar swap após user assinar PSBT (endpoint legado)
 * 
 * Body: {
 *   psbt: "cHNidP8BAH...",
 *   poolId: "840000:3:BTC",
 *   quote: { ... }, // Quote anterior
 *   userAddress: "bc1p..."
 * }
 */
router.post('/swap', async (req, res) => {
    try {
        // Verificar kill switch
        if (isKillSwitchActive()) {
            return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable (maintenance mode)'
            });
        }
        
        const { psbt, poolId, quote, userAddress } = req.body;
        
        if (!psbt || !poolId || !quote) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        console.log('\n🔄 ═══ PROCESSING SWAP ═══');
        console.log(`   Pool: ${poolId}`);
        console.log(`   User: ${userAddress}`);
        console.log(`   Direction: ${quote.inputCoinId} → ${quote.outputCoinId}`);
        
        // Determinar tipo de swap
        const isBtcToRune = quote.inputCoinId === '0:0';
        
        // ═══════════════════════════════════════════════════════════════════════
        // 1. VALIDAR PSBT COM POLICY ENGINE
        // ═══════════════════════════════════════════════════════════════════════
        
        let validation;
        
        if (isBtcToRune) {
            validation = await validateSwapBtcToRune({
                psbtBase64: psbt,
                poolId,
                expectedBtcIn: quote.inputAmount,
                expectedRuneOut: quote.outputAmount,
                minRuneOut: quote.minOutput,
                maxSlippage: quote.slippageTolerance,
                nonce: quote.nonce
            });
        } else {
            validation = await validateSwapRuneToBtc({
                psbtBase64: psbt,
                poolId,
                expectedRuneIn: quote.inputAmount,
                expectedBtcOut: quote.outputAmount,
                minBtcOut: quote.minOutput,
                maxSlippage: quote.slippageTolerance,
                nonce: quote.nonce
            });
        }
        
        if (!validation.valid) {
            console.error('   ❌ PSBT validation failed:', validation.errors);
            
            return res.status(400).json({
                success: false,
                error: 'PSBT validation failed',
                details: validation.errors
            });
        }
        
        console.log('   ✅ PSBT validated by Policy Engine');
        
        // ═══════════════════════════════════════════════════════════════════════
        // 2. ASSINAR INPUT DO POOL
        // ═══════════════════════════════════════════════════════════════════════
        
        const signed = await signPoolInputSafe(psbt, poolId, 0);
        
        console.log('   ✅ Pool input signed');
        
        // ═══════════════════════════════════════════════════════════════════════
        // 3. FINALIZAR E EXTRAIR TX
        // ═══════════════════════════════════════════════════════════════════════
        
        const { txHex, txid, size } = finalizeAndExtract(signed.psbtSigned);
        
        console.log('   ✅ Transaction finalized');
        console.log(`   TXID: ${txid}`);
        
        // ═══════════════════════════════════════════════════════════════════════
        // 4. TESTAR MEMPOOL (testmempoolaccept)
        // ═══════════════════════════════════════════════════════════════════════
        
        try {
            const mempoolTest = await bitcoinRpc.call('testmempoolaccept', [[txHex]]);
            
            if (!mempoolTest[0].allowed) {
                console.error('   ❌ Mempool test failed:', mempoolTest[0]['reject-reason']);
                
                return res.status(400).json({
                    success: false,
                    error: 'Transaction rejected by mempool',
                    reason: mempoolTest[0]['reject-reason']
                });
            }
            
            console.log('   ✅ Mempool test passed');
        } catch (e) {
            console.warn('   ⚠️  Could not test mempool:', e.message);
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // 5. BROADCAST
        // ═══════════════════════════════════════════════════════════════════════
        
        try {
            await bitcoinRpc.call('sendrawtransaction', [txHex]);
            
            console.log('   ✅ Transaction broadcasted');
            console.log('═══════════════════════════════════════════════════\n');
            
        } catch (broadcastError) {
            console.error('   ❌ Broadcast failed:', broadcastError.message);
            
            return res.status(500).json({
                success: false,
                error: 'Broadcast failed',
                details: broadcastError.message,
                txHex // Retornar hex para debug
            });
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // 6. SALVAR NO BANCO
        // ═══════════════════════════════════════════════════════════════════════
        
        const timestamp = Math.floor(Date.now() / 1000);
        const swapId = `${poolId}:${txid}`;
        
        db.prepare(`
            INSERT INTO defi_swaps (
                swap_id, pool_id, trader_address,
                input_coin_id, input_amount,
                output_coin_id, output_amount,
                lp_fee, protocol_fee, price_impact,
                psbt_hex, tx_hex, txid,
                status, nonce,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            swapId, poolId, userAddress,
            quote.inputCoinId, quote.inputAmount,
            quote.outputCoinId, quote.outputAmount,
            quote.lpFee, quote.protocolFee, quote.priceImpact,
            psbt, txHex, txid,
            'BROADCASTED', quote.nonce,
            timestamp
        );
        
        // ═══════════════════════════════════════════════════════════════════════
        // 7. ATUALIZAR RESERVAS DO POOL (otimistic update)
        // ═══════════════════════════════════════════════════════════════════════
        
        const pool = getPool(poolId.replace(':BTC', ''));
        
        const newReserveBtc = isBtcToRune 
            ? pool.reserve_btc + quote.inputAmount
            : pool.reserve_btc - quote.outputAmount;
        
        const newReserveRune = isBtcToRune
            ? pool.reserve_rune - quote.outputAmount
            : pool.reserve_rune + quote.inputAmount;
        
        db.prepare(`
            UPDATE defi_pools
            SET reserve_btc = ?,
                reserve_rune = ?,
                volume_24h_btc = volume_24h_btc + ?,
                fees_collected_btc = fees_collected_btc + ?,
                updated_at = ?
            WHERE pool_id = ?
        `).run(
            newReserveBtc,
            newReserveRune,
            isBtcToRune ? quote.inputAmount : quote.outputAmount,
            quote.lpFee + quote.protocolFee,
            timestamp,
            poolId
        );
        
        console.log(`✅ Pool reserves updated: BTC=${newReserveBtc}, Rune=${newReserveRune}`);
        
        // Resposta de sucesso
        res.json({
            success: true,
            txid,
            size,
            swap: {
                swapId,
                inputAmount: quote.inputAmount,
                outputAmount: quote.outputAmount,
                lpFee: quote.lpFee,
                protocolFee: quote.protocolFee,
                priceImpact: quote.priceImpact
            },
            newReserves: {
                btc: newReserveBtc,
                rune: newReserveRune
            }
        });
        
    } catch (error) {
        console.error('Error executing swap:', error);
        console.log('═══════════════════════════════════════════════════\n');
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 CRIAR NOVO POOL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/defi/pools
 * Criar novo pool de liquidez
 * 
 * Body: {
 *   runeId: "840000:3",
 *   runeName: "MY•RUNE",
 *   runeSymbol: "RUNE",
 *   initialBtc: 10000000,
 *   initialRune: 1000000000,
 *   providerAddress: "bc1p...",
 *   poolUtxo: { txid, vout, value, script }
 * }
 */
// ═══════════════════════════════════════════════════════════════════════════════
// 📊 STATUS & HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/defi/status
 * Status do sistema DeFi (LND, pools, fees, etc)
 */
router.get('/status', async (req, res) => {
    try {
        const signerStatus = await getPoolSignerStatus();
        
        // Check if tables exist
        const tablesExist = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('defi_pools', 'defi_swaps')
        `).all();
        
        let poolCount = { count: 0 };
        let totalSwaps = { count: 0 };
        
        if (tablesExist.length > 0) {
            try {
                poolCount = db.prepare('SELECT COUNT(*) as count FROM defi_pools WHERE status = "ACTIVE"').get();
                totalSwaps = db.prepare('SELECT COUNT(*) as count FROM defi_swaps').get();
            } catch (e) {
                console.warn('Could not query defi tables:', e.message);
            }
        }
        
        res.json({
            success: true,
            defi: {
                enabled: true,
                version: '1.0.0',
                fees: {
                    lpFee: '0.7%',
                    protocolFee: '0.2%',
                    total: '0.9%'
                },
                limits: {
                    maxPriceImpact: '50%',
                    minLiquidity: 1000,
                    slippageTolerance: '5%'
                }
            },
            pools: {
                total: poolCount.count,
                active: poolCount.count
            },
            swaps: {
                total: totalSwaps.count
            },
            signer: signerStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 CREATE POOL - PREPARE (STEP 1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/defi/pools/prepare
 * Preparar PSBT para criar pool (user vai assinar depois)
 * 
 * Body: {
 *   runeId, runeName, runeSymbol,
 *   initialBtc, initialRune,
 *   userAddress, userUtxos,
 *   feeRate, poolName, useInscription, poolInscriptionId, poolImage
 * }
 */
router.post('/pools/prepare', async (req, res) => {
    try {
        const {
            runeId,
            runeName,
            runeSymbol,
            initialBtc,
            initialRune,
            userAddress,
            userUtxos,
            feeRate = 10,
            poolName,
            useInscription,
            poolInscriptionId,
            poolInscriptionNumber,
            poolImage
        } = req.body;
        
        console.log('🏊 Preparing Create Pool PSBT...');
        console.log('   Rune:', runeName, runeId);
        console.log('   Initial BTC:', initialBtc, 'sats');
        console.log('   Initial Rune:', initialRune);
        console.log('   User Address:', userAddress);
        
        // Validar parâmetros
        if (!runeId || !runeName || !initialBtc || !initialRune || !userAddress || !userUtxos || userUtxos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // Gerar endereço do pool (Taproot 2-of-2)
        const poolId = `${runeId}:BTC`;
        const { address: poolAddress, pubkey: poolPubkey } = generatePoolAddress(poolId);
        
        console.log('   Pool ID:', poolId);
        console.log('   Pool Address:', poolAddress);
        
        // Construir PSBT
        const psbt = buildCreatePoolPSBT({
            userUtxos,
            poolAddress,
            userAddress,
            runeId,
            runeAmount: initialRune,
            btcAmount: initialBtc,
            feeRate
        });
        
        // Converter para base64
        const psbtBase64 = psbt.toBase64();
        
        console.log('✅ PSBT created, length:', psbtBase64.length);
        
        // Salvar pool no DB como "PENDING" (aguardando funding)
        const timestamp = Date.now();
        const tempPoolId = `temp_${poolId}_${timestamp}`;
        
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
            tempPoolId, runeId, runeName, runeSymbol,
            '', 0, 0, '',  // UTXO ainda não existe
            initialBtc, initialRune,
            1,
            poolAddress, poolPubkey,
            useInscription ? 1 : 0, poolInscriptionId || null, poolInscriptionNumber || null, poolImage || null,
            'PENDING',  // Status pending até broadcast
            timestamp, timestamp
        );
        
        console.log('✅ Pool saved as PENDING:', tempPoolId);
        
        res.json({
            success: true,
            psbt: psbtBase64,
            poolId: tempPoolId,
            poolAddress,
            message: 'Please sign this PSBT with your wallet'
        });
        
    } catch (error) {
        console.error('❌ Error preparing pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 CREATE POOL - FINALIZE (STEP 2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/defi/pools/finalize
 * Receber PSBT assinado pelo user, co-assinar e fazer broadcast
 * 
 * Body: {
 *   psbt: "base64...",
 *   poolId: "temp_..."
 * }
 */
router.post('/pools/finalize', async (req, res) => {
    try {
        const { psbt: psbtBase64, poolId } = req.body;
        
        console.log('🏊 Finalizing Create Pool...');
        console.log('   Pool ID:', poolId);
        
        if (!psbtBase64 || !poolId) {
            return res.status(400).json({
                success: false,
                error: 'Missing psbt or poolId'
            });
        }
        
        // Buscar pool no DB
        const pool = db.prepare('SELECT * FROM defi_pools WHERE pool_id = ?').get(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        if (pool.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Pool status is ${pool.status}, expected PENDING`
            });
        }
        
        // Parsear PSBT assinado pelo user
        const { Psbt } = await import('bitcoinjs-lib');
        const userSignedPsbt = Psbt.fromBase64(psbtBase64);
        
        console.log('   User signed PSBT received');
        
        // TODO: Pool Signer co-assina aqui
        // Por enquanto, vamos assumir que o user assinou sozinho (para teste)
        // Em produção, precisamos co-assinar com a chave do protocol
        
        // Finalizar PSBT
        try {
            userSignedPsbt.finalizeAllInputs();
        } catch (e) {
            console.warn('   Some inputs not finalized:', e.message);
        }
        
        // Extrair tx hex
        const txHex = userSignedPsbt.extractTransaction().toHex();
        const txid = userSignedPsbt.extractTransaction().getId();
        
        console.log('   TX Hex length:', txHex.length);
        console.log('   TXID:', txid);
        
        // Broadcast
        console.log('📡 Broadcasting transaction...');
        
        try {
            await bitcoinRpc.call('sendrawtransaction', [txHex]);
            console.log('✅ Transaction broadcast successful!');
        } catch (broadcastError) {
            console.error('❌ Broadcast failed:', broadcastError.message);
            
            // Tentar testmempoolaccept para mais detalhes
            try {
                const testResult = await bitcoinRpc.call('testmempoolaccept', [[txHex]]);
                console.error('   testmempoolaccept:', JSON.stringify(testResult, null, 2));
            } catch (e) {
                // ignore
            }
            
            throw new Error(`Broadcast failed: ${broadcastError.message}`);
        }
        
        // Atualizar pool no DB com UTXO real
        const finalPoolId = `${pool.rune_id}:BTC`;
        
        db.prepare(`
            UPDATE defi_pools SET
                pool_id = ?,
                pool_utxo_txid = ?,
                pool_utxo_vout = 0,
                pool_utxo_value = ?,
                status = 'ACTIVE',
                updated_at = ?
            WHERE pool_id = ?
        `).run(
            finalPoolId,
            txid,
            pool.reserve_btc + 546,
            Date.now(),
            poolId
        );
        
        console.log('✅ Pool activated:', finalPoolId);
        
        res.json({
            success: true,
            txid,
            poolId: finalPoolId,
            message: 'Pool created successfully!',
            explorerUrl: `https://mempool.space/tx/${txid}`
        });
        
    } catch (error) {
        console.error('❌ Error finalizing pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/pools', (req, res) => {
    try {
        const {
            runeId,
            runeName,
            runeSymbol,
            initialBtc,
            initialRune,
            providerAddress,
            poolUtxo,
            useInscription,
            poolInscriptionId,
            poolInscriptionNumber,
            poolImage
        } = req.body;
        
        // Validar
        if (!runeId || !runeName || !initialBtc || !initialRune || !providerAddress || !poolUtxo) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // Gerar endereço do pool
        const poolId = `${runeId}:BTC`;
        const { address, pubkey } = generatePoolAddress(poolId);
        
        // Criar pool
        const pool = createPool({
            runeId,
            runeName,
            runeSymbol,
            initialBtc,
            initialRune,
            providerAddress,
            poolUtxo,
            poolAddress: address,
            poolPubkey: pubkey,
            useInscription,
            poolInscriptionId,
            poolInscriptionNumber,
            poolImage
        });
        
        res.json({
            success: true,
            pool: {
                ...pool,
                price: getPoolPrice({ reserve_btc: initialBtc, reserve_rune: initialRune })
            }
        });
        
    } catch (error) {
        console.error('Error creating pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

