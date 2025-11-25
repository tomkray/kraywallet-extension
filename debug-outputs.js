import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const network = bitcoin.networks.bitcoin;

// PSBT do seller (antes do buyer adicionar)
const sellerPsbtBase64 = process.argv[2];

// PSBT final (depois do buyer assinar)
const finalPsbtBase64 = process.argv[3];

if (!sellerPsbtBase64 || !finalPsbtBase64) {
    console.error('Usage: node debug-outputs.js <seller_psbt_base64> <final_psbt_base64>');
    process.exit(1);
}

try {
    const sellerPsbt = bitcoin.Psbt.fromBase64(sellerPsbtBase64, { network });
    const finalPsbt = bitcoin.Psbt.fromBase64(finalPsbtBase64, { network });
    
    console.log('\n🔍 COMPARING SELLER OUTPUT 0 vs FINAL OUTPUT 0:\n');
    
    console.log('📋 SELLER PSBT Output 0:');
    if (sellerPsbt.txOutputs.length > 0) {
        const sellerOut0 = sellerPsbt.txOutputs[0];
        console.log('   Value:', sellerOut0.value, 'sats');
        console.log('   Script:', sellerOut0.script.toString('hex'));
        const addr = bitcoin.address.fromOutputScript(sellerOut0.script, network);
        console.log('   Address:', addr);
    } else {
        console.log('   ❌ NO OUTPUTS!');
    }
    
    console.log('\n📋 FINAL PSBT Output 0:');
    if (finalPsbt.txOutputs.length > 0) {
        const finalOut0 = finalPsbt.txOutputs[0];
        console.log('   Value:', finalOut0.value, 'sats');
        console.log('   Script:', finalOut0.script.toString('hex'));
        const addr = bitcoin.address.fromOutputScript(finalOut0.script, network);
        console.log('   Address:', addr);
    } else {
        console.log('   ❌ NO OUTPUTS!');
    }
    
    console.log('\n🔍 COMPARISON:');
    if (sellerPsbt.txOutputs.length > 0 && finalPsbt.txOutputs.length > 0) {
        const sellerOut0 = sellerPsbt.txOutputs[0];
        const finalOut0 = finalPsbt.txOutputs[0];
        
        const valueMatch = sellerOut0.value === finalOut0.value;
        const scriptMatch = sellerOut0.script.equals(finalOut0.script);
        
        console.log('   Value match:', valueMatch ? '✅' : '❌');
        console.log('   Script match:', scriptMatch ? '✅' : '❌');
        
        if (!scriptMatch) {
            console.log('\n❌ SCRIPTS ARE DIFFERENT:');
            console.log('   Seller:', sellerOut0.script.toString('hex'));
            console.log('   Final: ', finalOut0.script.toString('hex'));
            
            // Byte-by-byte comparison
            console.log('\n🔍 Byte-by-byte diff:');
            for (let i = 0; i < Math.max(sellerOut0.script.length, finalOut0.script.length); i++) {
                const sellerByte = sellerOut0.script[i];
                const finalByte = finalOut0.script[i];
                if (sellerByte !== finalByte) {
                    console.log(`   Byte ${i}: seller=${sellerByte?.toString(16).padStart(2, '0')} final=${finalByte?.toString(16).padStart(2, '0')} ❌`);
                }
            }
        } else {
            console.log('\n✅ OUTPUT 0 IS IDENTICAL!');
            console.log('   This means the error is NOT in Output 0 copying.');
            console.log('   The problem is likely in the SIGHASH calculation itself!');
        }
    }
    
    console.log('\n📊 ALL OUTPUTS:');
    console.log('   Seller PSBT outputs:', sellerPsbt.txOutputs.length);
    console.log('   Final PSBT outputs:', finalPsbt.txOutputs.length);
    
    for (let i = 0; i < finalPsbt.txOutputs.length; i++) {
        const out = finalPsbt.txOutputs[i];
        const addr = bitcoin.address.fromOutputScript(out.script, network);
        console.log(`   Output ${i}: ${out.value} sats → ${addr}`);
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
}

