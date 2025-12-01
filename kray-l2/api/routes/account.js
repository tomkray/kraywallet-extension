/**
 * KRAY SPACE L2 - Account API Routes
 */

import express from 'express';
import { getAccount, getBalance, getAccountStats, listAccounts, createAccount } from '../../state/accountManager.js';
import { getAccountTransactions } from '../../state/transactionExecutor.js';
import { formatCredits } from '../../core/constants.js';

const router = express.Router();

/**
 * GET /api/account/:address/balance
 * Get account balance
 */
router.get('/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;

    const balance = getBalance(address);

    res.json({
      account_id: balance.account_id,
      balance_credits: balance.balance.toString(),
      balance_kray: formatCredits(balance.balance),
      staked_credits: balance.staked.toString(),
      staked_kray: formatCredits(balance.staked),
      locked_credits: balance.locked.toString(),
      locked_kray: formatCredits(balance.locked),
      total_credits: balance.total.toString(),
      total_kray: formatCredits(balance.total),
      nonce: balance.nonce
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/account/:address/transactions
 * Get account transaction history
 */
router.get('/:address/transactions', async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const account = getAccount(address);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const transactions = getAccountTransactions(account.account_id, limit, offset);

    res.json({
      account_id: account.account_id,
      transactions: transactions.map(tx => ({
        tx_hash: tx.tx_hash,
        from: tx.from_account,
        to: tx.to_account,
        type: tx.tx_type,
        amount: tx.amount_credits,
        gas_fee: tx.gas_fee_credits,
        status: tx.status,
        created_at: tx.created_at,
        confirmed_at: tx.confirmed_at
      })),
      limit,
      offset
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/account/:address/stats
 * Get account statistics
 */
router.get('/:address/stats', async (req, res) => {
  try {
    const { address } = req.params;

    const account = getAccount(address);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const stats = getAccountStats(account.account_id);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/account/create
 * Create new L2 account
 */
router.post('/create', async (req, res) => {
  try {
    const { l1_address } = req.body;

    if (!l1_address) {
      return res.status(400).json({ error: 'l1_address is required' });
    }

    const account = createAccount(l1_address);

    res.json({
      account_id: account.account_id,
      l1_address: account.l1_address,
      balance_credits: account.balance_credits,
      nonce: account.nonce,
      created_at: account.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/account/list
 * List all accounts (admin)
 */
router.get('/list', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const accounts = listAccounts(limit, offset);

    res.json({
      accounts: accounts.map(a => ({
        account_id: a.account_id,
        l1_address: a.l1_address,
        balance: a.balance_credits,
        staked: a.staked_credits,
        nonce: a.nonce,
        last_activity: a.last_activity
      })),
      limit,
      offset
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;





