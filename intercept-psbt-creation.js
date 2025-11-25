import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

// Interceptar a função createCustomSellPsbt
import * as psbtBuilder from './server/utils/psbtBuilder.js';

const originalFunction = psbtBuilder.createCustomSellPsbt;

psbtBuilder.createCustomSellPsbt = function(...args) {
    console.log('\n🔍 ========== INTERCEPTED createCustomSellPsbt ==========');
    console.log('📥 Arguments:', JSON.stringify(args[0], null, 2));
    
    const result = originalFunction.apply(this, args);
    
    console.log('\n📤 PSBT Result (first 200 chars):', result.substring(0, 200));
    
    // Decodificar para ver estrutura
    try {
        const psbt = bitcoin.Psbt.fromBase64(result, { network: bitcoin.networks.bitcoin });
        console.log('\n📊 PSBT STRUCTURE:');
        console.log('   Inputs:', psbt.inputCount);
        console.log('   Outputs:', psbt.txOutputs.length);
        
        if (psbt.txOutputs.length > 0) {
            console.log('\n❌ OUTPUTS FOUND:');
            psbt.txOutputs.forEach((output, i) => {
                const address = bitcoin.address.fromOutputScript(output.script, bitcoin.networks.bitcoin);
                console.log(`   Output ${i}: ${output.value} sats → ${address}`);
            });
            console.log('\n🚨 THIS IS THE BUG! createCustomSellPsbt should return 0 outputs!');
        } else {
            console.log('   ✅ NO OUTPUTS (correct!)');
        }
    } catch (e) {
        console.error('   ❌ Error decoding PSBT:', e.message);
    }
    
    console.log('========================================================\n');
    
    return result;
};

console.log('✅ PSBT interceptor loaded!');
console.log('   Now start the server and create an offer...');
console.log('   The console will show EXACTLY what createCustomSellPsbt returns!\n');

