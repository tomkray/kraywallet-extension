/**
 * Runestone Decoder - Decodifica Runestones de transações Bitcoin
 * Baseado na especificação oficial do Runes Protocol
 * https://docs.ordinals.com/runes.html
 */

import bitcoin from 'bitcoinjs-lib';

/**
 * Decodifica um valor LEB128 (Little Endian Base 128)
 * @param {Buffer} buffer - Buffer com dados LEB128
 * @param {number} offset - Offset inicial
 * @returns {Object} - { value: BigInt, bytesRead: number }
 */
function decodeLEB128(buffer, offset = 0) {
    let value = 0n;
    let shift = 0n;
    let bytesRead = 0;
    
    while (offset + bytesRead < buffer.length) {
        const byte = buffer[offset + bytesRead];
        bytesRead++;
        
        // Bits 0-6 contêm dados
        value |= BigInt(byte & 0x7F) << shift;
        
        // Se bit 7 é 0, terminamos
        if ((byte & 0x80) === 0) {
            return { value, bytesRead };
        }
        
        shift += 7n;
        
        // Proteção contra loops infinitos
        if (bytesRead > 10) {
            throw new Error('LEB128 too long');
        }
    }
    
    throw new Error('Incomplete LEB128');
}

/**
 * Decodifica um Rune ID (block:tx)
 * @param {Buffer} buffer - Buffer com dados
 * @param {number} offset - Offset inicial
 * @returns {Object} - { block: BigInt, tx: BigInt, bytesRead: number }
 */
function decodeRuneId(buffer, offset = 0) {
    const blockResult = decodeLEB128(buffer, offset);
    const txResult = decodeLEB128(buffer, offset + blockResult.bytesRead);
    
    return {
        block: blockResult.value,
        tx: txResult.value,
        bytesRead: blockResult.bytesRead + txResult.bytesRead
    };
}

/**
 * Verifica se o script é um OP_RETURN com Runestone
 * @param {Buffer} scriptPubKey - Script do output
 * @returns {Buffer|null} - Payload do Runestone ou null
 */
function extractRunestonePayload(scriptPubKey) {
    // Runestone format: OP_RETURN (0x6a) + OP_13 (0x5d) + <payload>
    if (scriptPubKey.length < 3) return null;
    if (scriptPubKey[0] !== 0x6a) return null; // OP_RETURN
    if (scriptPubKey[1] !== 0x5d) return null; // OP_13 (OP_PUSHNUM_13)
    
    // O terceiro byte é o tamanho do push
    const pushSize = scriptPubKey[2];
    
    // Verificar se temos dados suficientes
    if (scriptPubKey.length < 3 + pushSize) return null;
    
    // Extrair o payload
    return scriptPubKey.subarray(3, 3 + pushSize);
}

/**
 * Decodifica um Runestone completo
 * @param {Buffer} payload - Payload do Runestone (após OP_RETURN + OP_13)
 * @returns {Object} - { edicts: Array, pointer: number|null, ... }
 */
function decodeRunestone(payload) {
    const result = {
        edicts: [],
        pointer: null,
        cenotaph: false
    };
    
    try {
        let offset = 0;
        let lastRuneId = { block: 0n, tx: 0n };
        
        while (offset < payload.length) {
            // Decodificar tag
            const tagResult = decodeLEB128(payload, offset);
            const tag = tagResult.value;
            offset += tagResult.bytesRead;
            
            console.log(`   🏷️  Tag: ${tag}`);
            
            // Tag 0: Body (edicts)
            if (tag === 0n) {
                console.log('   📋 Body section (edicts)');
                
                // Ler edicts até o fim ou próxima tag
                while (offset < payload.length) {
                    // Tentar decodificar RuneId
                    try {
                        const runeIdResult = decodeRuneId(payload, offset);
                        offset += runeIdResult.bytesRead;
                        
                        // Delta encoding: adicionar ao último RuneId
                        const currentBlock = lastRuneId.block + runeIdResult.block;
                        const currentTx = (runeIdResult.block === 0n) 
                            ? lastRuneId.tx + runeIdResult.tx
                            : runeIdResult.tx;
                        
                        lastRuneId = { block: currentBlock, tx: currentTx };
                        
                        // Decodificar amount
                        const amountResult = decodeLEB128(payload, offset);
                        offset += amountResult.bytesRead;
                        
                        // Decodificar output index
                        const outputResult = decodeLEB128(payload, offset);
                        offset += outputResult.bytesRead;
                        
                        const edict = {
                            runeId: `${currentBlock}:${currentTx}`,
                            amount: amountResult.value.toString(),
                            output: Number(outputResult.value)
                        };
                        
                        console.log(`   ✅ Edict: Rune ${edict.runeId} -> ${edict.amount} to output ${edict.output}`);
                        
                        result.edicts.push(edict);
                    } catch (e) {
                        // Se falhar, pode ser o fim dos edicts
                        console.log('   ℹ️  End of edicts section');
                        break;
                    }
                }
            }
            // Tag 2: Pointer
            else if (tag === 2n) {
                const pointerResult = decodeLEB128(payload, offset);
                result.pointer = Number(pointerResult.value);
                offset += pointerResult.bytesRead;
                console.log(`   🎯 Pointer: ${result.pointer}`);
            }
            // Outras tags (ignorar por enquanto)
            else {
                const valueResult = decodeLEB128(payload, offset);
                offset += valueResult.bytesRead;
                console.log(`   ⏭️  Skipping tag ${tag} with value ${valueResult.value}`);
            }
        }
        
        console.log(`   ✅ Decoded ${result.edicts.length} edicts`);
        
    } catch (error) {
        console.error('   ❌ Error decoding Runestone:', error.message);
        result.cenotaph = true;
    }
    
    return result;
}

/**
 * Busca e decodifica Runestones de um endereço
 * @param {string} address - Endereço Bitcoin
 * @param {Array} utxos - Lista de UTXOs do endereço
 * @param {Function} getTxHex - Função para buscar hex de uma transação (txid => hex)
 * @returns {Promise<Array>} - Lista de runes com UTXOs
 */
async function getRunesFromUtxos(address, utxos, getTxHex) {
    console.log(`🔍 Analyzing ${utxos.length} UTXOs for Runestones...`);
    
    const runesMap = new Map();
    
    for (const utxo of utxos) {
        try {
            console.log(`\n📦 Checking UTXO: ${utxo.txid}:${utxo.vout}`);
            
            // Buscar a transação completa
            const txHex = await getTxHex(utxo.txid);
            if (!txHex) {
                console.log('   ⚠️  Could not fetch tx');
                continue;
            }
            
            // Parsear a transação usando bitcoinjs-lib
            const tx = bitcoin.Transaction.fromHex(txHex);
            console.log(`   📋 TX has ${tx.outs.length} outputs`);
            
            // Procurar por OP_RETURN com OP_13 nos outputs
            let foundRunestone = false;
            
            for (let i = 0; i < tx.outs.length; i++) {
                const output = tx.outs[i];
                const scriptPubKey = output.script;
                
                // Verificar se é Runestone (OP_RETURN + OP_13)
                const payload = extractRunestonePayload(scriptPubKey);
                
                if (payload) {
                    console.log(`   ✅ Found Runestone in output ${i}`);
                    console.log(`   📦 Runestone payload: ${payload.length} bytes`);
                    console.log(`   📦 Payload hex: ${payload.toString('hex').substring(0, 100)}...`);
                    
                    const runestone = decodeRunestone(payload);
                    
                    // Verificar se este UTXO específico recebeu runes
                    for (const edict of runestone.edicts) {
                        if (edict.output === utxo.vout) {
                            console.log(`   🎯 UTXO ${utxo.vout} received rune ${edict.runeId}`);
                            
                            if (!runesMap.has(edict.runeId)) {
                                runesMap.set(edict.runeId, {
                                    runeId: edict.runeId,
                                    name: `RUNE_${edict.runeId}`, // Placeholder, buscar nome depois
                                    totalAmount: 0n,
                                    utxos: []
                                });
                            }
                            
                            const rune = runesMap.get(edict.runeId);
                            rune.totalAmount += BigInt(edict.amount);
                            rune.utxos.push({
                                txid: utxo.txid,
                                vout: utxo.vout,
                                amount: edict.amount,
                                value: utxo.value
                            });
                        }
                    }
                    
                    foundRunestone = true;
                    break;
                }
            }
            
            if (!foundRunestone) {
                console.log('   ℹ️  No Runestone in this tx');
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing UTXO ${utxo.txid}:${utxo.vout}:`, error.message);
        }
    }
    
    // Converter Map para Array
    const runes = Array.from(runesMap.values()).map(rune => ({
        runeId: rune.runeId,
        name: rune.name,
        displayName: rune.name,
        amount: rune.totalAmount.toString(),
        symbol: '⧈',
        utxos: rune.utxos
    }));
    
    console.log(`\n✅ Found ${runes.length} unique runes in ${utxos.length} UTXOs`);
    
    return runes;
}

export {
    decodeLEB128,
    decodeRuneId,
    extractRunestonePayload,
    decodeRunestone,
    getRunesFromUtxos
};

