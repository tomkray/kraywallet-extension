/**
 * KRAY SPACE L2 - Account Manager
 * 
 * Manages L2 accounts, balances, and nonces
 */

import { getDatabase, transaction } from '../core/database.js';
import { isValidAddress, isValidKrayAddress, TOKEN } from '../core/constants.js';
import crypto from 'crypto';

/**
 * Generate L2 account ID from L1 address
 */
export function generateAccountId(l1Address) {
  // Create deterministic account ID from L1 address
  const hash = crypto.createHash('sha256').update(l1Address).digest('hex');
  return `kray_${hash.substring(0, 32)}`;
}

/**
 * Create new L2 account
 * 
 * UPDATED: Now accepts optional pubkey for signature verification
 */
export function createAccount(l1Address, publicKey = null) {
  if (!isValidAddress(l1Address)) {
    throw new Error('Invalid L1 address format');
  }

  const accountId = generateAccountId(l1Address);
  const timestamp = Date.now();

  console.log(`\n👤 Creating L2 account...`);
  console.log(`   L1 Address: ${l1Address}`);
  console.log(`   Account ID: ${accountId}`);
  if (publicKey) {
    console.log(`   Public Key: ${publicKey.substring(0, 16)}...`);
  }

  const db = getDatabase();

  // Check if account already exists
  const existing = db.prepare(`
    SELECT account_id FROM l2_accounts WHERE l1_address = ?
  `).get(l1Address);

  if (existing) {
    console.log(`   ℹ️  Account already exists`);
    return getAccount(accountId);
  }

  // Create account
  const stmt = db.prepare(`
    INSERT INTO l2_accounts (
      account_id, l1_address, pubkey,
      balance_credits, staked_credits, locked_credits,
      nonce, created_at, updated_at, last_activity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    accountId,
    l1Address,
    publicKey,  // Store pubkey for signature verification
    '0',  // initial balance
    '0',  // initial staked
    '0',  // initial locked
    0,    // initial nonce
    timestamp,
    timestamp,
    timestamp
  );

  // Log audit event
  logAuditEvent('account_created', {
    account_id: accountId,
    l1_address: l1Address
  }, accountId);

  console.log(`✅ Account created successfully`);

  return getAccount(accountId);
}

/**
 * Get account by ID or L1 address
 */
export function getAccount(accountIdOrAddress) {
  const db = getDatabase();

  let account;

  if (isValidKrayAddress(accountIdOrAddress)) {
    // Query by account ID
    account = db.prepare(`
      SELECT * FROM l2_accounts WHERE account_id = ?
    `).get(accountIdOrAddress);
  } else if (isValidAddress(accountIdOrAddress)) {
    // Query by L1 address
    account = db.prepare(`
      SELECT * FROM l2_accounts WHERE l1_address = ?
    `).get(accountIdOrAddress);
  } else {
    throw new Error('Invalid account identifier');
  }

  return account || null;
}

/**
 * Get account balance
 */
export function getBalance(accountId) {
  const account = getAccount(accountId);

  if (!account) {
    throw new Error('Account not found');
  }

  return {
    account_id: account.account_id,
    balance: BigInt(account.balance_credits),
    staked: BigInt(account.staked_credits),
    locked: BigInt(account.locked_credits),
    total: BigInt(account.balance_credits) + BigInt(account.staked_credits) + BigInt(account.locked_credits),
    nonce: account.nonce
  };
}

/**
 * Update account balance
 */
export function updateBalance(accountId, newBalance) {
  const db = getDatabase();
  const timestamp = Date.now();

  if (newBalance < 0n) {
    throw new Error('Balance cannot be negative');
  }

  console.log(`\n💰 Updating balance...`);
  console.log(`   Account: ${accountId}`);
  console.log(`   New Balance: ${newBalance.toString()} credits`);

  const stmt = db.prepare(`
    UPDATE l2_accounts
    SET balance_credits = ?,
        updated_at = ?,
        last_activity = ?
    WHERE account_id = ?
  `);

  stmt.run(
    newBalance.toString(),
    timestamp,
    timestamp,
    accountId
  );

  console.log(`✅ Balance updated`);
}

/**
 * Transfer credits between accounts
 */
export function transfer(fromAccountId, toAccountId, amount) {
  if (amount <= 0n) {
    throw new Error('Transfer amount must be positive');
  }

  return transaction(() => {
    console.log(`\n💸 Processing transfer...`);
    console.log(`   From: ${fromAccountId}`);
    console.log(`   To: ${toAccountId}`);
    console.log(`   Amount: ${amount.toString()} credits`);

    // Get current balances
    const fromAccount = getAccount(fromAccountId);
    const toAccount = getAccount(toAccountId);

    if (!fromAccount) {
      throw new Error('Sender account not found');
    }

    if (!toAccount) {
      throw new Error('Recipient account not found');
    }

    const fromBalance = BigInt(fromAccount.balance_credits);
    const toBalance = BigInt(toAccount.balance_credits);

    // Check sufficient balance
    if (fromBalance < amount) {
      throw new Error(`Insufficient balance. Have: ${fromBalance}, Need: ${amount}`);
    }

    // Update balances
    const newFromBalance = fromBalance - amount;
    const newToBalance = toBalance + amount;

    updateBalance(fromAccountId, newFromBalance);
    updateBalance(toAccountId, newToBalance);

    console.log(`✅ Transfer completed`);

    return {
      from: { account_id: fromAccountId, new_balance: newFromBalance },
      to: { account_id: toAccountId, new_balance: newToBalance }
    };
  });
}

/**
 * Increment nonce
 */
export function incrementNonce(accountId) {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE l2_accounts
    SET nonce = nonce + 1,
        updated_at = ?
    WHERE account_id = ?
  `);

  stmt.run(Date.now(), accountId);
}

/**
 * Get current nonce
 */
export function getNonce(accountId) {
  const account = getAccount(accountId);

  if (!account) {
    throw new Error('Account not found');
  }

  return account.nonce;
}

/**
 * Stake credits
 */
export function stake(accountId, amount) {
  if (amount <= 0n) {
    throw new Error('Stake amount must be positive');
  }

  return transaction(() => {
    const db = getDatabase();
    const timestamp = Date.now();

    console.log(`\n🔒 Staking credits...`);
    console.log(`   Account: ${accountId}`);
    console.log(`   Amount: ${amount.toString()} credits`);

    const account = getAccount(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    const balance = BigInt(account.balance_credits);
    const staked = BigInt(account.staked_credits);

    if (balance < amount) {
      throw new Error('Insufficient balance to stake');
    }

    const newBalance = balance - amount;
    const newStaked = staked + amount;

    const stmt = db.prepare(`
      UPDATE l2_accounts
      SET balance_credits = ?,
          staked_credits = ?,
          updated_at = ?,
          last_activity = ?
      WHERE account_id = ?
    `);

    stmt.run(
      newBalance.toString(),
      newStaked.toString(),
      timestamp,
      timestamp,
      accountId
    );

    console.log(`✅ Staked successfully`);

    return {
      account_id: accountId,
      new_balance: newBalance,
      new_staked: newStaked
    };
  });
}

/**
 * Unstake credits
 */
export function unstake(accountId, amount) {
  if (amount <= 0n) {
    throw new Error('Unstake amount must be positive');
  }

  return transaction(() => {
    const db = getDatabase();
    const timestamp = Date.now();

    console.log(`\n🔓 Unstaking credits...`);
    console.log(`   Account: ${accountId}`);
    console.log(`   Amount: ${amount.toString()} credits`);

    const account = getAccount(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    const balance = BigInt(account.balance_credits);
    const staked = BigInt(account.staked_credits);

    if (staked < amount) {
      throw new Error('Insufficient staked amount');
    }

    const newBalance = balance + amount;
    const newStaked = staked - amount;

    const stmt = db.prepare(`
      UPDATE l2_accounts
      SET balance_credits = ?,
          staked_credits = ?,
          updated_at = ?,
          last_activity = ?
      WHERE account_id = ?
    `);

    stmt.run(
      newBalance.toString(),
      newStaked.toString(),
      timestamp,
      timestamp,
      accountId
    );

    console.log(`✅ Unstaked successfully`);

    return {
      account_id: accountId,
      new_balance: newBalance,
      new_staked: newStaked
    };
  });
}

/**
 * List all accounts (paginated)
 */
export function listAccounts(limit = 50, offset = 0) {
  const db = getDatabase();

  const accounts = db.prepare(`
    SELECT * FROM l2_accounts
    ORDER BY balance_credits DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  return accounts;
}

/**
 * Get account statistics
 */
export function getAccountStats(accountId) {
  const db = getDatabase();

  const stats = {
    account: getAccount(accountId),
    
    totalTransactions: db.prepare(`
      SELECT COUNT(*) as count FROM l2_transactions
      WHERE from_account = ? OR to_account = ?
    `).get(accountId, accountId)?.count || 0,

    sentTransactions: db.prepare(`
      SELECT COUNT(*) as count FROM l2_transactions
      WHERE from_account = ? AND status = 'confirmed'
    `).get(accountId)?.count || 0,

    receivedTransactions: db.prepare(`
      SELECT COUNT(*) as count FROM l2_transactions
      WHERE to_account = ? AND status = 'confirmed'
    `).get(accountId)?.count || 0,

    totalGasSpent: db.prepare(`
      SELECT SUM(CAST(gas_fee_credits AS INTEGER)) as total FROM l2_transactions
      WHERE from_account = ? AND status = 'confirmed'
    `).get(accountId)?.total || 0,

    deposits: db.prepare(`
      SELECT COUNT(*) as count FROM l2_deposits
      WHERE l2_account_id = ?
    `).get(accountId)?.count || 0,

    withdrawals: db.prepare(`
      SELECT COUNT(*) as count FROM l2_withdrawals
      WHERE l2_account_id = ?
    `).get(accountId)?.count || 0
  };

  return stats;
}

/**
 * Log audit event
 */
function logAuditEvent(eventType, eventData, accountId = null, txHash = null) {
  const db = getDatabase();

  db.prepare(`
    INSERT INTO l2_audit_log (event_type, event_data, account_id, tx_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    eventType,
    JSON.stringify(eventData),
    accountId,
    txHash,
    Date.now()
  );
}

export default {
  generateAccountId,
  createAccount,
  getAccount,
  getBalance,
  updateBalance,
  transfer,
  incrementNonce,
  getNonce,
  stake,
  unstake,
  listAccounts,
  getAccountStats
};

