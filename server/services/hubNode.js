/**
 * 🌟 KRAY STATION HUB NODE
 * 
 * Node Lightning central que:
 * - Mantém liquidez de todas as pools AMM
 * - Aceita channels de múltiplos usuários
 * - Processa swaps instantâneos (< 1 segundo)
 * - Cobra fees customizáveis por pool
 */

import lndConnection from './lndConnection.js';
import utxoManager from './utxoManager.js';
import { getDatabase } from '../db/init-supabase.js';
import * as ammCalculator from '../utils/ammCalculator.js';

class KraySpaceHub {
    constructor() {
        this.pubkey = null;           // Pubkey Lightning do Hub
        this.lnd = null;              // Conexão LND
        this.pools = new Map();       // AMM Pools (Map<poolId, pool>)
        this.channels = new Map();    // User channels (Map<channelId, channel>)
        this.isInitialized = false;
    }

    /**
     * 🚀 INICIALIZAR HUB
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️  Hub already initialized');
            return;
        }

        console.log('🚀 ========== INITIALIZING KRAY STATION HUB ==========');
        
        try {
            // 1. Conectar ao LND
            this.lnd = lndConnection;
            
            // Verificar se LND está conectado
            if (!this.lnd.isConnected) {
                console.log('⏳ Waiting for LND connection...');
                await this.lnd.connect();
            }
            
            // 2. Obter pubkey do Hub
            const info = await this.lnd.getInfo();
            this.pubkey = info.identity_pubkey;
            
            console.log(`✅ Hub Pubkey: ${this.pubkey}`);
            console.log(`   Alias: ${info.alias || 'Kray Space Hub'}`);
            console.log(`   Block Height: ${info.block_height}`);
            console.log(`   Synced: ${info.synced_to_chain}`);
            
            // 3. Carregar pools existentes
            await this.loadPools();
            
            // 4. Carregar channels ativos
            await this.loadChannels();
            
            this.isInitialized = true;
            console.log('✅ ========== HUB INITIALIZED! ==========');
            
        } catch (error) {
            console.error('❌ Failed to initialize Hub:', error.message);
            throw error;
        }
    }

    /**
     * 🏊 CARREGAR POOLS AMM DO DATABASE
     */
    async loadPools() {
        console.log('🏊 Loading AMM pools...');
        
        try {
            const db = getDatabase();
            const poolsFromDB = await db.all(`
                SELECT * FROM lightning_pools WHERE status = 'active'
            `);
            
            for (const pool of poolsFromDB) {
                this.pools.set(pool.id, {
                    id: pool.id,
                    name: pool.name,
                    tokenA: pool.token_a,     // Ex: "840000:3" (DOG rune ID)
                    tokenB: pool.token_b,     // Ex: null (BTC)
                    reserveA: pool.reserve_a, // Quantidade de token A no Hub
                    reserveB: pool.reserve_b, // Quantidade de token B no Hub
                    feePercent: pool.fee_percent, // Ex: 0.3
                    volume24h: pool.volume_24h || 0,
                    swapCount: pool.swap_count || 0,
                    createdAt: pool.created_at
                });
            }
            
            console.log(`✅ Loaded ${this.pools.size} pools`);
            
        } catch (error) {
            console.error('❌ Error loading pools:', error.message);
            // Continuar mesmo se não houver pools
        }
    }

    /**
     * 🔗 CARREGAR CHANNELS ATIVOS
     */
    async loadChannels() {
        console.log('🔗 Loading active channels...');
        
        try {
            const db = getDatabase();
            const channelsFromDB = await db.all(`
                SELECT * FROM hub_channels WHERE status = 'active'
            `);
            
            for (const channel of channelsFromDB) {
                this.channels.set(channel.channel_id, {
                    channelId: channel.channel_id,
                    userPubkey: channel.user_pubkey,
                    userAddress: channel.user_address,
                    capacity: channel.capacity,
                    assetType: channel.asset_type,
                    assetId: channel.asset_id,
                    status: channel.status
                });
            }
            
            console.log(`✅ Loaded ${this.channels.size} active channels`);
            
        } catch (error) {
            console.error('❌ Error loading channels:', error.message);
        }
    }

    /**
     * 📡 OBTER INFORMAÇÕES PÚBLICAS DO HUB
     */
    getPublicInfo() {
        if (!this.isInitialized) {
            return {
                status: 'initializing',
                message: 'Hub is starting up...'
            };
        }

        return {
            status: 'active',
            pubkey: this.pubkey,
            alias: 'Kray Station AMM Hub',
            channels: this.channels.size,
            pools: Array.from(this.pools.values()).map(p => ({
                id: p.id,
                name: p.name,
                pair: `${p.tokenA}/${p.tokenB || 'BTC'}`,
                fee: `${p.feePercent}%`,
                tvl: this.calculateTVL(p),
                volume24h: p.volume24h,
                swapCount: p.swapCount
            })),
            features: [
                'Instant swaps (< 1 second)',
                'Runes support (revolutionary!)',
                'Custom pool fees',
                'On-chain settlement',
                'Lightning base fee: 1 sat'
            ]
        };
    }

    /**
     * 📊 CALCULAR TVL DA POOL (em sats)
     */
    calculateTVL(pool) {
        // Para simplificar, retornar reserve B (BTC)
        // No futuro: converter Runes para valor em BTC
        return pool.reserveB;
    }

    /**
     * 🏊 CRIAR NOVA POOL
     */
    async createPool(tokenA, tokenB, feePercent = 0.3) {
        console.log(`🏊 Creating new pool: ${tokenA}/${tokenB || 'BTC'}`);
        
        const poolId = `${tokenA}_${tokenB || 'BTC'}`;
        
        // Verificar se pool já existe
        if (this.pools.has(poolId)) {
            throw new Error('Pool already exists');
        }
        
        const pool = {
            id: poolId,
            name: `${tokenA}/${tokenB || 'BTC'}`,
            tokenA,
            tokenB,
            reserveA: 0,
            reserveB: 0,
            feePercent,
            volume24h: 0,
            swapCount: 0,
            createdAt: Date.now()
        };
        
        // Salvar no DB
        const db = getDatabase();
        await db.run(`
            INSERT INTO lightning_pools
            (id, name, token_a, token_b, reserve_a, reserve_b, fee_percent, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        `, [
            pool.id,
            pool.name,
            pool.tokenA,
            pool.tokenB,
            pool.reserveA,
            pool.reserveB,
            pool.feePercent,
            pool.createdAt,
            pool.createdAt
        ]);
        
        this.pools.set(poolId, pool);
        
        console.log('✅ Pool created!');
        return pool;
    }

    /**
     * 💰 ADICIONAR LIQUIDEZ À POOL
     */
    async addLiquidityToPool(poolId, amountA, amountB) {
        console.log(`💰 Adding liquidity to pool ${poolId}`);
        console.log(`   Amount A: ${amountA}`);
        console.log(`   Amount B: ${amountB}`);
        
        const pool = this.pools.get(poolId);
        if (!pool) {
            throw new Error('Pool not found');
        }
        
        // Atualizar reserves
        pool.reserveA += amountA;
        pool.reserveB += amountB;
        
        // Salvar no DB
        await this.updatePoolReserves(pool);
        
        console.log('✅ Liquidity added!');
        console.log(`   New reserves: ${pool.reserveA} / ${pool.reserveB}`);
        
        return pool;
    }

    /**
     * 💱 OBTER QUOTE DE SWAP
     */
    getSwapQuote(poolId, amountIn, isTokenAToB = true) {
        console.log(`💱 Getting swap quote for pool ${poolId}`);
        console.log(`   Amount in: ${amountIn}`);
        console.log(`   Direction: ${isTokenAToB ? 'A→B' : 'B→A'}`);
        
        const pool = this.pools.get(poolId);
        if (!pool) {
            throw new Error('Pool not found');
        }
        
        // Validar reserves
        if (pool.reserveA === 0 || pool.reserveB === 0) {
            throw new Error('Pool has no liquidity');
        }
        
        // Calcular output usando AMM (x * y = k)
        const reserveIn = isTokenAToB ? pool.reserveA : pool.reserveB;
        const reserveOut = isTokenAToB ? pool.reserveB : pool.reserveA;
        
        const feeMultiplier = 1 - (pool.feePercent / 100);
        const amountInWithFee = Math.floor(amountIn * feeMultiplier);
        
        const amountOut = Math.floor(
            (reserveOut * amountInWithFee) / 
            (reserveIn + amountInWithFee)
        );
        
        const poolFee = amountIn - amountInWithFee;
        const priceImpact = ((amountIn / reserveIn) * 100).toFixed(2);
        
        console.log(`   Amount out: ${amountOut}`);
        console.log(`   Pool fee: ${poolFee}`);
        console.log(`   Price impact: ${priceImpact}%`);
        
        return {
            amountOut,
            poolFee,
            lightningFee: 1, // 1 sat fixo
            totalFee: poolFee + 1,
            priceImpact: parseFloat(priceImpact),
            expiresAt: Date.now() + 60000 // 1 minuto
        };
    }

    /**
     * 💱 EXECUTAR SWAP
     */
    async executeSwap({
        userPubkey,
        channelId,
        poolId,
        amountIn,
        minAmountOut,
        isTokenAToB = true
    }) {
        console.log('💱 ========== EXECUTING SWAP ==========');
        console.log(`   User: ${userPubkey}`);
        console.log(`   Channel: ${channelId}`);
        console.log(`   Pool: ${poolId}`);
        console.log(`   Amount in: ${amountIn}`);
        console.log(`   Min amount out: ${minAmountOut}`);
        
        // 1. Obter quote
        const quote = this.getSwapQuote(poolId, amountIn, isTokenAToB);
        
        // 2. Validar slippage
        if (quote.amountOut < minAmountOut) {
            throw new Error(`Slippage too high. Expected min ${minAmountOut}, got ${quote.amountOut}`);
        }
        
        // 3. Validar channel
        const channel = this.channels.get(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }
        
        if (channel.userPubkey !== userPubkey) {
            throw new Error('Channel does not belong to user');
        }
        
        // 4. Executar swap via Lightning
        // (PLACEHOLDER - implementação completa requer lógica de HTLCs)
        const paymentHash = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`⚡ Simulating Lightning payment...`);
        console.log(`   Payment hash: ${paymentHash}`);
        
        // 5. Atualizar reserves da pool
        const pool = this.pools.get(poolId);
        
        if (isTokenAToB) {
            pool.reserveA += amountIn;
            pool.reserveB -= quote.amountOut;
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= quote.amountOut;
        }
        
        pool.volume24h += amountIn;
        pool.swapCount += 1;
        
        // 6. Salvar no DB
        await this.updatePoolReserves(pool);
        await this.recordSwap({
            poolId,
            userPubkey,
            channelId,
            fromAsset: isTokenAToB ? pool.tokenA : (pool.tokenB || 'BTC'),
            toAsset: isTokenAToB ? (pool.tokenB || 'BTC') : pool.tokenA,
            amountIn,
            amountOut: quote.amountOut,
            poolFee: quote.poolFee,
            lightningFee: quote.lightningFee,
            priceImpact: quote.priceImpact,
            paymentHash,
            timestamp: Date.now()
        });
        
        console.log('✅ Swap completed!');
        console.log(`   Amount out: ${quote.amountOut}`);
        console.log(`   Total fee: ${quote.totalFee}`);
        
        return {
            success: true,
            amountOut: quote.amountOut,
            fee: quote.totalFee,
            paymentHash
        };
    }

    /**
     * 💾 ATUALIZAR RESERVES DA POOL NO DB
     */
    async updatePoolReserves(pool) {
        const db = getDatabase();
        await db.run(`
            UPDATE lightning_pools
            SET reserve_a = ?, reserve_b = ?, volume_24h = ?, swap_count = ?, updated_at = ?
            WHERE id = ?
        `, [
            pool.reserveA,
            pool.reserveB,
            pool.volume24h,
            pool.swapCount,
            Date.now(),
            pool.id
        ]);
    }

    /**
     * 📝 REGISTRAR SWAP NO DB
     */
    async recordSwap(swap) {
        const db = getDatabase();
        await db.run(`
            INSERT INTO hub_swaps
            (pool_id, user_pubkey, channel_id, from_asset, to_asset, 
             amount_in, amount_out, pool_fee, lightning_fee, price_impact, payment_hash, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            swap.poolId,
            swap.userPubkey,
            swap.channelId,
            swap.fromAsset,
            swap.toAsset,
            swap.amountIn,
            swap.amountOut,
            swap.poolFee,
            swap.lightningFee,
            swap.priceImpact,
            swap.paymentHash,
            swap.timestamp
        ]);
    }

    /**
     * 📊 OBTER ESTATÍSTICAS DA POOL
     */
    getPoolStats(poolId) {
        const pool = this.pools.get(poolId);
        if (!pool) {
            throw new Error('Pool not found');
        }

        return {
            id: pool.id,
            name: pool.name,
            pair: `${pool.tokenA}/${pool.tokenB || 'BTC'}`,
            reserveA: pool.reserveA,
            reserveB: pool.reserveB,
            tvl: this.calculateTVL(pool),
            volume24h: pool.volume24h,
            swapCount: pool.swapCount,
            feePercent: pool.feePercent,
            createdAt: pool.createdAt
        };
    }

    /**
     * 📋 LISTAR TODAS AS POOLS
     */
    listPools() {
        return Array.from(this.pools.values()).map(pool => this.getPoolStats(pool.id));
    }
}

export default new KraySpaceHub();

