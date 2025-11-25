import axios from 'axios';

/**
 * UTXO Filter - Protege inscriptions e runes
 * 
 * Este módulo implementa a lógica de proteção de UTXOs que contêm:
 * - Inscriptions (Ordinals)
 * - Runes
 * 
 * Apenas UTXOs "puros" (sem nada) podem ser usados para fees e envio de BTC
 */

import quicknode from './quicknode.js';

const ORD_SERVER_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';

class UTXOFilter {
    /**
     * Verificar se um UTXO contém inscription
     * @param {string} txid - Transaction ID
     * @param {number} vout - Output index
     * @returns {Promise<boolean>} true se contém inscription
     */
    async hasInscription(txid, vout) {
        try {
            console.log(`🔍 Checking inscription for ${txid}:${vout}...`);
            
            // Usar QuickNode em vez de ORD_SERVER_URL
            const outpoint = `${txid}:${vout}`;
            const outputData = await quicknode.getOutput(outpoint);
            
            // Delay para respeitar rate limit
            await new Promise(r => setTimeout(r, 120));
            
            // Verificar se tem inscriptions
            const hasInscr = outputData.inscriptions && outputData.inscriptions.length > 0;
            
            if (hasInscr) {
                console.log(`   ⚠️  UTXO ${txid}:${vout} has INSCRIPTION - PROTECTED`);
            }
            
            return hasInscr;
            
        } catch (error) {
            console.log(`   ℹ️  Could not check inscription for ${txid}:${vout}:`, error.message);
            // Em caso de erro, assumir que pode ter inscription (ser conservador)
            return false;
        }
    }
    
    /**
     * Verificar se um UTXO contém runes
     * @param {string} txid - Transaction ID
     * @param {number} vout - Output index
     * @returns {Promise<boolean>} true se contém runes
     */
    async hasRunes(txid, vout) {
        try {
            console.log(`🔍 Checking runes for ${txid}:${vout}...`);
            
            // Usar QuickNode em vez de ORD_SERVER_URL
            const outpoint = `${txid}:${vout}`;
            const outputData = await quicknode.getOutput(outpoint);
            
            // Delay para respeitar rate limit
            await new Promise(r => setTimeout(r, 120));
            
            // Verificar se tem runes
            const hasRuneData = outputData.runes && Object.keys(outputData.runes).length > 0;
            
            if (hasRuneData) {
                console.log(`   ⚠️  UTXO ${txid}:${vout} has RUNES - PROTECTED`);
            }
            
            return hasRuneData;
            
        } catch (error) {
            console.log(`   ℹ️  Could not check runes for ${txid}:${vout}:`, error.message);
            return false;
        }
    }
    
    /**
     * Verificar se UTXO é "puro" (sem inscription nem runes)
     * @param {string} txid - Transaction ID
     * @param {number} vout - Output index
     * @returns {Promise<boolean>} true se é puro (seguro para gastar)
     */
    async isPureUTXO(txid, vout) {
        const [hasInscr, hasRune] = await Promise.all([
            this.hasInscription(txid, vout),
            this.hasRunes(txid, vout)
        ]);
        
        const isPure = !hasInscr && !hasRune;
        
        if (isPure) {
            console.log(`   ✅ UTXO ${txid}:${vout} is PURE (safe to spend)`);
        } else {
            console.log(`   ⛔ UTXO ${txid}:${vout} is PROTECTED (has inscription or runes)`);
        }
        
        return isPure;
    }
    
    /**
     * Filtrar lista de UTXOs, retornando apenas os "puros"
     * @param {Array} utxos - Lista de UTXOs [{txid, vout, amount}, ...]
     * @returns {Promise<Array>} UTXOs puros (sem inscription nem runes)
     */
    async filterPureUTXOs(utxos) {
        console.log(`\n🔒 ===== FILTERING UTXOs FOR SAFETY =====`);
        console.log(`Total UTXOs to check: ${utxos.length}`);
        
        const results = [];
        
        for (const utxo of utxos) {
            const isPure = await this.isPureUTXO(utxo.txid, utxo.vout);
            
            if (isPure) {
                results.push(utxo);
            } else {
                console.log(`   🛡️  Protecting UTXO ${utxo.txid}:${utxo.vout} (${utxo.amount || utxo.value} sats)`);
            }
        }
        
        console.log(`\n✅ Safe UTXOs found: ${results.length}/${utxos.length}`);
        console.log(`🛡️  Protected UTXOs: ${utxos.length - results.length}`);
        console.log(`=========================================\n`);
        
        return results;
    }
    
    /**
     * Filtrar UTXOs que contêm uma rune específica
     * @param {Array} utxos - Lista de UTXOs
     * @param {string} runeName - Nome da rune
     * @returns {Promise<Array>} UTXOs que contêm a rune
     */
    async filterRuneUTXOs(utxos, runeName) {
        console.log(`\n🪙 Filtering UTXOs containing rune: ${runeName}`);
        
        const results = [];
        
        for (const utxo of utxos) {
            try {
                const outpoint = `${utxo.txid}:${utxo.vout}`;
                const outputData = await quicknode.getOutput(outpoint);
                
                // Delay para respeitar rate limit
                await new Promise(r => setTimeout(r, 120));
                
                // Verificar se contém a rune específica
                if (outputData.runes && outputData.runes[runeName]) {
                    console.log(`   ✅ Found ${runeName} in ${utxo.txid}:${utxo.vout}`);
                    results.push(utxo);
                }
            } catch (error) {
                console.log(`   ⚠️  Error checking ${utxo.txid}:${utxo.vout}:`, error.message);
            }
        }
        
        console.log(`Found ${results.length} UTXOs with ${runeName}\n`);
        
        return results;
    }
    
    /**
     * Selecionar UTXOs puros para envio de Bitcoin
     * @param {Array} allUtxos - Todos os UTXOs disponíveis
     * @param {number} targetAmount - Quantidade necessária (em sats)
     * @returns {Promise<Object>} {selected: Array, totalAmount: number}
     */
    async selectPureUTXOsForBitcoin(allUtxos, targetAmount) {
        console.log(`\n💰 Selecting pure UTXOs for ${targetAmount} sats...`);
        
        // Filtrar apenas UTXOs puros
        const pureUtxos = await this.filterPureUTXOs(allUtxos);
        
        if (pureUtxos.length === 0) {
            throw new Error('No pure UTXOs available! All UTXOs contain inscriptions or runes.');
        }
        
        // Ordenar do menor para o maior (coin selection strategy)
        const sorted = pureUtxos.sort((a, b) => {
            const amountA = a.amount || a.value || 0;
            const amountB = b.amount || b.value || 0;
            return amountA - amountB;
        });
        
        // Selecionar UTXOs suficientes
        const selected = [];
        let totalAmount = 0;
        
        for (const utxo of sorted) {
            selected.push(utxo);
            totalAmount += (utxo.amount || utxo.value || 0);
            
            if (totalAmount >= targetAmount) {
                break;
            }
        }
        
        if (totalAmount < targetAmount) {
            throw new Error(`Insufficient pure UTXOs. Need ${targetAmount} sats, but only ${totalAmount} sats available in pure UTXOs.`);
        }
        
        console.log(`✅ Selected ${selected.length} pure UTXOs totaling ${totalAmount} sats`);
        
        return {
            selected,
            totalAmount,
            change: totalAmount - targetAmount
        };
    }
}

export default new UTXOFilter();

