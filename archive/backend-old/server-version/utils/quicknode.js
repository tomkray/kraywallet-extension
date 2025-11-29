/**
 * 🚀 QuickNode API Client
 * Integração com QuickNode Ordinals & Runes API + Bitcoin RPC
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const QUICKNODE_ENDPOINT = process.env.QUICKNODE_ENDPOINT;
const QUICKNODE_ENABLED = process.env.QUICKNODE_ENABLED === 'true';

class QuickNodeClient {
    constructor() {
        this.endpoint = QUICKNODE_ENDPOINT;
        this.enabled = QUICKNODE_ENABLED;
        
        if (!this.endpoint) {
            console.warn('⚠️  QuickNode endpoint not configured');
        } else {
            console.log('✅ QuickNode client initialized');
            console.log(`📍 Endpoint: ${this.endpoint.split('/')[2]}`);
        }
    }

    /**
     * Helper genérico para chamar QuickNode JSON-RPC
     */
    async call(method, params = []) {
        if (!this.enabled) {
            throw new Error('QuickNode is disabled');
        }

        try {
            const response = await axios.post(this.endpoint, {
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000, // 30s timeout
                maxRedirects: 5,
                validateStatus: (status) => status < 500 // Aceitar 2xx, 3xx, 4xx
            });

            if (response.data.error) {
                throw new Error(`QuickNode Error: ${response.data.error.message}`);
            }

            return response.data.result;
        } catch (error) {
            if (error.response) {
                throw new Error(`QuickNode API Error: ${error.response.status} - ${error.response.statusText}`);
            }
            throw error;
        }
    }

    // ==========================================
    // 📜 ORDINALS API
    // ==========================================

    /**
     * Get inscription data
     */
    async getInscription(inscriptionId) {
        return await this.call('ord_getInscription', [inscriptionId]);
    }

    /**
     * Get multiple inscriptions
     */
    async getInscriptions(offset = 0, limit = 100) {
        return await this.call('ord_getInscriptions', [offset, limit]);
    }

    /**
     * Get inscription content (returns hex string)
     */
    async getInscriptionContent(inscriptionId) {
        const result = await this.call('ord_getContent', [inscriptionId]);
        // Result is hex string, convert to buffer
        return Buffer.from(result, 'hex');
    }
    
    /**
     * Get inscription metadata
     */
    async getInscriptionMetadata(inscriptionId) {
        return await this.call('ord_getMetadata', [inscriptionId]);
    }
    
    /**
     * Get inscription recursive (with all parent data)
     */
    async getInscriptionRecursive(inscriptionId) {
        return await this.call('ord_getInscriptionRecursive', [inscriptionId]);
    }
    
    /**
     * Get inscriptions by block
     */
    async getInscriptionsByBlock(blockHeight) {
        return await this.call('ord_getInscriptionsByBlock', [blockHeight]);
    }
    
    /**
     * Get sat recursive (with all inscription data)
     */
    async getSatRecursive(satNumber) {
        return await this.call('ord_getSatRecursive', [satNumber]);
    }
    
    /**
     * Get transaction with ordinal data
     */
    async getTx(txid) {
        return await this.call('ord_getTx', [txid]);
    }

    /**
     * Get inscription children
     */
    async getChildren(inscriptionId) {
        return await this.call('ord_getChildren', [inscriptionId]);
    }

    /**
     * Get collections
     */
    async getCollections() {
        return await this.call('ord_getCollections', []);
    }

    /**
     * Get sat info
     */
    async getSat(satNumber) {
        return await this.call('ord_getSat', [satNumber]);
    }

    /**
     * Get sat at index
     */
    async getSatAtIndex(index) {
        return await this.call('ord_getSatAtIndex', [index]);
    }

    /**
     * Get output (UTXO) info
     */
    async getOutput(outpoint) {
        // outpoint format: "txid:vout"
        return await this.call('ord_getOutput', [outpoint]);
    }

    /**
     * Get inscriptions by block
     */
    async getInscriptionsByBlock(blockHeight) {
        return await this.call('ord_getInscriptionsByBlock', [blockHeight]);
    }

    // ==========================================
    // 🪙 RUNES API
    // ==========================================

    /**
     * Get specific rune data
     * @param {string} runeId - Format: "blockHeight:txIndex" (e.g., "843268:2998")
     * @returns {Object} Rune data with entry, id, mintable, parent
     */
    async getRune(runeId) {
        const result = await this.call('ord_getRune', [runeId]);
        return result;
    }

    /**
     * Get all runes
     * @returns {Array} List of all rune IDs
     */
    async getRunes() {
        const result = await this.call('ord_getRunes', []);
        return result;
    }

    /**
     * Get output with rune balances
     * @param {string} outpoint - Format: "txid:vout"
     * @returns {Object} Output data including rune balances
     */
    async getOutputWithRunes(outpoint) {
        const result = await this.call('ord_getOutput', [outpoint]);
        return result;
    }

    // ==========================================
    // 🧱 BLOCKCHAIN INFO
    // ==========================================

    /**
     * Get current block height
     */
    async getCurrentBlockHeight() {
        return await this.call('ord_getCurrentBlockHeight', []);
    }

    /**
     * Get current block hash
     */
    async getCurrentBlockHash() {
        return await this.call('ord_getCurrentBlockHash', []);
    }

    /**
     * Get current block time
     */
    async getCurrentBlockTime() {
        return await this.call('ord_getCurrentBlockTime', []);
    }

    /**
     * Get block hash by height
     */
    async getBlockHash(height) {
        return await this.call('ord_getBlockHash', [height]);
    }

    /**
     * Get block info
     */
    async getBlockInfo(hashOrHeight) {
        return await this.call('ord_getBlockInfo', [hashOrHeight]);
    }

    /**
     * Get ord server status
     */
    async getStatus() {
        return await this.call('ord_getStatus', []);
    }

    // ==========================================
    // ₿ BITCOIN RPC
    // ==========================================

    /**
     * Broadcast transaction
     */
    async sendRawTransaction(hex) {
        return await this.call('sendrawtransaction', [hex]);
    }

    /**
     * Get raw transaction
     */
    async getRawTransaction(txid, verbose = true) {
        return await this.call('getrawtransaction', [txid, verbose]);
    }

    /**
     * Get blockchain info
     */
    async getBlockchainInfo() {
        return await this.call('getblockchaininfo', []);
    }

    /**
     * Estimate smart fee
     */
    async estimateSmartFee(blocks = 6) {
        return await this.call('estimatesmartfee', [blocks]);
    }

    /**
     * Get UTXO info
     */
    async getTxOut(txid, vout, includeMempool = true) {
        return await this.call('gettxout', [txid, vout, includeMempool]);
    }

    /**
     * Get block
     */
    async getBlock(blockHash, verbosity = 1) {
        return await this.call('getblock', [blockHash, verbosity]);
    }

    /**
     * Get block header
     */
    async getBlockHeader(blockHash, verbose = true) {
        return await this.call('getblockheader', [blockHash, verbose]);
    }

    /**
     * Get mempool info
     */
    async getMempoolInfo() {
        return await this.call('getmempoolinfo', []);
    }

    /**
     * Get raw mempool
     */
    async getRawMempool(verbose = false) {
        return await this.call('getrawmempool', [verbose]);
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            const info = await this.getBlockchainInfo();
            return {
                connected: true,
                chain: info.chain,
                blocks: info.blocks,
                headers: info.headers,
                verificationProgress: info.verificationprogress
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
export default new QuickNodeClient();

