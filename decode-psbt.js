import bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

// PSBT base64 do log
const psbtBase64 = 'cHNidP8BAP0YAQIAAAADPnT2YSFMOEwwurAmKe7mhbU0lAMN9xnyL6PKq3cV5kIAAAAAAP/////top3z7JcsKgXxP+MLOdCW6AB1cb0c8DYwDjo/1fXIsQIAAAAA/////1nGI2d6iL1dEByInJcIO5A8DskXSscIby9ChCYPiX55AAAAAAD/////BAAAAAAAAAAACWpdwKIzA/QDASICAAAAAAAAIlEgQjH8RxrlTdrx75QffJKp2DVz2MWP19C5AJvjYTw2jM4iAgAAAAAAACJRIGCeppxaxVvhq3UTDHiKk0UQg3g2ubxdXatpe5Sel/2KHSMAAAAAAAAiUSBgnqacWsVb4at1Ewx4ipNFEIN4Nrm8XV2raXuUnpf9igAAAAAAAQErWAIAAAAAAAAiUSBgnqacWsVb4at1Ewx4ipNFEIN4Nrm8XV2raXuUnpf9igEXIGCeppxaxVvhq3UTDHiKk0UQg3g2ubxdXatpe5Sel/2KAAEBK30CAAAAAAAAIlEgYJ6mnFrFW+GrdRMMeIqTRRCDeDa5vF1dq2l7lJ6X/YoBFyBgnqacWsVb4at1Ewx4ipNFEIN4Nrm8XV2raXuUnpf9igABASsQJwAAAAAAACJRIGCeppxaxVvhq3UTDHiKk0UQg3g2ubxdXatpe5Sel/2KARcgYJ6mnFrFW+GrdRMMeIqTRRCDeDa5vF1dq2l7lJ6X/YoAAAAAAA==';

console.log('🔍 Decoding PSBT...\n');

try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    const network = bitcoin.networks.bitcoin;
    
    console.log('PSBT Inputs:', psbt.data.inputs.length);
    console.log('PSBT Outputs:', psbt.txOutputs.length);
    
    console.log('\n📥 INPUTS ANALYSIS:\n');
    
    psbt.data.inputs.forEach((input, i) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Input ${i}:`);
        
        if (input.witnessUtxo) {
            console.log(`  ✅ Witness UTXO present`);
            console.log(`  Value: ${input.witnessUtxo.value} sats`);
            console.log(`  Script: ${input.witnessUtxo.script.toString('hex')}`);
            
            // Tentar decodificar endereço
            try {
                const address = bitcoin.address.fromOutputScript(input.witnessUtxo.script, network);
                console.log(`  Address: ${address}`);
            } catch (e) {
                console.log(`  ⚠️  Cannot decode address: ${e.message}`);
            }
        } else {
            console.log(`  ❌ No witness UTXO!`);
        }
        
        if (input.tapInternalKey) {
            console.log(`  Tap Internal Key: ${input.tapInternalKey.toString('hex')}`);
        }
        
        console.log('');
    });
    
    console.log('\n📤 OUTPUTS ANALYSIS:\n');
    
    psbt.txOutputs.forEach((output, i) => {
        console.log(`Output ${i}:`);
        console.log(`  Value: ${output.value} sats`);
        console.log(`  Script: ${output.script.toString('hex')}`);
        
        try {
            const address = bitcoin.address.fromOutputScript(output.script, network);
            console.log(`  Address: ${address}`);
        } catch (e) {
            if (output.script[0] === 0x6a) {
                console.log(`  Type: OP_RETURN`);
            }
        }
        console.log('');
    });
    
    // Calcular totais
    let totalIn = 0;
    psbt.data.inputs.forEach(input => {
        if (input.witnessUtxo) {
            totalIn += input.witnessUtxo.value;
        }
    });
    
    let totalOut = 0;
    psbt.txOutputs.forEach(output => {
        totalOut += output.value;
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Total Input Value: ${totalIn} sats`);
    console.log(`Total Output Value: ${totalOut} sats`);
    console.log(`Fee: ${totalIn - totalOut} sats`);
    
} catch (error) {
    console.error('❌ Error decoding PSBT:', error.message);
    console.error(error.stack);
}

