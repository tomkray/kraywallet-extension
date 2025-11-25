import crypto from 'crypto';

// Gerar ID único
export function generateOfferId() {
    return Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
}

// Validar endereço Bitcoin
export function isValidBitcoinAddress(address) {
    // Regex simplificado - em produção use bitcoinjs-lib
    const bech32Regex = /^(bc1|tb1)[a-z0-9]{39,87}$/i;
    const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const p2shRegex = /^3[a-km-zA-HJ-NP-Z1-9]{33}$/;
    
    return bech32Regex.test(address) || legacyRegex.test(address) || p2shRegex.test(address);
}

// Formatar satoshis para BTC
export function satsToBTC(sats) {
    return (sats / 100000000).toFixed(8);
}

// Formatar BTC para satoshis
export function btcToSats(btc) {
    return Math.floor(btc * 100000000);
}

// Calcular fee total
export function calculateFee(vsize, feeRate) {
    return vsize * feeRate;
}

// Estimar vsize de transação
export function estimateVsize(inputs, outputs) {
    // Estimativa simplificada
    // P2WPKH: ~68 vB por input, ~31 vB por output
    const overhead = 10.5; // versão, locktime, etc
    const inputSize = inputs * 68;
    const outputSize = outputs * 31;
    
    return Math.ceil(overhead + inputSize + outputSize);
}

// Validar PSBT básico
export function isValidPSBT(psbt) {
    if (!psbt || typeof psbt !== 'string') return false;
    
    // PSBT sempre começa com "cHNidP8" (base64 de "psbt\xff")
    return psbt.startsWith('cHNidP8');
}

// Truncar string (para display)
export function truncateString(str, start = 8, end = 8) {
    if (!str || str.length <= start + end) return str;
    return `${str.slice(0, start)}...${str.slice(-end)}`;
}

// Formatar timestamp
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString();
}

// Calcular tempo desde
export function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
        }
    }
    
    return 'just now';
}

// Validar fee rate
export function isValidFeeRate(feeRate) {
    const rate = parseInt(feeRate);
    return !isNaN(rate) && rate >= 1 && rate <= 1000;
}

// Calcular price impact
export function calculatePriceImpact(amountIn, reserveIn, reserveOut) {
    if (reserveIn === 0 || reserveOut === 0) return 0;
    
    const impact = (amountIn / reserveIn) * 100;
    return Math.min(impact, 100); // Cap at 100%
}

// Aplicar slippage
export function applySlippage(amount, slippagePercent) {
    return Math.floor(amount * (1 - slippagePercent / 100));
}

export default {
    generateOfferId,
    isValidBitcoinAddress,
    satsToBTC,
    btcToSats,
    calculateFee,
    estimateVsize,
    isValidPSBT,
    truncateString,
    formatTimestamp,
    timeAgo,
    isValidFeeRate,
    calculatePriceImpact,
    applySlippage
};











