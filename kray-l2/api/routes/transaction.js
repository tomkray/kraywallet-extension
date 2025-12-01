/**
 * KRAY SPACE L2 - Transaction API Routes
 */

import express from 'express';
import { executeTransaction, getTransaction, getPendingTransactions, getTransactionStats } from '../../state/transactionExecutor.js';
import { calculateGasFee } from '../../core/constants.js';

const router = express.Router();

/**
 * POST /api/transaction/send
 * Send L2 transaction
 */
router.post('/send', async (req, res) => {
  try {
    const { from_account, to_account, amount, signature, nonce, tx_type, data } = req.body;

    if (!from_account || !to_account || !amount || !signature) {
      return res.status(400).json({ 
        error: 'from_account, to_account, amount, and signature are required' 
      });
    }

    if (nonce === undefined) {
      return res.status(400).json({ error: 'nonce is required' });
    }

    const result = await executeTransaction({
      from_account,
      to_account,
      amount,
      tx_type: tx_type || 'transfer',
      data,
      signature,
      nonce
    });

    res.json({
      tx_hash: result.tx_hash,
      status: result.status,
      from: result.from_account,
      to: result.to_account,
      amount: result.amount,
      gas_fee: result.gas_fee,
      new_nonce: result.nonce,
      confirmed_at: result.confirmed_at,
      message: 'Transaction confirmed instantly on L2!'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/transaction/:hash
 * Get transaction details
 */
router.get('/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    const tx = getTransaction(hash);

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      tx_hash: tx.tx_hash,
      from: tx.from_account,
      to: tx.to_account,
      type: tx.tx_type,
      amount: tx.amount_credits,
      gas_fee: tx.gas_fee_credits,
      nonce: tx.nonce,
      status: tx.status,
      batch_id: tx.batch_id,
      created_at: tx.created_at,
      confirmed_at: tx.confirmed_at,
      data: tx.data ? JSON.parse(tx.data) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transaction/estimate-gas
 * Estimate gas for transaction
 */
router.post('/estimate-gas', async (req, res) => {
  try {
    const { tx_type } = req.body;

    const gasFee = calculateGasFee(tx_type?.toUpperCase() || 'BASE_TRANSFER');

    res.json({
      tx_type: tx_type || 'transfer',
      gas_fee_credits: gasFee,
      gas_fee_kray: (gasFee / 1000).toFixed(3)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transaction/pending
 * Get pending transactions
 */
router.get('/pending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const pending = getPendingTransactions(limit);

    res.json({
      pending_count: pending.length,
      transactions: pending
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transaction/stats
 * Get transaction statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = getTransactionStats();

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;





