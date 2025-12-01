/**
 * KRAY SPACE L2 - Alternative Deposit Detector
 * 
 * Uses Mempool.space API as fallback when QuickNode RPC fails
 */

import axios from 'axios';

const MEMPOOL_API = 'https://mempool.space/api';

/**
 * Get UTXOs for address using Mempool.space API
 */
export async function getUTXOsFromMempool(address) {
  console.log(`   📡 Fetching UTXOs from Mempool.space for ${address.substring(0, 20)}...`);

  try {
    const response = await axios.get(`${MEMPOOL_API}/address/${address}/utxo`, {
      timeout: 10000
    });

    const utxos = response.data || [];

    console.log(`   ✅ Found ${utxos.length} UTXOs via Mempool.space`);

    return utxos.map(utxo => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      scriptPubKey: null, // Not provided by mempool.space
      confirmations: utxo.status?.confirmed ? utxo.status.block_height : 0
    }));

  } catch (error) {
    console.error('   ❌ Mempool.space API error:', error.message);
    return [];
  }
}

/**
 * Get transaction details from Mempool.space
 */
export async function getTransactionFromMempool(txid) {
  try {
    const response = await axios.get(`${MEMPOOL_API}/tx/${txid}`, {
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    console.error('Error getting transaction from mempool:', error.message);
    return null;
  }
}

/**
 * Get address transactions from Mempool.space
 */
export async function getAddressTransactions(address, afterTxid = null) {
  try {
    const url = afterTxid 
      ? `${MEMPOOL_API}/address/${address}/txs/chain/${afterTxid}`
      : `${MEMPOOL_API}/address/${address}/txs`;

    const response = await axios.get(url, {
      timeout: 10000
    });

    return response.data || [];
  } catch (error) {
    console.error('Error getting address transactions:', error.message);
    return [];
  }
}

export default {
  getUTXOsFromMempool,
  getTransactionFromMempool,
  getAddressTransactions
};




