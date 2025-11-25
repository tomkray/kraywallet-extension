/**
 * 🔨 RUNES DEFI PSBT BUILDER
 * 
 * Constrói PSBTs Runes-aware para operações de DeFi:
 * - Swaps (troca entre Rune e BTC)
 * - Add Liquidity (adicionar liquidez ao pool)
 * - Remove Liquidity (remover liquidez do pool)
 * 
 * Baseado no modelo RichSwap com OP_RETURN edicts
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { TREASURE_ADDRESS } from './poolManager.js';

bitcoin.initEccLib(ecc);

// TODO: Implementar encode completo do Runestone
// Por enquanto, usando placeholder
function encodeRunestone(runestone) {
    // Placeholder - implementar encoding completo
    return Buffer.from('mock_runestone');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 CREATE POOL PSBT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Construir PSBT para criar pool de liquidez
 * 
 * @param {Object} params
 * @param {Array} params.userUtxos - UTXOs do user (BTC + Runes)
 * @param {string} params.poolAddress - Endereço do pool (Taproot 2-of-2)
 * @param {string} params.userAddress - Endereço do user (para change)
 * @param {string} params.runeId - ID da rune (ex: "840000:3")
 * @param {number} params.runeAmount - Quantidade de runes para o pool
 * @param {number} params.btcAmount - Quantidade de BTC para o pool (sats)
 * @param {number} params.feeRate - Fee rate (sats/vbyte)
 * @returns {bitcoin.Psbt}
 */
export function buildCreatePoolPSBT({
    userUtxos,
    poolAddress,
    userAddress,
    runeId,
    runeAmount,
    btcAmount,
    feeRate = 10
}) {
    const network = bitcoin.networks.bitcoin;
    const psbt = new bitcoin.Psbt({ network });
    
    console.log('🏊 Building Create Pool PSBT...');
    console.log('   Pool Address:', poolAddress);
    console.log('   Rune:', runeId, 'Amount:', runeAmount);
    console.log('   BTC Amount:', btcAmount, 'sats');
    
    // Selecionar UTXOs do user
    let totalInputValue = 0;
    let runeInputFound = false;
    
    for (const utxo of userUtxos) {
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(utxo.scriptPubKey, 'hex'),
                value: utxo.value
            },
            tapInternalKey: utxo.tapInternalKey ? Buffer.from(utxo.tapInternalKey, 'hex') : undefined
        });
        
        totalInputValue += utxo.value;
        
        // Verificar se este UTXO tem a rune
        if (utxo.runes && utxo.runes.some(r => r.id === runeId)) {
            runeInputFound = true;
        }
    }
    
    if (!runeInputFound) {
        throw new Error(`No UTXO found with rune ${runeId}`);
    }
    
    console.log('   Total input value:', totalInputValue, 'sats');
    
    // OUTPUT 0: Pool address (recebe BTC + Runes)
    psbt.addOutput({
        address: poolAddress,
        value: btcAmount + 546 // BTC + dust para as runes
    });
    
    console.log('   Output 0 (pool):', btcAmount + 546, 'sats');
    
    // OUTPUT 1: OP_RETURN com Runestone (transfere runes para output 0)
    const edict = createRuneEdict(runeId, runeAmount, 0);
    const runestoneOutput = buildRunestoneOutput([edict]);
    
    psbt.addOutput(runestoneOutput);
    console.log('   Output 1 (OP_RETURN): Runestone');
    
    // OUTPUT 2: Change (troco para user)
    const estimatedFee = 300 * feeRate; // ~300 vbytes estimado
    const changeAmount = totalInputValue - (btcAmount + 546) - estimatedFee;
    
    if (changeAmount > 546) {
        psbt.addOutput({
            address: userAddress,
            value: changeAmount
        });
        console.log('   Output 2 (change):', changeAmount, 'sats');
    } else {
        console.log('   No change output (amount too small)');
    }
    
    console.log('✅ Create Pool PSBT built successfully');
    
    return psbt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 RUNES EDICT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Criar edict para transferir runes
 * 
 * @param {string} runeId - ID da rune (ex: "840000:3")
 * @param {number} amount - Quantidade a transferir
 * @param {number} outputIndex - Índice do output destino
 */
function createRuneEdict(runeId, amount, outputIndex) {
    const [block, tx] = runeId.split(':').map(Number);
    
    return {
        id: { block, tx },
        amount: BigInt(amount),
        output: outputIndex
    };
}

/**
 * Construir OP_RETURN com Runestone
 * 
 * @param {Array} edicts - Array de edicts [{id, amount, output}]
 * @param {number} pointer - Pointer padrão (opcional)
 */
function buildRunestoneOutput(edicts, pointer = null) {
    const runestone = {
        edicts: edicts.map(e => ({
            id: e.id,
            amount: e.amount,
            output: e.output
        }))
    };
    
    if (pointer !== null) {
        runestone.pointer = pointer;
    }
    
    // Encode runestone to buffer
    const runestoneBuffer = encodeRunestone(runestone);
    
    // Create OP_RETURN script
    const script = bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN,
        Buffer.from([0x52]), // 'R' - Runes protocol ID
        runestoneBuffer
    ]);
    
    return {
        script,
        value: 0 // OP_RETURN sempre tem valor 0
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔨 SWAP PSBT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Construir PSBT para swap: BTC → Rune
 * 
 * FLUXO:
 * Input #0: Pool UTXO (unsigned) - contém a liquidez
 * Input #1+: User UTXOs (signed) - BTC para pagar
 * Output #0: OP_RETURN - edict transferindo Rune para user
 * Output #1: Pool UTXO updated - liquidez atualizada
 * Output #2: User recebe Rune (546 sats dust)
 * Output #3: User change (se houver)
 */
export function buildSwapBtcToRunePSBT({
    pool,
    userInputs,
    userAddress,
    userChangeAddress,
    btcAmount,
    runeAmountOut,
    minRuneOut,
    lpFee,
    protocolFee,
    minerFee,
    network = 'mainnet'
}) {
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    const psbt = new bitcoin.Psbt({ network: btcNetwork });
    
    console.log('\n🔨 ═══ BUILDING SWAP PSBT (BTC → Rune) ═══');
    console.log(`   Pool: ${pool.pool_id}`);
    console.log(`   BTC In: ${btcAmount} sats`);
    console.log(`   Rune Out: ${runeAmountOut} (min: ${minRuneOut})`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INPUT #0: Pool UTXO (será assinado pelo pool depois)
    // ═══════════════════════════════════════════════════════════════════════════
    
    psbt.addInput({
        hash: pool.pool_utxo_txid,
        index: pool.pool_utxo_vout,
        witnessUtxo: {
            script: Buffer.from(pool.pool_utxo_script, 'hex'),
            value: pool.pool_utxo_value
        },
        tapInternalKey: Buffer.from(pool.pool_pubkey, 'hex')
    });
    
    console.log(`   ✅ Input #0: Pool UTXO ${pool.pool_utxo_txid}:${pool.pool_utxo_vout}`);
    console.log(`      Value: ${pool.pool_utxo_value} sats`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INPUTS #1+: User UTXOs (já assinados ou para assinar)
    // ═══════════════════════════════════════════════════════════════════════════
    
    let totalUserInput = 0;
    
    for (const utxo of userInputs) {
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(utxo.scriptPubKey, 'hex'),
                value: utxo.value
            }
        });
        
        totalUserInput += utxo.value;
        console.log(`   ✅ Input #${psbt.inputCount - 1}: User UTXO ${utxo.txid}:${utxo.vout} (${utxo.value} sats)`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // OUTPUT #0: OP_RETURN com Runestone edict
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Edict: transferir runeAmountOut da rune para output #2 (user)
    const edicts = [
        createRuneEdict(pool.rune_id, runeAmountOut, 2)
    ];
    
    const runestoneOutput = buildRunestoneOutput(edicts);
    
    psbt.addOutput(runestoneOutput);
    
    console.log(`   ✅ Output #0: OP_RETURN (Runestone)`);
    console.log(`      Edict: Transfer ${runeAmountOut} ${pool.rune_symbol} to output #2`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // OUTPUT #1: Pool UTXO atualizado (recebe BTC do user, perde Rune)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const newPoolValue = pool.pool_utxo_value + btcAmount - lpFee - protocolFee;
    
    psbt.addOutput({
        address: pool.pool_address,
        value: newPoolValue
    });
    
    console.log(`   ✅ Output #1: Pool updated`);
    console.log(`      Address: ${pool.pool_address}`);
    console.log(`      Value: ${newPoolValue} sats (${pool.pool_utxo_value} + ${btcAmount} - ${lpFee + protocolFee})`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // OUTPUT #2: User recebe Rune (546 sats dust)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const DUST_LIMIT = 546;
    
    psbt.addOutput({
        address: userAddress,
        value: DUST_LIMIT
    });
    
    console.log(`   ✅ Output #2: User receives Rune`);
    console.log(`      Address: ${userAddress}`);
    console.log(`      Value: ${DUST_LIMIT} sats (dust + Rune via edict)`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // OUTPUT #3: Protocol fee (Treasury)
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (protocolFee > DUST_LIMIT) {
        psbt.addOutput({
            address: TREASURE_ADDRESS,
            value: protocolFee
        });
        
        console.log(`   ✅ Output #3: Protocol fee`);
        console.log(`      Address: ${TREASURE_ADDRESS}`);
        console.log(`      Value: ${protocolFee} sats`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // OUTPUT #4: User change (se houver)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const totalOut = newPoolValue + DUST_LIMIT + (protocolFee > DUST_LIMIT ? protocolFee : 0) + minerFee;
    const change = totalUserInput - (btcAmount + minerFee);
    
    if (change >= DUST_LIMIT) {
        psbt.addOutput({
            address: userChangeAddress || userAddress,
            value: change
        });
        
        console.log(`   ✅ Output #${psbt.txOutputs.length - 1}: User change`);
        console.log(`      Address: ${userChangeAddress || userAddress}`);
        console.log(`      Value: ${change} sats`);
    }
    
    console.log('\n   📊 PSBT Summary:');
    console.log(`      Total inputs: ${psbt.inputCount}`);
    console.log(`      Total outputs: ${psbt.txOutputs.length}`);
    console.log(`      Estimated fee: ${minerFee} sats`);
    console.log('═══════════════════════════════════════════════════\n');
    
    return {
        psbt: psbt.toBase64(),
        summary: {
            userInputs: totalUserInput,
            btcAmount,
            runeAmountOut,
            minRuneOut,
            lpFee,
            protocolFee,
            minerFee,
            change,
            poolValueBefore: pool.pool_utxo_value,
            poolValueAfter: newPoolValue
        }
    };
}

/**
 * Construir PSBT para swap: Rune → BTC
 * 
 * FLUXO:
 * Input #0: Pool UTXO (unsigned) - contém a liquidez
 * Input #1: User UTXO com Rune (signed)
 * Input #2+: User UTXOs para fees (signed)
 * Output #0: OP_RETURN - edict transferindo Rune para pool
 * Output #1: Pool UTXO updated - recebe Rune, perde BTC
 * Output #2: User recebe BTC
 * Output #3: User change (se houver)
 */
export function buildSwapRuneToBtcPSBT({
    pool,
    userRuneUtxo,
    userFeeInputs,
    userAddress,
    userChangeAddress,
    runeAmount,
    btcAmountOut,
    minBtcOut,
    lpFee,
    protocolFee,
    minerFee,
    network = 'mainnet'
}) {
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    const psbt = new bitcoin.Psbt({ network: btcNetwork });
    
    console.log('\n🔨 ═══ BUILDING SWAP PSBT (Rune → BTC) ═══');
    console.log(`   Pool: ${pool.pool_id}`);
    console.log(`   Rune In: ${runeAmount}`);
    console.log(`   BTC Out: ${btcAmountOut} sats (min: ${minBtcOut})`);
    
    // Input #0: Pool UTXO
    psbt.addInput({
        hash: pool.pool_utxo_txid,
        index: pool.pool_utxo_vout,
        witnessUtxo: {
            script: Buffer.from(pool.pool_utxo_script, 'hex'),
            value: pool.pool_utxo_value
        },
        tapInternalKey: Buffer.from(pool.pool_pubkey, 'hex')
    });
    
    // Input #1: User Rune UTXO
    psbt.addInput({
        hash: userRuneUtxo.txid,
        index: userRuneUtxo.vout,
        witnessUtxo: {
            script: Buffer.from(userRuneUtxo.scriptPubKey, 'hex'),
            value: userRuneUtxo.value
        }
    });
    
    console.log(`   ✅ Input #1: User Rune UTXO ${userRuneUtxo.txid}:${userRuneUtxo.vout}`);
    
    // Inputs #2+: User fee UTXOs
    let totalFeeInput = 0;
    for (const utxo of userFeeInputs) {
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(utxo.scriptPubKey, 'hex'),
                value: utxo.value
            }
        });
        totalFeeInput += utxo.value;
    }
    
    // Output #0: OP_RETURN - transferir Rune para pool (output #1)
    const edicts = [
        createRuneEdict(pool.rune_id, runeAmount, 1)
    ];
    
    const runestoneOutput = buildRunestoneOutput(edicts);
    psbt.addOutput(runestoneOutput);
    
    console.log(`   ✅ Output #0: OP_RETURN`);
    console.log(`      Edict: Transfer ${runeAmount} ${pool.rune_symbol} to output #1 (pool)`);
    
    // Output #1: Pool recebe Rune, perde BTC
    const newPoolValue = pool.pool_utxo_value - btcAmountOut - protocolFee;
    
    psbt.addOutput({
        address: pool.pool_address,
        value: newPoolValue
    });
    
    console.log(`   ✅ Output #1: Pool updated (${newPoolValue} sats)`);
    
    // Output #2: User recebe BTC
    psbt.addOutput({
        address: userAddress,
        value: btcAmountOut
    });
    
    console.log(`   ✅ Output #2: User receives BTC (${btcAmountOut} sats)`);
    
    // Output #3: Protocol fee
    const DUST_LIMIT = 546;
    if (protocolFee > DUST_LIMIT) {
        psbt.addOutput({
            address: TREASURE_ADDRESS,
            value: protocolFee
        });
        
        console.log(`   ✅ Output #3: Protocol fee (${protocolFee} sats)`);
    }
    
    // Output #4: User change
    const totalUserInput = userRuneUtxo.value + totalFeeInput;
    const totalOut = newPoolValue + btcAmountOut + (protocolFee > DUST_LIMIT ? protocolFee : 0);
    const change = totalUserInput + pool.pool_utxo_value - totalOut - minerFee;
    
    if (change >= DUST_LIMIT) {
        psbt.addOutput({
            address: userChangeAddress || userAddress,
            value: change
        });
        
        console.log(`   ✅ Output #${psbt.txOutputs.length - 1}: User change (${change} sats)`);
    }
    
    console.log('═══════════════════════════════════════════════════\n');
    
    return {
        psbt: psbt.toBase64(),
        summary: {
            runeAmount,
            btcAmountOut,
            minBtcOut,
            lpFee,
            protocolFee,
            minerFee,
            change
        }
    };
}

export default {
    buildSwapBtcToRunePSBT,
    buildSwapRuneToBtcPSBT,
    createRuneEdict,
    buildRunestoneOutput
};

