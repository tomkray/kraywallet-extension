/**
 * 📊 UTXO MANAGER
 * 
 * Classifica UTXOs em:
 * - Pure Bitcoin (seguro para Lightning)
 * - Runes (seguro para Lightning com metadata)
 * - Inscriptions (BLOQUEADO! Nunca enviar para Lightning!)
 */

class UTXOManager {
    constructor() {
        this.ordServerUrl = process.env.ORD_SERVER_URL || 'http://localhost:80';
        this.mempoolUrl = process.env.MEMPOOL_URL || 'https://mempool.space/api';
    }

    /**
     * 🔍 CLASSIFICAR TODOS OS UTXOs DE UM ADDRESS
     * 
     * @param {string} address - Endereço Taproot
     * @returns {Object} { pureBitcoin: [], runes: [], inscriptions: [] }
     */
    async classifyUTXOs(address) {
        console.log(`📊 ========== CLASSIFYING UTXOs ==========`);
        console.log(`   Address: ${address}`);
        
        try {
            // 1. Buscar todos os UTXOs do address (Mempool.space)
            const utxos = await this.fetchUTXOs(address);
            console.log(`   Found ${utxos.length} UTXOs`);
            
            if (utxos.length === 0) {
                return {
                    pureBitcoin: [],
                    runes: [],
                    inscriptions: []
                };
            }
            
            const classified = {
                pureBitcoin: [],
                runes: [],
                inscriptions: []
            };
            
            // 2. Para cada UTXO, consultar ORD server
            for (const utxo of utxos) {
                const type = await this.checkUTXOType(utxo);
                
                if (type.isInscription) {
                    console.log(`   ❌ UTXO ${utxo.txid}:${utxo.vout} = INSCRIPTION (BLOCKED!)`);
                    classified.inscriptions.push({
                        ...utxo,
                        inscription: type.inscription
                    });
                } else if (type.isRune) {
                    console.log(`   🪙 UTXO ${utxo.txid}:${utxo.vout} = RUNE (${type.rune.id})`);
                    classified.runes.push({
                        ...utxo,
                        rune: type.rune
                    });
                } else {
                    console.log(`   ✅ UTXO ${utxo.txid}:${utxo.vout} = PURE BITCOIN`);
                    classified.pureBitcoin.push(utxo);
                }
            }
            
            console.log(`✅ Classification complete:`);
            console.log(`   Pure Bitcoin: ${classified.pureBitcoin.length} UTXOs`);
            console.log(`   Runes: ${classified.runes.length} UTXOs`);
            console.log(`   Inscriptions: ${classified.inscriptions.length} UTXOs`);
            
            return classified;
            
        } catch (error) {
            console.error('❌ Error classifying UTXOs:', error.message);
            throw error;
        }
    }

    /**
     * 🔎 VERIFICAR TIPO DO UTXO VIA ORD SERVER
     * 
     * @param {Object} utxo - { txid, vout, value }
     * @returns {Object} { isPure?, isRune?, isInscription?, rune?, inscription? }
     */
    async checkUTXOType(utxo) {
        const { txid, vout } = utxo;
        
        try {
            // Consultar ORD server
            const response = await fetch(
                `${this.ordServerUrl}/output/${txid}:${vout}`,
                { timeout: 5000 }
            );
            
            if (!response.ok) {
                // UTXO não tem nada especial (Pure Bitcoin)
                return { isPure: true };
            }
            
            const data = await response.json();
            
            // Verificar se tem inscription
            if (data.inscriptions && data.inscriptions.length > 0) {
                return {
                    isInscription: true,
                    inscription: {
                        id: data.inscriptions[0].id,
                        number: data.inscriptions[0].number,
                        content_type: data.inscriptions[0].content_type
                    }
                };
            }
            
            // Verificar se tem rune
            if (data.runes && data.runes.length > 0) {
                return {
                    isRune: true,
                    rune: {
                        id: data.runes[0].id,
                        name: data.runes[0].name,
                        amount: data.runes[0].amount
                    }
                };
            }
            
            return { isPure: true };
            
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.warn(`⚠️  ORD server not available, assuming UTXO ${txid}:${vout} is pure Bitcoin`);
            } else {
                console.warn(`⚠️  Error checking UTXO ${txid}:${vout}:`, error.message);
            }
            return { isPure: true }; // Assumir puro se erro
        }
    }

    /**
     * 📡 BUSCAR UTXOs DO ADDRESS (MEMPOOL.SPACE)
     * 
     * @param {string} address - Endereço Bitcoin
     * @returns {Array} UTXOs
     */
    async fetchUTXOs(address) {
        try {
            const response = await fetch(
                `${this.mempoolUrl}/address/${address}/utxo`,
                { timeout: 10000 }
            );
            
            if (!response.ok) {
                throw new Error(`Mempool API returned ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Error fetching UTXOs from Mempool:', error.message);
            throw new Error('Failed to fetch UTXOs');
        }
    }

    /**
     * 🔒 FILTRAR APENAS UTXOs SEGUROS PARA LIGHTNING
     * (Pure Bitcoin + Runes permitidos, NUNCA Inscriptions!)
     * 
     * @param {Object} classified - Resultado de classifyUTXOs()
     * @returns {Object} { pureBitcoin, runes }
     */
    filterLightningSafeUTXOs(classified) {
        return {
            // Pure Bitcoin é sempre seguro
            pureBitcoin: classified.pureBitcoin,
            
            // Runes são permitidos (revolucionário!)
            runes: classified.runes,
            
            // Inscriptions NUNCA devem ir para Lightning
            // (perda permanente se enviado!)
            inscriptions: [] // BLOQUEADO!
        };
    }

    /**
     * 💰 SELECIONAR UTXOs QUE SOMAM CAPACIDADE DESEJADA
     * 
     * @param {Array} utxos - Lista de UTXOs
     * @param {number} targetCapacity - Capacidade desejada em sats
     * @returns {Array} UTXOs selecionados
     */
    selectUTXOsForCapacity(utxos, targetCapacity) {
        console.log(`💰 Selecting UTXOs for capacity: ${targetCapacity} sats`);
        
        // Ordenar do maior para o menor
        const sorted = [...utxos].sort((a, b) => b.value - a.value);
        const selected = [];
        let total = 0;
        
        for (const utxo of sorted) {
            selected.push(utxo);
            total += utxo.value;
            
            console.log(`   Added UTXO: ${utxo.value} sats (total: ${total})`);
            
            if (total >= targetCapacity) {
                break;
            }
        }
        
        if (total < targetCapacity) {
            throw new Error(`Insufficient balance. Need ${targetCapacity}, have ${total}`);
        }
        
        console.log(`✅ Selected ${selected.length} UTXOs (total: ${total} sats)`);
        return selected;
    }

    /**
     * 📊 CALCULAR BALANCES POR TIPO
     * 
     * @param {Object} classified - Resultado de classifyUTXOs()
     * @returns {Object} { pureBitcoin, runes, inscriptions }
     */
    calculateBalances(classified) {
        const pureBitcoinBalance = classified.pureBitcoin.reduce(
            (sum, utxo) => sum + utxo.value,
            0
        );
        
        // Agrupar Runes por ID
        const runesBalances = {};
        for (const utxo of classified.runes) {
            const runeId = utxo.rune.id;
            if (!runesBalances[runeId]) {
                runesBalances[runeId] = {
                    id: runeId,
                    name: utxo.rune.name,
                    amount: 0,
                    utxoCount: 0
                };
            }
            runesBalances[runeId].amount += utxo.rune.amount;
            runesBalances[runeId].utxoCount += 1;
        }
        
        return {
            pureBitcoin: pureBitcoinBalance,
            runes: Object.values(runesBalances),
            inscriptions: classified.inscriptions.length
        };
    }
}

export default new UTXOManager();

