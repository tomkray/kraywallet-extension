import bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const txHex = '020000000001033e74f661214c384c30bab02629eee685b53494030df719f22fa3caab7715e6420000000000ffffffffeda29df3ec972c2a05f13fe30b39d096e8007571bd1cf036300e3a3fd5f5c8b10200000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff040000000000000000096a5dc0a23303f4030122020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce2202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a1d23000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a0141bb7a384c6c4a309493a32c11d39685cae57d2c0c6fe133da59bffd3646fdde116f731ea405f01ed4e4af391e8c0fe4343d29132d882fe676cd1f0faa9215a66a010141ebee33415815f8066bc1c77c03a73c1627c140966d5d0e165c3f0dc9bc44031060e645e2901098cab8a5b087460ff86f8c104311880d19438e7310b0c9ae923d010141289d72802474fa5f92354b69d66e95c7cc574ad0b46eab1eb66f3159189c84cd4613812c44108b99008b769c8aaf0698e603fc7f111226bfcf32a88b4a0aeac90100000000';

console.log('🔍 Analyzing Witness Data...\n');

try {
    const tx = bitcoin.Transaction.fromHex(txHex);
    
    console.log('Transaction ID:', tx.getId());
    console.log('Has witness:', tx.hasWitnesses());
    console.log('\n📝 WITNESS DATA ANALYSIS:\n');
    
    tx.ins.forEach((input, i) => {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Input ${i}:`);
        console.log(`  TXID: ${Buffer.from(input.hash).reverse().toString('hex')}`);
        console.log(`  VOUT: ${input.index}`);
        console.log(`  Sequence: 0x${input.sequence.toString(16)}`);
        console.log(`  Witness stack items: ${input.witness.length}`);
        
        input.witness.forEach((witnessItem, j) => {
            console.log(`\n  Witness[${j}]:`);
            console.log(`    Length: ${witnessItem.length} bytes`);
            console.log(`    Hex: ${witnessItem.toString('hex')}`);
            
            // Para Taproot, witness[0] deve ser a assinatura (64 ou 65 bytes)
            if (j === 0) {
                if (witnessItem.length === 64) {
                    console.log(`    ✅ Valid Taproot signature (64 bytes - Schnorr without sighash)`);
                } else if (witnessItem.length === 65) {
                    const sighash = witnessItem[64];
                    console.log(`    ✅ Valid Taproot signature (65 bytes - Schnorr with sighash)`);
                    console.log(`    Sighash byte: 0x${sighash.toString(16).padStart(2, '0')}`);
                    console.log(`    Sighash type: ${sighash === 0x01 ? 'SIGHASH_ALL' : sighash === 0x03 ? 'SIGHASH_SINGLE' : sighash === 0x83 ? 'SIGHASH_SINGLE|ANYONECANPAY' : 'UNKNOWN'}`);
                } else {
                    console.log(`    ⚠️  Unusual signature length! Expected 64 or 65 bytes`);
                }
            }
        });
    });
    
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`Total Inputs: ${tx.ins.length}`);
    console.log(`Total Outputs: ${tx.outs.length}`);
    console.log(`Has Witness: ${tx.hasWitnesses()}`);
    console.log(`Virtual Size: ${tx.virtualSize()} vB`);
    console.log(`Weight: ${tx.weight()} WU`);
    
} catch (error) {
    console.error('❌ Error analyzing transaction:', error.message);
    console.error(error.stack);
}

