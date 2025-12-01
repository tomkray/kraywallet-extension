/**
 * KRAY SPACE L2 - Key Manager
 * 
 * Manages the 2-of-3 multisig keys for the bridge
 * 
 * SECURITY CRITICAL:
 * - Never expose private keys
 * - Use environment variables
 * - Rotate keys periodically
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import { ECPairFactory } from 'ecpair';
import * as bip39 from 'bip39';
import { NETWORK } from '../core/constants.js';

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const BITCOIN_NETWORK = NETWORK.BITCOIN_NETWORK === 'mainnet' 
  ? bitcoin.networks.bitcoin 
  : bitcoin.networks.testnet;

/**
 * Validator key pair structure
 */
class ValidatorKey {
  constructor(mnemonic, index = 0) {
    this.mnemonic = mnemonic;
    this.index = index;
    this.root = bip32.fromSeed(bip39.mnemonicToSeedSync(mnemonic));
    
    // Derivation path: m/86'/0'/0'/0/{index} (Taproot standard)
    const path = `m/86'/0'/0'/0/${index}`;
    this.node = this.root.derivePath(path);
    this.keyPair = ECPair.fromPrivateKey(this.node.privateKey, { network: BITCOIN_NETWORK });
  }

  getPublicKey() {
    return this.node.publicKey.toString('hex');
  }

  getPrivateKey() {
    return this.keyPair;
  }

  getAddress() {
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: this.node.publicKey.slice(1, 33),
      network: BITCOIN_NETWORK
    });
    return address;
  }
}

/**
 * Bridge Key Manager
 * 
 * Manages the 3 validator keys for the 2-of-3 multisig
 */
export class BridgeKeyManager {
  constructor() {
    this.validators = [];
    this.initialized = false;
  }

  /**
   * Initialize with validator mnemonics from environment
   */
  initialize() {
    if (this.initialized) {
      console.log('   ℹ️  Key manager already initialized');
      return;
    }

    console.log('\n🔑 Initializing bridge key manager...');

    // Load validator mnemonics from environment
    const validator1Mnemonic = process.env.VALIDATOR_1_MNEMONIC;
    const validator2Mnemonic = process.env.VALIDATOR_2_MNEMONIC;
    const validator3Mnemonic = process.env.VALIDATOR_3_MNEMONIC;

    if (!validator1Mnemonic || !validator2Mnemonic || !validator3Mnemonic) {
      console.warn('⚠️  Validator mnemonics not found in environment');
      console.warn('   Generating temporary keys for development...');
      
      // Generate temporary keys for development
      this.validators = [
        new ValidatorKey(bip39.generateMnemonic(), 0),
        new ValidatorKey(bip39.generateMnemonic(), 0),
        new ValidatorKey(bip39.generateMnemonic(), 0)
      ];

      console.log('   ⚠️  DEVELOPMENT MODE: Using temporary keys');
      console.log('   🔐 Validator 1 pubkey:', this.validators[0].getPublicKey().substring(0, 16) + '...');
      console.log('   🔐 Validator 2 pubkey:', this.validators[1].getPublicKey().substring(0, 16) + '...');
      console.log('   🔐 Validator 3 pubkey:', this.validators[2].getPublicKey().substring(0, 16) + '...');
    } else {
      // Production: use environment mnemonics
      this.validators = [
        new ValidatorKey(validator1Mnemonic, 0),
        new ValidatorKey(validator2Mnemonic, 0),
        new ValidatorKey(validator3Mnemonic, 0)
      ];

      console.log('✅ Loaded validator keys from environment');
    }

    this.initialized = true;
    return this.getPublicKeys();
  }

  /**
   * Get public keys for multisig address generation
   */
  getPublicKeys() {
    if (!this.initialized) {
      this.initialize();
    }

    return this.validators.map(v => v.getPublicKey());
  }

  /**
   * Get validator key pairs for signing
   */
  getSigningKeys(indices = [0, 1]) {
    if (!this.initialized) {
      this.initialize();
    }

    return indices.map(i => this.validators[i].getPrivateKey());
  }

  /**
   * Get validator addresses
   */
  getValidatorAddresses() {
    if (!this.initialized) {
      this.initialize();
    }

    return this.validators.map(v => v.getAddress());
  }

  /**
   * Export public keys (safe to share)
   */
  exportPublicKeys() {
    const pubkeys = this.getPublicKeys();
    
    return {
      validator_1: pubkeys[0],
      validator_2: pubkeys[1],
      validator_3: pubkeys[2],
      threshold: '2-of-3',
      network: NETWORK.BITCOIN_NETWORK
    };
  }

  /**
   * Generate new validator key
   */
  static generateValidatorKey() {
    const mnemonic = bip39.generateMnemonic();
    const validator = new ValidatorKey(mnemonic, 0);

    return {
      mnemonic,
      pubkey: validator.getPublicKey(),
      address: validator.getAddress()
    };
  }
}

// Singleton instance
let keyManagerInstance = null;

/**
 * Get key manager instance
 */
export function getKeyManager() {
  if (!keyManagerInstance) {
    keyManagerInstance = new BridgeKeyManager();
    keyManagerInstance.initialize();
  }
  return keyManagerInstance;
}

/**
 * Initialize bridge keys
 */
export function initBridgeKeys() {
  const keyManager = getKeyManager();
  return keyManager.getPublicKeys();
}

export default {
  BridgeKeyManager,
  getKeyManager,
  initBridgeKeys
};





