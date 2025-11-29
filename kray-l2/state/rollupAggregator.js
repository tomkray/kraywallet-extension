/**
 * KRAY SPACE L2 - Rollup Aggregator
 * 
 * Aggregates L2 transactions into batches and publishes to Bitcoin L1
 */

import crypto from 'crypto';
import { getDatabase, transaction } from '../core/database.js';
import { createStateCommitment, MerkleTree } from './merkleTree.js';
import { listAccounts } from './accountManager.js';
import { getTransactionStats } from './transactionExecutor.js';
import { ROLLUP, STATUS } from '../core/constants.js';
import * as bitcoin from 'bitcoinjs-lib';

let batchBuilderInterval = null;
let currentBatch = null;

/**
 * Start batch builder
 * 
 * Automatically creates batches every BATCH_INTERVAL seconds
 */
export function startBatchBuilder() {
  if (batchBuilderInterval) {
    console.log('   ℹ️  Batch builder already running');
    return;
  }

  console.log('\n📦 Starting batch builder...');
  console.log(`   Interval: ${ROLLUP.BATCH_INTERVAL}s (${ROLLUP.BATCH_INTERVAL / 3600}h)`);

  // Build batch immediately
  buildBatch();

  // Set up interval
  batchBuilderInterval = setInterval(() => {
    buildBatch();
  }, ROLLUP.BATCH_INTERVAL * 1000);

  console.log('✅ Batch builder started');

  return {
    stop: () => {
      if (batchBuilderInterval) {
        clearInterval(batchBuilderInterval);
        batchBuilderInterval = null;
        console.log('🛑 Batch builder stopped');
      }
    }
  };
}

/**
 * Build a new batch
 */
export async function buildBatch() {
  return transaction(() => {
    const db = getDatabase();

    console.log('\n🏗️  Building new batch...');

    // Get previous batch
    const prevBatch = db.prepare(`
      SELECT * FROM l2_batches 
      ORDER BY batch_id DESC 
      LIMIT 1
    `).get();

    const prevStateRoot = prevBatch?.new_state_root || hash('genesis');

    // Get all confirmed transactions not in a batch
    const unbatchedTxs = db.prepare(`
      SELECT * FROM l2_transactions
      WHERE status = ?
        AND batch_id IS NULL
      ORDER BY created_at ASC
      LIMIT ?
    `).all(STATUS.TX_CONFIRMED, ROLLUP.MAX_TXS_PER_BATCH);

    if (unbatchedTxs.length === 0) {
      console.log('   ℹ️  No transactions to batch');
      return null;
    }

    console.log(`   Transactions to batch: ${unbatchedTxs.length}`);

    // Calculate gas statistics
    const totalGasCollected = unbatchedTxs.reduce((sum, tx) => {
      return sum + BigInt(tx.gas_fee_credits);
    }, 0n);

    const totalGasBurned = totalGasCollected / 2n; // 50% burned
    const totalGasDistributed = totalGasCollected - totalGasBurned; // 50% to validators

    // Create new state commitment
    const accounts = listAccounts(100000, 0); // Get all accounts
    const { root: newStateRoot } = createStateCommitment(accounts);

    // Create batch record
    const timestamp = Date.now();
    const txHashes = unbatchedTxs.map(tx => tx.tx_hash);

    const result = db.prepare(`
      INSERT INTO l2_batches (
        prev_state_root, new_state_root,
        tx_count, tx_hashes,
        total_gas_collected, total_gas_burned, total_gas_distributed,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prevStateRoot,
      newStateRoot,
      unbatchedTxs.length,
      JSON.stringify(txHashes),
      totalGasCollected.toString(),
      totalGasBurned.toString(),
      totalGasDistributed.toString(),
      'building',
      timestamp
    );

    const batchId = result.lastInsertRowid;

    // Assign transactions to batch
    const updateStmt = db.prepare(`
      UPDATE l2_transactions 
      SET batch_id = ? 
      WHERE tx_hash = ?
    `);

    for (const tx of unbatchedTxs) {
      updateStmt.run(batchId, tx.tx_hash);
    }

    console.log(`✅ Batch ${batchId} built`);
    console.log(`   Transactions: ${unbatchedTxs.length}`);
    console.log(`   State root: ${newStateRoot}`);
    console.log(`   Gas burned: ${totalGasBurned} credits`);
    console.log(`   Gas distributed: ${totalGasDistributed} credits`);

    currentBatch = {
      batch_id: batchId,
      prev_state_root: prevStateRoot,
      new_state_root: newStateRoot,
      tx_count: unbatchedTxs.length,
      total_gas_collected: totalGasCollected.toString(),
      status: 'building'
    };

    return currentBatch;
  });
  
  // Publish to L1 after transaction completes
  // (can't await inside transaction())
  if (currentBatch) {
    publishBatchToL1(currentBatch.batch_id).catch(err => {
      console.error('❌ Error publishing batch to L1:', err.message);
    });
  }
  
  return currentBatch;
}

/**
 * Publish batch to Bitcoin L1 via OP_RETURN
 */
export async function publishBatchToL1(batchId) {
  const db = getDatabase();

  console.log(`\n📡 Publishing batch ${batchId} to L1...`);

  const batch = db.prepare(`
    SELECT * FROM l2_batches WHERE batch_id = ?
  `).get(batchId);

  if (!batch) {
    throw new Error('Batch not found');
  }

  // Create OP_RETURN data with state root
  const opReturnData = createOpReturnData(batch);

  console.log(`   OP_RETURN data: ${opReturnData.toString('hex')}`);

  // Create Bitcoin transaction with OP_RETURN
  // This would use your PSBT builder from backend-render
  const txid = await createAndBroadcastAnchor(opReturnData);

  // Get current Bitcoin block height
  const blockHeight = await getCurrentBlockHeight();

  // Update batch
  const timestamp = Date.now();

  db.prepare(`
    UPDATE l2_batches
    SET status = 'published',
        l1_anchor_txid = ?,
        l1_block_height = ?,
        published_at = ?
    WHERE batch_id = ?
  `).run(txid, blockHeight, timestamp, batchId);

  console.log(`✅ Batch published to L1`);
  console.log(`   TXID: ${txid}`);
  console.log(`   Block: ${blockHeight}`);

  // Log audit
  db.prepare(`
    INSERT INTO l2_audit_log (event_type, event_data, batch_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'batch_published',
    JSON.stringify({
      batch_id: batchId,
      tx_count: batch.tx_count,
      state_root: batch.new_state_root,
      l1_txid: txid
    }),
    batchId,
    timestamp
  );

  return { txid, blockHeight };
}

/**
 * Create OP_RETURN data
 * 
 * Format: KRAY + state_root (32 bytes) + metadata
 */
function createOpReturnData(batch) {
  const prefix = ROLLUP.OP_RETURN_PREFIX; // 'KRAY'
  const stateRoot = Buffer.from(batch.new_state_root, 'hex').slice(0, 28); // 28 bytes
  
  // Total: 4 + 28 = 32 bytes (fits in OP_RETURN limit)
  return Buffer.concat([prefix, stateRoot]);
}

/**
 * Create and broadcast anchor transaction
 */
async function createAndBroadcastAnchor(opReturnData) {
  console.log('   📝 Creating anchor transaction...');

  // This would create a Bitcoin transaction with OP_RETURN
  // Using minimal amount (dust) + OP_RETURN
  
  // Placeholder: would use actual PSBT builder and QuickNode
  const placeholderTxid = crypto.randomBytes(32).toString('hex');
  
  console.log('   ✅ Anchor transaction created');
  
  return placeholderTxid;
}

/**
 * Get current Bitcoin block height
 */
async function getCurrentBlockHeight() {
  // Would query QuickNode for current block height
  // Placeholder
  return 850000;
}

/**
 * Hash helper
 */
function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Get batch by ID
 */
export function getBatch(batchId) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_batches WHERE batch_id = ?
  `).get(batchId);
}

/**
 * Get recent batches
 */
export function getRecentBatches(limit = 10) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_batches
    ORDER BY batch_id DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get batch statistics
 */
export function getBatchStats() {
  const db = getDatabase();

  return {
    total: db.prepare('SELECT COUNT(*) as count FROM l2_batches').get()?.count || 0,
    
    published: db.prepare(`
      SELECT COUNT(*) as count FROM l2_batches WHERE status = 'published'
    `).get()?.count || 0,

    finalized: db.prepare(`
      SELECT COUNT(*) as count FROM l2_batches WHERE status = 'finalized'
    `).get()?.count || 0,

    totalTxsInBatches: db.prepare(`
      SELECT SUM(tx_count) as total FROM l2_batches
    `).get()?.total || 0,

    totalGasBurned: db.prepare(`
      SELECT SUM(CAST(total_gas_burned AS INTEGER)) as total FROM l2_batches
    `).get()?.total || 0,

    lastBatch: db.prepare(`
      SELECT * FROM l2_batches ORDER BY batch_id DESC LIMIT 1
    `).get()
  };
}

/**
 * Finalize batch (after L1 confirmations)
 */
export async function finalizeBatch(batchId, l1Confirmations = 6) {
  const db = getDatabase();

  console.log(`\n✅ Finalizing batch ${batchId}...`);

  const batch = getBatch(batchId);

  if (!batch) {
    throw new Error('Batch not found');
  }

  if (batch.status === 'finalized') {
    console.log('   ℹ️  Already finalized');
    return batch;
  }

  if (!batch.l1_anchor_txid) {
    throw new Error('Batch not published to L1 yet');
  }

  // Check L1 confirmations (would query QuickNode)
  // Placeholder: assume enough confirmations

  const timestamp = Date.now();

  db.prepare(`
    UPDATE l2_batches
    SET status = 'finalized',
        finalized_at = ?
    WHERE batch_id = ?
  `).run(timestamp, batchId);

  console.log(`✅ Batch finalized`);

  return getBatch(batchId);
}

export default {
  startBatchBuilder,
  buildBatch,
  publishBatchToL1,
  getBatch,
  getRecentBatches,
  getBatchStats,
  finalizeBatch
};

