/**
 * 🌊 AMM Calculator - Automated Market Maker
 * 
 * Implementa a fórmula x * y = k (Constant Product Formula)
 * Usada por Uniswap, PancakeSwap, e agora MyWallet DEX!
 * 
 * Recursos:
 * - Cálculo de preços de swap
 * - Cálculo de LP tokens
 * - Slippage protection
 * - Fee calculations
 */

export class AMMCalculator {
    /**
     * Calcular output de um swap usando x*y=k
     * 
     * @param {number} amountIn - Quantidade de input
     * @param {number} reserveIn - Reserva do token input
     * @param {number} reserveOut - Reserva do token output
     * @param {number} feeRate - Taxa da pool (em basis points, ex: 30 = 0.3%)
     * @returns {Object} { amountOut, priceImpact, effectivePrice }
     */
    static calculateSwapOutput(amountIn, reserveIn, reserveOut, feeRate = 30) {
        if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) {
            throw new Error('Invalid swap parameters: amounts must be positive');
        }

        // Aplicar fee (ex: 30 basis points = 0.3%)
        const amountInWithFee = amountIn * (10000 - feeRate) / 10000;
        
        // Fórmula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        // Usando BigInt para evitar overflow
        const amountInBig = BigInt(Math.floor(amountInWithFee));
        const reserveInBig = BigInt(reserveIn);
        const reserveOutBig = BigInt(reserveOut);
        
        const numerator = amountInBig * reserveOutBig;
        const denominator = reserveInBig + amountInBig;
        
        const amountOut = Number(numerator / denominator);
        
        // Calcular price impact (quanto o preço mudou)
        const priceBeforeSwap = reserveOut / reserveIn;
        const priceAfterSwap = (reserveOut - amountOut) / (reserveIn + amountIn);
        const priceImpact = Math.abs((priceAfterSwap - priceBeforeSwap) / priceBeforeSwap) * 100;
        
        // Preço efetivo deste swap
        const effectivePrice = amountOut / amountIn;
        
        return {
            amountOut: Math.floor(amountOut),
            priceImpact: priceImpact.toFixed(2),
            effectivePrice: effectivePrice.toFixed(8),
            feeAmount: amountIn - amountInWithFee
        };
    }

    /**
     * Calcular input necessário para obter um output desejado
     * 
     * @param {number} amountOut - Quantidade desejada de output
     * @param {number} reserveIn - Reserva do token input
     * @param {number} reserveOut - Reserva do token output
     * @param {number} feeRate - Taxa da pool
     * @returns {Object} { amountIn, priceImpact, effectivePrice }
     */
    static calculateSwapInput(amountOut, reserveIn, reserveOut, feeRate = 30) {
        if (amountOut <= 0 || reserveIn <= 0 || reserveOut <= 0) {
            throw new Error('Invalid swap parameters');
        }
        
        if (amountOut >= reserveOut) {
            throw new Error('Insufficient liquidity: output exceeds reserves');
        }

        // Fórmula invertida: amountIn = (reserveIn * amountOut) / (reserveOut - amountOut)
        const numerator = BigInt(reserveIn) * BigInt(amountOut);
        const denominator = BigInt(reserveOut - amountOut);
        
        let amountIn = Number(numerator / denominator);
        
        // Adicionar fee
        amountIn = Math.ceil(amountIn * 10000 / (10000 - feeRate));
        
        // Calcular price impact
        const priceBeforeSwap = reserveOut / reserveIn;
        const priceAfterSwap = (reserveOut - amountOut) / (reserveIn + amountIn);
        const priceImpact = Math.abs((priceAfterSwap - priceBeforeSwap) / priceBeforeSwap) * 100;
        
        const effectivePrice = amountOut / amountIn;
        
        return {
            amountIn,
            priceImpact: priceImpact.toFixed(2),
            effectivePrice: effectivePrice.toFixed(8)
        };
    }

    /**
     * Calcular LP tokens ao adicionar liquidez
     * 
     * @param {number} amountA - Quantidade do token A
     * @param {number} amountB - Quantidade do token B
     * @param {number} reserveA - Reserva atual do token A
     * @param {number} reserveB - Reserva atual do token B
     * @param {number} totalSupply - Supply total de LP tokens
     * @returns {Object} { lpTokens, shareOfPool }
     */
    static calculateLPTokens(amountA, amountB, reserveA, reserveB, totalSupply) {
        if (amountA <= 0 || amountB <= 0) {
            throw new Error('Invalid liquidity amounts');
        }

        let lpTokens;
        
        if (totalSupply === 0 || reserveA === 0 || reserveB === 0) {
            // Pool nova: LP tokens = sqrt(amountA * amountB)
            lpTokens = Math.floor(Math.sqrt(amountA * amountB));
            
            // Minimum liquidity (prevenir edge cases)
            if (lpTokens < 1000) {
                throw new Error('Initial liquidity too small (minimum 1000 LP tokens)');
            }
        } else {
            // Pool existente: LP tokens proporcional à contribuição
            const lpTokensFromA = (amountA * totalSupply) / reserveA;
            const lpTokensFromB = (amountB * totalSupply) / reserveB;
            
            // Usar o menor para garantir proporção correta
            lpTokens = Math.floor(Math.min(lpTokensFromA, lpTokensFromB));
        }

        // Calcular share da pool
        const newTotalSupply = totalSupply + lpTokens;
        const shareOfPool = (lpTokens / newTotalSupply) * 100;

        return {
            lpTokens,
            shareOfPool: shareOfPool.toFixed(4),
            newTotalSupply
        };
    }

    /**
     * Calcular quanto receber ao remover liquidez
     * 
     * @param {number} lpTokens - Quantidade de LP tokens a queimar
     * @param {number} totalSupply - Supply total de LP tokens
     * @param {number} reserveA - Reserva do token A
     * @param {number} reserveB - Reserva do token B
     * @returns {Object} { amountA, amountB }
     */
    static calculateRemoveLiquidity(lpTokens, totalSupply, reserveA, reserveB) {
        if (lpTokens <= 0 || lpTokens > totalSupply) {
            throw new Error('Invalid LP token amount');
        }

        // Proporção = lpTokens / totalSupply
        const share = lpTokens / totalSupply;
        
        const amountA = Math.floor(reserveA * share);
        const amountB = Math.floor(reserveB * share);

        return {
            amountA,
            amountB,
            share: (share * 100).toFixed(4)
        };
    }

    /**
     * Calcular preço atual de um token na pool
     * 
     * @param {number} reserveA - Reserva do token A
     * @param {number} reserveB - Reserva do token B
     * @returns {Object} { priceAinB, priceBinA }
     */
    static calculatePrice(reserveA, reserveB) {
        if (reserveA <= 0 || reserveB <= 0) {
            return { priceAinB: 0, priceBinA: 0 };
        }

        return {
            priceAinB: (reserveB / reserveA).toFixed(8),  // Quanto B vale 1 A
            priceBinA: (reserveA / reserveB).toFixed(8)   // Quanto A vale 1 B
        };
    }

    /**
     * Validar slippage tolerance
     * 
     * @param {number} expectedAmount - Quantidade esperada
     * @param {number} actualAmount - Quantidade real
     * @param {number} slippageTolerance - Tolerância em % (ex: 0.5 = 0.5%)
     * @returns {boolean}
     */
    static validateSlippage(expectedAmount, actualAmount, slippageTolerance = 0.5) {
        const minAcceptable = expectedAmount * (1 - slippageTolerance / 100);
        return actualAmount >= minAcceptable;
    }

    /**
     * Calcular APR estimado baseado em volume e fees
     * 
     * @param {number} volume24h - Volume de 24h
     * @param {number} totalLiquidity - TVL da pool
     * @param {number} feeRate - Taxa da pool (basis points)
     * @returns {number} APR em %
     */
    static calculateAPR(volume24h, totalLiquidity, feeRate = 30) {
        if (totalLiquidity <= 0) return 0;

        // Fees geradas em 24h
        const dailyFees = volume24h * (feeRate / 10000);
        
        // Extrapolar para ano (365 dias)
        const annualFees = dailyFees * 365;
        
        // APR = (annual fees / TVL) * 100
        const apr = (annualFees / totalLiquidity) * 100;

        return apr.toFixed(2);
    }

    /**
     * Calcular optimal amounts para adicionar liquidez (manter proporção)
     * 
     * @param {number} amountADesired - Quanto de A o usuário quer adicionar
     * @param {number} reserveA - Reserva atual de A
     * @param {number} reserveB - Reserva atual de B
     * @returns {Object} { amountA, amountB, ratio }
     */
    static calculateOptimalLiquidity(amountADesired, reserveA, reserveB) {
        if (reserveA === 0 || reserveB === 0) {
            // Pool nova: usuário define a proporção
            return {
                amountA: amountADesired,
                amountB: 0,  // Usuário deve especificar
                ratio: 0
            };
        }

        // Pool existente: manter proporção
        const ratio = reserveB / reserveA;
        const amountBOptimal = Math.floor(amountADesired * ratio);

        return {
            amountA: amountADesired,
            amountB: amountBOptimal,
            ratio: ratio.toFixed(8)
        };
    }
}

export default AMMCalculator;




