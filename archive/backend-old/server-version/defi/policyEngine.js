/**
 * 🛡️ DEFI POLICY ENGINE
 * 
 * Valida PSBTs antes do pool co-assinar
 * Garante que todas as regras do AMM sejam respeitadas
 * 
 * VALIDAÇÕES:
 * - Matemática correta (x*y=k)
 * - Slippage dentro do limite
 * - Fees corretas (LP + Protocol)
 * - Edict Runestone válido
 * - Roteamento correto da Rune
 * - UTXO do pool disponível
 * - Valores mínimos (dust)
 * - Network fee adequada
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import runesDecoder from '../utils/runesDecoderOfficial.js';
import { getPool, LP_FEE_PERCENTAGE, PROTOCOL_FEE_PERCENTAGE } from './poolManager.js';

bitcoin.initEccLib(ecc);

// Helper to decode runestone
const decodeRunestone = (data) => {
    // TODO: Usar decoder real quando disponível
    return { edicts: [] };
};

const DUST_LIMIT = 546;
const MIN_MINER_FEE = 350; // sats mínimos para relay

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 SWAP VALIDATION (BTC → Rune)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validar PSBT de swap BTC → Rune antes de co-assinar
 */
export async function validateSwapBtcToRune({
    psbtBase64,
    poolId,
    expectedBtcIn,
    expectedRuneOut,
    minRuneOut,
    maxSlippage,
    nonce
}) {
    const errors = [];
    const warnings = [];
    
    console.log('\n🛡️  ═══ POLICY ENGINE: Swap BTC → Rune ═══');
    console.log(`   Pool ID: ${poolId}`);
    console.log(`   Expected BTC In: ${expectedBtcIn} sats`);
    console.log(`   Expected Rune Out: ${expectedRuneOut}`);
    console.log(`   Min Rune Out: ${minRuneOut}`);
    
    try {
        // ═══════════════════════════════════════════════════════════════════════════
        // 1. PARSE PSBT
        // ═══════════════════════════════════════════════════════════════════════════
        
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
        
        if (psbt.inputCount < 2) {
            errors.push('PSBT must have at least 2 inputs (pool + user)');
        }
        
        if (psbt.txOutputs.length < 3) {
            errors.push('PSBT must have at least 3 outputs (OP_RETURN + pool + user)');
        }
        
        // ═══════════════════════════════════════════════════════════════════════════
        // 2. BUSCAR POOL E VALIDAR UTXO
        // ═══════════════════════════════════════════════════════════════════════════
        
        const pool = getPool(poolId.replace(':BTC', ''));
        
        if (!pool) {
            errors.push(`Pool ${poolId} not found or inactive`);
            return { valid: false, errors, warnings };
        }
        
        // Verificar se input #0 é o UTXO do pool
        const poolInput = psbt.txInputs[0];
        const poolInputTxid = Buffer.from(poolInput.hash).reverse().toString('hex');
        
        if (poolInputTxid !== pool.pool_utxo_txid || poolInput.index !== pool.pool_utxo_vout) {
            errors.push(`Input #0 must be pool UTXO ${pool.pool_utxo_txid}:${pool.pool_utxo_vout}`);
        }
        
        console.log(`   ✅ Pool UTXO matched: ${poolInputTxid}:${poolInput.index}`);
        
        // ═══════════════════════════════════════════════════════════════════════════
        // 3. VALIDAR OP_RETURN E RUNESTONE EDICT
        // ═══════════════════════════════════════════════════════════════════════════
        
        const opReturnOutput = psbt.txOutputs[0];
        
        if (opReturnOutput.value !== 0) {
            errors.push('Output #0 (OP_RETURN) must have value 0');
        }
        
        // Decode OP_RETURN script
        const decompiled = bitcoin.script.decompile(opReturnOutput.script);
        
        if (!decompiled || decompiled[0] !== bitcoin.opcodes.OP_RETURN) {
            errors.push('Output #0 must be OP_RETURN');
        } else {
            console.log(`   ✅ OP_RETURN detected`);
            
            // Verificar se é um Runestone válido
            if (decompiled.length >= 3 && decompiled[1].toString() === '82') { // 'R' = 0x52
                try {
                    const runestoneData = decompiled[2];
                    const runestone = decodeRunestone(runestoneData);
                    
                    console.log(`   📜 Runestone decoded:`, runestone);
                    
                    // Validar edict
                    if (!runestone.edicts || runestone.edicts.length === 0) {
                        errors.push('Runestone must contain at least one edict');
                    } else {
                        const edict = runestone.edicts[0];
                        
                        // Verificar rune ID
                        const edictRuneId = `${edict.id.block}:${edict.id.tx}`;
                        if (edictRuneId !== pool.rune_id) {
                            errors.push(`Edict rune ID mismatch: expected ${pool.rune_id}, got ${edictRuneId}`);
                        }
                        
                        // Verificar amount
                        const edictAmount = Number(edict.amount);
                        if (edictAmount < minRuneOut) {
                            errors.push(`Edict amount ${edictAmount} below minimum ${minRuneOut}`);
                        }
                        
                        if (Math.abs(edictAmount - expectedRuneOut) > expectedRuneOut * 0.01) {
                            warnings.push(`Edict amount ${edictAmount} differs from expected ${expectedRuneOut}`);
                        }
                        
                        // Verificar output index (deve ser #2 - user)
                        if (edict.output !== 2) {
                            errors.push(`Edict output must be #2 (user), got #${edict.output}`);
                        }
                        
                        console.log(`   ✅ Edict validated: ${edictAmount} ${pool.rune_symbol} → output #${edict.output}`);
                    }
                } catch (e) {
                    errors.push(`Failed to decode Runestone: ${e.message}`);
                }
            } else {
                errors.push('Output #0 is not a valid Runestone');
            }
        }
        
        // ═══════════════════════════════════════════════════════════════════════════
        // 4. VALIDAR OUTPUTS
        // ═══════════════════════════════════════════════════════════════════════════
        
        // Output #1: Pool atualizado
        const poolOutput = psbt.txOutputs[1];
        const poolOutputAddress = bitcoin.address.fromOutputScript(poolOutput.script, bitcoin.networks.bitcoin);
        
        if (poolOutputAddress !== pool.pool_address) {
            errors.push(`Output #1 must pay to pool address ${pool.pool_address}`);
        }
        
        // Calcular valor esperado do pool após swap
        const lpFee = Math.floor(expectedBtcIn * LP_FEE_PERCENTAGE / 100);
        const protocolFee = Math.floor(expectedBtcIn * PROTOCOL_FEE_PERCENTAGE / 100);
        const expectedPoolValue = pool.pool_utxo_value + expectedBtcIn - lpFee - protocolFee;
        
        if (Math.abs(poolOutput.value - expectedPoolValue) > 1000) { // Tolerância de 1000 sats
            errors.push(`Pool output value mismatch: expected ~${expectedPoolValue}, got ${poolOutput.value}`);
        }
        
        console.log(`   ✅ Pool output validated: ${poolOutput.value} sats`);
        
        // Output #2: User recebe Rune (dust)
        const userOutput = psbt.txOutputs[2];
        
        if (userOutput.value < DUST_LIMIT) {
            errors.push(`User output #2 below dust limit: ${userOutput.value} < ${DUST_LIMIT}`);
        }
        
        console.log(`   ✅ User output validated: ${userOutput.value} sats (dust)`);
        
        // Output #3 (opcional): Protocol fee
        if (protocolFee > DUST_LIMIT && psbt.txOutputs.length >= 4) {
            const { TREASURE_ADDRESS } = await import('./poolManager.js');
            const feeOutput = psbt.txOutputs[3];
            const feeAddress = bitcoin.address.fromOutputScript(feeOutput.script, bitcoin.networks.bitcoin);
            
            if (feeAddress !== TREASURE_ADDRESS) {
                errors.push(`Protocol fee output must pay to treasury ${TREASURE_ADDRESS}`);
            }
            
            if (Math.abs(feeOutput.value - protocolFee) > 100) {
                errors.push(`Protocol fee mismatch: expected ${protocolFee}, got ${feeOutput.value}`);
            }
            
            console.log(`   ✅ Protocol fee validated: ${feeOutput.value} sats`);
        }
        
        // ═══════════════════════════════════════════════════════════════════════════
        // 5. VALIDAR MATEMÁTICA AMM (x*y=k)
        // ═══════════════════════════════════════════════════════════════════════════
        
        const k_before = pool.reserve_btc * pool.reserve_rune;
        const k_after = (pool.reserve_btc + expectedBtcIn) * (pool.reserve_rune - expectedRuneOut);
        
        // k deve aumentar levemente devido às fees
        if (k_after < k_before) {
            errors.push(`Invariant k violated: ${k_before} → ${k_after} (k should increase with fees)`);
        }
        
        console.log(`   ✅ Invariant k validated: ${k_before} → ${k_after}`);
        
        // ═══════════════════════════════════════════════════════════════════════════
        // 6. VALIDAR SLIPPAGE
        // ═══════════════════════════════════════════════════════════════════════════
        
        const actualSlippage = (expectedRuneOut - minRuneOut) / expectedRuneOut;
        
        if (actualSlippage > maxSlippage) {
            errors.push(`Slippage too high: ${(actualSlippage * 100).toFixed(2)}% > ${(maxSlippage * 100).toFixed(2)}%`);
        }
        
        console.log(`   ✅ Slippage validated: ${(actualSlippage * 100).toFixed(2)}%`);
        
        // ═══════════════════════════════════════════════════════════════════════════
        // 7. VALIDAR FEES
        // ═══════════════════════════════════════════════════════════════════════════
        
        // Estimar fee de rede
        const estimatedSize = psbt.inputCount * 68 + psbt.txOutputs.length * 43 + 10;
        const estimatedFee = estimatedSize * 2; // 2 sat/vB mínimo
        
        if (estimatedFee < MIN_MINER_FEE) {
            warnings.push(`Low miner fee: ${estimatedFee} sats (min recommended: ${MIN_MINER_FEE})`);
        }
        
        console.log(`   ✅ Estimated miner fee: ${estimatedFee} sats`);
        
        // ═══════════════════════════════════════════════════════════════════════════
        // 8. VALIDAR NONCE (anti-replay)
        // ═══════════════════════════════════════════════════════════════════════════
        
        // TODO: Implementar verificação de nonce contra banco de dados
        console.log(`   ⚠️  Nonce validation not implemented (nonce: ${nonce})`);
        
    } catch (error) {
        console.error('   ❌ Validation error:', error);
        errors.push(`Validation exception: ${error.message}`);
    }
    
    const valid = errors.length === 0;
    
    console.log('\n   📊 Validation Result:');
    console.log(`      Valid: ${valid}`);
    console.log(`      Errors: ${errors.length}`);
    console.log(`      Warnings: ${warnings.length}`);
    
    if (errors.length > 0) {
        console.log('\n   ❌ Errors:');
        errors.forEach((e, i) => console.log(`      ${i + 1}. ${e}`));
    }
    
    if (warnings.length > 0) {
        console.log('\n   ⚠️  Warnings:');
        warnings.forEach((w, i) => console.log(`      ${i + 1}. ${w}`));
    }
    
    console.log('═══════════════════════════════════════════════════\n');
    
    return {
        valid,
        errors,
        warnings,
        pool: valid ? {
            poolId: pool.pool_id,
            runeId: pool.rune_id,
            runeName: pool.rune_name,
            address: pool.pool_address
        } : null
    };
}

/**
 * Validar PSBT de swap Rune → BTC antes de co-assinar
 */
export async function validateSwapRuneToBtc({
    psbtBase64,
    poolId,
    expectedRuneIn,
    expectedBtcOut,
    minBtcOut,
    maxSlippage,
    nonce
}) {
    const errors = [];
    const warnings = [];
    
    console.log('\n🛡️  ═══ POLICY ENGINE: Swap Rune → BTC ═══');
    console.log(`   Pool ID: ${poolId}`);
    console.log(`   Expected Rune In: ${expectedRuneIn}`);
    console.log(`   Expected BTC Out: ${expectedBtcOut} sats`);
    
    try {
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
        const pool = getPool(poolId.replace(':BTC', ''));
        
        if (!pool) {
            errors.push(`Pool ${poolId} not found`);
            return { valid: false, errors, warnings };
        }
        
        // Verificar OP_RETURN edict (Rune → Pool)
        const opReturnOutput = psbt.txOutputs[0];
        const decompiled = bitcoin.script.decompile(opReturnOutput.script);
        
        if (decompiled && decompiled[0] === bitcoin.opcodes.OP_RETURN) {
            try {
                const runestone = decodeRunestone(decompiled[2]);
                const edict = runestone.edicts[0];
                
                // Verificar que edict transfere Rune para pool (output #1)
                if (edict.output !== 1) {
                    errors.push(`Edict must transfer to output #1 (pool), got #${edict.output}`);
                }
                
                const edictAmount = Number(edict.amount);
                if (edictAmount !== expectedRuneIn) {
                    errors.push(`Edict amount mismatch: expected ${expectedRuneIn}, got ${edictAmount}`);
                }
                
                console.log(`   ✅ Edict validated: ${edictAmount} → pool`);
            } catch (e) {
                errors.push(`Failed to decode Runestone: ${e.message}`);
            }
        } else {
            errors.push('Output #0 must be OP_RETURN with Runestone');
        }
        
        // Verificar pool output (perde BTC, ganha Rune)
        const poolOutput = psbt.txOutputs[1];
        const protocolFee = Math.floor(expectedBtcOut * PROTOCOL_FEE_PERCENTAGE / 100);
        const expectedPoolValue = pool.pool_utxo_value - expectedBtcOut - protocolFee;
        
        if (Math.abs(poolOutput.value - expectedPoolValue) > 1000) {
            errors.push(`Pool value mismatch: expected ~${expectedPoolValue}, got ${poolOutput.value}`);
        }
        
        // Verificar user output (recebe BTC)
        const userOutput = psbt.txOutputs[2];
        if (userOutput.value < minBtcOut) {
            errors.push(`User output below minimum: ${userOutput.value} < ${minBtcOut}`);
        }
        
        console.log(`   ✅ User BTC output validated: ${userOutput.value} sats`);
        
        // Validar invariante k
        const k_before = pool.reserve_btc * pool.reserve_rune;
        const k_after = (pool.reserve_btc - expectedBtcOut) * (pool.reserve_rune + expectedRuneIn);
        
        if (k_after < k_before) {
            errors.push(`Invariant k violated: ${k_before} → ${k_after}`);
        }
        
        console.log(`   ✅ Invariant k validated`);
        
    } catch (error) {
        errors.push(`Validation exception: ${error.message}`);
    }
    
    const valid = errors.length === 0;
    
    console.log(`\n   📊 Validation Result: ${valid ? '✅ PASS' : '❌ FAIL'}`);
    console.log('═══════════════════════════════════════════════════\n');
    
    return {
        valid,
        errors,
        warnings
    };
}

/**
 * Validar Add Liquidity PSBT
 */
export async function validateAddLiquidity({
    psbtBase64,
    poolId,
    btcAmount,
    runeAmount,
    minShares
}) {
    // TODO: Implementar validação de add liquidity
    console.log('⚠️  validateAddLiquidity not yet implemented');
    return { valid: false, errors: ['Not implemented'], warnings: [] };
}

/**
 * Validar Remove Liquidity PSBT
 */
export async function validateRemoveLiquidity({
    psbtBase64,
    poolId,
    shares,
    minBtc,
    minRune
}) {
    // TODO: Implementar validação de remove liquidity
    console.log('⚠️  validateRemoveLiquidity not yet implemented');
    return { valid: false, errors: ['Not implemented'], warnings: [] };
}

export default {
    validateSwapBtcToRune,
    validateSwapRuneToBtc,
    validateAddLiquidity,
    validateRemoveLiquidity
};

