/**
 * 🎯 UNIFIED DEFI - SMART ROUTER
 * 
 * Experiência unificada para o usuário:
 * - User vê apenas: saldo, swap simples, execução rápida
 * - Backend decide automaticamente: L1 ou L2
 * - Backend agrega: real + synthetic runes
 * - Backend otimiza: velocidade + custo + segurança
 * 
 * USER NÃO VÊ:
 * ❌ "L1" ou "L2"
 * ❌ "Synthetic" ou "Real"
 * ❌ "Lightning" ou "On-chain"
 * 
 * USER SÓ VÊ:
 * ✅ Saldo total
 * ✅ Swap simples
 * ✅ Instant + Secure + Low Fee
 * 
 * @author KrayWallet Team
 * @version 4.0 - UNIFIED EXPERIENCE
 */

import express from 'express';
import axios from 'axios';
import syntheticRunesService from '../services/syntheticRunesService.js';
import StateTracker from '../lightning/krayStateTracker.js';
import PSBTBuilderRunes from '../utils/psbtBuilderRunes.js';

const router = express.Router();

// ✅ Usar ORD server LOCAL (não ordinals.com para evitar rate limit!)
// QuickNode enabled
const USE_QUICKNODE = process.env.QUICKNODE_ENABLED === 'true';

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 AGGREGATED BALANCE - Real + Synthetic
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/unified-defi/balance/:address
 * 
 * Retorna saldo AGREGADO (real + synthetic)
 * User vê apenas total, não precisa saber de L1/L2
 */
router.get('/balance/:address', async (req, res) => {
    console.log('\n💰 ========== GET AGGREGATED BALANCE ==========');
    
    try {
        const { address } = req.params;
        console.log('   Address:', address);
        
        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Buscar REAL runes (L1) do ORD
        // ═══════════════════════════════════════════════════════════════════
        
        console.log('   📡 Fetching real runes from ORD...');
        const realRunesMap = {};
        
        try {
            const runesResponse = await axios.get(`http://localhost:4000/api/runes/fast/${address}`);
            const runesData = runesResponse.data;
            
            if (runesData.success && runesData.runes) {
                for (const rune of runesData.runes) {
                    realRunesMap[rune.runeId] = {
                        runeId: rune.runeId,
                        runeName: rune.name,
                        runeSymbol: rune.symbol || rune.name.split('•')[0],
                        balance: parseFloat(rune.amount) || 0,
                        divisibility: rune.divisibility || 0, // ✅ Cada rune tem sua própria divisibility!
                        source: 'real',
                        parent: rune.parent || null,
                        // ✅ Usar ORD server LOCAL em vez de ordinals.com (evita rate limit!)
                        // Se não tem parent, usar logo padrão do KRAY STATION
                        thumbnail: rune.parent 
                            ? `${ORD_SERVER_URL}/content/${rune.parent}` 
                            : '/images/kray-station-logo.png'
                    };
                    console.log(`   📦 Real: ${rune.name} = ${rune.amount} (div: ${rune.divisibility || 0}, parent: ${rune.parent || 'none'})`);
                }
            }
        } catch (error) {
            console.warn('   ⚠️  Error fetching real runes:', error.message);
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Buscar SYNTHETIC runes (L2) das pools
        // ═══════════════════════════════════════════════════════════════════
        
        const pools = await StateTracker.listActiveChannels();
        console.log(`   🏊 Found ${pools.length} active pools`);
        
        for (const pool of pools) {
            try {
                // Synthetic balance (L2)
                const syntheticResult = await syntheticRunesService.getVirtualBalance(
                    address, pool.poolId
                );
                const syntheticBalance = syntheticResult.balance || 0;
                
                if (syntheticBalance > 0) {
                    console.log(`   ⚡ Synthetic: ${pool.runeSymbol} = ${syntheticBalance}`);
                    
                    // Se já tem rune real, adicionar synthetic ao total
                    if (realRunesMap[pool.runeId]) {
                        realRunesMap[pool.runeId].balance += syntheticBalance;
                        realRunesMap[pool.runeId].hasSynthetic = true;
                        realRunesMap[pool.runeId].syntheticBalance = syntheticBalance;
                    } else {
                        // Criar entrada só com synthetic
                        realRunesMap[pool.runeId] = {
                            runeId: pool.runeId,
                            runeName: pool.runeName,
                            runeSymbol: pool.runeSymbol,
                            balance: syntheticBalance,
                            source: 'synthetic',
                            syntheticBalance
                        };
                    }
                }
            } catch (error) {
                console.warn(`   ⚠️  Error getting synthetic balance for ${pool.runeSymbol}:`, error.message);
            }
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Converter para array e retornar
        // ═══════════════════════════════════════════════════════════════════
        
        const aggregatedBalances = Object.values(realRunesMap);
        console.log(`   ✅ Total runes: ${aggregatedBalances.length}`);
        
        res.json({
            success: true,
            address,
            balances: aggregatedBalances
        });
        
    } catch (error) {
        console.error('❌ Error getting aggregated balance:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 SMART ROUTER - Decision Engine
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Decide automaticamente a melhor rota para o swap
 * 
 * Prioridades:
 * 1. L2 Synthetic (se user já tem) → INSTANT (~1-3s, ~1 sat fee)
 * 2. L2 Available (se pool tem liquidez) → FAST (~2-5s, ~1 sat fee)
 * 3. L1 Traditional (fallback) → SLOW (~10-60min, ~2000 sats fee)
 */
async function decideRoute(userAddress, fromAsset, toAsset, amount) {
    console.log('\n🤖 ========== SMART ROUTER ==========');
    console.log('   User:', userAddress);
    console.log('   From:', fromAsset);
    console.log('   To:', toAsset);
    console.log('   Amount:', amount);
    
    // Encontrar pool
    const pools = await StateTracker.listActiveChannels();
    const pool = pools.find(p => 
        p.runeId === fromAsset || p.runeId === toAsset
    );
    
    if (!pool) {
        console.log('   ❌ Pool not found!');
        return {
            route: 'NO_POOL',
            reason: 'No liquidity pool available for this rune',
            estimatedTime: null,
            estimatedFee: null,
            error: 'NO_POOL_AVAILABLE'
        };
    }
    
    console.log('   ✅ Pool found:', pool.poolId);
    
    // ───────────────────────────────────────────────────────────────────────
    // ROUTE 1: L2 Synthetic (BEST - User já tem synthetic)
    // ───────────────────────────────────────────────────────────────────────
    
    if (fromAsset !== 'BTC') {
        // Selling runes → Check synthetic balance
        try {
            const syntheticBalance = await syntheticRunesService.getVirtualBalance(
                userAddress, pool.poolId
            );
            
            if (syntheticBalance.balance >= amount) {
                console.log('   ✅ ROUTE: L2 Synthetic (user has synthetic balance)');
                console.log('   ⚡ Speed: INSTANT (~1-3s)');
                console.log('   💸 Fee: ~1 sat');
                
                return {
                    route: 'L2_SYNTHETIC',
                    poolId: pool.poolId,
                    reason: 'User has synthetic balance',
                    estimatedTime: '1-3 seconds',
                    estimatedFee: 1
                };
            }
        } catch (error) {
            console.warn('   ⚠️  Error checking synthetic balance:', error.message);
        }
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // ROUTE 2: L2 Available (GOOD - Pool has liquidity)
    // ───────────────────────────────────────────────────────────────────────
    
    try {
        const poolStats = await syntheticRunesService.getPoolStats(pool.poolId);
        
        if (poolStats.success) {
            const availableLiquidity = poolStats.l1.runes - poolStats.syntheticIssued;
            
            if (fromAsset === 'BTC' && availableLiquidity >= amount) {
                console.log('   ✅ ROUTE: L2 Available (pool has liquidity)');
                console.log('   ⚡ Speed: FAST (~2-5s)');
                console.log('   💸 Fee: ~1 sat');
                
                return {
                    route: 'L2_AVAILABLE',
                    poolId: pool.poolId,
                    reason: 'Pool has available liquidity',
                    estimatedTime: '2-5 seconds',
                    estimatedFee: 1
                };
            }
        }
    } catch (error) {
        console.warn('   ⚠️  Error checking pool stats:', error.message);
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // ROUTE 3: L1 Traditional (FALLBACK)
    // ───────────────────────────────────────────────────────────────────────
    
    console.log('   📍 ROUTE: L1 Traditional (fallback)');
    console.log('   🐢 Speed: SLOW (~10-60min)');
    console.log('   💸 Fee: ~2000 sats');
    
    return {
        route: 'L1',
        reason: 'No L2 liquidity available',
        estimatedTime: '10-60 minutes',
        estimatedFee: 2000
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 UNIFIED SWAP - The Magic Happens Here
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/unified-defi/swap
 * 
 * Endpoint UNIFICADO para swaps
 * Backend decide automaticamente a melhor rota
 * User só vê: "Swap completed! ✨"
 */
router.post('/swap', async (req, res) => {
    console.log('\n🎯 ========== UNIFIED SWAP ==========');
    
    try {
        const { userAddress, fromAsset, toAsset, amount, minAmountOut } = req.body;
        
        if (!userAddress || !fromAsset || !toAsset || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        console.log('   User:', userAddress);
        console.log('   From:', fromAsset, 'Amount:', amount);
        console.log('   To:', toAsset);
        
        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Smart Router - Decide best route
        // ═══════════════════════════════════════════════════════════════════
        
        const routeDecision = await decideRoute(userAddress, fromAsset, toAsset, amount);
        
        console.log('\n📋 Route Decision:');
        console.log('   Route:', routeDecision.route);
        console.log('   Reason:', routeDecision.reason);
        console.log('   Time:', routeDecision.estimatedTime);
        console.log('   Fee:', routeDecision.estimatedFee, 'sats');
        
        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Execute swap based on route
        // ═══════════════════════════════════════════════════════════════════
        
        let result;
        
        switch (routeDecision.route) {
            case 'L2_SYNTHETIC':
            case 'L2_AVAILABLE':
                // Execute via Lightning (L2)
                result = await executeLightningSwap(
                    userAddress, 
                    fromAsset, 
                    toAsset, 
                    amount, 
                    minAmountOut,
                    routeDecision.poolId
                );
                break;
                
            case 'L1':
                // Execute via traditional on-chain (L1)
                result = await executeL1Swap(
                    userAddress,
                    fromAsset,
                    toAsset,
                    amount,
                    minAmountOut
                );
                break;
                
            default:
                throw new Error('Unknown route');
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Return unified response
        // ═══════════════════════════════════════════════════════════════════
        
        console.log('\n✅ ========== SWAP COMPLETED ==========');
        console.log('   Route used:', routeDecision.route);
        console.log('   Amount out:', result.amountOut);
        console.log('   Fee:', result.fee, 'sats');
        
        res.json({
            success: true,
            // User vê apenas isso:
            amountOut: result.amountOut,
            fee: result.fee,
            estimatedTime: routeDecision.estimatedTime,
            // Informações adicionais (opcional)
            route: routeDecision.route, // Para transparência/debug
            message: result.message || 'Swap completed successfully! ✨'
        });
        
    } catch (error) {
        console.error('❌ Error in unified swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS - Execute Swaps
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute swap via Lightning (L2)
 */
async function executeLightningSwap(userAddress, fromAsset, toAsset, amount, minAmountOut, poolId) {
    console.log('\n⚡ Executing Lightning Swap (L2)...');
    
    // Calculate swap using AMM
    const calculation = await syntheticRunesService.calculateSwap(
        poolId, fromAsset, toAsset, amount
    );
    
    // Validate slippage
    if (minAmountOut && calculation.amountOut < minAmountOut) {
        throw new Error(`Slippage too high. Expected ${minAmountOut}, got ${calculation.amountOut}`);
    }
    
    // Execute swap
    const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await syntheticRunesService.executeSwap(
        swapId,
        poolId,
        userAddress,
        fromAsset,
        toAsset,
        amount,
        calculation.amountOut,
        calculation.fee,
        calculation.executionPrice,
        calculation.slippage
    );
    
    console.log('   ✅ Lightning swap completed!');
    
    return {
        amountOut: calculation.amountOut,
        fee: calculation.fee,
        swapId,
        message: 'Swap completed via Lightning! ⚡'
    };
}

/**
 * Execute swap via traditional L1
 */
async function executeL1Swap(userAddress, fromAsset, toAsset, amount, minAmountOut) {
    console.log('\n🐢 Executing L1 Swap (traditional)...');
    
    // TODO: Implementar swap L1 tradicional
    // Por enquanto, retornar placeholder
    
    throw new Error('L1 traditional swap not yet implemented. Please try again later or contact support.');
    
    // Quando implementado:
    // 1. Create PSBT for swap
    // 2. Return PSBT for user to sign
    // 3. Broadcast after signature
    // 4. Wait for confirmation
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 QUOTE - Calculate swap before executing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/unified-defi/quote
 * 
 * Calcular swap SEM executar
 * User vê preview antes de confirmar
 */
router.post('/quote', async (req, res) => {
    console.log('\n💭 ========== GET QUOTE ==========');
    
    try {
        const { userAddress, fromAsset, toAsset, amount } = req.body;
        
        // Get route decision
        const routeDecision = await decideRoute(userAddress, fromAsset, toAsset, amount);
        
        // ✅ Check if no pool available
        if (routeDecision.route === 'NO_POOL') {
            return res.status(400).json({
                success: false,
                error: 'NO_POOL_AVAILABLE',
                message: '🏊 No liquidity pool available for this rune!\n\n💡 Create a pool first to enable swaps.',
                needsPool: true,
                runeId: fromAsset
            });
        }
        
        // Calculate based on route
        let amountOut, fee, price;
        
        if (routeDecision.route === 'L2_SYNTHETIC' || routeDecision.route === 'L2_AVAILABLE') {
            const calculation = await syntheticRunesService.calculateSwap(
                routeDecision.poolId, fromAsset, toAsset, amount
            );
            
            amountOut = calculation.amountOut;
            fee = calculation.fee;
            price = calculation.executionPrice;
        } else {
            // L1 calculation (simplified)
            amountOut = amount * 0.998; // 0.2% slippage estimate
            fee = 2000; // Typical L1 fee
            price = amount / amountOut;
        }
        
        res.json({
            success: true,
            amountOut,
            fee,
            price,
            route: routeDecision.route,
            estimatedTime: routeDecision.estimatedTime,
            message: `Best route: ${routeDecision.route === 'L1' ? 'Traditional' : 'Lightning'}`
        });
        
    } catch (error) {
        console.error('❌ Error getting quote:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

