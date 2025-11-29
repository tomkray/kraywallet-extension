/**
 * KRAY SPACE L2 - PSBT Bridge
 * 
 * Manages Bitcoin L1 ↔ L2 bridge using PSBT multisig
 * 
 * Security Model:
 * - 2-of-3 Taproot multisig
 * - 6 block confirmations for deposits
 * - 24 hour challenge period for withdrawals
 * - Fraud proof system
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import { ECPairFactory } from 'ecpair';
import { getDatabase, transaction } from '../core/database.js';
import { BRIDGE, TOKEN, STATUS, NETWORK } from '../core/constants.js';
import { generateAccountId, createAccount, getAccount, updateBalance } from '../state/accountManager.js';
import crypto from 'crypto';

// Initialize Bitcoin libraries
bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// Bitcoin network configuration
const BITCOIN_NETWORK = NETWORK.BITCOIN_NETWORK === 'mainnet' 
  ? bitcoin.networks.bitcoin 
  : bitcoin.networks.testnet;

/**
 * Generate Taproot multisig address (2-of-3)
 * 
 * FIXED: Now creates TRUE 2-of-3 Tapscript multisig
 */
export async function generateMultisigAddress(pubkeys) {
  // Import the REAL multisig implementation (ES module style)
  const { createTaprootMultisig } = await import('./taprootMultisig.js');
  
  console.log('\n🔐 Generating TRUE 2-of-3 Taproot multisig...');
  
  const multisigData = createTaprootMultisig(pubkeys);
  
  console.log('✅ TRUE multisig address generated:', multisigData.address);
  console.log('   Type: Tapscript 2-of-3 threshold');
  
  return multisigData;
}

/**
 * Initialize deposit listener
 * 
 * Monitors Bitcoin blockchain for deposits to the multisig address
 */
export async function startDepositListener(multisigAddress, quicknodeEndpoint) {
  console.log('\n👀 Starting deposit listener...');
  console.log(`   Watching address: ${multisigAddress}`);

  // This would integrate with QuickNode to listen for new transactions
  // For now, we'll provide the structure
  
  const checkInterval = 60000; // Check every minute

  const checkDeposits = async () => {
    try {
      // Query QuickNode for UTXOs at the multisig address
      const utxos = await fetchUTXOs(multisigAddress, quicknodeEndpoint);

      for (const utxo of utxos) {
        await processDeposit(utxo, multisigAddress);
      }
    } catch (error) {
      console.error('❌ Error checking deposits:', error.message);
    }
  };

  // Initial check
  await checkDeposits();

  // Set up interval
  const intervalId = setInterval(checkDeposits, checkInterval);

  console.log('✅ Deposit listener started');

  return {
    stop: () => {
      clearInterval(intervalId);
      console.log('🛑 Deposit listener stopped');
    }
  };
}

/**
 * Fetch UTXOs from QuickNode
 * 
 * FIXED: Now uses real Bitcoin RPC
 */
async function fetchUTXOs(address, endpoint) {
  // Import real Bitcoin RPC
  const { getUTXOs } = await import('./bitcoinRpc.js');
  
  return await getUTXOs(address);
}

/**
 * Process a deposit transaction
 */
export async function processDeposit(utxo, multisigAddress) {
  const { txid, vout, amount, confirmations } = utxo;

  console.log(`\n📥 Processing deposit...`);
  console.log(`   TXID: ${txid}`);
  console.log(`   Vout: ${vout}`);
  console.log(`   Amount: ${amount} BTC`);
  console.log(`   Confirmations: ${confirmations}`);

  // SECURITY: Verify UTXO is still unspent (double-spend protection)
  const { isUTXOUnspent } = await import('./bitcoinRpc.js');
  const unspent = await isUTXOUnspent(txid, vout);

  if (!unspent) {
    console.log('   ⚠️  UTXO already spent - potential double-spend attempt!');
    return null;
  }

  // CRITICAL: Check if deposit already processed (MUST prevent duplicates!)
  const db = getDatabase();
  const existing = db.prepare(`
    SELECT deposit_id, status FROM l2_deposits 
    WHERE l1_txid = ? AND l1_vout = ?
  `).get(txid, vout);

  if (existing) {
    console.log(`   ℹ️  Deposit already exists: ${existing.deposit_id}`);
    console.log(`   Status: ${existing.status}`);
    
    // If already claimed, STOP! Don't process again!
    if (existing.status === 'claimed') {
      console.log(`   ✅ Already claimed - skipping to prevent duplicate credits!`);
      return existing.deposit_id; // RETURN EARLY!
    }

    // Only update confirmations if still pending
    db.prepare(`
      UPDATE l2_deposits 
      SET confirmations = ?,
          status = CASE 
            WHEN confirmations >= ? THEN 'confirming'
            ELSE status 
          END
      WHERE l1_txid = ? AND l1_vout = ?
    `).run(confirmations, BRIDGE.DEPOSIT_CONFIRMATIONS, txid, vout);

    // Check if ready to claim (only if not already claimed!)
    if (confirmations >= BRIDGE.DEPOSIT_CONFIRMATIONS && existing.status !== 'claimed') {
      const deposit = db.prepare(`
        SELECT * FROM l2_deposits WHERE l1_txid = ? AND l1_vout = ?
      `).get(txid, vout);

      if (deposit.status === 'confirming') {
        await claimDeposit(deposit.deposit_id);
      }
    }

    return existing.deposit_id; // Already processed
  }

  // Extract tokens from UTXO (supports multi-token)
  const tokens = await extractTokensFromUTXO(txid, vout);

  if (!tokens || tokens.length === 0) {
    console.log('   ⚠️  No supported tokens found in UTXO, skipping...');
    return null;
  }
  
  // For now, process only KRAY (first token that is KRAY)
  const krayToken = tokens.find(t => t.symbol === 'KRAY');
  
  if (!krayToken) {
    console.log('   ⚠️  UTXO has tokens but no KRAY, skipping...');
    return null;
  }
  
  const krayAmount = krayToken.amount;

  // CRITICAL: Get sender's address from TX inputs (not multisig!)
  let senderAddress = multisigAddress; // Default fallback
  
  try {
    // Get full transaction to find who sent it
    const { getRawTransaction } = await import('./bitcoinRpc.js');
    const txHex = await getRawTransaction(txid, false);
    
    if (txHex) {
      const tx = bitcoin.Transaction.fromHex(txHex);
      
      // Get first input's previous output to find sender
      if (tx.ins && tx.ins.length > 0) {
        const firstInput = tx.ins[0];
        const prevTxid = firstInput.hash.reverse().toString('hex');
        const prevVout = firstInput.index;
        
        // Get previous TX to find sender's address
        const prevTxHex = await getRawTransaction(prevTxid, false);
        
        if (prevTxHex) {
          const prevTx = bitcoin.Transaction.fromHex(prevTxHex);
          const prevOutput = prevTx.outs[prevVout];
          
          // Decode address from scriptPubKey
          if (prevOutput && prevOutput.script) {
            try {
              const payment = bitcoin.payments.p2tr({
                output: prevOutput.script,
                network: BITCOIN_NETWORK
              });
              
              if (payment.address) {
                senderAddress = payment.address;
                console.log(`   ✅ Sender address: ${senderAddress.substring(0, 20)}...`);
              }
            } catch (e) {
              console.warn('   ⚠️  Could not decode sender address, using multisig');
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('   ❌ Error getting sender address:', error.message);
    console.log('   ℹ️  Using multisig address as fallback');
  }

  // Create deposit record with SENDER's address (not multisig!)
  const depositId = `dep_${crypto.randomBytes(16).toString('hex')}`;
  const creditsMinted = krayAmount * krayToken.credits_per_token;

  const timestamp = Date.now();

  db.prepare(`
    INSERT INTO l2_deposits (
      deposit_id, l1_txid, l1_vout, l1_address,
      kray_amount, credits_minted,
      status, confirmations,
      detected_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    depositId,
    txid,
    vout,
    senderAddress, // ✅ Address de quem ENVIOU!
    krayAmount.toString(),
    creditsMinted.toString(),
    confirmations >= BRIDGE.DEPOSIT_CONFIRMATIONS ? 'confirming' : 'pending',
    confirmations,
    timestamp,
    timestamp
  );

  console.log(`✅ Deposit recorded: ${depositId}`);
  console.log(`   KRAY: ${krayAmount}`);
  console.log(`   Credits: ${creditsMinted}`);

  // Auto-claim if enough confirmations
  if (confirmations >= BRIDGE.DEPOSIT_CONFIRMATIONS) {
    await claimDeposit(depositId);
  }

  return depositId;
}

/**
 * Extract ALL supported tokens from UTXO
 * 
 * UPDATED: Multi-token support (KRAY, DOG, DOGSOCIAL, RADIOLA)
 */
async function extractTokensFromUTXO(txid, vout) {
  console.log('   🔍 Decoding Runestone from UTXO...');
  
  try {
    // Import simple inline decoder (works like popup.js!)
    const { decodeRunesFromUTXO } = await import('./simpleRuneDecoder.js');
    const { SUPPORTED_TOKENS, getTokenByEtchingId } = await import('../core/constants.js');
    
    // Decode the transaction
    const utxoRunes = await decodeRunesFromUTXO(txid, vout);
    
    if (!utxoRunes || utxoRunes.length === 0) {
      console.log('   ⚠️  No runes found in UTXO');
      return [];
    }
    const foundTokens = [];
    
    // Check each rune against supported tokens
    for (const rune of utxoRunes) {
      const token = getTokenByEtchingId(rune.rune_id);
      
      if (token) {
        const amount = parseInt(rune.amount);
        foundTokens.push({
          symbol: token.symbol,
          name: token.name,
          amount: amount,
          etching_id: token.etching_id,
          emoji: token.emoji,
          credits_per_token: token.credits_per_token
        });
        
        console.log(`   ✅ Found ${amount} ${token.symbol} ${token.emoji} (${token.name})`);
      } else {
        console.log(`   ⚠️  Rune ${rune.rune_id} not supported (ignored)`);
      }
    }
    
    if (foundTokens.length === 0) {
      console.log('   ⚠️  UTXO contains runes, but NONE are supported');
      console.log('   ℹ️  Supported: KRAY ⚡, DOG 🐕, DOGSOCIAL 🎭, RADIOLA 🎵');
      return [];
    }
    
    console.log(`   ✅ VERIFIED: Found ${foundTokens.length} supported token(s)`);
    
    return foundTokens;
    
  } catch (error) {
    console.error('   ❌ Error decoding Runestone:', error.message);
    return [];
  }
}

/**
 * Claim deposit and mint L2 credits
 */
export async function claimDeposit(depositId) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n✨ Claiming deposit: ${depositId}`);

    const deposit = db.prepare(`
      SELECT * FROM l2_deposits WHERE deposit_id = ?
    `).get(depositId);

    if (!deposit) {
      throw new Error('Deposit not found');
    }

    if (deposit.status === 'claimed') {
      console.log('   ℹ️  Already claimed');
      return deposit;
    }

    if (deposit.confirmations < BRIDGE.DEPOSIT_CONFIRMATIONS) {
      throw new Error(`Insufficient confirmations: ${deposit.confirmations}/${BRIDGE.DEPOSIT_CONFIRMATIONS}`);
    }

    // Get or create L2 account
    let account = getAccount(deposit.l1_address);
    
    if (!account) {
      account = createAccount(deposit.l1_address);
    }

    // Mint credits
    const currentBalance = BigInt(account.balance_credits);
    const creditsToMint = BigInt(deposit.credits_minted);
    const newBalance = currentBalance + creditsToMint;

    updateBalance(account.account_id, newBalance);

    // Update deposit status
    const timestamp = Date.now();

    db.prepare(`
      UPDATE l2_deposits
      SET status = 'claimed',
          l2_account_id = ?,
          claimed_at = ?
      WHERE deposit_id = ?
    `).run(account.account_id, timestamp, depositId);

    console.log(`✅ Deposit claimed successfully`);
    console.log(`   Account: ${account.account_id}`);
    console.log(`   Credits minted: ${creditsToMint}`);
    console.log(`   New balance: ${newBalance}`);

    // Log audit event
    db.prepare(`
      INSERT INTO l2_audit_log (event_type, event_data, account_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'deposit',
      JSON.stringify({
        deposit_id: depositId,
        l1_txid: deposit.l1_txid,
        kray_amount: deposit.kray_amount,
        credits_minted: deposit.credits_minted
      }),
      account.account_id,
      timestamp
    );

    return {
      deposit,
      account,
      credits_minted: creditsToMint,
      new_balance: newBalance
    };
  });
}

/**
 * Request withdrawal (L2 → L1)
 */
export async function requestWithdrawal(accountId, creditsAmount, l1Address) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n📤 Requesting withdrawal...`);
    console.log(`   Account: ${accountId}`);
    console.log(`   Credits: ${creditsAmount}`);
    console.log(`   L1 Address: ${l1Address}`);

    const account = getAccount(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    const balance = BigInt(account.balance_credits);
    const withdrawalAmount = BigInt(creditsAmount);

    if (balance < withdrawalAmount) {
      throw new Error(`Insufficient balance: ${balance} < ${withdrawalAmount}`);
    }

    // Calculate KRAY amount (floor division)
    const krayAmount = Number(withdrawalAmount) / TOKEN.CREDITS_PER_KRAY;
    const krayAmountFloor = Math.floor(krayAmount);

    if (krayAmountFloor < TOKEN.MIN_WITHDRAWAL) {
      throw new Error(`Minimum withdrawal: ${TOKEN.MIN_WITHDRAWAL} KRAY`);
    }

    // Burn credits
    const newBalance = balance - withdrawalAmount;
    updateBalance(accountId, newBalance);

    // Create withdrawal record
    const withdrawalId = `wdw_${crypto.randomBytes(16).toString('hex')}`;
    const timestamp = Date.now();
    const challengeDeadline = timestamp + (BRIDGE.WITHDRAWAL_CHALLENGE_PERIOD * 1000);

    db.prepare(`
      INSERT INTO l2_withdrawals (
        withdrawal_id, l2_account_id,
        credits_burned, kray_amount, l1_address,
        challenge_deadline, challenged,
        status, requested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      withdrawalId,
      accountId,
      withdrawalAmount.toString(),
      krayAmountFloor.toString(),
      l1Address,
      Math.floor(challengeDeadline / 1000),
      0,
      STATUS.WITHDRAWAL_PENDING,
      timestamp
    );

    console.log(`✅ Withdrawal requested: ${withdrawalId}`);
    console.log(`   Challenge deadline: ${new Date(challengeDeadline).toISOString()}`);
    console.log(`   Credits burned: ${withdrawalAmount}`);
    console.log(`   KRAY to receive: ${krayAmountFloor}`);

    // Log audit event
    db.prepare(`
      INSERT INTO l2_audit_log (event_type, event_data, account_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'withdrawal',
      JSON.stringify({
        withdrawal_id: withdrawalId,
        credits_burned: withdrawalAmount.toString(),
        kray_amount: krayAmountFloor.toString(),
        l1_address: l1Address
      }),
      accountId,
      timestamp
    );

    return {
      withdrawal_id: withdrawalId,
      credits_burned: withdrawalAmount,
      kray_amount: krayAmountFloor,
      challenge_deadline: challengeDeadline,
      status: STATUS.WITHDRAWAL_PENDING
    };
  });
}

/**
 * Process pending withdrawals (after challenge period)
 * 
 * FIXED: Now passes multisigData correctly
 */
export async function processPendingWithdrawals(multisigData, signerKeys) {
  const db = getDatabase();

  const currentTime = Math.floor(Date.now() / 1000);

  // Get withdrawals ready to process
  const withdrawals = db.prepare(`
    SELECT * FROM l2_withdrawals
    WHERE status = ?
      AND challenged = 0
      AND challenge_deadline <= ?
    ORDER BY requested_at ASC
    LIMIT 10
  `).all(STATUS.WITHDRAWAL_PENDING, currentTime);

  console.log(`\n🔄 Processing ${withdrawals.length} pending withdrawals...`);

  const results = [];

  for (const withdrawal of withdrawals) {
    try {
      const result = await executeWithdrawal(withdrawal, multisigData, signerKeys);
      results.push({ withdrawal_id: withdrawal.withdrawal_id, success: true, result });
    } catch (error) {
      console.error(`❌ Failed to process withdrawal ${withdrawal.withdrawal_id}:`, error.message);
      
      // Mark as failed
      db.prepare(`
        UPDATE l2_withdrawals
        SET status = ?,
            error_message = ?
        WHERE withdrawal_id = ?
      `).run(STATUS.WITHDRAWAL_FAILED, error.message, withdrawal.withdrawal_id);

      results.push({ withdrawal_id: withdrawal.withdrawal_id, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Execute withdrawal by creating and broadcasting PSBT
 * 
 * FIXED: Now uses complete PSBT builder with Runestone
 */
async function executeWithdrawal(withdrawal, multisigData, signerKeys) {
  console.log(`\n🔓 Executing withdrawal: ${withdrawal.withdrawal_id}`);

  // Import complete withdrawal PSBT builder
  const { createWithdrawalPSBT, signWithdrawalPSBT, finalizeWithdrawalPSBT } = 
    await import('./withdrawalPSBT.js');

  // Create PSBT with Runestone
  const psbt = await createWithdrawalPSBT(withdrawal, multisigData);

  // Get signatures
  const signatures = [];
  
  // Sign with 2 of 3 validator keys
  for (let i = 0; i < 2; i++) {
    const key = signerKeys[i];
    // Sign and collect signature
    // Actual signing happens in signWithdrawalPSBT
    signatures.push(Buffer.alloc(64)); // Placeholder for signature buffer
  }

  // Sign PSBT
  const signedPSBT = await signWithdrawalPSBT(psbt, signerKeys.slice(0, 2), multisigData);

  // Finalize PSBT
  const tx = finalizeWithdrawalPSBT(signedPSBT, signatures, multisigData);

  // Broadcast to Bitcoin network
  const txid = await broadcastTransaction(tx);

  // Update withdrawal record
  const db = getDatabase();
  const timestamp = Date.now();

  db.prepare(`
    UPDATE l2_withdrawals
    SET status = ?,
        l1_txid = ?,
        l1_vout = 0,
        completed_at = ?
    WHERE withdrawal_id = ?
  `).run(STATUS.WITHDRAWAL_COMPLETED, txid, timestamp, withdrawal.withdrawal_id);

  console.log(`✅ Withdrawal executed successfully`);
  console.log(`   TXID: ${txid}`);

  return { txid, timestamp };
}

// Withdrawal PSBT functions moved to withdrawalPSBT.js
// Now using complete implementation with Runestone support!

/**
 * Broadcast transaction to Bitcoin network
 * 
 * FIXED: Now broadcasts to real Bitcoin network via QuickNode
 */
async function broadcastTransaction(tx) {
  console.log('   📡 Broadcasting transaction to Bitcoin...');
  
  const txHex = tx.toHex();
  
  // Import real broadcast function
  const { broadcastTransaction: broadcast } = await import('./bitcoinRpc.js');
  
  const txid = await broadcast(txHex);
  
  return txid;
}

/**
 * Get deposit status
 */
export function getDepositStatus(depositId) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_deposits WHERE deposit_id = ?
  `).get(depositId);
}

/**
 * Get withdrawal status
 */
export function getWithdrawalStatus(withdrawalId) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_withdrawals WHERE withdrawal_id = ?
  `).get(withdrawalId);
}

export default {
  generateMultisigAddress,
  startDepositListener,
  processDeposit,
  claimDeposit,
  requestWithdrawal,
  processPendingWithdrawals,
  getDepositStatus,
  getWithdrawalStatus
};

