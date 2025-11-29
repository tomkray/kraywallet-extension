import axios from 'axios';

/**
 * 🌐 Cliente para Mempool.space API
 * 
 * Busca fees em tempo real da rede Bitcoin
 */

const MEMPOOL_API_URL = 'https://mempool.space/api';

class MempoolAPI {
    constructor() {
        this.baseUrl = MEMPOOL_API_URL;
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000, // ✅ Aumentado para 30s (era 10s)
            headers: {
                'Accept': 'application/json'
            }
        });
        
        // ✅ Cache simples para UTXOs (evita múltiplas chamadas)
        this.utxoCache = new Map();
        this.cacheTimeout = 30000; // 30 segundos
    }
    
    /**
     * Limpar cache de um endereço
     */
    clearCache(address) {
        this.utxoCache.delete(address);
    }
    
    /**
     * Limpar todo o cache
     */
    clearAllCache() {
        this.utxoCache.clear();
    }

    /**
     * Obter fees recomendadas em tempo real
     * @returns {Promise<{fastestFee, halfHourFee, hourFee, economyFee, minimumFee}>}
     */
    async getRecommendedFees() {
        try {
            const response = await this.client.get('/v1/fees/recommended');
            
            // Mempool.space retorna:
            // {
            //   fastestFee: 20,    // próximo bloco (~10 min)
            //   halfHourFee: 15,   // 30 minutos
            //   hourFee: 10,       // 1 hora
            //   economyFee: 5,     // baixa prioridade
            //   minimumFee: 1      // mínimo da rede
            // }
            
            return {
                high: response.data.fastestFee || 20,      // Próximo bloco
                medium: response.data.hourFee || 10,        // 1 hora
                low: response.data.economyFee || 5,         // Economia
                minimum: response.data.minimumFee || 1,     // Mínimo
                halfHour: response.data.halfHourFee || 15,  // 30 min
                source: 'mempool.space'
            };
        } catch (error) {
            console.error('Mempool API Error:', error.message);
            throw error;
        }
    }

    /**
     * Obter mempool info (estatísticas)
     */
    async getMempoolInfo() {
        try {
            const response = await this.client.get('/mempool');
            return response.data;
        } catch (error) {
            console.error('Mempool API Error:', error.message);
            throw error;
        }
    }

    /**
     * Obter fee percentis (distribuição de fees)
     */
    async getFeePercentiles() {
        try {
            const response = await this.client.get('/v1/fees/mempool-blocks');
            return response.data;
        } catch (error) {
            console.error('Mempool API Error:', error.message);
            throw error;
        }
    }

    /**
     * Broadcast de transação
     * @param {string} txHex - Transação em hex
     */
    async broadcastTransaction(txHex) {
        try {
            console.log('📡 Mempool.space broadcast request:');
            console.log('   TX hex length:', txHex.length, 'characters');
            console.log('   TX hex preview:', txHex.substring(0, 100) + '...');
            
            const response = await this.client.post('/tx', txHex, {
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
            return response.data; // Retorna txid
        } catch (error) {
            console.error('❌ Mempool API Error broadcasting tx:', error.message);
            console.error('   Status:', error.response?.status);
            console.error('   Data:', error.response?.data);
            console.error('   Text:', error.response?.data?.toString());
            throw error;
        }
    }

    /**
     * Obter informações de uma transação
     * @param {string} txid
     */
    async getTransaction(txid) {
        try {
            const response = await this.client.get(`/tx/${txid}`);
            return response.data;
        } catch (error) {
            console.error('Mempool API Error getting tx:', error.message);
            throw error;
        }
    }

    /**
     * Obter status de transação
     * @param {string} txid
     */
    async getTransactionStatus(txid) {
        try {
            const response = await this.client.get(`/tx/${txid}/status`);
            return response.data;
        } catch (error) {
            console.error('Mempool API Error getting tx status:', error.message);
            throw error;
        }
    }

    /**
     * Obter UTXO de um endereço (com cache)
     * @param {string} address
     */
    async getAddressUtxos(address) {
        try {
            // ✅ Verificar cache primeiro
            const cached = this.utxoCache.get(address);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                console.log(`   💾 Cache hit for ${address.substring(0, 16)}...`);
                return cached.data;
            }
            
            console.log(`   📡 Fetching UTXOs from Mempool.space for ${address.substring(0, 16)}...`);
            const response = await this.client.get(`/address/${address}/utxo`);
            
            // ✅ Armazenar em cache
            this.utxoCache.set(address, {
                data: response.data,
                timestamp: Date.now()
            });
            
            return response.data;
        } catch (error) {
            console.error('Mempool API Error getting UTXOs:', error.message);
            
            // ✅ Se falhar, retornar cache antigo se existir
            const cached = this.utxoCache.get(address);
            if (cached) {
                console.warn('   ⚠️  Using stale cache due to error');
                return cached.data;
            }
            
            throw error;
        }
    }

    /**
     * Testar conexão
     */
    async testConnection() {
        try {
            await this.getRecommendedFees();
            return {
                connected: true,
                status: 'ok'
            };
        } catch (error) {
            return {
                connected: false,
                status: 'error',
                error: error.message
            };
        }
    }
}

// Export singleton
const mempoolApi = new MempoolAPI();
export default mempoolApi;






