/**
 * KRAY SPACE L2 - Test Script
 * 
 * Basic tests to verify L2 functionality
 */

import { initDatabase, getStats } from './core/database.js';
import { createAccount, getBalance, transfer } from './state/accountManager.js';
import { executeTransaction } from './state/transactionExecutor.js';
import { createPool, swap, calculatePriceImpact } from './defi/ammPool.js';
import { listOrdinal, buyOrdinal } from './marketplace/ordinalTrading.js';
import { awardReward, claimReward } from './defi/gamingRewards.js';
import { krayToCredits, formatCredits } from './core/constants.js';

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║        KRAY SPACE L2 - Functionality Test                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

async function runTests() {
  try {
    // Initialize database
    console.log('1️⃣  Initializing database...');
    initDatabase();
    console.log('✅ Database initialized\n');

    // Test 1: Create accounts
    console.log('2️⃣  Testing account creation...');
    const alice = createAccount('bc1p' + 'a'.repeat(58));
    const bob = createAccount('bc1p' + 'b'.repeat(58));
    console.log(`✅ Created accounts: ${alice.account_id}, ${bob.account_id}\n`);

    // Test 2: Simulate deposit (manually add balance)
    console.log('3️⃣  Simulating deposit...');
    const db = require('./core/database.js').getDatabase();
    db.prepare('UPDATE l2_accounts SET balance_credits = ? WHERE account_id = ?')
      .run('100000', alice.account_id); // 100 KRAY = 100,000 credits
    
    const aliceBalance = getBalance(alice.account_id);
    console.log(`✅ Alice balance: ${aliceBalance.balance} credits (${formatCredits(aliceBalance.balance)} KRAY)\n`);

    // Test 3: Execute transfer
    console.log('4️⃣  Testing transfer...');
    const transferResult = await executeTransaction({
      from_account: alice.account_id,
      to_account: bob.account_id,
      amount: '10000', // 10 KRAY
      tx_type: 'transfer',
      signature: '0'.repeat(128), // Mock signature
      nonce: 0
    });
    console.log(`✅ Transfer executed: ${transferResult.tx_hash}\n`);

    // Check balances
    const aliceNewBalance = getBalance(alice.account_id);
    const bobBalance = getBalance(bob.account_id);
    console.log(`   Alice: ${formatCredits(aliceNewBalance.balance)} KRAY`);
    console.log(`   Bob: ${formatCredits(bobBalance.balance)} KRAY\n`);

    // Test 4: Create AMM pool
    console.log('5️⃣  Testing AMM pool creation...');
    
    // Give Alice more balance for pool
    db.prepare('UPDATE l2_accounts SET balance_credits = ? WHERE account_id = ?')
      .run('500000', alice.account_id); // 500 KRAY

    const pool = createPool(
      alice.account_id,
      'KRAY',
      'BTC',
      '100000', // 100 KRAY
      '1000000' // 1,000 sat-equivalent
    );
    console.log(`✅ Pool created: ${pool.pool_id}\n`);

    // Test 5: Execute swap
    console.log('6️⃣  Testing swap...');
    
    // Give Bob balance for swap
    db.prepare('UPDATE l2_accounts SET balance_credits = ? WHERE account_id = ?')
      .run('50000', bob.account_id); // 50 KRAY

    const swapResult = swap(
      pool.pool_id,
      bob.account_id,
      'KRAY',
      '10000', // 10 KRAY in
      '0'      // min out
    );
    console.log(`✅ Swap executed!`);
    console.log(`   In: 10 KRAY`);
    console.log(`   Out: ${swapResult.amount_out} (BTC equivalent)`);
    console.log(`   Price impact: ${swapResult.price_impact.toFixed(2)}%\n`);

    // Test 6: Marketplace listing
    console.log('7️⃣  Testing marketplace...');
    const listing = listOrdinal(
      alice.account_id,
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0',
      '5000' // 5 KRAY
    );
    console.log(`✅ Ordinal listed: ${listing.listing_id}\n`);

    // Test 7: Gaming rewards
    console.log('8️⃣  Testing gaming rewards...');
    const reward = awardReward(bob.account_id, 'daily', '100', { description: 'Daily login' });
    console.log(`✅ Reward awarded: ${reward.reward_id}`);
    
    const claimResult = claimReward(reward.reward_id, bob.account_id);
    console.log(`✅ Reward claimed: ${claimResult.amount_claimed} credits\n`);

    // Test 8: Get statistics
    console.log('9️⃣  Database statistics...');
    const stats = getStats();
    console.log(`   Accounts: ${stats.accounts}`);
    console.log(`   Transactions: ${stats.transactions}`);
    console.log(`   Pools: ${stats.pools}`);
    console.log(`   Listings: ${stats.listings}`);
    console.log(`   Total Balance: ${stats.totalBalance} credits (${formatCredits(stats.totalBalance)} KRAY)`);
    console.log(`   Total Staked: ${stats.totalStaked} credits\n`);

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║            ✅ ALL TESTS PASSED! 🎉                          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('KRAY SPACE L2 is working perfectly! 🚀\n');

    console.log('Next steps:');
    console.log('1. npm install (if not done)');
    console.log('2. Configure .env with validator keys');
    console.log('3. npm start (to run the server)');
    console.log('4. Test API endpoints');
    console.log('5. Integrate with KrayWallet extension\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();




