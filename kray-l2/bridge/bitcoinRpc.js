/**
 * KRAY SPACE L2 - Bitcoin RPC Integration
 * 
 * Real QuickNode integration for L1 operations
 */

import axios from 'axios';

const QUICKNODE_ENDPOINT = process.env.QUICKNODE_ENDPOINT;

/**
 * Make RPC call to QuickNode
 */
async function rpcCall(method, params = []) {
  if (!QUICKNODE_ENDPOINT) {
    throw new Error('QUICKNODE_ENDPOINT not configured');
  }

  try {
    const response = await axios.post(QUICKNODE_ENDPOINT, {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`);
    }

    return response.data.result;
  } catch (error) {
    console.error(`❌ RPC call failed (${method}):`, error.message);
    throw error;
  }
}

/**
 * Get UTXOs for an address
 * FIXED: Using listunspent instead of scantxoutset (QuickNode compatible)
 */
export async function getUTXOs(address) {
  console.log(`📡 Fetching UTXOs for ${address}...`);

  try {
    // Method 1: Try listunspent (better QuickNode support)
    try {
      const result = await rpcCall('listunspent', [0, 9999999, [address]]);
      
      if (result && result.length > 0) {
        console.log(`✅ Found ${result.length} UTXOs via listunspent`);
        
        return result.map(utxo => ({
          txid: utxo.txid,
          vout: utxo.vout,
          value: Math.floor(utxo.amount * 100000000), // BTC to sats
          scriptPubKey: utxo.scriptPubKey,
          confirmations: utxo.confirmations || 0
        }));
      }
    } catch (listError) {
      console.warn('   ⚠️  listunspent not available, trying alternative...');
    }

    // Method 2: Try scantxoutset as fallback
    try {
      const result = await rpcCall('scantxoutset', ['start', [`addr(${address})`]]);
      
      const utxos = result.unspents || [];
      console.log(`✅ Found ${utxos.length} UTXOs via scantxoutset`);

      return utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: Math.floor(utxo.amount * 100000000),
        scriptPubKey: utxo.scriptPubKey,
        confirmations: utxo.height ? result.height - utxo.height + 1 : 0
      }));
    } catch (scanError) {
      console.warn('   ⚠️  scantxoutset not available either');
    }

    // Method 3: Use getaddresstxids + getrawtransaction (last resort)
    console.log('   ℹ️  Using manual UTXO detection...');
    return await getUTXOsManual(address);

  } catch (error) {
    console.error('❌ All methods failed:', error.message);
    return [];
  }
}

/**
 * Manual UTXO detection using Mempool.space API (fallback)
 */
async function getUTXOsManual(address) {
  try {
    // Import mempool detector
    const { getUTXOsFromMempool } = await import('./depositDetector.js');
    
    const utxos = await getUTXOsFromMempool(address);
    
    if (utxos && utxos.length > 0) {
      console.log(`   ✅ Detected ${utxos.length} UTXOs via Mempool.space API`);
      return utxos;
    }
    
    return [];
  } catch (error) {
    console.error('   ❌ Fallback detection failed:', error.message);
    return [];
  }
}

/**
 * Get raw transaction
 */
export async function getRawTransaction(txid, verbose = false) {
  return await rpcCall('getrawtransaction', [txid, verbose]);
}

/**
 * Get transaction details
 */
export async function getTransaction(txid) {
  return await rpcCall('gettransaction', [txid]);
}

/**
 * Broadcast transaction
 */
export async function broadcastTransaction(txHex) {
  console.log('📡 Broadcasting transaction to Bitcoin network...');

  try {
    const txid = await rpcCall('sendrawtransaction', [txHex]);

    console.log('✅ Transaction broadcast success');
    console.log(`   TXID: ${txid}`);

    return txid;
  } catch (error) {
    console.error('❌ Broadcast failed:', error.message);
    throw error;
  }
}

/**
 * Get current block height
 */
export async function getBlockHeight() {
  const blockchainInfo = await rpcCall('getblockchaininfo');
  return blockchainInfo.blocks;
}

/**
 * Get block hash by height
 */
export async function getBlockHash(height) {
  return await rpcCall('getblockhash', [height]);
}

/**
 * Verify UTXO is unspent
 */
export async function isUTXOUnspent(txid, vout) {
  try {
    const txOut = await rpcCall('gettxout', [txid, vout, true]);
    return txOut !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Estimate fee for transaction
 */
export async function estimateFee(blocks = 6) {
  try {
    const result = await rpcCall('estimatesmartfee', [blocks]);
    
    if (result.feerate) {
      // Convert BTC/kB to sats/vB
      const satPerKB = result.feerate * 100000000;
      const satPerVB = satPerKB / 1000;
      return Math.ceil(satPerVB);
    }
    
    // Fallback: 10 sat/vB
    return 10;
  } catch (error) {
    console.warn('⚠️  Fee estimation failed, using fallback (10 sat/vB)');
    return 10;
  }
}

export default {
  getUTXOs,
  getRawTransaction,
  getTransaction,
  broadcastTransaction,
  getBlockHeight,
  getBlockHash,
  isUTXOUnspent,
  estimateFee
};

