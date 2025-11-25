import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

// PSBT assinado que falhou (copiar do console do browser)
const psbtBase64 = process.argv[2];

if (!psbtBase64) {
    console.error('Usage: node debug-psbt.js <psbt-base64>');
    process.exit(1);
}

console.log('🔍 DEBUGGING FAILED PSBT:\n');

try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: bitcoin.networks.bitcoin });
    
    console.log('📊 PSBT Structure:');
    console.log('   Inputs:', psbt.inputCount);
    console.log('   Outputs:', psbt.txOutputs.length);
    
    console.log('\n📥 INPUTS:');
    for (let i = 0; i < psbt.inputCount; i++) {
        const input = psbt.data.inputs[i];
        const txInput = psbt.txInputs[i];
        
        console.log(`\n   Input ${i}:`);
        console.log('      hash:', Buffer.from(txInput.hash).reverse().toString('hex'));
        console.log('      index:', txInput.index);
        console.log('      tapKeySig:', input.tapKeySig ? input.tapKeySig.length + ' bytes' : '❌ MISSING');
        console.log('      sighashType:', input.sighashType, '(0x' + (input.sighashType?.toString(16) || '00') + ')');
        console.log('      finalScriptWitness:', input.finalScriptWitness ? input.finalScriptWitness.length + ' bytes' : 'Not finalized');
        
        if (input.tapKeySig) {
            console.log('      sig (hex):', input.tapKeySig.toString('hex').substring(0, 32) + '...');
        }
    }
    
    console.log('\n📤 OUTPUTS:');
    for (let i = 0; i < psbt.txOutputs.length; i++) {
        const output = psbt.txOutputs[i];
        const addr = bitcoin.address.fromOutputScript(output.script, bitcoin.networks.bitcoin);
        console.log(`   Output ${i}: ${output.value} sats → ${addr}`);
    }
    
    // Tentar extrair transação
    console.log('\n🔨 Attempting to extract transaction...');
    try {
        const tx = psbt.extractTransaction();
        console.log('✅ Transaction extracted successfully!');
        console.log('   TXID:', tx.getId());
        console.log('   Size:', tx.virtualSize(), 'vB');
        console.log('   Hex:', tx.toHex().substring(0, 100) + '...');
    } catch (extractError) {
        console.error('❌ Failed to extract transaction:', extractError.message);
    }
    
} catch (error) {
    console.error('❌ Error parsing PSBT:', error.message);
    process.exit(1);
}

