/**
 * KRAY SPACE L2 - DeFi API Routes
 */

import express from 'express';
import { createPool, swap, listPools, getPool, getPoolStats, calculatePriceImpact } from '../../defi/ammPool.js';

const router = express.Router();

/**
 * GET /api/defi/pools
 * List all AMM pools
 */
router.get('/pools', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';

    const pools = listPools(activeOnly);

    res.json({
      pools: pools.map(p => ({
        pool_id: p.pool_id,
        token_a: p.token_a,
        token_b: p.token_b,
        reserve_a: p.reserve_a,
        reserve_b: p.reserve_b,
        lp_supply: p.lp_token_supply,
        fee_rate: p.fee_rate / 10000,
        total_volume: p.total_volume,
        total_swaps: p.total_swaps,
        active: p.active === 1
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/defi/pool/create
 * Create new pool
 */
router.post('/pool/create', async (req, res) => {
  try {
    const { creator_account, token_a, token_b, amount_a, amount_b } = req.body;

    if (!creator_account || !token_a || !token_b || !amount_a || !amount_b) {
      return res.status(400).json({ 
        error: 'creator_account, token_a, token_b, amount_a, and amount_b are required' 
      });
    }

    const result = createPool(creator_account, token_a, token_b, amount_a, amount_b);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/defi/swap
 * Execute swap
 */
router.post('/swap', async (req, res) => {
  try {
    const { pool_id, account_id, token_in, amount_in, min_amount_out } = req.body;

    if (!pool_id || !account_id || !token_in || !amount_in) {
      return res.status(400).json({ 
        error: 'pool_id, account_id, token_in, and amount_in are required' 
      });
    }

    const result = swap(pool_id, account_id, token_in, amount_in, min_amount_out || '0');

    res.json({
      ...result,
      message: 'Swap executed instantly on L2!'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/defi/pool/:id
 * Get pool details
 */
router.get('/pool/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pool = getPool(id);

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const stats = getPoolStats(id);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/defi/quote
 * Get swap quote
 */
router.post('/quote', async (req, res) => {
  try {
    const { pool_id, token_in, amount_in } = req.body;

    if (!pool_id || !token_in || !amount_in) {
      return res.status(400).json({ 
        error: 'pool_id, token_in, and amount_in are required' 
      });
    }

    const quote = calculatePriceImpact(pool_id, token_in, amount_in);

    res.json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;




















