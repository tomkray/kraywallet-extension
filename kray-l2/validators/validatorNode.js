/**
 * KRAY SPACE L2 - Validator Node
 * 
 * Validator node that validates transactions and participates in consensus
 */

import { getDatabase, transaction } from '../core/database.js';
import { VALIDATOR, STATUS } from '../core/constants.js';
import crypto from 'crypto';

/**
 * Register new validator
 */
export function registerValidator(pubkey, l1Address, stakeAmount) {
  return transaction(() => {
    const db = getDatabase();

    console.log('\n🛡️  Registering validator...');
    console.log(`   Pubkey: ${pubkey.substring(0, 16)}...`);
    console.log(`   L1 Address: ${l1Address}`);
    console.log(`   Stake: ${stakeAmount} credits`);

    const stakeBigInt = BigInt(stakeAmount);
    const minStake = BigInt(VALIDATOR.MIN_STAKE);

    if (stakeBigInt < minStake) {
      throw new Error(`Insufficient stake. Minimum: ${minStake}, Provided: ${stakeBigInt}`);
    }

    // Check if validator already exists
    const existing = db.prepare(`
      SELECT validator_id FROM l2_validators WHERE validator_pubkey = ?
    `).get(pubkey);

    if (existing) {
      throw new Error('Validator already registered');
    }

    const validatorId = `val_${crypto.randomBytes(16).toString('hex')}`;
    const timestamp = Date.now();

    db.prepare(`
      INSERT INTO l2_validators (
        validator_id, validator_pubkey, validator_address,
        staked_amount, rewards_earned, rewards_claimed,
        status, blocks_validated, last_active,
        uptime_percentage, registered_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validatorId,
      pubkey,
      l1Address,
      stakeAmount.toString(),
      '0',
      '0',
      STATUS.VALIDATOR_ACTIVE,
      0,
      timestamp,
      100.0,
      timestamp,
      timestamp
    );

    console.log(`✅ Validator registered: ${validatorId}`);

    // Log audit
    db.prepare(`
      INSERT INTO l2_audit_log (event_type, event_data, created_at)
      VALUES (?, ?, ?)
    `).run(
      'validator_registered',
      JSON.stringify({
        validator_id: validatorId,
        pubkey,
        stake: stakeAmount.toString()
      }),
      timestamp
    );

    return {
      validator_id: validatorId,
      status: STATUS.VALIDATOR_ACTIVE
    };
  });
}

/**
 * Get validator by ID or pubkey
 */
export function getValidator(validatorIdOrPubkey) {
  const db = getDatabase();

  let validator = db.prepare(`
    SELECT * FROM l2_validators WHERE validator_id = ?
  `).get(validatorIdOrPubkey);

  if (!validator) {
    validator = db.prepare(`
      SELECT * FROM l2_validators WHERE validator_pubkey = ?
    `).get(validatorIdOrPubkey);
  }

  return validator;
}

/**
 * List active validators
 */
export function listActiveValidators() {
  const db = getDatabase();

  return db.prepare(`
    SELECT * FROM l2_validators
    WHERE status = ?
    ORDER BY staked_amount DESC
  `).all(STATUS.VALIDATOR_ACTIVE);
}

/**
 * Update validator activity
 */
export function updateValidatorActivity(validatorId) {
  const db = getDatabase();
  const timestamp = Date.now();

  db.prepare(`
    UPDATE l2_validators
    SET last_active = ?,
        blocks_validated = blocks_validated + 1,
        updated_at = ?
    WHERE validator_id = ?
  `).run(timestamp, timestamp, validatorId);
}

/**
 * Distribute rewards to validators
 */
export function distributeRewards(totalRewards) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n💰 Distributing ${totalRewards} credits to validators...`);

    const activeValidators = listActiveValidators();

    if (activeValidators.length === 0) {
      console.log('   ℹ️  No active validators');
      return { distributed: 0 };
    }

    // Calculate total stake
    const totalStake = activeValidators.reduce((sum, v) => {
      return sum + BigInt(v.staked_amount);
    }, 0n);

    console.log(`   Active validators: ${activeValidators.length}`);
    console.log(`   Total stake: ${totalStake} credits`);

    const totalRewardsBigInt = BigInt(totalRewards);
    const updateStmt = db.prepare(`
      UPDATE l2_validators
      SET rewards_earned = CAST(rewards_earned AS INTEGER) + ?,
          updated_at = ?
      WHERE validator_id = ?
    `);

    const timestamp = Date.now();
    let totalDistributed = 0n;

    for (const validator of activeValidators) {
      const stake = BigInt(validator.staked_amount);
      
      // Proportional rewards based on stake
      const reward = (totalRewardsBigInt * stake) / totalStake;
      
      updateStmt.run(reward.toString(), timestamp, validator.validator_id);
      
      totalDistributed += reward;

      console.log(`   ${validator.validator_id}: ${reward} credits`);
    }

    console.log(`✅ Rewards distributed: ${totalDistributed} credits`);

    return {
      distributed: totalDistributed.toString(),
      validators: activeValidators.length
    };
  });
}

/**
 * Claim validator rewards
 */
export function claimValidatorRewards(validatorId) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n💸 Claiming validator rewards...`);
    console.log(`   Validator: ${validatorId}`);

    const validator = getValidator(validatorId);

    if (!validator) {
      throw new Error('Validator not found');
    }

    const rewards = BigInt(validator.rewards_earned);
    const claimed = BigInt(validator.rewards_claimed);
    const pending = rewards - claimed;

    if (pending <= 0n) {
      throw new Error('No pending rewards to claim');
    }

    console.log(`   Pending rewards: ${pending} credits`);

    const timestamp = Date.now();

    db.prepare(`
      UPDATE l2_validators
      SET rewards_claimed = CAST(rewards_claimed AS INTEGER) + ?,
          updated_at = ?
      WHERE validator_id = ?
    `).run(pending.toString(), timestamp, validatorId);

    console.log(`✅ Rewards claimed: ${pending} credits`);

    return {
      claimed: pending.toString(),
      total_earned: rewards.toString(),
      total_claimed: (claimed + pending).toString()
    };
  });
}

/**
 * Slash validator for malicious behavior
 */
export function slashValidator(validatorId, reason, percentage = VALIDATOR.OFFLINE_SLASH) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n⚠️  Slashing validator ${validatorId}...`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Percentage: ${percentage}%`);

    const validator = getValidator(validatorId);

    if (!validator) {
      throw new Error('Validator not found');
    }

    const stake = BigInt(validator.staked_amount);
    const slashAmount = (stake * BigInt(percentage)) / 100n;
    const newStake = stake - slashAmount;

    const timestamp = Date.now();

    db.prepare(`
      UPDATE l2_validators
      SET staked_amount = ?,
          status = ?,
          slash_reason = ?,
          slash_amount = CAST(COALESCE(slash_amount, '0') AS INTEGER) + ?,
          updated_at = ?
      WHERE validator_id = ?
    `).run(
      newStake.toString(),
      STATUS.VALIDATOR_SLASHED,
      reason,
      slashAmount.toString(),
      timestamp,
      validatorId
    );

    console.log(`✅ Validator slashed`);
    console.log(`   Amount: ${slashAmount} credits`);
    console.log(`   New stake: ${newStake} credits`);

    // Log audit
    db.prepare(`
      INSERT INTO l2_audit_log (event_type, event_data, created_at)
      VALUES (?, ?, ?)
    `).run(
      'validator_slashed',
      JSON.stringify({
        validator_id: validatorId,
        reason,
        slash_amount: slashAmount.toString(),
        percentage
      }),
      timestamp
    );

    return {
      validator_id: validatorId,
      slash_amount: slashAmount.toString(),
      new_stake: newStake.toString()
    };
  });
}

/**
 * Check validator health and slash if needed
 */
export function checkValidatorHealth() {
  const db = getDatabase();
  const currentTime = Date.now();

  const validators = listActiveValidators();
  const slashedValidators = [];

  for (const validator of validators) {
    const timeSinceActive = currentTime - validator.last_active;
    const maxOfflineTime = VALIDATOR.MAX_OFFLINE_TIME * 1000; // Convert to ms

    if (timeSinceActive > maxOfflineTime) {
      console.log(`⚠️  Validator ${validator.validator_id} offline for ${Math.floor(timeSinceActive / 1000)}s`);
      
      const result = slashValidator(
        validator.validator_id,
        `Offline for ${Math.floor(timeSinceActive / 60000)} minutes`,
        VALIDATOR.OFFLINE_SLASH
      );

      slashedValidators.push(result);
    }
  }

  if (slashedValidators.length > 0) {
    console.log(`⚠️  Slashed ${slashedValidators.length} validators for being offline`);
  }

  return slashedValidators;
}

/**
 * Get validator statistics
 */
export function getValidatorStats() {
  const db = getDatabase();

  return {
    total: db.prepare('SELECT COUNT(*) as count FROM l2_validators').get()?.count || 0,
    
    active: db.prepare(`
      SELECT COUNT(*) as count FROM l2_validators WHERE status = ?
    `).get(STATUS.VALIDATOR_ACTIVE)?.count || 0,

    inactive: db.prepare(`
      SELECT COUNT(*) as count FROM l2_validators WHERE status = ?
    `).get(STATUS.VALIDATOR_INACTIVE)?.count || 0,

    slashed: db.prepare(`
      SELECT COUNT(*) as count FROM l2_validators WHERE status = ?
    `).get(STATUS.VALIDATOR_SLASHED)?.count || 0,

    totalStake: db.prepare(`
      SELECT SUM(CAST(staked_amount AS INTEGER)) as total 
      FROM l2_validators 
      WHERE status = ?
    `).get(STATUS.VALIDATOR_ACTIVE)?.total || 0,

    totalRewardsEarned: db.prepare(`
      SELECT SUM(CAST(rewards_earned AS INTEGER)) as total FROM l2_validators
    `).get()?.total || 0,

    totalRewardsClaimed: db.prepare(`
      SELECT SUM(CAST(rewards_claimed AS INTEGER)) as total FROM l2_validators
    `).get()?.total || 0
  };
}

export default {
  registerValidator,
  getValidator,
  listActiveValidators,
  updateValidatorActivity,
  distributeRewards,
  claimValidatorRewards,
  slashValidator,
  checkValidatorHealth,
  getValidatorStats
};







