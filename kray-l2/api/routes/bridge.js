/**
 * KRAY SPACE L2 - Bridge API Routes
 * 
 * Endpoints for L1↔L2 bridge operations
 */

import express from 'express';
import { requestWithdrawal, getDepositStatus, getWithdrawalStatus } from '../../bridge/psbtBridge.js';

const router = express.Router();

/**
 * POST /api/bridge/deposit/initiate
 * Initiate a deposit (get multisig address)
 */
router.post('/deposit/initiate', async (req, res) => {
  try {
    const { l1_address } = req.body;

    if (!l1_address) {
      return res.status(400).json({ error: 'l1_address is required' });
    }

    // In production, would generate unique deposit address per user
    // For now, return the main multisig address
    const multisigAddress = process.env.BRIDGE_MULTISIG_ADDRESS;

    res.json({
      deposit_address: multisigAddress,
      instructions: 'Send KRAY to this address. After 6 confirmations, credits will be minted on L2.',
      min_deposit: '1 KRAY',
      conversion_rate: '1 KRAY = 1,000 credits'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bridge/deposit/:txid/:vout/status
 * Get deposit status
 */
router.get('/deposit/:txid/:vout/status', async (req, res) => {
  try {
    const { txid, vout } = req.params;

    const db = req.app.locals.db;
    const deposit = db.prepare(`
      SELECT * FROM l2_deposits WHERE l1_txid = ? AND l1_vout = ?
    `).get(txid, parseInt(vout));

    if (!deposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }

    res.json({
      deposit_id: deposit.deposit_id,
      l1_txid: deposit.l1_txid,
      l1_vout: deposit.l1_vout,
      kray_amount: deposit.kray_amount,
      credits_minted: deposit.credits_minted,
      status: deposit.status,
      confirmations: deposit.confirmations,
      required_confirmations: 6,
      l2_account_id: deposit.l2_account_id,
      claimed_at: deposit.claimed_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bridge/withdrawal/request
 * Request withdrawal from L2 to L1
 */
router.post('/withdrawal/request', async (req, res) => {
  try {
    const { account_id, credits_amount, l1_address, signature } = req.body;

    if (!account_id || !credits_amount || !l1_address || !signature) {
      return res.status(400).json({ 
        error: 'account_id, credits_amount, l1_address, and signature are required' 
      });
    }

    const result = await requestWithdrawal(account_id, credits_amount, l1_address);

    res.json({
      withdrawal_id: result.withdrawal_id,
      credits_burned: result.credits_burned.toString(),
      kray_amount: result.kray_amount.toString(),
      l1_address,
      challenge_deadline: result.challenge_deadline,
      challenge_deadline_iso: new Date(result.challenge_deadline).toISOString(),
      status: result.status,
      message: 'Withdrawal requested. Wait 24h challenge period before completion.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bridge/withdrawal/:id/status
 * Get withdrawal status
 */
router.get('/withdrawal/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawal = getWithdrawalStatus(id);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    const currentTime = Date.now() / 1000;
    const timeRemaining = Math.max(0, withdrawal.challenge_deadline - currentTime);

    res.json({
      withdrawal_id: withdrawal.withdrawal_id,
      l2_account_id: withdrawal.l2_account_id,
      credits_burned: withdrawal.credits_burned,
      kray_amount: withdrawal.kray_amount,
      l1_address: withdrawal.l1_address,
      l1_txid: withdrawal.l1_txid,
      status: withdrawal.status,
      challenged: withdrawal.challenged === 1,
      challenge_reason: withdrawal.challenge_reason,
      challenge_time_remaining: Math.floor(timeRemaining),
      requested_at: withdrawal.requested_at,
      completed_at: withdrawal.completed_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bridge/info
 * Get bridge information
 */
router.get('/info', async (req, res) => {
  try {
    // Get multisig address from global variable set during init
    const multisigAddress = global.multisigAddress || 'bc1p...initializing...';

    res.json({
      multisig_address: multisigAddress,
      threshold: '2-of-3',
      deposit_confirmations: 6,
      withdrawal_challenge_period: '24 hours',
      conversion_rate: '1 KRAY = 1,000 credits',
      decimals: 3,
      min_deposit: '1 KRAY',
      min_withdrawal: '1 KRAY',
      network: 'Bitcoin Testnet4'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

