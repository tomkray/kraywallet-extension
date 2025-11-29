/**
 * KRAY SPACE L2 - Validator API Routes
 */

import express from 'express';
import { registerValidator, listActiveValidators, getValidator, claimValidatorRewards, getValidatorStats } from '../../validators/validatorNode.js';
import { getConsensus } from '../../validators/consensusRaft.js';

const router = express.Router();

/**
 * GET /api/validator/list
 * List all validators
 */
router.get('/list', async (req, res) => {
  try {
    const validators = listActiveValidators();

    res.json({
      validators: validators.map(v => ({
        validator_id: v.validator_id,
        pubkey: v.validator_pubkey.substring(0, 16) + '...',
        staked_amount: v.staked_amount,
        rewards_earned: v.rewards_earned,
        status: v.status,
        blocks_validated: v.blocks_validated,
        uptime: v.uptime_percentage
      })),
      total: validators.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/validator/register
 * Register new validator
 */
router.post('/register', async (req, res) => {
  try {
    const { pubkey, l1_address, stake_amount } = req.body;

    if (!pubkey || !l1_address || !stake_amount) {
      return res.status(400).json({ 
        error: 'pubkey, l1_address, and stake_amount are required' 
      });
    }

    const result = registerValidator(pubkey, l1_address, stake_amount);

    res.json({
      ...result,
      message: 'Validator registered successfully',
      min_stake: '10,000 KRAY (10,000,000 credits)'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/validator/:id
 * Get validator details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const validator = getValidator(id);

    if (!validator) {
      return res.status(404).json({ error: 'Validator not found' });
    }

    res.json(validator);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/validator/:id/claim-rewards
 * Claim validator rewards
 */
router.post('/:id/claim-rewards', async (req, res) => {
  try {
    const { id } = req.params;

    const result = claimValidatorRewards(id);

    res.json({
      ...result,
      message: 'Rewards claimed successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/validator/stats
 * Get validator network statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = getValidatorStats();

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/validator/consensus/state
 * Get consensus state
 */
router.get('/consensus/state', async (req, res) => {
  try {
    const consensus = getConsensus();
    const state = consensus.getState();

    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

