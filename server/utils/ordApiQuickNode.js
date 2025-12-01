/**
 * 🚀 Ord API com QuickNode Integration
 * Usa QuickNode quando disponível, fallback para ord local
 */

import axios from 'axios';
import dotenv from 'dotenv';
import quicknode from './quicknode.js';

dotenv.config();

const ORD_SERVER_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';
const USE_QUICKNODE = process.env.QUICKNODE_ENABLED === 'true';

class OrdAPI {
    constructor() {
        this.baseUrl = ORD_SERVER_URL;
        this.useQuickNode = USE_QUICKNODE;
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'Accept': 'application/json'
            },
            family: 4
        });
        
        // Cache
        this.inscriptionsCache = new Map();
        this.CACHE_TTL = 30000; // 30 segundos
        
        console.log(`📡 Ord API initialized (QuickNode: ${this.useQuickNode ? 'ENABLED ✅' : 'disabled'})`);
    }

    // ==========================================
    // 📜 INSCRIPTION METHODS
    // ==========================================

    /**
     * Get inscription by ID
     */
    async getInscription(inscriptionId) {
        if (this.useQuickNode) {
            try {
                const result = await quicknode.getInscription(inscriptionId);
                return {
                    id: inscriptionId,
                    number: result.number,
                    inscription_number: result.number,
                    content_type: result.content_type,
                    content_length: result.content_length,
                    address: result.address,
                    genesis_height: result.genesis_height,
                    genesis_transaction: result.genesis_transaction,
                    location: result.location,
                    output: result.output,
                    output_value: result.output_value,
                    sat: result.sat,
                    timestamp: result.timestamp
                };
            } catch (error) {
                console.warn(`⚠️  QuickNode failed for ${inscriptionId}, trying local...`);
                return await this.getInscriptionLocal(inscriptionId);
            }
        }
        
        return await this.getInscriptionLocal(inscriptionId);
    }

    /**
     * Get inscription from local ord server
     */
    async getInscriptionLocal(inscriptionId) {
        try {
            const response = await this.client.get(`/inscription/${inscriptionId}`, {
                headers: { 'Accept': 'text/html' },
                timeout: 5000
            });
            
            const html = response.data;
            
            const numberMatch = html.match(/Inscription\s+(\d+)/i);
            const inscriptionNumber = numberMatch ? parseInt(numberMatch[1]) : null;
            
            const typeMatch = html.match(/content\s+type<\/dt>\s*<dd[^>]*>([^<]+)/i);
            const contentType = typeMatch ? typeMatch[1].trim() : 'unknown';
            
            return {
                id: inscriptionId,
                number: inscriptionNumber,
                inscription_number: inscriptionNumber,
                content_type: contentType
            };
        } catch (error) {
            console.error(`Error getting inscription ${inscriptionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get inscriptions for an address
     */
    async getInscriptionsByAddress(address, offset = 0, limit = 100) {
        // Check cache first
        const cacheKey = `${address}:${offset}:${limit}`;
        const cached = this.inscriptionsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            console.log(`📦 Cache hit for ${address}`);
            return cached.data;
        }

        if (this.useQuickNode) {
            try {
                // QuickNode doesn't have direct address inscriptions endpoint
                // We'll need to use local or implement custom logic
                console.log('⚠️  QuickNode doesn\'t support address inscriptions yet, using local');
                return await this.getInscriptionsByAddressLocal(address, offset, limit);
            } catch (error) {
                console.warn('QuickNode failed, trying local...');
                return await this.getInscriptionsByAddressLocal(address, offset, limit);
            }
        }
        
        return await this.getInscriptionsByAddressLocal(address, offset, limit);
    }

    /**
     * Get inscriptions by address from local ord
     */
    async getInscriptionsByAddressLocal(address, offset = 0, limit = 100) {
        try {
            const url = `/inscriptions`;
            const response = await this.client.get(url, {
                headers: { 'Accept': 'application/json' },
                timeout: 60000
            });
            
            // TODO: Filter by address
            return response.data || [];
        } catch (error) {
            console.error(`Error getting inscriptions for ${address}:`, error.message);
            return [];
        }
    }

    // ==========================================
    // 🪙 RUNE METHODS
    // ==========================================

    /**
     * Get all runes
     */
    async getRunes() {
        if (this.useQuickNode) {
            try {
                console.log('🪙 Fetching runes from QuickNode...');
                const runes = await quicknode.getRunes();
                return runes;
            } catch (error) {
                console.warn('QuickNode runes failed, trying local...');
                return await this.getRunesLocal();
            }
        }
        
        return await this.getRunesLocal();
    }

    /**
     * Get runes from local ord
     */
    async getRunesLocal() {
        try {
            const response = await this.client.get('/runes', {
                headers: { 'Accept': 'application/json' }
            });
            return response.data || [];
        } catch (error) {
            console.error('Error getting runes:', error.message);
            return [];
        }
    }

    /**
     * Get specific rune
     */
    async getRune(runeId) {
        if (this.useQuickNode) {
            try {
                const rune = await quicknode.getRune(runeId);
                return rune;
            } catch (error) {
                console.warn(`QuickNode failed for rune ${runeId}, trying local...`);
                return await this.getRuneLocal(runeId);
            }
        }
        
        return await this.getRuneLocal(runeId);
    }

    /**
     * Get rune from local ord
     */
    async getRuneLocal(runeId) {
        try {
            const response = await this.client.get(`/rune/${runeId}`, {
                headers: { 'Accept': 'application/json' }
            });
            return response.data;
        } catch (error) {
            console.error(`Error getting rune ${runeId}:`, error.message);
            throw error;
        }
    }

    // ==========================================
    // 🧱 BLOCKCHAIN METHODS
    // ==========================================

    /**
     * Get current block height
     */
    async getBlockHeight() {
        if (this.useQuickNode) {
            try {
                return await quicknode.getCurrentBlockHeight();
            } catch (error) {
                console.warn('QuickNode failed, trying local...');
                return await this.getBlockHeightLocal();
            }
        }
        
        return await this.getBlockHeightLocal();
    }

    /**
     * Get block height from local ord
     */
    async getBlockHeightLocal() {
        try {
            const response = await this.client.get('/blockheight');
            return parseInt(response.data);
        } catch (error) {
            console.error('Error getting block height:', error.message);
            throw error;
        }
    }

    /**
     * Get output info
     */
    async getOutput(txid, vout) {
        const outpoint = `${txid}:${vout}`;
        
        if (this.useQuickNode) {
            try {
                return await quicknode.getOutput(outpoint);
            } catch (error) {
                console.warn(`QuickNode failed for output ${outpoint}, trying local...`);
                return await this.getOutputLocal(outpoint);
            }
        }
        
        return await this.getOutputLocal(outpoint);
    }

    /**
     * Get output from local ord
     */
    async getOutputLocal(outpoint) {
        try {
            const response = await this.client.get(`/output/${outpoint}`, {
                headers: { 'Accept': 'application/json' }
            });
            return response.data;
        } catch (error) {
            console.error(`Error getting output ${outpoint}:`, error.message);
            throw error;
        }
    }

    /**
     * Test connection
     */
    async testConnection() {
        if (this.useQuickNode) {
            try {
                const status = await quicknode.getStatus();
                return {
                    connected: true,
                    status: 'ok',
                    source: 'QuickNode',
                    blockHeight: await quicknode.getCurrentBlockHeight()
                };
            } catch (error) {
                console.warn('QuickNode failed, trying local...');
            }
        }
        
        try {
            const height = await this.getBlockHeightLocal();
            return {
                connected: true,
                status: 'ok',
                source: 'Local',
                blockHeight: height
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                source: 'None'
            };
        }
    }

    /**
     * Get content (inscription data)
     */
    async getContent(inscriptionId) {
        // Content é sempre via HTTP, não há no QuickNode JSON-RPC
        try {
            const response = await this.client.get(`/content/${inscriptionId}`, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`Error getting content for ${inscriptionId}:`, error.message);
            throw error;
        }
    }
}

// Export singleton
export default new OrdAPI();








