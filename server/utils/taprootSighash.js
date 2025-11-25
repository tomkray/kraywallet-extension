/**
 * Implementação manual do cálculo de sighash para Taproot (BIP 341)
 * Necessário porque bitcoinjs-lib pode ter problemas com OP_RETURN
 */

import * as bitcoin from 'bitcoinjs-lib';

/**
 * Calcular sighash BIP 341 para Taproot key-path spending
 * 
 * @param {Object} psbt - PSBT object
 * @param {number} inputIndex - Índice do input a assinar
 * @param {Array} prevouts - Array de prevouts com {txid, vout, value, scriptPubKey}
 * @param {number} sighashType - Tipo de sighash (0x00 = DEFAULT, 0x01 = ALL)
 * @returns {Buffer} Sighash (32 bytes)
 */
export function calculateTaprootSighash(psbt, inputIndex, prevouts, sighashType = 0x00) {
    console.log(`\n🔐 Calculating BIP 341 sighash for input ${inputIndex}...`);
    console.log(`   SIGHASH type: 0x${sighashType.toString(16)}`);
    
    const tx = psbt.__CACHE.__TX;
    const buffers = [];
    
    // Extrair flags do sighashType
    const SIGHASH_ALL = 0x01;
    const SIGHASH_NONE = 0x02;
    const SIGHASH_SINGLE = 0x03;
    const SIGHASH_ANYONECANPAY = 0x80;
    
    const sighashBase = sighashType & 0x1f;  // Remove ANYONECANPAY flag
    const anyoneCanPay = (sighashType & SIGHASH_ANYONECANPAY) !== 0;
    
    console.log(`   Base type: 0x${sighashBase.toString(16)} (${sighashBase === SIGHASH_SINGLE ? 'SINGLE' : sighashBase === SIGHASH_NONE ? 'NONE' : 'ALL/DEFAULT'})`);
    console.log(`   ANYONECANPAY: ${anyoneCanPay ? 'YES' : 'NO'}`);
    
    // 1. Epoch (0x00)
    buffers.push(Buffer.from([0x00]));
    
    // 2. Hash type
    buffers.push(Buffer.from([sighashType]));
    
    // 3. nVersion (4 bytes LE)
    const versionBuf = Buffer.allocUnsafe(4);
    versionBuf.writeUInt32LE(tx.version);
    buffers.push(versionBuf);
    
    // 4. nLockTime (4 bytes LE)
    const locktimeBuf = Buffer.allocUnsafe(4);
    locktimeBuf.writeUInt32LE(tx.locktime);
    buffers.push(locktimeBuf);
    
    // 5. sha_prevouts (se NÃO for ANYONECANPAY)
    if (!anyoneCanPay) {
        const sha_prevouts = hashPrevouts(tx);
        buffers.push(sha_prevouts);
        console.log('  sha_prevouts:', sha_prevouts.toString('hex'));
    } else {
        console.log('  sha_prevouts: SKIPPED (ANYONECANPAY)');
    }
    
    // 6. sha_amounts (se NÃO for ANYONECANPAY)
    if (!anyoneCanPay) {
        const sha_amounts = hashAmounts(prevouts);
        buffers.push(sha_amounts);
        console.log('  sha_amounts:', sha_amounts.toString('hex'));
    } else {
        console.log('  sha_amounts: SKIPPED (ANYONECANPAY)');
    }
    
    // 7. sha_scriptpubkeys (se NÃO for ANYONECANPAY)
    if (!anyoneCanPay) {
        const sha_scriptpubkeys = hashScriptPubKeys(prevouts);
        buffers.push(sha_scriptpubkeys);
        console.log('  sha_scriptpubkeys:', sha_scriptpubkeys.toString('hex'));
    } else {
        console.log('  sha_scriptpubkeys: SKIPPED (ANYONECANPAY)');
    }
    
    // 8. sha_sequences (se NÃO for ANYONECANPAY E NÃO for NONE|SINGLE)
    if (!anyoneCanPay && sighashBase !== SIGHASH_NONE && sighashBase !== SIGHASH_SINGLE) {
        const sha_sequences = hashSequences(tx);
        buffers.push(sha_sequences);
        console.log('  sha_sequences:', sha_sequences.toString('hex'));
    } else {
        console.log('  sha_sequences: SKIPPED');
    }
    
    // 9. sha_outputs ✨ CRUCIAL: Depende do SIGHASH type!
    if (sighashBase !== SIGHASH_NONE && sighashBase !== SIGHASH_SINGLE) {
        // SIGHASH_ALL ou DEFAULT: Hash de TODOS os outputs
        const sha_outputs = hashOutputs(psbt);
        buffers.push(sha_outputs);
        console.log('  sha_outputs: ALL outputs hashed:', sha_outputs.toString('hex'));
    } else if (sighashBase === SIGHASH_SINGLE) {
        // SIGHASH_SINGLE: Hash APENAS do output correspondente (Output N para Input N)
        if (inputIndex < psbt.txOutputs.length) {
            const sha_single_output = hashSingleOutput(psbt, inputIndex);
            buffers.push(sha_single_output);
            console.log(`  sha_outputs: SINGLE output ${inputIndex} hashed:`, sha_single_output.toString('hex'));
        } else {
            // Se não há output correspondente, usar zero hash
            buffers.push(Buffer.alloc(32, 0));
            console.log(`  sha_outputs: No output ${inputIndex}, using zero hash`);
        }
    } else {
        // SIGHASH_NONE: Não assina nenhum output
        console.log('  sha_outputs: NONE (not signing any outputs)');
    }
    
    // 10. spend_type (0x00 para key-path, sem annex)
    buffers.push(Buffer.from([0x00]));
    
    // Se ANYONECANPAY, adicionar dados específicos deste input
    if (anyoneCanPay) {
        console.log(`  📝 Adding ANYONECANPAY-specific data for input ${inputIndex}...`);
        
        // outpoint (txid + vout)
        const input = tx.ins[inputIndex];
        buffers.push(Buffer.from(input.hash).reverse());
        const voutBuf = Buffer.allocUnsafe(4);
        voutBuf.writeUInt32LE(input.index);
        buffers.push(voutBuf);
        
        // amount (8 bytes LE)
        const amountBuf = Buffer.allocUnsafe(8);
        amountBuf.writeBigUInt64LE(BigInt(prevouts[inputIndex].value));
        buffers.push(amountBuf);
        
        // scriptPubKey
        const scriptPubKey = Buffer.from(prevouts[inputIndex].scriptPubKey, 'hex');
        const scriptLen = encodeCompactSize(scriptPubKey.length);
        buffers.push(scriptLen);
        buffers.push(scriptPubKey);
        
        // sequence (4 bytes LE)
        const seqBuf = Buffer.allocUnsafe(4);
        seqBuf.writeUInt32LE(input.sequence);
        buffers.push(seqBuf);
        
        console.log('  ✅ ANYONECANPAY data added');
    } else {
        // 11. input_index (4 bytes LE)
        const indexBuf = Buffer.allocUnsafe(4);
        indexBuf.writeUInt32LE(inputIndex);
        buffers.push(indexBuf);
    }
    
    // Concatenar todos os buffers
    const message = Buffer.concat(buffers);
    console.log('  Message length:', message.length, 'bytes');
    
    // Hash final com TAG HASH "TapSighash" (BIP 340/341)
    const tag = 'TapSighash';
    const tagHash = bitcoin.crypto.sha256(Buffer.from(tag, 'utf8'));
    const taggedMessage = Buffer.concat([tagHash, tagHash, message]);
    const sighash = bitcoin.crypto.sha256(taggedMessage);
    console.log('  ✅ Sighash:', sighash.toString('hex'));
    
    return sighash;
}

/**
 * Hash de todos os prevouts (txid + vout)
 */
function hashPrevouts(tx) {
    const buffers = [];
    
    for (const input of tx.ins) {
        // txid (reversed - little endian)
        buffers.push(Buffer.from(input.hash).reverse());
        
        // vout (4 bytes LE)
        const voutBuf = Buffer.allocUnsafe(4);
        voutBuf.writeUInt32LE(input.index);
        buffers.push(voutBuf);
    }
    
    const concatenated = Buffer.concat(buffers);
    return bitcoin.crypto.sha256(concatenated);
}

/**
 * Hash de todos os valores (amounts)
 */
function hashAmounts(prevouts) {
    const buffers = [];
    
    for (const prevout of prevouts) {
        const amountBuf = Buffer.allocUnsafe(8);
        amountBuf.writeBigUInt64LE(BigInt(prevout.value));
        buffers.push(amountBuf);
    }
    
    const concatenated = Buffer.concat(buffers);
    return bitcoin.crypto.sha256(concatenated);
}

/**
 * Hash de todos os scriptPubKeys
 * CRÍTICO: Precisa serializar corretamente o OP_RETURN!
 */
function hashScriptPubKeys(prevouts) {
    const buffers = [];
    
    for (const prevout of prevouts) {
        const script = prevout.scriptPubKey;
        
        // Adicionar CompactSize (varuint) do tamanho do script
        const lengthBuf = encodeCompactSize(script.length);
        buffers.push(lengthBuf);
        
        // Adicionar o script
        buffers.push(script);
    }
    
    const concatenated = Buffer.concat(buffers);
    return bitcoin.crypto.sha256(concatenated);
}

/**
 * Hash de todas as sequences
 */
function hashSequences(tx) {
    const buffers = [];
    
    for (const input of tx.ins) {
        const seqBuf = Buffer.allocUnsafe(4);
        seqBuf.writeUInt32LE(input.sequence);
        buffers.push(seqBuf);
    }
    
    const concatenated = Buffer.concat(buffers);
    return bitcoin.crypto.sha256(concatenated);
}

/**
 * Hash de todos os outputs
 * CRÍTICO: Precisa incluir TODOS os outputs, incluindo OP_RETURN!
 */
function hashOutputs(psbt) {
    const buffers = [];
    
    for (const output of psbt.txOutputs) {
        // Amount (8 bytes LE)
        const amountBuf = Buffer.allocUnsafe(8);
        amountBuf.writeBigUInt64LE(BigInt(output.value));
        buffers.push(amountBuf);
        
        // Script length (CompactSize)
        const lengthBuf = encodeCompactSize(output.script.length);
        buffers.push(lengthBuf);
        
        // Script
        buffers.push(output.script);
    }
    
    const concatenated = Buffer.concat(buffers);
    return bitcoin.crypto.sha256(concatenated);
}

/**
 * Hash de um único output (para SIGHASH_SINGLE)
 */
function hashSingleOutput(psbt, outputIndex) {
    const output = psbt.txOutputs[outputIndex];
    
    // Amount (8 bytes LE)
    const amountBuf = Buffer.allocUnsafe(8);
    amountBuf.writeBigUInt64LE(BigInt(output.value));
    
    // Script length (CompactSize)
    const lengthBuf = encodeCompactSize(output.script.length);
    
    // Script
    const concatenated = Buffer.concat([amountBuf, lengthBuf, output.script]);
    return bitcoin.crypto.sha256(concatenated);
}

/**
 * Encode um número como CompactSize (varuint)
 * Usado para comprimentos de scripts
 */
function encodeCompactSize(n) {
    if (n < 0xfd) {
        const buf = Buffer.allocUnsafe(1);
        buf.writeUInt8(n);
        return buf;
    } else if (n <= 0xffff) {
        const buf = Buffer.allocUnsafe(3);
        buf.writeUInt8(0xfd);
        buf.writeUInt16LE(n, 1);
        return buf;
    } else if (n <= 0xffffffff) {
        const buf = Buffer.allocUnsafe(5);
        buf.writeUInt8(0xfe);
        buf.writeUInt32LE(n, 1);
        return buf;
    } else {
        const buf = Buffer.allocUnsafe(9);
        buf.writeUInt8(0xff);
        buf.writeBigUInt64LE(BigInt(n), 1);
        return buf;
    }
}

/**
 * Construir array de prevouts a partir de um PSBT
 */
export function extractPrevoutsFromPsbt(psbt) {
    const prevouts = [];
    
    for (let i = 0; i < psbt.data.inputs.length; i++) {
        const input = psbt.data.inputs[i];
        const txInput = psbt.__CACHE.__TX.ins[i];
        
        if (!input.witnessUtxo) {
            throw new Error(`Input ${i} missing witnessUtxo`);
        }
        
        prevouts.push({
            txid: Buffer.from(txInput.hash).reverse().toString('hex'),
            vout: txInput.index,
            value: input.witnessUtxo.value,
            scriptPubKey: input.witnessUtxo.script
        });
    }
    
    return prevouts;
}

export default {
    calculateTaprootSighash,
    extractPrevoutsFromPsbt
};

