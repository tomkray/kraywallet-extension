/**
 * KRAY SPACE L2 - Constants
 * 
 * Core constants for the L2 network
 */

// Supported Tokens on KRAY SPACE L2
export const SUPPORTED_TOKENS = {
  'KRAY': {
    name: 'KRAY•SPACE',
    symbol: 'KRAY',
    etching_id: '4aae35965730540004765070df639d0dd0485ec5d33a7181facac970e9225449',
    rune_id_short: '925516:1550', // Block:tx format (from Runestone decoder)
    decimals_l1: 0,
    decimals_l2: 3,
    credits_per_token: 1000,
    min_deposit: 1,
    min_withdrawal: 1,
    is_gas_token: true,
    emoji: '⚡'
  },
  'DOG': {
    name: 'DOG•GO•TO•THE•MOON',
    symbol: 'DOG',
    etching_id: 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375',
    decimals_l1: 0,
    decimals_l2: 5,
    credits_per_token: 100000,
    min_deposit: 1,
    min_withdrawal: 1,
    is_gas_token: false,
    emoji: '🐕'
  },
  'DOGSOCIAL': {
    name: 'DOG•SOCIAL•CLUB',
    symbol: 'DOGSOCIAL',
    etching_id: '8a18494da6e0d1902243220c397cdecf4de9d64020cf0fa9fa16adfc6e29e4ec',
    decimals_l1: 0,
    decimals_l2: 5,
    credits_per_token: 100000,
    min_deposit: 1,
    min_withdrawal: 1,
    is_gas_token: false,
    emoji: '🎭'
  },
  'RADIOLA': {
    name: 'RADIOLA•MUSIC',
    symbol: 'RADIOLA',
    etching_id: '046e7799f87248b24e60672c11d2e09d8a85b3cd562f1ab6e48fc8b8278afaad',
    decimals_l1: 0,
    decimals_l2: 5,
    credits_per_token: 100000,
    min_deposit: 1,
    min_withdrawal: 1,
    is_gas_token: false,
    emoji: '🎵'
  }
};

// Primary token (for gas and main operations)
export const TOKEN = SUPPORTED_TOKENS.KRAY;

// Helper to get token by etching ID (supports both formats!)
export function getTokenByEtchingId(etchingId) {
  return Object.values(SUPPORTED_TOKENS).find(t => 
    t.etching_id === etchingId || t.rune_id_short === etchingId
  );
}

// Helper to get token by symbol
export function getTokenBySymbol(symbol) {
  return SUPPORTED_TOKENS[symbol.toUpperCase()];
}

// Gas Fees (in credits)
export const GAS = {
  BASE_TRANSFER: 1,      // 0.001 KRAY
  SWAP: 5,               // 0.005 KRAY
  STAKE: 2,              // 0.002 KRAY
  UNSTAKE: 2,            // 0.002 KRAY
  MARKETPLACE_LIST: 10,  // 0.010 KRAY
  MARKETPLACE_BUY: 5,    // 0.005 KRAY
  COMPLEX_DEFI: 20,      // 0.020 KRAY
  
  // Gas distribution
  BURN_PERCENTAGE: 50,   // 50% burned
  VALIDATOR_PERCENTAGE: 50 // 50% to validators
};

// Bridge Configuration
export const BRIDGE = {
  MULTISIG_THRESHOLD: 2, // 2-of-3 multisig
  MULTISIG_TOTAL: 3,
  
  DEPOSIT_CONFIRMATIONS: 6,  // 6 blocks confirmation
  WITHDRAWAL_CHALLENGE_PERIOD: 86400, // 24 hours in seconds
  
  // Bridge addresses (will be generated)
  FEDERATION_PUBKEYS: [], // To be populated
  
  // Fees
  DEPOSIT_FEE: 0,        // No fee for deposits
  WITHDRAWAL_FEE: 100    // 0.100 KRAY (100 credits) for withdrawals
};

// Validator Configuration
export const VALIDATOR = {
  MIN_STAKE: 10000000,   // 10,000 KRAY (10,000,000 credits)
  UNSTAKE_LOCK_PERIOD: 604800, // 7 days in seconds
  
  REWARD_SHARE: 50,      // 50% of gas goes to validators
  
  // Slashing
  OFFLINE_SLASH: 10,     // 10% slash for being offline >24h
  MALICIOUS_SLASH: 50,   // 50% slash for malicious behavior
  
  // Performance
  MAX_OFFLINE_TIME: 86400 // 24 hours
};

// Rollup Configuration
export const ROLLUP = {
  BATCH_INTERVAL: 3600,  // 1 hour in seconds
  MAX_TXS_PER_BATCH: 10000,
  
  // L1 Anchoring
  OP_RETURN_PREFIX: Buffer.from('KRAY'),
  MAX_OP_RETURN_SIZE: 80 // Bitcoin OP_RETURN limit
};

// Network Configuration
export const NETWORK = {
  L2_CHAIN_ID: 'kray-mainnet-1',
  L2_NETWORK_NAME: 'KRAY SPACE',
  
  // Performance targets
  TARGET_TPS: 1000,
  TARGET_FINALITY: 1000, // 1 second in ms
  
  // Bitcoin network
  BITCOIN_NETWORK: process.env.BITCOIN_NETWORK || 'mainnet'
};

// Database Configuration
export const DATABASE = {
  PATH: process.env.DB_PATH || './data/kray-l2.db',
  WAL_MODE: true,
  TIMEOUT: 5000
};

// API Configuration
export const API = {
  PORT: process.env.PORT || 5000,
  RATE_LIMIT: {
    WINDOW_MS: 60000,    // 1 minute
    MAX_REQUESTS: 100    // 100 requests per minute
  }
};

// Security
export const SECURITY = {
  // Challenge periods
  FRAUD_PROOF_WINDOW: 86400, // 24 hours
  DISPUTE_RESOLUTION_TIME: 172800, // 48 hours
  
  // Rate limiting
  MAX_TXS_PER_ACCOUNT_PER_BLOCK: 10,
  MAX_PENDING_WITHDRAWALS: 5
};

// Status codes
export const STATUS = {
  // Transaction status
  TX_PENDING: 'pending',
  TX_CONFIRMED: 'confirmed',
  TX_FAILED: 'failed',
  
  // Deposit status
  DEPOSIT_PENDING: 'pending',
  DEPOSIT_CONFIRMING: 'confirming',
  DEPOSIT_CLAIMED: 'claimed',
  
  // Withdrawal status
  WITHDRAWAL_PENDING: 'pending',
  WITHDRAWAL_CHALLENGED: 'challenged',
  WITHDRAWAL_COMPLETED: 'completed',
  WITHDRAWAL_FAILED: 'failed',
  
  // Validator status
  VALIDATOR_ACTIVE: 'active',
  VALIDATOR_INACTIVE: 'inactive',
  VALIDATOR_SLASHED: 'slashed'
};

// Errors
export const ERRORS = {
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INVALID_SIGNATURE: 'Invalid signature',
  INVALID_NONCE: 'Invalid nonce',
  INVALID_AMOUNT: 'Invalid amount',
  DEPOSIT_NOT_FOUND: 'Deposit not found',
  WITHDRAWAL_IN_CHALLENGE: 'Withdrawal in challenge period',
  VALIDATOR_NOT_FOUND: 'Validator not found',
  INSUFFICIENT_STAKE: 'Insufficient stake'
};

// Helper functions
export function creditsToKray(credits) {
  const conversionRate = SUPPORTED_TOKENS.KRAY.credits_per_token || 1000;
  return Number(credits) / conversionRate;
}

export function krayToCredits(kray) {
  const conversionRate = SUPPORTED_TOKENS.KRAY.credits_per_token || 1000;
  return Math.floor(Number(kray) * conversionRate);
}

export function formatCredits(credits) {
  const kray = creditsToKray(credits);
  const decimals = SUPPORTED_TOKENS.KRAY.decimals_l2 || 3;
  return kray.toFixed(decimals);
}

export function calculateGasFee(txType) {
  return GAS[txType] || GAS.BASE_TRANSFER;
}

export function distributeGas(totalGas) {
  const burned = Math.floor(totalGas * GAS.BURN_PERCENTAGE / 100);
  const validators = totalGas - burned;
  return { burned, validators };
}

// Validation functions
export function isValidAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && num > 0 && Number.isInteger(num);
}

export function isValidAddress(address) {
  // Bitcoin Taproot address validation (bc1p...)
  return /^bc1p[a-zA-HJ-NP-Z0-9]{58}$/.test(address);
}

export function isValidKrayAddress(address) {
  // L2 address format: kray_xxxxx
  return /^kray_[a-zA-Z0-9]{32}$/.test(address);
}

export default {
  TOKEN,
  GAS,
  BRIDGE,
  VALIDATOR,
  ROLLUP,
  NETWORK,
  DATABASE,
  API,
  SECURITY,
  STATUS,
  ERRORS,
  creditsToKray,
  krayToCredits,
  formatCredits,
  calculateGasFee,
  distributeGas,
  isValidAmount,
  isValidAddress,
  isValidKrayAddress
};

