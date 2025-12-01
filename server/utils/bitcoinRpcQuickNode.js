/**
 * 🚀 Bitcoin RPC com QuickNode Integration
 * Usa QuickNode quando disponível, fallback para bitcoind local
 */

import axios from 'axios';
import dotenv from 'dotenv';
import quicknode from './quicknode.js';

dotenv.config();

const BITCOIN_RPC_URL = process.env.BITCOIN_RPC_URL || 'http://127.0.0.1:8332';
const BITCOIN_RPC_USER = process.env.BITCOIN_RPC_USER;
const BITCOIN_RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD;
const USE_QUICKNODE = process.env.QUICKNODE_ENABLED === 'true';

class BitcoinRPC {
    constructor() {
        this.rpcUrl = BITCOIN_RPC_URL;
        this.rpcUser = BITCOIN_RPC_USER;
        this.rpcPassword = BITCOIN_RPC_PASSWORD;
        this.useQuickNode = USE_QUICKNODE;
        
        console.log(`₿  Bitcoin RPC initialized (QuickNode: ${this.useQuickNode ? 'ENABLED ✅' : 'disabled'})`);
    }

    /**
     * Call local Bitcoin RPC
     */
    async callLocal(method, params = []) {
        try {
            const response = await axios.post(this.rpcUrl, {
                jsonrpc: '1.0',
                id: Date.now(),
                method,
                params
            }, {
                auth: {
                    username: this.rpcUser,
                    password: this.rpcPassword
                },
                timeout: 30000
            });

            if (response.data.error) {
                throw new Error(response.data.error.message);
            }

            return response.data.result;
        } catch (error) {
            console.error(`Bitcoin RPC Error (${method}):`, error.message);
            throw error;
        }
    }

    /**
     * Call QuickNode or fallback to local
     */
    async call(method, params = []) {
        if (this.useQuickNode) {
            try {
                return await quicknode.call(method, params);
            } catch (error) {
                console.warn(`⚠️  QuickNode failed for ${method}, trying local...`);
                return await this.callLocal(method, params);
            }
        }
        
        return await this.callLocal(method, params);
    }

    // ==========================================
    // 🧱 BLOCKCHAIN METHODS
    // ==========================================

    async getBlockchainInfo() {
        return await this.call('getblockchaininfo');
    }

    async getBlockCount() {
        return await this.call('getblockcount');
    }

    async getBlock(blockHash, verbosity = 1) {
        return await this.call('getblock', [blockHash, verbosity]);
    }

    async getBlockHash(height) {
        return await this.call('getblockhash', [height]);
    }

    async getBlockHeader(blockHash, verbose = true) {
        return await this.call('getblockheader', [blockHash, verbose]);
    }

    async getBestBlockHash() {
        return await this.call('getbestblockhash');
    }

    // ==========================================
    // 💸 TRANSACTION METHODS
    // ==========================================

    async getRawTransaction(txid, verbose = true) {
        return await this.call('getrawtransaction', [txid, verbose]);
    }

    async sendRawTransaction(hex) {
        return await this.call('sendrawtransaction', [hex]);
    }

    async decodeRawTransaction(hex) {
        return await this.call('decoderawtransaction', [hex]);
    }

    async getTxOut(txid, vout, includeMempool = true) {
        return await this.call('gettxout', [txid, vout, includeMempool]);
    }

    async getTransaction(txid, includeWatchOnly = true) {
        return await this.call('gettransaction', [txid, includeWatchOnly]);
    }

    // ==========================================
    // 💰 MEMPOOL METHODS
    // ==========================================

    async getMempoolInfo() {
        return await this.call('getmempoolinfo');
    }

    async getRawMempool(verbose = false) {
        return await this.call('getrawmempool', [verbose]);
    }

    async getMempoolEntry(txid) {
        return await this.call('getmempoolentry', [txid]);
    }

    // ==========================================
    // 💵 FEE ESTIMATION
    // ==========================================

    async estimateSmartFee(blocks = 6, estimateMode = 'ECONOMICAL') {
        return await this.call('estimatesmartfee', [blocks, estimateMode]);
    }

    async estimateFee(blocks = 6) {
        try {
            const result = await this.estimateSmartFee(blocks);
            if (result.feerate) {
                return result.feerate; // BTC/kB
            }
            return 0.00001; // Fallback: 1 sat/vB
        } catch (error) {
            console.error('Error estimating fee:', error.message);
            return 0.00001;
        }
    }

    // ==========================================
    // 🔍 UTXO METHODS
    // ==========================================

    async getUtxos(address) {
        // QuickNode não tem scantxoutset, usar local
        if (this.useQuickNode) {
            console.warn('⚠️  getUtxos requires local bitcoind (scantxoutset)');
            return await this.getUtxosLocal(address);
        }
        
        return await this.getUtxosLocal(address);
    }

    async getUtxosLocal(address) {
        try {
            const descriptor = `addr(${address})`;
            const result = await this.callLocal('scantxoutset', ['start', [descriptor]]);
            
            if (!result || !result.unspents) {
                return [];
            }
            
            return result.unspents.map(utxo => ({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.amount * 100000000, // Convert BTC to sats
                scriptPubKey: utxo.scriptPubKey,
                height: utxo.height
            }));
        } catch (error) {
            console.error('Error scanning UTXOs:', error.message);
            throw error;
        }
    }

    // ==========================================
    // 📊 NETWORK INFO
    // ==========================================

    async getNetworkInfo() {
        return await this.call('getnetworkinfo');
    }

    async getMiningInfo() {
        return await this.call('getmininginfo');
    }

    async getDifficulty() {
        return await this.call('getdifficulty');
    }

    // ==========================================
    // 🧪 TEST CONNECTION
    // ==========================================

    async testConnection() {
        try {
            const info = await this.getBlockchainInfo();
            return {
                connected: true,
                source: this.useQuickNode ? 'QuickNode' : 'Local',
                chain: info.chain,
                blocks: info.blocks,
                headers: info.headers,
                verificationProgress: info.verificationprogress
            };
        } catch (error) {
            return {
                connected: false,
                source: 'None',
                error: error.message
            };
        }
    }

    // ==========================================
    // 📡 BROADCAST
    // ==========================================

    async broadcastTransaction(hex) {
        try {
            console.log('📡 Broadcasting transaction...');
            const txid = await this.sendRawTransaction(hex);
            console.log(`✅ Transaction broadcast: ${txid}`);
            return {
                success: true,
                txid,
                source: this.useQuickNode ? 'QuickNode' : 'Local'
            };
        } catch (error) {
            console.error('❌ Broadcast failed:', error.message);
            throw error;
        }
    }
}

// Export singleton
export default new BitcoinRPC();






