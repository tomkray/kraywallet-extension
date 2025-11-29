/**
 * 💰 MEMPOOL FEES - Dynamic Bitcoin Network Fees
 * 
 * Busca fees recomendados do mempool.space em tempo real
 * 
 * @author KRAY Team
 * @version 1.0
 */

import axios from 'axios';

const MEMPOOL_API = 'https://mempool.space/api/v1/fees/recommended';
const CACHE_DURATION = 60000; // 1 minuto

let cachedFees = null;
let lastFetch = 0;

/**
 * Buscar fees recomendados do mempool.space
 * 
 * @returns {Object} Fees recomendados
 * {
 *   fastestFee: 15,    // Next block (~10 min)
 *   halfHourFee: 10,   // ~30 min
 *   hourFee: 8,        // ~1 hour
 *   economyFee: 5,     // Low priority
 *   minimumFee: 1      // Muito lento
 * }
 */
export async function getRecommendedFees() {
    const now = Date.now();
    
    // Usar cache se ainda válido
    if (cachedFees && (now - lastFetch) < CACHE_DURATION) {
        console.log('   📦 Using cached fees');
        return cachedFees;
    }
    
    try {
        console.log('   📡 Fetching fees from mempool.space...');
        
        const response = await axios.get(MEMPOOL_API, {
            timeout: 5000,
            headers: {
                'User-Agent': 'KRAY-Wallet/1.0'
            }
        });
        
        const fees = response.data;
        
        // Validar resposta
        if (!fees.fastestFee || !fees.halfHourFee) {
            throw new Error('Invalid mempool.space response');
        }
        
        // Atualizar cache
        cachedFees = fees;
        lastFetch = now;
        
        console.log('   ✅ Fees fetched from mempool.space:');
        console.log('      Fastest (~10 min):', fees.fastestFee, 'sats/vB');
        console.log('      Half hour:', fees.halfHourFee, 'sats/vB');
        console.log('      Hour:', fees.hourFee, 'sats/vB');
        console.log('      Economy:', fees.economyFee, 'sats/vB');
        console.log('      Minimum:', fees.minimumFee, 'sats/vB');
        
        return fees;
        
    } catch (error) {
        console.warn('   ⚠️  Failed to fetch mempool fees:', error.message);
        console.warn('   Using fallback fees');
        
        // Fallback conservador
        const fallbackFees = {
            fastestFee: 20,
            halfHourFee: 10,
            hourFee: 8,
            economyFee: 5,
            minimumFee: 1
        };
        
        // Atualizar cache com fallback
        cachedFees = fallbackFees;
        lastFetch = now;
        
        return fallbackFees;
    }
}

/**
 * Pegar fee padrão (balanceado)
 * 
 * @returns {number} Fee rate em sats/vB
 */
export async function getDefaultFeeRate() {
    const fees = await getRecommendedFees();
    return fees.halfHourFee; // Padrão: ~30 minutos
}

/**
 * Pegar fee rápido (priority)
 * 
 * @returns {number} Fee rate em sats/vB
 */
export async function getFastFeeRate() {
    const fees = await getRecommendedFees();
    return fees.fastestFee; // Next block (~10 min)
}

/**
 * Pegar fee econômico (cheap)
 * 
 * @returns {number} Fee rate em sats/vB
 */
export async function getEconomyFeeRate() {
    const fees = await getRecommendedFees();
    return fees.economyFee; // Low priority
}

/**
 * Estimar tempo de confirmação baseado no fee rate
 * 
 * @param {number} feeRate - Fee rate em sats/vB
 * @returns {string} Tempo estimado
 */
export async function estimateConfirmationTime(feeRate) {
    const fees = await getRecommendedFees();
    
    if (feeRate >= fees.fastestFee) {
        return '~10 minutes (next block)';
    } else if (feeRate >= fees.halfHourFee) {
        return '~30 minutes';
    } else if (feeRate >= fees.hourFee) {
        return '~1 hour';
    } else if (feeRate >= fees.economyFee) {
        return '~2-4 hours';
    } else {
        return '~4+ hours (low priority)';
    }
}

/**
 * Calcular fee total baseado no tamanho estimado
 * 
 * @param {number} estimatedSize - Tamanho em vB
 * @param {number} feeRate - Fee rate em sats/vB (opcional, usa default se não fornecido)
 * @returns {Object} { fee, feeRate, estimatedTime }
 */
export async function calculateFee(estimatedSize, customFeeRate = null) {
    const feeRate = customFeeRate || await getDefaultFeeRate();
    const fee = Math.ceil(estimatedSize * feeRate);
    const estimatedTime = await estimateConfirmationTime(feeRate);
    
    return {
        fee,
        feeRate,
        estimatedSize,
        estimatedTime
    };
}

export default {
    getRecommendedFees,
    getDefaultFeeRate,
    getFastFeeRate,
    getEconomyFeeRate,
    estimateConfirmationTime,
    calculateFee
};

