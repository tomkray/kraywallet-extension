/**
 * KRAY SPACE L2 - Signature Verification
 * 
 * REAL Schnorr signature verification for L2 transactions
 */

import * as ecc from '@bitcoinerlab/secp256k1';
import crypto from 'crypto';
import { getDatabase } from '../core/database.js';

/**
 * Verify Schnorr signature for L2 transaction
 * 
 * FIXED: Now does REAL cryptographic verification
 */
export function verifyTransactionSignature(txData, l1Address) {
  const { signature, from_account, to_account, amount, nonce, tx_type } = txData;

  console.log('\n🔐 Verifying transaction signature...');
  console.log(`   From: ${from_account}`);
  console.log(`   Nonce: ${nonce}`);

  // Create message to verify (deterministic)
  const message = [
    from_account,
    to_account || '',
    amount.toString(),
    nonce.toString(),
    tx_type
  ].join(':');

  const messageHash = crypto.createHash('sha256').update(message).digest();

  try {
    // Parse signature (hex string to Buffer)
    const sigBuffer = Buffer.from(signature, 'hex');

    if (sigBuffer.length !== 64) {
      console.error('   ❌ Invalid signature length:', sigBuffer.length);
      return false;
    }

    // Get public key for the account
    const publicKey = getPublicKeyForAccount(from_account, l1Address);

    if (!publicKey) {
      console.error('   ❌ Public key not found for account');
      return false;
    }

    const pubkeyBuffer = Buffer.from(publicKey, 'hex');

    // REAL Schnorr verification
    // X-only pubkey (32 bytes)
    const xOnlyPubkey = pubkeyBuffer.length === 33 
      ? pubkeyBuffer.slice(1, 33) 
      : pubkeyBuffer.slice(0, 32);

    const isValid = ecc.verifySchnorr(messageHash, xOnlyPubkey, sigBuffer);

    if (isValid) {
      console.log('   ✅ Signature verified successfully');
    } else {
      console.error('   ❌ Invalid signature');
    }

    return isValid;

  } catch (error) {
    console.error('   ❌ Signature verification failed:', error.message);
    return false;
  }
}

/**
 * Get public key for account
 * 
 * FIXED: Now retrieves pubkey from database
 */
function getPublicKeyForAccount(accountId, l1Address) {
  const db = getDatabase();
  
  const account = db.prepare(`
    SELECT pubkey FROM l2_accounts WHERE account_id = ?
  `).get(accountId);

  if (!account) {
    console.error('   ❌ Account not found');
    return null;
  }

  if (!account.pubkey) {
    console.error('   ❌ Public key not set for account');
    console.error('   💡 Hint: Provide pubkey when creating account or in first transaction');
    return null;
  }

  return account.pubkey;
}

/**
 * Store public key for account
 * 
 * Should be called when creating account or on first transaction
 */
export function storePublicKey(accountId, publicKey) {
  const db = getDatabase();

  console.log(`💾 Storing public key for ${accountId}...`);

  try {
    db.prepare(`
      UPDATE l2_accounts
      SET pubkey = ?
      WHERE account_id = ?
    `).run(publicKey, accountId);

    console.log('✅ Public key stored');
  } catch (error) {
    // Column might not exist yet
    console.warn('⚠️  Could not store pubkey (column might not exist)');
  }
}

/**
 * Recover public key from signature (Schnorr doesn't support this directly)
 * 
 * For Schnorr, we need the pubkey to be provided with the signature
 */
export function extractPubkeyFromSignature(signature, message) {
  // Schnorr signatures don't allow pubkey recovery like ECDSA
  // User must provide pubkey with signature
  throw new Error('Schnorr signatures require pubkey to be provided');
}

export default {
  verifyTransactionSignature,
  storePublicKey
};

