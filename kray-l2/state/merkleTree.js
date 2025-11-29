/**
 * KRAY SPACE L2 - Merkle Tree
 * 
 * Merkle tree for state commitments and fraud proofs
 */

import crypto from 'crypto';

/**
 * Hash function for Merkle tree
 */
function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Merkle Tree implementation
 */
export class MerkleTree {
  constructor(leaves = []) {
    this.leaves = leaves.map(leaf => typeof leaf === 'string' ? leaf : hash(JSON.stringify(leaf)));
    this.tree = this.buildTree();
  }

  /**
   * Build Merkle tree from leaves
   */
  buildTree() {
    if (this.leaves.length === 0) {
      return [hash('')]; // Empty tree hash
    }

    let currentLevel = this.leaves.slice();
    const tree = [currentLevel];

    while (currentLevel.length > 1) {
      const nextLevel = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        
        const combined = hash(left + right);
        nextLevel.push(combined);
      }

      tree.push(nextLevel);
      currentLevel = nextLevel;
    }

    return tree;
  }

  /**
   * Get Merkle root
   */
  getRoot() {
    if (this.tree.length === 0) {
      return hash('');
    }
    return this.tree[this.tree.length - 1][0];
  }

  /**
   * Get Merkle proof for a leaf
   */
  getProof(leafIndex) {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error('Invalid leaf index');
    }

    const proof = [];
    let index = leafIndex;

    for (let level = 0; level < this.tree.length - 1; level++) {
      const currentLevel = this.tree[level];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < currentLevel.length) {
        proof.push({
          hash: currentLevel[siblingIndex],
          position: isRightNode ? 'left' : 'right'
        });
      }

      index = Math.floor(index / 2);
    }

    return proof;
  }

  /**
   * Verify Merkle proof
   */
  static verifyProof(leaf, proof, root) {
    let computedHash = typeof leaf === 'string' ? leaf : hash(JSON.stringify(leaf));

    for (const { hash: siblingHash, position } of proof) {
      if (position === 'left') {
        computedHash = hash(siblingHash + computedHash);
      } else {
        computedHash = hash(computedHash + siblingHash);
      }
    }

    return computedHash === root;
  }

  /**
   * Get tree depth
   */
  getDepth() {
    return this.tree.length;
  }

  /**
   * Get total leaves
   */
  getLeafCount() {
    return this.leaves.length;
  }
}

/**
 * Create state commitment (Merkle root of all accounts)
 */
export function createStateCommitment(accounts) {
  console.log(`\n🌳 Creating state commitment for ${accounts.length} accounts...`);

  // Create leaves from account states
  const leaves = accounts.map(account => {
    const state = {
      account_id: account.account_id,
      balance: account.balance_credits,
      staked: account.staked_credits,
      nonce: account.nonce
    };
    return hash(JSON.stringify(state));
  });

  const tree = new MerkleTree(leaves);
  const root = tree.getRoot();

  console.log(`✅ State root: ${root}`);
  console.log(`   Accounts: ${accounts.length}`);
  console.log(`   Tree depth: ${tree.getDepth()}`);

  return {
    root,
    tree,
    account_count: accounts.length,
    timestamp: Date.now()
  };
}

/**
 * Generate fraud proof
 * 
 * Proves that a state transition was invalid
 */
export function generateFraudProof(prevState, transaction, newState) {
  console.log('\n🚨 Generating fraud proof...');

  // Create Merkle trees for before and after states
  const prevTree = new MerkleTree([prevState]);
  const newTree = new MerkleTree([newState]);

  // Transaction should produce valid state transition
  const expectedState = simulateTransaction(prevState, transaction);

  // Compare expected vs actual
  const isValid = JSON.stringify(expectedState) === JSON.stringify(newState);

  if (isValid) {
    console.log('✅ State transition is valid - no fraud');
    return null;
  }

  console.log('❌ FRAUD DETECTED!');

  const proof = {
    prev_state: prevState,
    transaction,
    expected_state: expectedState,
    actual_state: newState,
    prev_root: prevTree.getRoot(),
    new_root: newTree.getRoot(),
    fraud_type: 'invalid_state_transition',
    timestamp: Date.now()
  };

  return proof;
}

/**
 * Simulate transaction execution (for fraud proof)
 */
function simulateTransaction(accountState, transaction) {
  const { amount, gas_fee } = transaction;
  
  const balance = BigInt(accountState.balance);
  const txAmount = BigInt(amount);
  const gasFee = BigInt(gas_fee);

  // Simulate deduction
  const newBalance = balance - txAmount - gasFee;

  return {
    ...accountState,
    balance: newBalance.toString(),
    nonce: accountState.nonce + 1
  };
}

/**
 * Verify fraud proof
 */
export function verifyFraudProof(proof) {
  console.log('\n🔍 Verifying fraud proof...');

  const { prev_state, transaction, expected_state, actual_state } = proof;

  // Re-simulate transaction
  const recomputedState = simulateTransaction(prev_state, transaction);

  // Compare with expected
  const isValidProof = JSON.stringify(recomputedState) === JSON.stringify(expected_state);

  // Check if actual state differs
  const isFraud = JSON.stringify(expected_state) !== JSON.stringify(actual_state);

  console.log(`   Valid proof: ${isValidProof}`);
  console.log(`   Fraud detected: ${isFraud}`);

  return {
    valid: isValidProof,
    fraud: isFraud
  };
}

export default {
  MerkleTree,
  createStateCommitment,
  generateFraudProof,
  verifyFraudProof
};

