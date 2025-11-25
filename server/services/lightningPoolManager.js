/**
 * 🏊 LIGHTNING POOL MANAGER
 * 
 * Gerencia pools de liquidez na Lightning Network
 * Integra AMM (x*y=k) com Lightning Channels
 */

import lightningNode from './lightningNode.js';
import * as ammCalculator from '../utils/ammCalculator.js';

class LightningPoolManager {
    constructor() {
        this.pools = new Map(); // poolId -> poolData
    }

    /**
     * 🎯 CRIAR POOL DE LIQUIDEZ COM LIGHTNING
     * 
     * Processo:
     * 1. Verificar ownership da Ordinal Inscription
     * 2. Criar Lightning Node baseado na inscription
     * 3. Abrir canal Lightning com capacidade
     * 4. Registrar pool com AMM parameters
     * 
     * @param {Object} params - Parâmetros da pool
     * @returns {Object} Pool criada
     */
    async createPool(params) {
        const {
            inscription,
            runeA,
            amountA,
            isBtcPair,
            runeB,
            amountB,
            feeRate,
            creatorAddress
        } = params;

        console.log('🏊 Creating Lightning Pool...');
        console.log('   Inscription:', inscription.inscriptionNumber);
        console.log('   Token A:', `${amountA} ${runeA.name}`);
        console.log('   Token B:', isBtcPair ? `${amountB} sats` : `${amountB} ${runeB.name}`);

        // 1. Criar Lightning Node da inscription
        const node = await lightningNode.createNodeFromInscription(inscription);

        // 2. Preparar capacidade do canal
        const channelCapacity = {
            btc: isBtcPair ? amountB : 10000, // Se não for BTC pair, usar mínimo
            runes: [
                { id: runeA.id, amount: amountA, name: runeA.name }
            ]
        };

        // Se for Rune/Rune pair, adicionar segunda rune
        if (!isBtcPair && runeB) {
            channelCapacity.runes.push({
                id: runeB.id,
                amount: amountB,
                name: runeB.name
            });
        }

        // 3. Abrir canal Lightning
        const channel = await lightningNode.openChannel(
            inscription.inscriptionId,
            channelCapacity
        );

        // 4. Calcular price inicial e LP tokens
        const priceA = isBtcPair 
            ? amountB / amountA  // sats per token
            : amountB / amountA; // token B per token A
        
        const lpTokenSupply = Math.sqrt(amountA * amountB);

        // 5. Criar estrutura da pool
        const pool = {
            // Identity
            poolId: channel.channelId,
            channelId: channel.channelId,
            shortChannelId: channel.shortChannelId,
            
            // Inscription linkage
            inscriptionId: inscription.inscriptionId,
            inscriptionNumber: inscription.inscriptionNumber,
            inscriptionImage: inscription.contentUrl || null,
            useInscription: !!inscription.contentUrl,
            
            // Creator
            creatorAddress: creatorAddress,
            
            // Tokens
            tokenA: {
                id: runeA.id,
                name: runeA.name,
                symbol: runeA.symbol || runeA.name,
                reserve: amountA
            },
            tokenB: isBtcPair ? {
                id: 'BTC',
                name: 'Bitcoin',
                symbol: 'sats',
                reserve: amountB
            } : {
                id: runeB.id,
                name: runeB.name,
                symbol: runeB.symbol || runeB.name,
                reserve: amountB
            },
            
            // AMM Parameters
            k: amountA * amountB, // Constant product
            feeRate: feeRate || 0.003, // 0.3% default
            
            // LP Tokens
            lpTokenSupply: lpTokenSupply,
            lpHolders: new Map([[creatorAddress, lpTokenSupply]]),
            
            // Metrics
            totalValueLocked: isBtcPair ? amountB : (amountA + amountB),
            volume24h: 0,
            volume7d: 0,
            volumeAllTime: 0,
            swapCount: 0,
            feesAccumulated: 0,
            
            // Lightning specific
            lightningNodeId: node.nodeId,
            lightningNodePubkey: node.nodePubkey,
            
            // State
            status: 'pending', // pending -> active -> closed
            active: false,
            
            // Timestamps
            createdAt: Date.now(),
            activatedAt: null,
            lastSwapAt: null
        };

        // 6. Armazenar pool
        this.pools.set(pool.poolId, pool);

        console.log('✅ Lightning Pool created!');
        console.log('   Pool ID:', pool.poolId.substring(0, 16) + '...');
        console.log('   Lightning Node:', node.alias);
        console.log('   Initial Price:', priceA, 'sats per token');
        console.log('   LP Tokens:', lpTokenSupply.toFixed(2));

        return pool;
    }

    /**
     * ⚡ EXECUTAR SWAP VIA LIGHTNING
     * 
     * Processo:
     * 1. Validar pool e parâmetros
     * 2. Calcular output usando AMM (x*y=k)
     * 3. Aplicar slippage protection
     * 4. Criar Lightning Invoice
     * 5. Usuário paga invoice (off-chain)
     * 6. Atualizar reserves da pool
     * 
     * @param {string} poolId - ID da pool
     * @param {Object} swapParams - Parâmetros do swap
     * @returns {Object} Invoice Lightning + swap details
     */
    async executeSwap(poolId, swapParams) {
        const {
            tokenIn,
            amountIn,
            minAmountOut,
            slippageTolerance
        } = swapParams;

        console.log('⚡ Executing Lightning Swap...');
        console.log('   Pool:', poolId.substring(0, 16) + '...');
        console.log('   Input:', `${amountIn} ${tokenIn}`);

        // 1. Get pool
        const pool = this.pools.get(poolId);
        if (!pool) {
            throw new Error('Pool not found');
        }

        if (!pool.active) {
            throw new Error('Pool not active');
        }

        // 2. Determinar direção do swap
        const isTokenAtoB = tokenIn === pool.tokenA.id;
        const tokenOut = isTokenAtoB ? pool.tokenB.id : pool.tokenA.id;
        
        const reserveIn = isTokenAtoB ? pool.tokenA.reserve : pool.tokenB.reserve;
        const reserveOut = isTokenAtoB ? pool.tokenB.reserve : pool.tokenA.reserve;

        // 3. Calcular output usando AMM
        const swapResult = ammCalculator.calculateSwapOutput(
            amountIn,
            reserveIn,
            reserveOut,
            pool.feeRate
        );

        console.log('   Calculated output:', swapResult.amountOut, tokenOut);
        console.log('   Fee:', swapResult.fee, tokenIn);
        console.log('   Price impact:', `${swapResult.priceImpact.toFixed(4)}%`);

        // 4. Validar slippage
        if (minAmountOut && swapResult.amountOut < minAmountOut) {
            throw new Error(`Slippage too high. Expected ${minAmountOut}, got ${swapResult.amountOut}`);
        }

        if (swapResult.priceImpact > (slippageTolerance || 1.0)) {
            throw new Error(`Price impact too high: ${swapResult.priceImpact.toFixed(2)}%`);
        }

        // 5. Criar Lightning Invoice
        const invoice = await lightningNode.createSwapInvoice(pool.channelId, {
            amountIn: amountIn,
            tokenIn: tokenIn,
            amountOut: swapResult.amountOut,
            tokenOut: tokenOut
        });

        // 6. Preparar atualização da pool (será executada quando invoice for paga)
        const poolUpdate = {
            reserveIn: reserveIn + amountIn,
            reserveOut: reserveOut - swapResult.amountOut,
            feesAccumulated: pool.feesAccumulated + swapResult.fee,
            volume: amountIn * (pool.tokenA.id === 'BTC' ? 1 : swapResult.executionPrice),
            invoice: invoice
        };

        console.log('✅ Lightning Invoice created!');
        console.log('   Invoice:', invoice.paymentRequest);
        console.log('   Expiry:', '1 hour');

        return {
            invoice: invoice,
            swapDetails: swapResult,
            poolUpdate: poolUpdate
        };
    }

    /**
     * 💰 ADICIONAR LIQUIDEZ
     * 
     * @param {string} poolId - ID da pool
     * @param {Object} params - Parâmetros
     * @returns {Object} LP tokens recebidos
     */
    async addLiquidity(poolId, params) {
        const { amountA, amountB, address } = params;

        console.log('💰 Adding liquidity to Lightning Pool...');

        const pool = this.pools.get(poolId);
        if (!pool) {
            throw new Error('Pool not found');
        }

        // Calcular LP tokens usando AMM calculator
        const lpTokens = ammCalculator.calculateLPTokens(
            amountA,
            amountB,
            pool.tokenA.reserve,
            pool.tokenB.reserve,
            pool.lpTokenSupply
        );

        // Atualizar pool
        pool.tokenA.reserve += amountA;
        pool.tokenB.reserve += amountB;
        pool.lpTokenSupply += lpTokens.lpTokensReceived;
        pool.totalValueLocked += (pool.tokenB.id === 'BTC' ? amountB : (amountA + amountB));

        // Atualizar holdings
        const currentBalance = pool.lpHolders.get(address) || 0;
        pool.lpHolders.set(address, currentBalance + lpTokens.lpTokensReceived);

        // Atualizar canal Lightning
        const channel = lightningNode.getChannel(pool.channelId);
        if (channel) {
            channel.capacity += (pool.tokenB.id === 'BTC' ? amountB : 0);
            channel.localBalance += (pool.tokenB.id === 'BTC' ? amountB : 0);
        }

        console.log('✅ Liquidity added!');
        console.log('   LP Tokens:', lpTokens.lpTokensReceived);
        console.log('   Share:', `${lpTokens.shareOfPool.toFixed(4)}%`);

        return lpTokens;
    }

    /**
     * 💸 REMOVER LIQUIDEZ (FECHAR CANAL)
     * 
     * @param {string} poolId - ID da pool
     * @param {Object} params - Parâmetros
     * @returns {Object} PSBT de fechamento
     */
    async removeLiquidity(poolId, params) {
        const { lpTokens, address, destination } = params;

        console.log('💸 Removing liquidity from Lightning Pool...');

        const pool = this.pools.get(poolId);
        if (!pool) {
            throw new Error('Pool not found');
        }

        // Verificar ownership
        const userBalance = pool.lpHolders.get(address) || 0;
        if (userBalance < lpTokens) {
            throw new Error('Insufficient LP tokens');
        }

        // Calcular quanto receberá
        const amounts = ammCalculator.calculateRemoveLiquidity(
            lpTokens,
            pool.tokenA.reserve,
            pool.tokenB.reserve,
            pool.lpTokenSupply,
            pool.feesAccumulated
        );

        // Se estiver removendo TODA a liquidez, fechar canal
        const isFullWithdraw = (lpTokens === userBalance);

        if (isFullWithdraw) {
            console.log('   Full withdraw - closing Lightning Channel...');
            
            // Fechar canal Lightning
            const closePSBT = await lightningNode.closeChannel(
                pool.channelId,
                destination
            );

            // Marcar pool como fechada
            pool.status = 'closed';
            pool.active = false;

            return {
                type: 'full_withdraw',
                amounts: amounts,
                psbt: closePSBT
            };
        } else {
            // Retirada parcial - canal continua aberto
            pool.tokenA.reserve -= amounts.amountA;
            pool.tokenB.reserve -= amounts.amountB;
            pool.lpTokenSupply -= lpTokens;
            pool.lpHolders.set(address, userBalance - lpTokens);

            console.log('   Partial withdraw - channel remains open');

            return {
                type: 'partial_withdraw',
                amounts: amounts
            };
        }
    }

    /**
     * 📊 GET POOL INFO
     */
    getPool(poolId) {
        return this.pools.get(poolId);
    }

    /**
     * 📊 LIST ALL POOLS
     */
    listPools(filters = {}) {
        let pools = Array.from(this.pools.values());

        // Filter by status
        if (filters.status) {
            pools = pools.filter(p => p.status === filters.status);
        }

        // Filter by creator
        if (filters.creator) {
            pools = pools.filter(p => p.creatorAddress === filters.creator);
        }

        // Sort by TVL
        if (filters.sortBy === 'tvl') {
            pools.sort((a, b) => b.totalValueLocked - a.totalValueLocked);
        }

        return pools;
    }

    /**
     * 📊 GET POOL STATS
     */
    getPoolStats(poolId) {
        const pool = this.pools.get(poolId);
        if (!pool) {
            return null;
        }

        const priceA = pool.tokenB.reserve / pool.tokenA.reserve;
        const priceB = pool.tokenA.reserve / pool.tokenB.reserve;

        // Calcular APR baseado em fees
        const dailyVolume = pool.volume24h;
        const dailyFees = dailyVolume * pool.feeRate;
        const yearlyFees = dailyFees * 365;
        const apr = (yearlyFees / pool.totalValueLocked) * 100;

        return {
            poolId: pool.poolId,
            tvl: pool.totalValueLocked,
            volume24h: pool.volume24h,
            volume7d: pool.volume7d,
            volumeAllTime: pool.volumeAllTime,
            swapCount: pool.swapCount,
            feesAccumulated: pool.feesAccumulated,
            apr: apr,
            priceA: priceA,
            priceB: priceB,
            lpTokenSupply: pool.lpTokenSupply,
            active: pool.active
        };
    }
}

export default new LightningPoolManager();

