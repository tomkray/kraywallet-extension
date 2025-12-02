/**
 * KRAY SPACE L2 - Gaming Rewards
 * 
 * Reward system for games, achievements, tournaments, and loyalty
 */

import { getDatabase, transaction } from '../core/database.js';
import { getAccount, updateBalance } from '../state/accountManager.js';
import crypto from 'crypto';

/**
 * Award reward to user
 */
export function awardReward(userAccount, rewardType, amount, metadata = {}) {
  return transaction(() => {
    const db = getDatabase();

    console.log('\n🎁 Awarding reward...');
    console.log(`   User: ${userAccount}`);
    console.log(`   Type: ${rewardType}`);
    console.log(`   Amount: ${amount} credits`);

    const account = getAccount(userAccount);

    if (!account) {
      throw new Error('User account not found');
    }

    const amountBigInt = BigInt(amount);

    if (amountBigInt <= 0n) {
      throw new Error('Reward amount must be positive');
    }

    const rewardId = `reward_${crypto.randomBytes(16).toString('hex')}`;
    const timestamp = Date.now();

    // Set expiration (30 days from now)
    const expiresAt = timestamp + (30 * 24 * 60 * 60 * 1000);

    db.prepare(`
      INSERT INTO l2_gaming_rewards (
        reward_id, user_account,
        reward_type, reward_amount,
        game_id, achievement_id,
        claimed, earned_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rewardId,
      userAccount,
      rewardType,
      amount.toString(),
      metadata.game_id || null,
      metadata.achievement_id || null,
      0, // Not claimed yet
      timestamp,
      expiresAt
    );

    console.log(`✅ Reward awarded: ${rewardId}`);
    console.log(`   Expires: ${new Date(expiresAt).toISOString()}`);

    // Log audit
    db.prepare(`
      INSERT INTO l2_audit_log (event_type, event_data, account_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'reward_awarded',
      JSON.stringify({
        reward_id: rewardId,
        reward_type: rewardType,
        amount: amount.toString(),
        ...metadata
      }),
      userAccount,
      timestamp
    );

    return {
      reward_id: rewardId,
      amount: amount.toString(),
      expires_at: expiresAt
    };
  });
}

/**
 * Claim reward
 */
export function claimReward(rewardId, userAccount) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n🎁 Claiming reward ${rewardId}...`);

    const reward = db.prepare(`
      SELECT * FROM l2_gaming_rewards WHERE reward_id = ?
    `).get(rewardId);

    if (!reward) {
      throw new Error('Reward not found');
    }

    if (reward.user_account !== userAccount) {
      throw new Error('Reward belongs to another user');
    }

    if (reward.claimed) {
      throw new Error('Reward already claimed');
    }

    const currentTime = Date.now();

    if (reward.expires_at && currentTime > reward.expires_at) {
      throw new Error('Reward has expired');
    }

    // Credit user account
    const account = getAccount(userAccount);
    const balance = BigInt(account.balance_credits);
    const rewardAmount = BigInt(reward.reward_amount);
    const newBalance = balance + rewardAmount;

    updateBalance(userAccount, newBalance);

    // Mark as claimed
    db.prepare(`
      UPDATE l2_gaming_rewards
      SET claimed = 1,
          claimed_at = ?
      WHERE reward_id = ?
    `).run(currentTime, rewardId);

    console.log(`✅ Reward claimed!`);
    console.log(`   Amount: ${rewardAmount} credits`);
    console.log(`   New balance: ${newBalance} credits`);

    return {
      reward_id: rewardId,
      amount_claimed: rewardAmount.toString(),
      new_balance: newBalance.toString()
    };
  });
}

/**
 * Get user's pending rewards
 */
export function getPendingRewards(userAccount) {
  const db = getDatabase();
  const currentTime = Date.now();

  return db.prepare(`
    SELECT * FROM l2_gaming_rewards
    WHERE user_account = ?
      AND claimed = 0
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY earned_at DESC
  `).all(userAccount, currentTime);
}

/**
 * Get user's reward history
 */
export function getRewardHistory(userAccount, limit = 50) {
  const db = getDatabase();

  return db.prepare(`
    SELECT * FROM l2_gaming_rewards
    WHERE user_account = ?
    ORDER BY earned_at DESC
    LIMIT ?
  `).all(userAccount, limit);
}

/**
 * Get reward statistics
 */
export function getRewardStats(userAccount = null) {
  const db = getDatabase();

  if (userAccount) {
    // User-specific stats
    return {
      total_earned: db.prepare(`
        SELECT SUM(CAST(reward_amount AS INTEGER)) as total
        FROM l2_gaming_rewards
        WHERE user_account = ?
      `).get(userAccount)?.total || 0,

      total_claimed: db.prepare(`
        SELECT SUM(CAST(reward_amount AS INTEGER)) as total
        FROM l2_gaming_rewards
        WHERE user_account = ? AND claimed = 1
      `).get(userAccount)?.total || 0,

      pending: db.prepare(`
        SELECT SUM(CAST(reward_amount AS INTEGER)) as total
        FROM l2_gaming_rewards
        WHERE user_account = ? AND claimed = 0
      `).get(userAccount)?.total || 0,

      by_type: db.prepare(`
        SELECT reward_type, COUNT(*) as count, SUM(CAST(reward_amount AS INTEGER)) as total
        FROM l2_gaming_rewards
        WHERE user_account = ?
        GROUP BY reward_type
      `).all(userAccount)
    };
  }

  // Global stats
  return {
    total_rewards: db.prepare('SELECT COUNT(*) as count FROM l2_gaming_rewards').get()?.count || 0,

    total_amount: db.prepare(`
      SELECT SUM(CAST(reward_amount AS INTEGER)) as total FROM l2_gaming_rewards
    `).get()?.total || 0,

    claimed_amount: db.prepare(`
      SELECT SUM(CAST(reward_amount AS INTEGER)) as total 
      FROM l2_gaming_rewards 
      WHERE claimed = 1
    `).get()?.total || 0,

    by_type: db.prepare(`
      SELECT reward_type, COUNT(*) as count, SUM(CAST(reward_amount AS INTEGER)) as total
      FROM l2_gaming_rewards
      GROUP BY reward_type
    `).all()
  };
}

/**
 * Expire old unclaimed rewards
 */
export function expireOldRewards() {
  const db = getDatabase();
  const currentTime = Date.now();

  console.log('\n🗑️  Expiring old rewards...');

  const result = db.prepare(`
    DELETE FROM l2_gaming_rewards
    WHERE claimed = 0
      AND expires_at IS NOT NULL
      AND expires_at < ?
  `).run(currentTime);

  console.log(`✅ Expired ${result.changes} old rewards`);

  return { expired_count: result.changes };
}

/**
 * Create daily reward for active users
 */
export function createDailyReward(userAccount, amount = 100) {
  return awardReward(userAccount, 'daily', amount, {
    description: 'Daily login reward'
  });
}

/**
 * Create achievement reward
 */
export function createAchievementReward(userAccount, achievementId, amount) {
  return awardReward(userAccount, 'achievement', amount, {
    achievement_id: achievementId
  });
}

/**
 * Create tournament reward
 */
export function createTournamentReward(userAccount, tournamentId, placement, amount) {
  return awardReward(userAccount, 'tournament', amount, {
    game_id: tournamentId,
    achievement_id: `placement_${placement}`
  });
}

/**
 * Create referral reward
 */
export function createReferralReward(userAccount, referredAccount, amount) {
  return awardReward(userAccount, 'referral', amount, {
    achievement_id: `referred_${referredAccount}`
  });
}

/**
 * Get listing by ID
 */
function getListing(listingId) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_marketplace_listings WHERE listing_id = ?
  `).get(listingId);
}

export default {
  awardReward,
  claimReward,
  getPendingRewards,
  getRewardHistory,
  getRewardStats,
  expireOldRewards,
  createDailyReward,
  createAchievementReward,
  createTournamentReward,
  createReferralReward
};




















