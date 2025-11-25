/**
 * ⚡ LIGHTNING NETWORK API ROUTES
 * 
 * Endpoints para operações Lightning Network
 */

import express from 'express';
import lightningPoolManager from '../services/lightningPoolManager.js';
import lightningNode from '../services/lightningNode.js';
import lndConnection from '../services/lndConnection.js';
import hubNode from '../services/hubNode.js';
import lightningChannelManager from '../services/lightningChannelManager.js';
import { db } from '../db/init-supabase.js';

const router = express.Router();

/**
 * ⚡ GET LIGHTNING BALANCE
 * 
 * GET /api/lightning/balance/:address
 */
router.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        console.log(`⚡ Getting Lightning balance for: ${address}`);
        
        // Verificar se LND está conectado
        if (!lndConnection.isConnected) {
            console.log('⚠️  LND not connected, attempting to connect...');
            const connectResult = await lndConnection.connect();
            
            if (!connectResult.success) {
                console.log('❌ LND not available, returning 0 balance');
                return res.json({
                    success: true,
                    balance: 0,
                    channels: {
                        total: 0,
                        active: 0
                    },
                    localBalance: 0,
                    remoteBalance: 0,
                    lndStatus: 'disconnected',
                    message: 'LND not running. Start with: ./start-lnd.sh'
                });
            }
        }
        
        // LND está conectado! Buscar balance REAL
        console.log('✅ LND connected! Fetching real balance...');
        
        // Buscar wallet balance
        const walletBalance = await lndConnection.getWalletBalance();
        console.log('💰 Wallet balance:', walletBalance);
        
        // Buscar channel balance
        const channelBalance = await lndConnection.getChannelBalance();
        console.log('⚡ Channel balance:', channelBalance);
        
        // Listar channels
        const channels = await lndConnection.listChannels();
        console.log('📡 Channels:', channels);
        
        // Contar channels ativos
        const activeChannels = channels.channels.filter(c => c.active).length;
        
        // Retornar dados REAIS do LND!
        res.json({
            success: true,
            balance: channelBalance.local_balance.sat, // Balance nos channels
            walletBalance: walletBalance.confirmed_balance, // Balance on-chain
            channels: {
                total: channels.total,
                active: activeChannels
            },
            localBalance: channelBalance.local_balance.sat,
            remoteBalance: channelBalance.remote_balance.sat,
            lndStatus: 'connected',
            message: 'Lightning Network active!'
        });
        
    } catch (error) {
        console.error('❌ Error getting Lightning balance:', error);
        
        // Se der erro, retornar 0 (LND não disponível)
        res.json({
            success: true,
            balance: 0,
            channels: {
                total: 0,
                active: 0
            },
            localBalance: 0,
            remoteBalance: 0,
            lndStatus: 'error',
            error: error.message
        });
    }
});

/**
 * ⚡ GET LND STATUS
 * 
 * GET /api/lightning/status
 */
router.get('/status', async (req, res) => {
    try {
        console.log('⚡ Checking LND status...');
        
        if (!lndConnection.isConnected) {
            const connectResult = await lndConnection.connect();
            
            if (!connectResult.success) {
                return res.json({
                    success: true,
                    connected: false,
                    message: 'LND not running',
                    hint: 'Start LND with: ./start-lnd.sh'
                });
            }
        }
        
        // LND conectado! Buscar info
        const info = await lndConnection.getInfo();
        
        res.json({
            success: true,
            connected: true,
            lnd: {
                version: info.version,
                identity_pubkey: info.identity_pubkey,
                alias: info.alias,
                num_active_channels: info.num_active_channels,
                num_peers: info.num_peers,
                synced_to_chain: info.synced_to_chain,
                synced_to_graph: info.synced_to_graph,
                block_height: info.block_height
            },
            message: 'LND is running!'
        });
        
    } catch (error) {
        console.error('❌ Error checking LND status:', error);
        
        // Verificar se é erro de wallet não desbloqueada
        const isWalletLocked = error.message.includes('wallet is locked') || 
                               error.message.includes('wallet not created') ||
                               error.message.includes('Wallet is encrypted');
        
        res.json({
            success: true,
            connected: false,
            walletStatus: isWalletLocked ? 'locked_or_initializing' : 'error',
            message: isWalletLocked ? 'LND wallet is initializing or locked. This may take a few minutes...' : 'LND connection error',
            error: error.message
        });
    }
});

/**
 * 🎯 CREATE LIGHTNING POOL
 * 
 * POST /api/lightning/pools/create
 * 
 * Body:
 * {
 *   inscription: { id, inscriptionId, inscriptionNumber, utxo, contentUrl },
 *   runeA: { id, name, symbol },
 *   amountA: number,
 *   isBtcPair: boolean,
 *   runeB?: { id, name, symbol },
 *   amountB: number,
 *   feeRate: number (0.003 = 0.3%),
 *   creatorAddress: string
 * }
 */
router.post('/pools/create', async (req, res) => {
    try {
        console.log('⚡ API: Create Lightning Pool');
        
        const {
            inscription,
            runeA,
            amountA,
            isBtcPair,
            runeB,
            amountB,
            feeRate,
            creatorAddress
        } = req.body;

        // Validações
        if (!inscription || !inscription.inscriptionId) {
            return res.status(400).json({
                success: false,
                error: 'Inscription required'
            });
        }

        if (!runeA || !amountA || amountA <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token A parameters'
            });
        }

        if (!isBtcPair && (!runeB || !amountB || amountB <= 0)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token B parameters'
            });
        }

        if (isBtcPair && (!amountB || amountB < 10000)) {
            return res.status(400).json({
                success: false,
                error: 'Minimum 10,000 sats required for BTC pair'
            });
        }

        if (!creatorAddress) {
            return res.status(400).json({
                success: false,
                error: 'Creator address required'
            });
        }

        // Criar pool
        const pool = await lightningPoolManager.createPool({
            inscription,
            runeA,
            amountA,
            isBtcPair,
            runeB,
            amountB,
            feeRate: feeRate || 0.003,
            creatorAddress
        });

        res.json({
            success: true,
            pool: {
                poolId: pool.poolId,
                channelId: pool.channelId,
                shortChannelId: pool.shortChannelId,
                inscriptionNumber: pool.inscriptionNumber,
                lightningNodeId: pool.lightningNodeId,
                tokenA: pool.tokenA,
                tokenB: pool.tokenB,
                tvl: pool.totalValueLocked,
                feeRate: pool.feeRate,
                lpTokenSupply: pool.lpTokenSupply,
                status: pool.status,
                createdAt: pool.createdAt
            },
            message: 'Lightning Pool created! Channel will be active after on-chain confirmation.'
        });

    } catch (error) {
        console.error('❌ Error creating Lightning Pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ⚡ EXECUTE SWAP
 * 
 * POST /api/lightning/swap
 * 
 * Body:
 * {
 *   poolId: string,
 *   tokenIn: string,
 *   amountIn: number,
 *   minAmountOut?: number,
 *   slippageTolerance?: number (default 1.0%)
 * }
 */
router.post('/swap', async (req, res) => {
    try {
        console.log('⚡ API: Execute Lightning Swap');
        
        const {
            poolId,
            tokenIn,
            amountIn,
            minAmountOut,
            slippageTolerance
        } = req.body;

        // Validações
        if (!poolId || !tokenIn || !amountIn || amountIn <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid swap parameters'
            });
        }

        // Executar swap
        const result = await lightningPoolManager.executeSwap(poolId, {
            tokenIn,
            amountIn,
            minAmountOut,
            slippageTolerance: slippageTolerance || 1.0
        });

        res.json({
            success: true,
            invoice: {
                paymentRequest: result.invoice.paymentRequest,
                paymentHash: result.invoice.paymentHash,
                amount: result.invoice.value,
                expiry: result.invoice.expiry,
                memo: result.invoice.memo
            },
            swapDetails: {
                amountIn: amountIn,
                tokenIn: tokenIn,
                amountOut: result.swapDetails.amountOut,
                tokenOut: result.invoice.tokenOut,
                fee: result.swapDetails.fee,
                priceImpact: result.swapDetails.priceImpact,
                executionPrice: result.swapDetails.executionPrice
            },
            message: 'Pay the Lightning invoice to complete the swap'
        });

    } catch (error) {
        console.error('❌ Error executing swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💰 ADD LIQUIDITY
 * 
 * POST /api/lightning/pools/:poolId/add-liquidity
 */
router.post('/pools/:poolId/add-liquidity', async (req, res) => {
    try {
        console.log('⚡ API: Add Liquidity');
        
        const { poolId } = req.params;
        const { amountA, amountB, address } = req.body;

        if (!amountA || !amountB || !address) {
            return res.status(400).json({
                success: false,
                error: 'Invalid parameters'
            });
        }

        const result = await lightningPoolManager.addLiquidity(poolId, {
            amountA,
            amountB,
            address
        });

        res.json({
            success: true,
            lpTokens: result.lpTokensReceived,
            shareOfPool: result.shareOfPool,
            message: `You received ${result.lpTokensReceived.toFixed(2)} LP tokens`
        });

    } catch (error) {
        console.error('❌ Error adding liquidity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💸 REMOVE LIQUIDITY
 * 
 * POST /api/lightning/pools/:poolId/remove-liquidity
 */
router.post('/pools/:poolId/remove-liquidity', async (req, res) => {
    try {
        console.log('⚡ API: Remove Liquidity');
        
        const { poolId } = req.params;
        const { lpTokens, address, destination } = req.body;

        if (!lpTokens || !address || !destination) {
            return res.status(400).json({
                success: false,
                error: 'Invalid parameters'
            });
        }

        const result = await lightningPoolManager.removeLiquidity(poolId, {
            lpTokens,
            address,
            destination
        });

        if (result.type === 'full_withdraw') {
            res.json({
                success: true,
                type: 'full_withdraw',
                amounts: result.amounts,
                psbt: result.psbt,
                message: 'Lightning Channel closed. Sign the PSBT to complete withdrawal.'
            });
        } else {
            res.json({
                success: true,
                type: 'partial_withdraw',
                amounts: result.amounts,
                message: 'Liquidity removed. Channel remains open.'
            });
        }

    } catch (error) {
        console.error('❌ Error removing liquidity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 GET POOL INFO
 * 
 * GET /api/lightning/pools/:poolId
 */
router.get('/pools/:poolId', async (req, res) => {
    try {
        const { poolId } = req.params;
        
        const pool = lightningPoolManager.getPool(poolId);
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }

        const stats = lightningPoolManager.getPoolStats(poolId);

        res.json({
            success: true,
            pool: {
                ...pool,
                stats: stats
            }
        });

    } catch (error) {
        console.error('❌ Error getting pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 LIST POOLS
 * 
 * GET /api/lightning/pools
 */
router.get('/pools', async (req, res) => {
    try {
        const { status, creator, sortBy } = req.query;
        
        const pools = lightningPoolManager.listPools({
            status,
            creator,
            sortBy
        });

        // Add stats to each pool
        const poolsWithStats = pools.map(pool => ({
            ...pool,
            stats: lightningPoolManager.getPoolStats(pool.poolId)
        }));

        res.json({
            success: true,
            pools: poolsWithStats,
            count: poolsWithStats.length
        });

    } catch (error) {
        console.error('❌ Error listing pools:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ⚡ GET LIGHTNING NODE INFO
 * 
 * GET /api/lightning/nodes/:inscriptionId
 */
router.get('/nodes/:inscriptionId', async (req, res) => {
    try {
        const { inscriptionId } = req.params;
        
        const node = lightningNode.getNode(inscriptionId);
        if (!node) {
            return res.status(404).json({
                success: false,
                error: 'Node not found'
            });
        }

        res.json({
            success: true,
            node: node
        });

    } catch (error) {
        console.error('❌ Error getting node:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 GET QUOTE FOR SWAP
 * 
 * POST /api/lightning/quote
 */
router.post('/quote', async (req, res) => {
    try {
        const { poolId, tokenIn, amountIn } = req.body;

        if (!poolId || !tokenIn || !amountIn) {
            return res.status(400).json({
                success: false,
                error: 'Invalid parameters'
            });
        }

        const pool = lightningPoolManager.getPool(poolId);
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }

        // Determinar direção
        const isTokenAtoB = tokenIn === pool.tokenA.id;
        const reserveIn = isTokenAtoB ? pool.tokenA.reserve : pool.tokenB.reserve;
        const reserveOut = isTokenAtoB ? pool.tokenB.reserve : pool.tokenA.reserve;
        const tokenOut = isTokenAtoB ? pool.tokenB.id : pool.tokenA.id;

        // Calcular (sem executar)
        const ammCalculator = require('../utils/ammCalculator');
        const result = ammCalculator.calculateSwapOutput(
            amountIn,
            reserveIn,
            reserveOut,
            pool.feeRate
        );

        res.json({
            success: true,
            quote: {
                amountIn: amountIn,
                tokenIn: tokenIn,
                amountOut: result.amountOut,
                tokenOut: tokenOut,
                fee: result.fee,
                priceImpact: result.priceImpact,
                executionPrice: result.executionPrice,
                minimumReceived: result.amountOut * 0.99, // 1% slippage
                lightningFee: 1 // 1 sat Lightning network fee
            }
        });

    } catch (error) {
        console.error('❌ Error getting quote:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ⚡ OPEN LIGHTNING CHANNEL
 * 
 * POST /api/lightning/open-channel
 * 
 * Body:
 * {
 *   capacity: number (sats),
 *   fromAddress: string,
 *   assetType: 'btc' | 'rune',
 *   rune?: { id, name, amount }
 * }
 */
router.post('/open-channel', async (req, res) => {
    try {
        const { capacity, fromAddress, assetType, rune } = req.body;
        
        console.log('⚡ ========== OPEN LIGHTNING CHANNEL ==========');
        console.log(`   Capacity: ${capacity} sats`);
        console.log(`   From: ${fromAddress}`);
        console.log(`   Asset Type: ${assetType}`);
        if (rune) console.log(`   Rune: ${rune.name} (${rune.id})`);
        
        // Validações
        if (!capacity || capacity < 20000) {
            return res.status(400).json({
                success: false,
                error: 'Minimum channel capacity is 20,000 sats'
            });
        }
        
        if (!fromAddress) {
            return res.status(400).json({
                success: false,
                error: 'fromAddress is required'
            });
        }
        
        // Verificar se LND está conectado e sincronizado
        if (!lndConnection.isConnected) {
            await lndConnection.connect();
        }
        
        const info = await lndConnection.getInfo();
        
        if (!info.synced_to_chain) {
            return res.status(503).json({
                success: false,
                error: `LND is syncing. Currently at block ${info.block_height}. Please wait ~15-30 minutes.`
            });
        }
        
        // TODO: Implementar lógica completa de abertura de channel
        // Por enquanto, retorna um exemplo de resposta
        console.log('🚧 Channel opening logic not fully implemented yet');
        console.log('📡 Would create:');
        console.log(`   1. Funding transaction with ${capacity} sats`);
        console.log(`   2. ${assetType === 'rune' ? 'Runestone with Pointer' : 'Pure BTC output'}`);
        console.log(`   3. 2-of-2 multisig with remote node`);
        console.log(`   4. Broadcast and wait 3 confirmations`);
        
        res.status(503).json({
            success: false,
            error: 'Channel opening feature is being implemented. LND is ready, but the full channel creation flow needs to be completed.'
        });
        
    } catch (error) {
        console.error('❌ Error opening channel:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ⚡ INIT LIGHTNING WALLET (for unlock)
 * 
 * POST /api/lightning/init-wallet
 * 
 * Body: { mnemonic, password }
 */
router.post('/init-wallet', async (req, res) => {
    try {
        const { mnemonic, password } = req.body;
        
        console.log('⚡ ========== INIT LIGHTNING WALLET ==========');
        console.log('   Triggered by wallet unlock');
        
        if (!mnemonic || !password) {
            return res.status(400).json({
                success: false,
                error: 'Mnemonic and password are required'
            });
        }
        
        // Inicializar LND wallet com a mesma seed
        console.log('⚡ Initializing LND with wallet seed...');
        const result = await lndConnection.initWalletWithSeed(mnemonic, password);
        
        if (result.success) {
            console.log('✅ Lightning wallet initialized successfully!');
            return res.json({
                success: true,
                message: 'Lightning wallet initialized',
                address: result.address
            });
        } else {
            console.warn('⚠️  Lightning initialization in progress...');
            return res.json({
                success: false,
                message: 'Lightning initialization in progress (background)',
                inProgress: true
            });
        }
        
    } catch (error) {
        console.error('❌ Error initializing Lightning wallet:', error);
        
        // Não retornar erro fatal, Lightning pode estar sendo inicializado em background
        return res.json({
            success: false,
            message: 'Lightning initialization in progress',
            inProgress: true
        });
    }
});

/**
 * 🌟 GET HUB INFO
 * 
 * GET /api/hub/info
 */
router.get('/hub/info', async (req, res) => {
    try {
        console.log('📡 Getting Hub info...');
        
        // Inicializar Hub se necessário
        if (!hubNode.isInitialized) {
            await hubNode.initialize();
        }
        
        const info = hubNode.getPublicInfo();
        
        res.json(info);
        
    } catch (error) {
        console.error('❌ Error getting Hub info:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🏊 LIST HUB POOLS
 * 
 * GET /api/hub/pools
 */
router.get('/hub/pools', async (req, res) => {
    try {
        console.log('🏊 Listing Hub pools...');
        
        if (!hubNode.isInitialized) {
            await hubNode.initialize();
        }
        
        const pools = hubNode.listPools();
        
        res.json({
            success: true,
            pools
        });
        
    } catch (error) {
        console.error('❌ Error listing pools:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 GET POOL STATS
 * 
 * GET /api/hub/pools/:poolId
 */
router.get('/hub/pools/:poolId', async (req, res) => {
    try {
        const { poolId } = req.params;
        
        console.log(`📊 Getting pool stats for: ${poolId}`);
        
        if (!hubNode.isInitialized) {
            await hubNode.initialize();
        }
        
        const stats = hubNode.getPoolStats(poolId);
        
        res.json({
            success: true,
            pool: stats
        });
        
    } catch (error) {
        console.error('❌ Error getting pool stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💱 GET SWAP QUOTE
 * 
 * POST /api/hub/quote
 * 
 * Body: {
 *   poolId: string,
 *   amountIn: number,
 *   isTokenAToB: boolean
 * }
 */
router.post('/hub/quote', async (req, res) => {
    try {
        const { poolId, amountIn, isTokenAToB = true } = req.body;
        
        console.log('💱 Getting swap quote...');
        console.log(`   Pool: ${poolId}`);
        console.log(`   Amount In: ${amountIn}`);
        console.log(`   Direction: ${isTokenAToB ? 'A→B' : 'B→A'}`);
        
        if (!poolId || !amountIn) {
            return res.status(400).json({
                success: false,
                error: 'poolId and amountIn are required'
            });
        }
        
        if (!hubNode.isInitialized) {
            await hubNode.initialize();
        }
        
        const quote = hubNode.getSwapQuote(poolId, amountIn, isTokenAToB);
        
        res.json({
            success: true,
            quote
        });
        
    } catch (error) {
        console.error('❌ Error getting quote:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💱 EXECUTE SWAP
 * 
 * POST /api/hub/swap
 * 
 * Body: {
 *   userPubkey: string,
 *   channelId: string,
 *   poolId: string,
 *   amountIn: number,
 *   minAmountOut: number,
 *   isTokenAToB: boolean
 * }
 */
router.post('/hub/swap', async (req, res) => {
    try {
        const {
            userPubkey,
            channelId,
            poolId,
            amountIn,
            minAmountOut,
            isTokenAToB = true
        } = req.body;
        
        console.log('💱 ========== EXECUTING SWAP ==========');
        console.log(`   User: ${userPubkey}`);
        console.log(`   Channel: ${channelId}`);
        console.log(`   Pool: ${poolId}`);
        console.log(`   Amount In: ${amountIn}`);
        console.log(`   Min Amount Out: ${minAmountOut}`);
        
        // Validações
        if (!userPubkey || !channelId || !poolId || !amountIn || !minAmountOut) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        if (!hubNode.isInitialized) {
            await hubNode.initialize();
        }
        
        // Executar swap
        const result = await hubNode.executeSwap({
            userPubkey,
            channelId,
            poolId,
            amountIn,
            minAmountOut,
            isTokenAToB
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error executing swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🔗 OPEN CHANNEL WITH HUB
 * 
 * POST /api/hub/open-channel
 * 
 * Body: {
 *   userAddress: string,
 *   capacity: number,
 *   assetType: 'btc' | 'rune',
 *   runeId?: string
 * }
 */
router.post('/hub/open-channel', async (req, res) => {
    try {
        const {
            userAddress,
            capacity,
            assetType,
            runeId
        } = req.body;
        
        console.log('🔗 ========== OPENING CHANNEL WITH HUB ==========');
        console.log(`   User Address: ${userAddress}`);
        console.log(`   Capacity: ${capacity} sats`);
        console.log(`   Asset Type: ${assetType}`);
        if (runeId) console.log(`   Rune ID: ${runeId}`);
        
        // Validações
        if (!userAddress || !capacity || !assetType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        if (capacity < 20000) {
            return res.status(400).json({
                success: false,
                error: 'Minimum capacity: 20,000 sats'
            });
        }
        
        if (assetType === 'inscription') {
            return res.status(403).json({
                success: false,
                error: '❌ BLOQUEADO! Inscriptions não podem ir para Lightning!'
            });
        }
        
        // Inicializar Hub se necessário
        if (!hubNode.isInitialized) {
            await hubNode.initialize();
        }
        
        // Obter pubkey do Hub
        const hubPubkey = hubNode.pubkey;
        
        if (!hubPubkey) {
            throw new Error('Hub pubkey not available');
        }
        
        // Abrir channel
        const result = await lightningChannelManager.openChannel({
            userAddress,
            remotePubkey: hubPubkey,
            capacity,
            assetType,
            runeId
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error opening channel:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 GET USER CHANNELS
 * 
 * GET /api/hub/channels/:userAddress
 */
router.get('/hub/channels/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;
        
        console.log(`📊 Getting channels for user: ${userAddress}`);
        
        const channels = await lightningChannelManager.getUserChannels(userAddress);
        
        res.json({
            success: true,
            channels
        });
        
    } catch (error) {
        console.error('❌ Error getting user channels:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ⚡ PAY LIGHTNING INVOICE
 * 
 * POST /api/lightning/pay
 * 
 * Body: { invoice }
 */
router.post('/pay', async (req, res) => {
    console.log('\n⚡ ===== LIGHTNING PAYMENT REQUEST =====');
    
    try {
        const { invoice } = req.body;
        
        if (!invoice) {
            return res.status(400).json({
                success: false,
                error: 'Invoice is required'
            });
        }
        
        console.log('  Invoice:', invoice.substring(0, 50) + '...');
        
        // Decode invoice (usando bolt11 library ou LND)
        let decoded;
        try {
            // Tentar decodificar localmente primeiro
            const bolt11 = await import('bolt11');
            decoded = bolt11.decode(invoice);
            console.log('✅ Invoice decoded:');
            console.log('   Amount:', decoded.satoshis || decoded.millisatoshis / 1000, 'sats');
            console.log('   Payment Hash:', decoded.tagsObject?.payment_hash);
            console.log('   Description:', decoded.tagsObject?.description || decoded.tagsObject?.purpose);
        } catch (decodeError) {
            console.warn('⚠️  bolt11 decode failed, will try via LND:', decodeError.message);
            // Se falhar, continuar e deixar LND decodificar
        }
        
        // Verificar se LND está conectado
        if (!lndConnection.isConnected) {
            console.log('⚠️  LND not connected, attempting to connect...');
            const connectResult = await lndConnection.connect();
            
            if (!connectResult.success) {
                return res.status(503).json({
                    success: false,
                    error: 'LND not available. Please start LND with: ./start-lnd.sh'
                });
            }
        }
        
        // Pagar via LND
        console.log('💰 Sending payment via LND...');
        
        const paymentResponse = await lndConnection.sendPaymentSync({
            payment_request: invoice,
            timeout_seconds: 60,
            allow_self_payment: true  // Permitir self-payment para testes
        });
        
        console.log('  LND Response:', {
            payment_error: paymentResponse.payment_error,
            payment_preimage: paymentResponse.payment_preimage?.toString('hex')?.substring(0, 16) + '...',
            payment_hash: paymentResponse.payment_hash?.toString('hex')?.substring(0, 16) + '...'
        });
        
        // Verificar se pagamento foi bem-sucedido
        if (paymentResponse.payment_error) {
            console.error('❌ Payment failed:', paymentResponse.payment_error);
            return res.status(400).json({
                success: false,
                error: paymentResponse.payment_error
            });
        }
        
        if (!paymentResponse.payment_preimage) {
            console.error('❌ Payment failed: No preimage returned');
            return res.status(400).json({
                success: false,
                error: 'Payment failed: No preimage returned'
            });
        }
        
        // Extrair dados do pagamento
        const preimage = paymentResponse.payment_preimage.toString('hex');
        const paymentHash = paymentResponse.payment_hash.toString('hex');
        const amountSats = decoded?.satoshis || 
                          decoded?.millisatoshis / 1000 || 
                          paymentResponse.payment_route?.total_amt || 
                          0;
        
        console.log('✅ Payment successful!');
        console.log('   Preimage:', preimage);
        console.log('   Payment Hash:', paymentHash);
        console.log('   Amount:', amountSats, 'sats');
        
        res.json({
            success: true,
            preimage,
            paymentHash,
            amountSats,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Error processing Lightning payment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process Lightning payment'
        });
    }
});

/**
 * 🔍 DECODE LIGHTNING INVOICE
 * 
 * POST /api/lightning/decode
 * 
 * Body: { invoice }
 */
router.post('/decode', async (req, res) => {
    try {
        const { invoice } = req.body;
        
        if (!invoice) {
            return res.status(400).json({
                success: false,
                error: 'Invoice is required'
            });
        }
        
        console.log('🔍 Decoding invoice:', invoice.substring(0, 50) + '...');
        
        // Tentar decodificar com bolt11
        try {
            const bolt11 = await import('bolt11');
            const decoded = bolt11.decode(invoice);
            
            const result = {
                success: true,
                amount: decoded.satoshis || decoded.millisatoshis / 1000,
                paymentHash: decoded.tagsObject?.payment_hash,
                description: decoded.tagsObject?.description || decoded.tagsObject?.purpose,
                expiry: decoded.timeExpireDate,
                destination: decoded.payeeNodeKey,
                timestamp: decoded.timestamp
            };
            
            console.log('✅ Invoice decoded:', result);
            
            res.json(result);
            
        } catch (decodeError) {
            console.error('❌ Failed to decode invoice:', decodeError);
            res.status(400).json({
                success: false,
                error: 'Invalid Lightning invoice'
            });
        }
        
    } catch (error) {
        console.error('❌ Error decoding invoice:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ⚡ GET LND INFO
 * 
 * GET /api/lightning/info
 * Retorna informações do nó Lightning
 */
router.get('/info', async (req, res) => {
    try {
        console.log('⚡ Getting LND info...');
        
        // Verificar se LND está conectado
        if (!lndConnection.isConnected) {
            console.log('⚠️  LND not connected, attempting to connect...');
            const connectResult = await lndConnection.connect();
            
            if (!connectResult.success) {
                return res.status(503).json({
                    success: false,
                    error: 'LND not available',
                    message: 'LND not running. Start with: ./start-lnd.sh'
                });
            }
        }
        
        // Buscar info do LND
        const info = await lndConnection.getInfo();
        console.log('✅ LND Info:', info);
        
        res.json({
            success: true,
            ...info
        });
        
    } catch (error) {
        console.error('❌ Error getting LND info:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

