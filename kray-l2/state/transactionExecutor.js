/**
 * KRAY SPACE L2 - Transaction Executor
 * 
 * Executes and validates L2 transactions
 */

import { getDatabase, transaction } from '../core/database.js';
import { getAccount, updateBalance, incrementNonce, getNonce, transfer } from './accountManager.js';
import { calculateGasFee, distributeGas, isValidAmount, STATUS } from '../core/constants.js';
import { verifyTransactionSignature } from './signatureVerifier.js';
import crypto from 'crypto';
import * as ecc from '@bitcoinerlab/secp256k1';

/**
 * Create and execute L2 transaction
 */
export async function executeTransaction(txData) {
  const {
    from_account,
    to_account,
    amount,
    tx_type = 'transfer',
    data = null,
    signature,
    nonce
  } = txData;

  return transaction(() => {
    console.log(`\n⚡ Executing L2 transaction...`);
    console.log(`   Type: ${tx_type}`);
    console.log(`   From: ${from_account}`);
    console.log(`   To: ${to_account || 'N/A'}`);
    console.log(`   Amount: ${amount} credits`);

    // Validate inputs
    if (!from_account) {
      throw new Error('from_account is required');
    }

    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (!signature) {
      throw new Error('Signature is required');
    }

    // Get from account
    const fromAccount = getAccount(from_account);

    if (!fromAccount) {
      throw new Error('Sender account not found');
    }

    // Verify nonce
    if (nonce !== fromAccount.nonce) {
      throw new Error(`Invalid nonce. Expected: ${fromAccount.nonce}, Got: ${nonce}`);
    }

    // Calculate gas fee
    const gasFee = BigInt(calculateGasFee(tx_type.toUpperCase()));
    const totalAmount = BigInt(amount);
    const totalRequired = totalAmount + gasFee;

    console.log(`   Gas Fee: ${gasFee} credits`);
    console.log(`   Total Required: ${totalRequired} credits`);

    // Check balance
    const balance = BigInt(fromAccount.balance_credits);

    if (balance < totalRequired) {
      throw new Error(`Insufficient balance. Have: ${balance}, Need: ${totalRequired}`);
    }

    // Verify signature (REAL verification now!)
    const isValid = verifyTransactionSignature(txData, fromAccount.l1_address);

    if (!isValid) {
      throw new Error('Invalid signature - cryptographic verification failed');
    }

    // Create transaction hash
    const txHash = createTransactionHash(txData);

    const db = getDatabase();
    const timestamp = Date.now();

    // Execute based on type
    let result;

    if (tx_type === 'transfer') {
      // Simple transfer
      if (!to_account) {
        throw new Error('to_account is required for transfers');
      }

      const toAccount = getAccount(to_account);

      if (!toAccount) {
        throw new Error('Recipient account not found');
      }

      // Deduct from sender (amount + gas)
      const newFromBalance = balance - totalRequired;
      updateBalance(from_account, newFromBalance);

      // Add to recipient (amount only, not gas)
      const toBalance = BigInt(toAccount.balance_credits);
      const newToBalance = toBalance + totalAmount;
      updateBalance(to_account, newToBalance);

      // Distribute gas
      const { burned, validators: validatorShare } = distributeGas(Number(gasFee));
      
      // TODO: Distribute validator share to active validators
      // For now, just burned

      result = {
        from_balance: newFromBalance,
        to_balance: newToBalance,
        gas_burned: burned,
        gas_validators: validatorShare
      };

    } else if (tx_type === 'burn') {
      // Burn tokens (for withdrawals)
      const newBalance = balance - totalRequired;
      updateBalance(from_account, newBalance);

      result = {
        from_balance: newBalance,
        burned: Number(totalAmount)
      };

    } else {
      throw new Error(`Unsupported transaction type: ${tx_type}`);
    }

    // Increment nonce
    incrementNonce(from_account);

    // Record transaction
    db.prepare(`
      INSERT INTO l2_transactions (
        tx_hash, from_account, to_account,
        tx_type, amount_credits, gas_fee_credits,
        nonce, signature, data,
        status, created_at, confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txHash,
      from_account,
      to_account,
      tx_type,
      amount.toString(),
      gasFee.toString(),
      nonce,
      signature,
      data ? JSON.stringify(data) : null,
      STATUS.TX_CONFIRMED, // Instant confirmation on L2!
      timestamp,
      timestamp
    );

    console.log(`✅ Transaction executed: ${txHash}`);
    console.log(`   Status: Confirmed (instant)`);
    console.log(`   New nonce: ${nonce + 1}`);

    // Log audit
    db.prepare(`
      INSERT INTO l2_audit_log (event_type, event_data, account_id, tx_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'transfer',
      JSON.stringify({ tx_type, amount, gas_fee: gasFee.toString() }),
      from_account,
      txHash,
      timestamp
    );

    return {
      tx_hash: txHash,
      status: STATUS.TX_CONFIRMED,
      from_account,
      to_account,
      amount: totalAmount.toString(),
      gas_fee: gasFee.toString(),
      nonce: nonce + 1,
      confirmed_at: timestamp,
      result
    };
  });
}

/**
 * Create transaction hash
 */
function createTransactionHash(txData) {
  const { from_account, to_account, amount, nonce, tx_type } = txData;
  
  const data = [
    from_account,
    to_account || '',
    amount.toString(),
    nonce.toString(),
    tx_type,
    Date.now().toString()
  ].join(':');

  return crypto.createHash('sha256').update(data).digest('hex');
}

// Signature verification moved to signatureVerifier.js
// Now uses REAL Schnorr verification!

/**
 * Get transaction by hash
 */
export function getTransaction(txHash) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_transactions WHERE tx_hash = ?
  `).get(txHash);
}

/**
 * Get transactions for account
 */
export function getAccountTransactions(accountId, limit = 50, offset = 0) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_transactions
    WHERE from_account = ? OR to_account = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(accountId, accountId, limit, offset);
}

/**
 * Get pending transactions
 */
export function getPendingTransactions(limit = 100) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_transactions
    WHERE status = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(STATUS.TX_PENDING, limit);
}

/**
 * Batch execute multiple transactions
 */
export async function executeBatch(transactions) {
  console.log(`\n📦 Executing batch of ${transactions.length} transactions...`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const tx of transactions) {
    try {
      const result = await executeTransaction(tx);
      results.push({ success: true, tx_hash: result.tx_hash, result });
      successCount++;
    } catch (error) {
      console.error(`❌ Transaction failed:`, error.message);
      results.push({ success: false, error: error.message, tx_data: tx });
      failCount++;
    }
  }

  console.log(`✅ Batch executed: ${successCount} success, ${failCount} failed`);

  return {
    total: transactions.length,
    success: successCount,
    failed: failCount,
    results
  };
}

/**
 * Get transaction statistics
 */
export function getTransactionStats() {
  const db = getDatabase();

  return {
    total: db.prepare('SELECT COUNT(*) as count FROM l2_transactions').get()?.count || 0,
    
    confirmed: db.prepare(`
      SELECT COUNT(*) as count FROM l2_transactions WHERE status = ?
    `).get(STATUS.TX_CONFIRMED)?.count || 0,

    pending: db.prepare(`
      SELECT COUNT(*) as count FROM l2_transactions WHERE status = ?
    `).get(STATUS.TX_PENDING)?.count || 0,

    failed: db.prepare(`
      SELECT COUNT(*) as count FROM l2_transactions WHERE status = ?
    `).get(STATUS.TX_FAILED)?.count || 0,

    totalGasCollected: db.prepare(`
      SELECT SUM(CAST(gas_fee_credits AS INTEGER)) as total 
      FROM l2_transactions 
      WHERE status = ?
    `).get(STATUS.TX_CONFIRMED)?.total || 0,

    byType: db.prepare(`
      SELECT tx_type, COUNT(*) as count 
      FROM l2_transactions 
      WHERE status = ?
      GROUP BY tx_type
    `).all(STATUS.TX_CONFIRMED)
  };
}

export default {
  executeTransaction,
  executeBatch,
  getTransaction,
  getAccountTransactions,
  getPendingTransactions,
  getTransactionStats
};

