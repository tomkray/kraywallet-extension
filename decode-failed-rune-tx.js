/**
 * Decode da transação que falhou no broadcast
 */

import * as bitcoin from 'bitcoinjs-lib';

// HEX da transação que falhou
const txHex = '02000000000102211b44209e9b41ca05739160184ae436dd677e6ede6b19129df12cf4202b95b10000000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff0300000000000000000a6a5d00c0a23303e8070122020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce7823000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a0141dff9a234bf998f747b3414fe7b93c1d788460d773751c9a4221dc9e497546cc116a4f40fd5882f103c311e4942fb3e02a79873d857ae9e49b5bc276df634ce710101415e753571b46dc0d9a960670f76b5c290455778042ce7a1f73bd11e579a6c57c2aa2f8ad89584b8698f5098c04e44bd3ea6c6e082f81d049604aa2a08cb633d890100000000';

console.log('🔍 ========== DECODING FAILED RUNE TRANSACTION ==========\n');

try {
    const tx = bitcoin.Transaction.fromHex(txHex);
    
    console.log('📦 Transaction Overview:');
    console.log('   Version:', tx.version);
    console.log('   Locktime:', tx.locktime);
    console.log('   Inputs:', tx.ins.length);
    console.log('   Outputs:', tx.outs.length);
    console.log('   TXID:', tx.getId());
    console.log('');
    
    // Analisar inputs
    console.log('🔍 INPUTS ANALYSIS:');
    for (let i = 0; i < tx.ins.length; i++) {
        const input = tx.ins[i];
        const txid = Buffer.from(input.hash).reverse().toString('hex');
        
        console.log(`\n   Input ${i}:`);
        console.log('   ├─ TXID:', txid);
        console.log('   ├─ Vout:', input.index);
        console.log('   ├─ Sequence:', input.sequence);
        console.log('   ├─ Script:', input.script.toString('hex'));
        console.log('   ├─ Has witness:', input.witness && input.witness.length > 0);
        
        if (input.witness && input.witness.length > 0) {
            console.log('   ├─ Witness stack items:', input.witness.length);
            for (let j = 0; j < input.witness.length; j++) {
                const item = input.witness[j];
                console.log(`   ├─   Item ${j}: ${item.length} bytes - ${item.toString('hex').substring(0, 32)}...`);
            }
            
            // Para Taproot key path, witness deve ter apenas 1 item (assinatura 64 ou 65 bytes)
            if (input.witness.length === 1) {
                const sig = input.witness[0];
                console.log('   └─ ✅ Taproot key path witness (1 item)');
                console.log('       Signature length:', sig.length, 'bytes', sig.length === 64 ? '(64 bytes - Schnorr without sighash)' : sig.length === 65 ? '(65 bytes - Schnorr with sighash)' : '(INVALID!)');
                if (sig.length === 65) {
                    const sighashByte = sig[64];
                    console.log('       Sighash byte:', `0x${sighashByte.toString(16).padStart(2, '0')}`);
                    if (sighashByte === 0x01) {
                        console.log('       ✅ SIGHASH_ALL (correct)');
                    } else if (sighashByte === 0x00) {
                        console.log('       ✅ SIGHASH_DEFAULT (correct for Taproot)');
                    } else {
                        console.log('       ⚠️  Custom SIGHASH:', sighashByte);
                    }
                }
            } else {
                console.log('   └─ ⚠️  Script path or invalid witness (not key path)');
            }
        } else {
            console.log('   └─ ❌ NO WITNESS! This is INVALID for Taproot!');
        }
    }
    
    // Analisar outputs
    console.log('\n\n🔍 OUTPUTS ANALYSIS:');
    for (let i = 0; i < tx.outs.length; i++) {
        const output = tx.outs[i];
        
        console.log(`\n   Output ${i}:`);
        console.log('   ├─ Value:', output.value, 'sats');
        console.log('   ├─ Script:', output.script.toString('hex'));
        
        // Detectar tipo
        if (output.script[0] === 0x6a) {
            console.log('   ├─ Type: OP_RETURN (Runestone)');
            if (output.script[1] === 0x5d) {
                console.log('   ├─ ✅ Has OP_13 (Runes protocol marker)');
                const data = output.script.slice(2).toString('hex');
                console.log('   └─ Runestone data:', data);
            } else {
                console.log('   └─ ❌ Missing OP_13!');
            }
        } else if (output.script[0] === 0x51 && output.script[1] === 0x20) {
            console.log('   ├─ Type: P2TR (Taproot)');
            const pubkey = output.script.slice(2).toString('hex');
            console.log('   └─ Output Key (32 bytes):', pubkey);
        } else {
            console.log('   └─ Type: OTHER');
        }
    }
    
    console.log('\n\n💰 TRANSACTION SIZE & FEE:');
    console.log('   Virtual size (vBytes):', tx.virtualSize());
    console.log('   Weight:', tx.weight());
    console.log('   Hex size:', txHex.length / 2, 'bytes');
    
    console.log('\n\n⚠️  POTENTIAL ISSUES:');
    
    let hasIssues = false;
    
    // Verificar se todas inputs têm witness
    for (let i = 0; i < tx.ins.length; i++) {
        const input = tx.ins[i];
        if (!input.witness || input.witness.length === 0) {
            console.log(`   ❌ Input ${i}: Missing witness (Taproot REQUIRES witness!)`);
            hasIssues = true;
        } else if (input.witness.length !== 1) {
            console.log(`   ⚠️  Input ${i}: Witness has ${input.witness.length} items (expected 1 for key path)`);
        } else {
            const sig = input.witness[0];
            if (sig.length !== 64 && sig.length !== 65) {
                console.log(`   ❌ Input ${i}: Invalid signature length ${sig.length} (expected 64 or 65)`);
                hasIssues = true;
            }
        }
    }
    
    // Verificar runestone
    const opReturnOutput = tx.outs.find(o => o.script[0] === 0x6a);
    if (!opReturnOutput) {
        console.log('   ❌ Missing OP_RETURN output (Runestone required!)');
        hasIssues = true;
    } else if (opReturnOutput.script[1] !== 0x5d) {
        console.log('   ❌ OP_RETURN missing OP_13 marker!');
        hasIssues = true;
    }
    
    if (!hasIssues) {
        console.log('   ✅ Transaction structure looks correct!');
        console.log('   ⚠️  Error -26: scriptpubkey likely means:');
        console.log('       1. Signature doesn\'t match the scriptPubKey');
        console.log('       2. tapInternalKey used for signing doesn\'t match the address');
        console.log('       3. Tweaked key calculation is wrong');
    }
    
    console.log('\n========================================\n');
    
} catch (error) {
    console.error('❌ Error decoding transaction:', error);
    console.error(error.stack);
}

