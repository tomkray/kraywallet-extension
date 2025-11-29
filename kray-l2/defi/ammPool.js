/**
 * KRAY SPACE L2 - AMM Pool
 * 
 * Automated Market Maker for instant swaps on L2
 * Based on constant product formula (x * y = k)
 */

import { getDatabase, transaction } from '../core/database.js';
import { getAccount, updateBalance } from '../state/accountManager.js';
import { executeTransaction } from '../state/transactionExecutor.js';
import crypto from 'crypto';

/**
 * Create new AMM pool
 */
export function createPool(creatorAccount, tokenA, tokenB, amountA, amountB) {
  return transaction(() => {
    const db = getDatabase();

    console.log('\n🏊 Creating AMM pool...');
    console.log(`   Creator: ${creatorAccount}`);
    console.log(`   Pair: ${tokenA}/${tokenB}`);
    console.log(`   Amount A: ${amountA}`);
    console.log(`   Amount B: ${amountB}`);

    // Validate inputs
    const account = getAccount(creatorAccount);

    if (!account) {
      throw new Error('Creator account not found');
    }

    const amountABigInt = BigInt(amountA);
    const amountBBigInt = BigInt(amountB);

    if (amountABigInt <= 0n || amountBBigInt <= 0n) {
      throw new Error('Pool amounts must be positive');
    }

    // For KRAY pools, check balance
    if (tokenA === 'KRAY') {
      const balance = BigInt(account.balance_credits);
      if (balance < amountABigInt) {
        throw new Error(`Insufficient KRAY balance: ${balance} < ${amountABigInt}`);
      }
    }

    // Create pool ID
    const poolId = `pool_${crypto.randomBytes(16).toString('hex')}`;
    
    // Initial LP token supply (geometric mean)
    const lpTokenSupply = sqrt(amountABigInt * amountBBigInt);

    const timestamp = Date.now();

    db.prepare(`
      INSERT INTO l2_defi_pools (
        pool_id, token_a, token_b,
        reserve_a, reserve_b, lp_token_supply,
        fee_rate, protocol_fee_rate,
        total_volume, total_fees, total_swaps,
        creator_account, active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poolId,
      tokenA,
      tokenB,
      amountA.toString(),
      amountB.toString(),
      lpTokenSupply.toString(),
      30,  // 0.3% fee
      5,   // 0.05% protocol fee
      '0',
      '0',
      0,
      creatorAccount,
      1,
      timestamp,
      timestamp
    );

    // Lock liquidity from creator
    if (tokenA === 'KRAY') {
      const balance = BigInt(account.balance_credits);
      updateBalance(creatorAccount, balance - amountABigInt);
    }

    console.log(`✅ Pool created: ${poolId}`);
    console.log(`   LP tokens: ${lpTokenSupply}`);

    return {
      pool_id: poolId,
      token_a: tokenA,
      token_b: tokenB,
      reserve_a: amountA.toString(),
      reserve_b: amountB.toString(),
      lp_token_supply: lpTokenSupply.toString()
    };
  });
}

/**
 * Execute swap on AMM pool
 */
export function swap(poolId, accountId, tokenIn, amountIn, minAmountOut) {
  return transaction(() => {
    const db = getDatabase();

    console.log('\n🔄 Executing swap...');
    console.log(`   Pool: ${poolId}`);
    console.log(`   Account: ${accountId}`);
    console.log(`   Token in: ${tokenIn}`);
    console.log(`   Amount in: ${amountIn}`);

    const pool = getPool(poolId);

    if (!pool || !pool.active) {
      throw new Error('Pool not found or inactive');
    }

    const account = getAccount(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    const amountInBigInt = BigInt(amountIn);

    // Determine which token is being swapped
    const isTokenA = tokenIn === pool.token_a;
    const reserveIn = BigInt(isTokenA ? pool.reserve_a : pool.reserve_b);
    const reserveOut = BigInt(isTokenA ? pool.reserve_b : pool.reserve_a);

    // Calculate amount out using constant product formula
    // amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    // Fee is 0.3% (30 basis points), so we use 997/1000

    const amountInWithFee = amountInBigInt * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * 1000n) + amountInWithFee;
    const amountOut = numerator / denominator;

    console.log(`   Amount out: ${amountOut}`);

    // Check slippage protection
    const minOut = BigInt(minAmountOut);

    if (amountOut < minOut) {
      throw new Error(`Slippage too high. Expected: ${minOut}, Got: ${amountOut}`);
    }

    // Check user has enough balance
    if (tokenIn === 'KRAY') {
      const balance = BigInt(account.balance_credits);
      if (balance < amountInBigInt) {
        throw new Error(`Insufficient balance: ${balance} < ${amountInBigInt}`);
      }
    }

    // Execute swap
    // Deduct input token from user
    if (tokenIn === 'KRAY') {
      const balance = BigInt(account.balance_credits);
      updateBalance(accountId, balance - amountInBigInt);
    }

    // Add output token to user
    if (!isTokenA && pool.token_b === 'KRAY') {
      const balance = BigInt(account.balance_credits);
      updateBalance(accountId, balance + amountOut);
    }

    // Update pool reserves
    const newReserveIn = reserveIn + amountInBigInt;
    const newReserveOut = reserveOut - amountOut;

    const timestamp = Date.now();

    db.prepare(`
      UPDATE l2_defi_pools
      SET reserve_a = ?,
          reserve_b = ?,
          total_volume = CAST(total_volume AS INTEGER) + ?,
          total_swaps = total_swaps + 1,
          updated_at = ?
      WHERE pool_id = ?
    `).run(
      isTokenA ? newReserveIn.toString() : newReserveOut.toString(),
      isTokenA ? newReserveOut.toString() : newReserveIn.toString(),
      amountIn.toString(),
      timestamp,
      poolId
    );

    // Calculate price and impact
    const price = Number(amountOut) / Number(amountInBigInt);
    const priceImpact = (Number(amountInBigInt) / Number(reserveIn)) * 100;

    console.log(`✅ Swap executed`);
    console.log(`   Price: ${price}`);
    console.log(`   Impact: ${priceImpact.toFixed(2)}%`);

    return {
      pool_id: poolId,
      amount_in: amountIn.toString(),
      amount_out: amountOut.toString(),
      price,
      price_impact: priceImpact,
      new_reserve_in: newReserveIn.toString(),
      new_reserve_out: newReserveOut.toString()
    };
  });
}

/**
 * Get pool by ID
 */
export function getPool(poolId) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_defi_pools WHERE pool_id = ?
  `).get(poolId);
}

/**
 * List all pools
 */
export function listPools(activeOnly = true) {
  const db = getDatabase();

  const query = activeOnly
    ? 'SELECT * FROM l2_defi_pools WHERE active = 1 ORDER BY total_volume DESC'
    : 'SELECT * FROM l2_defi_pools ORDER BY total_volume DESC';

  return db.prepare(query).all();
}

/**
 * Get pool statistics
 */
export function getPoolStats(poolId) {
  const pool = getPool(poolId);

  if (!pool) {
    return null;
  }

  const reserveA = BigInt(pool.reserve_a);
  const reserveB = BigInt(pool.reserve_b);

  return {
    pool_id: poolId,
    token_a: pool.token_a,
    token_b: pool.token_b,
    reserve_a: reserveA.toString(),
    reserve_b: reserveB.toString(),
    lp_token_supply: pool.lp_token_supply,
    price: Number(reserveB) / Number(reserveA),
    tvl: Number(reserveA) + Number(reserveB), // Simplified TVL
    total_volume: pool.total_volume,
    total_swaps: pool.total_swaps,
    fee_rate: pool.fee_rate / 10000 // Convert basis points to percentage
  };
}

/**
 * Calculate price impact for a swap
 */
export function calculatePriceImpact(poolId, tokenIn, amountIn) {
  const pool = getPool(poolId);

  if (!pool) {
    throw new Error('Pool not found');
  }

  const isTokenA = tokenIn === pool.token_a;
  const reserveIn = BigInt(isTokenA ? pool.reserve_a : pool.reserve_b);
  const reserveOut = BigInt(isTokenA ? pool.reserve_b : pool.reserve_a);

  const amountInBigInt = BigInt(amountIn);

  // Calculate amount out
  const amountInWithFee = amountInBigInt * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  const amountOut = numerator / denominator;

  // Calculate price impact
  const priceImpact = (Number(amountInBigInt) / Number(reserveIn)) * 100;

  // Effective price
  const effectivePrice = Number(amountOut) / Number(amountInBigInt);

  // Spot price (without trade)
  const spotPrice = Number(reserveOut) / Number(reserveIn);

  return {
    amount_out: amountOut.toString(),
    effective_price: effectivePrice,
    spot_price: spotPrice,
    price_impact: priceImpact,
    minimum_received: (amountOut * 995n / 1000n).toString() // 0.5% slippage tolerance
  };
}

/**
 * Square root helper (for LP tokens)
 */
function sqrt(value) {
  if (value < 0n) {
    throw new Error('Square root of negative number');
  }
  
  if (value === 0n) return 0n;
  
  let z = value;
  let x = value / 2n + 1n;
  
  while (x < z) {
    z = x;
    x = (value / x + x) / 2n;
  }
  
  return z;
}

export default {
  createPool,
  swap,
  getPool,
  listPools,
  getPoolStats,
  calculatePriceImpact
};

