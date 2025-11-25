/**
 * 🌊 PSBT Builder para DEX
 * 
 * Constrói PSBTs para swaps atômicos de runes usando pools de liquidez
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import axios from 'axios';
import psbtBuilderRunes from './psbtBuilderRunes.js';

bitcoin.initEccLib(ecc);

class PSBTBuilderDEX {
    /**
     * Construir PSBT para swap em liquidity pool
     * 
     * @param {Object} params
     * @param {string} params.userAddress - Endereço do usuário
     * @param {string} params.poolAddress - Endereço da pool (multi-sig ou script)
     * @param {string} params.runeIdIn - Rune que está enviando
     * @param {string} params.runeIdOut - Rune que está recebendo
     * @param {number} params.amountIn - Quantidade enviando
     * @param {number} params.amountOut - Quantidade recebendo (calculada pelo AMM)
     * @param {number} params.feeRate - Taxa de rede (sat/vB)
     * @param {Array} params.userUtxos - UTXOs do usuário
     * @param {Array} params.poolUtxos - UTXOs da pool
     */
    async buildSwapPSBT({
        userAddress,
        poolAddress,
        runeIdIn,
        runeIdOut,
        amountIn,
        amountOut,
        feeRate,
        userUtxos,
        poolUtxos
    }) {
        try {
            console.log('\n🌊 ========== BUILDING DEX SWAP PSBT ==========');
            console.log(`   User: ${userAddress}`);
            console.log(`   Pool: ${poolAddress}`);
            console.log(`   Swap: ${amountIn} ${runeIdIn} → ${amountOut} ${runeIdOut}`);
            console.log(`   Fee Rate: ${feeRate} sat/vB`);

            const network = this.network;
            const psbt = new bitcoin.Psbt({ network });

            // ========== INPUTS ==========
            
            // 1. Adicionar UTXOs do usuário (rune + BTC)
            console.log('\n📦 Adding user inputs...');
            
            const userRuneUtxos = userUtxos.filter(u => 
                u.runes && u.runes.some(r => r.id === runeIdIn && r.amount >= amountIn)
            );
            
            if (userRuneUtxos.length === 0) {
                throw new Error(`User has no UTXOs with ${amountIn} ${runeIdIn}`);
            }

            const userRuneUtxo = userRuneUtxos[0];
            
            // Adicionar UTXO com rune do usuário
            psbt.addInput({
                hash: userRuneUtxo.txid,
                index: userRuneUtxo.vout,
                witnessUtxo: {
                    script: Buffer.from(userRuneUtxo.scriptPubKey, 'hex'),
                    value: userRuneUtxo.value
                },
                tapInternalKey: this.toXOnly(Buffer.from(userAddress, 'hex'))
            });

            console.log(`   ✅ User rune input: ${userRuneUtxo.txid}:${userRuneUtxo.vout}`);

            // 2. Adicionar UTXOs da pool (rune de saída)
            console.log('\n📦 Adding pool inputs...');
            
            const poolRuneUtxos = poolUtxos.filter(u => 
                u.runes && u.runes.some(r => r.id === runeIdOut && r.amount >= amountOut)
            );
            
            if (poolRuneUtxos.length === 0) {
                throw new Error(`Pool has insufficient liquidity for ${amountOut} ${runeIdOut}`);
            }

            const poolRuneUtxo = poolRuneUtxos[0];
            
            psbt.addInput({
                hash: poolRuneUtxo.txid,
                index: poolRuneUtxo.vout,
                witnessUtxo: {
                    script: Buffer.from(poolRuneUtxo.scriptPubKey, 'hex'),
                    value: poolRuneUtxo.value
                },
                tapInternalKey: this.toXOnly(Buffer.from(poolAddress, 'hex'))
            });

            console.log(`   ✅ Pool rune input: ${poolRuneUtxo.txid}:${poolRuneUtxo.vout}`);

            // 3. Adicionar BTC para fees (usuário)
            const userBtcUtxos = userUtxos.filter(u => !u.runes || u.runes.length === 0);
            let totalBtcInput = 0;

            for (const utxo of userBtcUtxos.slice(0, 3)) {
                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: {
                        script: Buffer.from(utxo.scriptPubKey, 'hex'),
                        value: utxo.value
                    },
                    tapInternalKey: this.toXOnly(Buffer.from(userAddress, 'hex'))
                });
                totalBtcInput += utxo.value;
                
                console.log(`   ✅ User BTC input: ${utxo.value} sats`);
            }

            // ========== OUTPUTS ==========
            
            console.log('\n📤 Creating outputs...');

            const outputs = [];
            const DUST_LIMIT = 546;

            // 1. OP_RETURN com Runestone (duas transferências simultâneas)
            console.log('\n🔨 Building Runestone (dual transfer)...');
            
            // Runestone com dois edicts:
            // - Edict 1: amountIn do runeIdIn para a pool (output 1)
            // - Edict 2: amountOut do runeIdOut para o usuário (output 2)
            
            const runestone = this.buildRunestoneMultiEdict([
                {
                    runeId: runeIdIn,
                    amount: amountIn,
                    outputIndex: 1  // Pool recebe
                },
                {
                    runeId: runeIdOut,
                    amount: amountOut,
                    outputIndex: 2  // Usuário recebe
                }
            ]);

            outputs.push({
                script: Buffer.from(runestone, 'hex'),
                value: 0
            });

            console.log('   ✅ OP_RETURN output added');

            // 2. Pool recebe o runeIdIn (amountIn) + dust
            const poolScript = bitcoin.address.toOutputScript(poolAddress, network);
            
            outputs.push({
                script: poolScript,
                value: DUST_LIMIT
            });

            console.log(`   ✅ Pool output: ${DUST_LIMIT} sats (+ ${amountIn} ${runeIdIn})`);

            // 3. Usuário recebe o runeIdOut (amountOut) + dust
            const userScript = bitcoin.address.toOutputScript(userAddress, network);
            
            outputs.push({
                script: userScript,
                value: DUST_LIMIT
            });

            console.log(`   ✅ User output: ${DUST_LIMIT} sats (+ ${amountOut} ${runeIdOut})`);

            // 4. Change BTC para o usuário
            const estimatedSize = (psbt.data.inputs.length * 68) + (outputs.length * 43) + 10;
            const estimatedFee = Math.ceil(estimatedSize * feeRate);
            const totalOutputValue = outputs.reduce((sum, o) => sum + o.value, 0);
            const change = totalBtcInput - totalOutputValue - estimatedFee;

            if (change > DUST_LIMIT) {
                outputs.push({
                    script: userScript,
                    value: change
                });
                console.log(`   ✅ Change output: ${change} sats`);
            }

            // Adicionar outputs ao PSBT
            outputs.forEach(output => psbt.addOutput(output));

            // ========== FINALIZAÇÃO ==========
            
            console.log('\n✅ ========== DEX SWAP PSBT READY ==========');
            console.log(`   Inputs: ${psbt.data.inputs.length}`);
            console.log(`   Outputs: ${psbt.data.outputs.length}`);
            console.log(`   Estimated Fee: ${estimatedFee} sats`);
            console.log(`   Change: ${change} sats`);

            return {
                psbt: psbt.toBase64(),
                estimatedFee,
                change,
                inputs: psbt.data.inputs.length,
                outputs: psbt.data.outputs.length
            };

        } catch (error) {
            console.error('❌ Error building DEX swap PSBT:', error);
            throw error;
        }
    }

    /**
     * Construir PSBT para adicionar liquidez
     * 
     * @param {Object} params
     * @param {string} params.userAddress - Endereço do usuário
     * @param {string} params.poolAddress - Endereço da pool
     * @param {string} params.runeIdA - Primeiro rune
     * @param {string} params.runeIdB - Segundo rune (ou null se BTC)
     * @param {number} params.amountA - Quantidade de A
     * @param {number} params.amountB - Quantidade de B
     * @param {number} params.lpTokens - LP tokens a receber
     * @param {number} params.feeRate - Taxa de rede
     * @param {Array} params.userUtxos - UTXOs do usuário
     */
    async buildAddLiquidityPSBT({
        userAddress,
        poolAddress,
        runeIdA,
        runeIdB,
        amountA,
        amountB,
        lpTokens,
        feeRate,
        userUtxos
    }) {
        try {
            console.log('\n💧 ========== BUILDING ADD LIQUIDITY PSBT ==========');
            console.log(`   User: ${userAddress}`);
            console.log(`   Pool: ${poolAddress}`);
            console.log(`   Adding: ${amountA} ${runeIdA} + ${amountB} ${runeIdB || 'BTC'}`);
            console.log(`   LP Tokens: ${lpTokens}`);

            const network = this.network;
            const psbt = new bitcoin.Psbt({ network });

            // Adicionar inputs com runes A e B
            // Criar outputs:
            // - OP_RETURN com Runestone transferindo ambos para pool
            // - Pool recebe ambos runes
            // - Usuário recebe LP tokens (via inscription ou rune especial)

            // TODO: Implementar lógica completa de adicionar liquidez
            
            throw new Error('Add liquidity PSBT not yet implemented');

        } catch (error) {
            console.error('❌ Error building add liquidity PSBT:', error);
            throw error;
        }
    }

    /**
     * Construir PSBT para remover liquidez
     * 
     * @param {Object} params
     * @param {string} params.userAddress - Endereço do usuário
     * @param {string} params.poolAddress - Endereço da pool
     * @param {number} params.lpTokens - LP tokens a queimar
     * @param {number} params.amountA - Quantidade de A a receber
     * @param {number} params.amountB - Quantidade de B a receber
     * @param {number} params.feeRate - Taxa de rede
     * @param {Array} params.userUtxos - UTXOs do usuário (com LP tokens)
     * @param {Array} params.poolUtxos - UTXOs da pool
     */
    async buildRemoveLiquidityPSBT({
        userAddress,
        poolAddress,
        lpTokens,
        amountA,
        amountB,
        feeRate,
        userUtxos,
        poolUtxos
    }) {
        try {
            console.log('\n💧 ========== BUILDING REMOVE LIQUIDITY PSBT ==========');
            console.log(`   User: ${userAddress}`);
            console.log(`   Pool: ${poolAddress}`);
            console.log(`   Burning: ${lpTokens} LP tokens`);
            console.log(`   Receiving: ${amountA} + ${amountB}`);

            // TODO: Implementar lógica completa de remover liquidez
            
            throw new Error('Remove liquidity PSBT not yet implemented');

        } catch (error) {
            console.error('❌ Error building remove liquidity PSBT:', error);
            throw error;
        }
    }

    /**
     * Construir Runestone com múltiplos edicts (para swaps)
     * 
     * Formato correto:
     * [Tag 10, Delimiter 0, 
     *  blockHeight1, txIndex1, amount1, output1,
     *  blockHeight2, txIndex2, amount2, output2]
     */
    buildRunestoneMultiEdict(edicts) {
        try {
            console.log('\n🔨 Building Multi-Edict Runestone...');
            console.log(`   Edicts: ${edicts.length}`);

            const values = [
                10,  // Tag: Body
                0    // Delimiter
            ];

            // Adicionar cada edict
            for (const edict of edicts) {
                const [blockHeight, txIndex] = edict.runeId.split(':').map(Number);
                
                if (isNaN(blockHeight) || isNaN(txIndex)) {
                    throw new Error(`Invalid rune ID: ${edict.runeId}`);
                }

                values.push(
                    blockHeight,
                    txIndex,
                    parseInt(edict.amount),
                    edict.outputIndex
                );

                console.log(`   Edict: ${blockHeight}:${txIndex} → ${edict.amount} to output ${edict.outputIndex}`);
            }

            const encoded = this.encodeLEB128(values);
            const scriptPubKey = '6a5d' + encoded;

            console.log('   ✅ Multi-Edict Runestone built');
            console.log(`   Script: ${scriptPubKey.substring(0, 40)}...`);

            return scriptPubKey;

        } catch (error) {
            console.error('❌ Error building multi-edict Runestone:', error);
            throw error;
        }
    }
}

export default PSBTBuilderDEX;

