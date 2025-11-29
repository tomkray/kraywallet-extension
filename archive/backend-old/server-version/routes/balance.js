/**
 * 💰 Balance API via QuickNode
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

// Cache
const balanceCache = new Map();
const CACHE_TTL = 30000; // 30 segundos

/**
 * GET /api/wallet/:address/balance
 * Get address balance via Mempool.space (com fallback)
 */
router.get('/:address/balance', async (req, res) => {
    try {
        const { address } = req.params;
        
        console.log(`💰 Fetching balance for ${address}...`);
        
        // Check cache
        const cached = balanceCache.get(address);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json({
                success: true,
                balance: cached.data,
                source: 'cache'
            });
        }
        
        // Usar Mempool.space (QuickNode não suporta scantxoutset)
        console.log('   📡 Getting balance via Mempool.space...');
        
        const mempoolResponse = await axios.get(`https://mempool.space/api/address/${address}`, {
            timeout: 8000
        });
        
        const data = mempoolResponse.data;
        
        const balance = {
            confirmed: data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
            unconfirmed: data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
            total: 0
        };
        
        balance.total = balance.confirmed + balance.unconfirmed;
        
        console.log(`   ✅ Balance: ${balance.total} sats (via Mempool.space)`);
        
        // Save cache
        balanceCache.set(address, {
            data: balance,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            balance,
            source: 'mempool.space'
        });
        
    } catch (error) {
        console.error(`❌ Error fetching balance:`, error.message);
        
        // Retornar 0 se erro
        res.json({
            success: true,
            balance: {
                confirmed: 0,
                unconfirmed: 0,
                total: 0
            },
            source: 'error',
            error: error.message
        });
    }
});

export default router;

